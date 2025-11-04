import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess, uuid, os, datetime, sqlite3, threading, json
from prometheus_client import Counter, generate_latest, REGISTRY

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "mcp.db")
KUBECONFIG_DIR = os.path.join(BASE_DIR, "kubeconfigs")
os.makedirs(KUBECONFIG_DIR, exist_ok=True)

# Clear registry to avoid duplication on reloads
if 'mcp_create_requests_total' in REGISTRY._names_to_collectors:
    REGISTRY.unregister(REGISTRY._names_to_collectors['mcp_create_requests_total'])
create_counter = Counter('mcp_create_requests_total', 'Total create requests')

app = FastAPI(title="MCP k3d Sandbox PoC")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS sandboxes
                 (id TEXT PRIMARY KEY, name TEXT, status TEXT, created_at TEXT, expires_at TEXT, kubeconfig_path TEXT, owner TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS approvals
                 (id TEXT PRIMARY KEY, sandbox_id TEXT, approved INTEGER, approver TEXT, created_at TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS audit
                 (id TEXT PRIMARY KEY, timestamp TEXT, requester TEXT, action TEXT, inputs TEXT, result TEXT)""")
    conn.commit()
    conn.close()

init_db()

class CreateSpec(BaseModel):
    name: str
    servers: int = 1
    agents: int = 1
    ttl_minutes: int = 60
    owner: str = "unknown"

def write_audit(requester, action, inputs, result):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    aid = str(uuid.uuid4())
    c.execute("INSERT INTO audit VALUES (?,?,?,?,?,?)", (aid, datetime.datetime.utcnow().isoformat(), requester, action, json.dumps(inputs), json.dumps(result)))
    conn.commit()
    conn.close()

@app.get("/.well-known/mcp-manifest")
def manifest():
    p = os.path.join(BASE_DIR, "mcp_manifest.json")
    if not os.path.exists(p):
        raise HTTPException(status_code=404, detail="manifest not found")
    with open(p) as f:
        return json.load(f)

@app.post("/create_sandbox")
def create_sandbox(spec: CreateSpec):
    create_counter.inc()
    sandbox_id = str(uuid.uuid4())
    expires_at = (datetime.datetime.utcnow() + datetime.timedelta(minutes=spec.ttl_minutes)).isoformat()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO sandboxes VALUES (?,?,?,?,?,?,?)",
              (sandbox_id, spec.name, "PENDING_APPROVAL", datetime.datetime.utcnow().isoformat(), expires_at, "", spec.owner))
    conn.commit()
    conn.close()
    approval_id = str(uuid.uuid4())
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO approvals VALUES (?,?,?,?,?)",
              (approval_id, sandbox_id, 0, "", datetime.datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    write_audit(spec.owner, "create_sandbox", spec.dict(), {"sandbox_id": sandbox_id, "approval_id": approval_id, "status": "PENDING_APPROVAL"})
    return {"sandbox_id": sandbox_id, "approval_id": approval_id, "status": "PENDING_APPROVAL"}

@app.post("/approve")
def approve(approval_id: str, approver: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT sandbox_id FROM approvals WHERE id=?", (approval_id,))
    row = c.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="approval not found")
    sandbox_id = row[0]
    c.execute("UPDATE approvals SET approved=1, approver=? WHERE id=?", (approver, approval_id))
    c.execute("UPDATE sandboxes SET status='CREATING' WHERE id=?", (sandbox_id,))
    conn.commit()
    conn.close()
    write_audit(approver, "approve", {"approval_id": approval_id}, {"sandbox_id": sandbox_id, "status": "APPROVED"})
    threading.Thread(target=provision_sandbox, args=(sandbox_id,)).start()
    return {"status": "APPROVED", "sandbox_id": sandbox_id}

def run_command(cmd_list, capture_output=True):
    try:
        proc = subprocess.run(cmd_list, capture_output=capture_output, text=True, check=False)
        return proc.returncode, proc.stdout, proc.stderr
    except Exception as e:
        return 1, "", str(e)

def provision_sandbox(sandbox_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT name FROM sandboxes WHERE id=?", (sandbox_id,))
    row = c.fetchone()
    if not row:
        return
    name = row[0]
    cluster_name = f"sandbox-{sandbox_id[:8]}"
    cmd = ["k3d", "cluster", "create", cluster_name, "--servers", "1", "--agents", "1", "--wait"]
    rc, out, err = run_command(cmd)
    if rc != 0:
        c.execute("UPDATE sandboxes SET status='FAILED' WHERE id=?", (sandbox_id,))
        conn.commit()
        conn.close()
        write_audit("system", "provision", {"cluster": cluster_name}, {"rc": rc, "out": out, "err": err})
        return
    kube_path = os.path.join(KUBECONFIG_DIR, f"kubeconfig-{cluster_name}")
    rc, out, err = run_command(["k3d", "kubeconfig", "get", cluster_name])
    kube_content = out if rc == 0 else ""
    try:
        with open(kube_path, "w") as f:
            f.write(kube_content)
        os.chmod(kube_path, 0o600)
    except Exception:
        pass
    c.execute("UPDATE sandboxes SET status='ACTIVE', kubeconfig_path=? WHERE id=?", (kube_path, sandbox_id))
    conn.commit()
    conn.close()
    write_audit("system", "provision_complete", {"cluster": cluster_name}, {"kubeconfig_path": kube_path})

@app.get("/get_sandbox_status/{sandbox_id}")
def get_status(sandbox_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id,name,status,created_at,expires_at FROM sandboxes WHERE id=?", (sandbox_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="sandbox not found")
    return {"id":row[0], "name":row[1], "status":row[2], "created_at":row[3], "expires_at":row[4]}

@app.get("/get_kubeconfig/{sandbox_id}")
def get_kubeconfig(sandbox_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT kubeconfig_path FROM sandboxes WHERE id=?", (sandbox_id,))
    row = c.fetchone()
    conn.close()
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="kubeconfig not available")
    path = row[0]
    with open(path) as f:
        content = f.read()
    write_audit("user", "get_kubeconfig", {"sandbox_id": sandbox_id}, {"size": len(content)})
    return {"kubeconfig": content}

class RunTestSpec(BaseModel):
    sandbox_id: str
    test_id: str = "smoke"

@app.post("/run_test")
def run_test(spec: RunTestSpec):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT kubeconfig_path FROM sandboxes WHERE id=?", (spec.sandbox_id,))
    row = c.fetchone()
    conn.close()
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="sandbox or kubeconfig not found")
    kube_path = row[0]
    cmd = ["bash", os.path.join(os.path.dirname(BASE_DIR), "scripts", "run_demo_test.sh"), kube_path]
    rc, out, err = run_command(cmd)
    result = {"rc": rc, "out": out, "err": err}
    write_audit("user", "run_test", spec.dict(), result)
    return result

@app.post("/destroy_sandbox")
def destroy_sandbox(sandbox_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT kubeconfig_path,status FROM sandboxes WHERE id=?", (sandbox_id,))
    row = c.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="sandbox not found")
    status = row[1]
    if status not in ("ACTIVE","FAILED"):
        raise HTTPException(status_code=400, detail=f"cannot destroy sandbox in state {status}")
    c.execute("UPDATE sandboxes SET status='DESTROYING' WHERE id=?", (sandbox_id,))
    conn.commit()
    conn.close()
    threading.Thread(target=provision_delete, args=(sandbox_id,)).start()
    write_audit("user", "destroy_request", {"sandbox_id": sandbox_id}, {"status": "DESTROYING"})
    return {"status": "DESTROYING"}

def provision_delete(sandbox_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT kubeconfig_path FROM sandboxes WHERE id=?", (sandbox_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return
    kube_path = row[0]
    cluster_name = None
    if kube_path:
        bn = os.path.basename(kube_path)
        if bn.startswith("kubeconfig-"):
            cluster_name = bn.replace("kubeconfig-","")
    if cluster_name:
        run_command(["k3d", "cluster", "delete", cluster_name])
    try:
        if kube_path and os.path.exists(kube_path):
            os.remove(kube_path)
    except:
        pass
    c.execute("UPDATE sandboxes SET status='DESTROYED' WHERE id=?", (sandbox_id,))
    conn.commit()
    conn.close()
    write_audit("system", "destroy_complete", {"sandbox_id": sandbox_id}, {"cluster_deleted": bool(cluster_name)})

@app.get("/metrics")
def metrics():
    return generate_latest()

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000)
