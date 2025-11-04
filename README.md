# mcp-k3d-poc — MCP server PoC (k3d sandboxes)

This PoC implements a minimal MCP-style server that provisions ephemeral k3d Kubernetes sandboxes, returns kubeconfigs, runs smoke tests, and destroys clusters. It is intended as a learning/demo project.

## Prerequisites
- Docker running locally
- k3d installed
- kubectl installed
- Python 3.9+ and pip
- (Optional) `jq` for JSON parsing in examples

## Quickstart
1. Create a Python virtualenv and install deps:
```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start the MCP server:
```bash
uvicorn app:app --reload --port 8000
```

3. Create sandbox:
```bash
curl -X POST "http://localhost:8000/create_sandbox" -H "Content-Type: application/json" -d @examples/sample_spec.json
# copy approval_id from response
```

4. Approve:
```bash
curl -X POST "http://localhost:8000/approve?approval_id=<approval_id>&approver=you@example.com"
```

5. Poll status and when ACTIVE, retrieve kubeconfig:
```bash
curl "http://localhost:8000/get_sandbox_status/<sandbox_id>"
curl "http://localhost:8000/get_kubeconfig/<sandbox_id>" | jq -r .kubeconfig > kubeconfig-<id>
export KUBECONFIG=$(pwd)/kubeconfig-<id>
kubectl get nodes
```

6. Run smoke test:
```bash
curl -X POST "http://localhost:8000/run_test" -H "Content-Type: application/json" -d '{"sandbox_id":"<id>","test_id":"smoke"}'
```

7. Destroy:
```bash
curl -X POST "http://localhost:8000/destroy_sandbox" -H "Content-Type: application/json" -d '{"sandbox_id":"<id>"}'
```

## Notes & next steps
- This PoC is intentionally simple. For production: use Vault for kubeconfigs, OIDC for authentication, Postgres for DB, and robust subprocess handling.
- The server writes kubeconfigs to `server/kubeconfigs/` and uses a SQLite DB (`server/mcp.db`).
