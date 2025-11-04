import uuid, sqlite3, os, datetime
BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "mcp.db")
APPROVERS = ["you@example.com", "eknath789@gmail.com"]

def create_approval(sandbox_id):
    aid = str(uuid.uuid4())
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO approvals VALUES (?,?,?,?,?)", (aid, sandbox_id, 0, "", datetime.datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    return aid

def approve(aid, approver):
    if approver not in APPROVERS:
        raise Exception("approver not allowed (PoC)")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE approvals SET approved=1, approver=? WHERE id=?", (approver, aid))
    conn.commit()
    conn.close()
    return True
