# Curl examples for MCP PoC

1. Fetch manifest
```bash
curl http://localhost:8000/.well-known/mcp-manifest
```

2. Create sandbox (returns sandbox_id and approval_id)
```bash
curl -X POST "http://localhost:8000/create_sandbox" -H "Content-Type: application/json" -d @examples/sample_spec.json
```

3. Approve (use the approval_id returned)
```bash
curl -X POST "http://localhost:8000/approve?approval_id=<approval_id>&approver=you@example.com"
```

4. Poll status until ACTIVE
```bash
curl "http://localhost:8000/get_sandbox_status/<sandbox_id>"
```

5. Get kubeconfig (returns kubeconfig content in JSON)
```bash
curl "http://localhost:8000/get_kubeconfig/<sandbox_id>" | jq -r .kubeconfig > kubeconfig-<id>
export KUBECONFIG=$(pwd)/kubeconfig-<id>
kubectl get nodes
```

6. Run smoke test
```bash
curl -X POST "http://localhost:8000/run_test" -H "Content-Type: application/json" -d '{"sandbox_id":"<id>","test_id":"smoke"}'
```

7. Destroy sandbox
```bash
curl -X POST "http://localhost:8000/destroy_sandbox" -H "Content-Type: application/json" -d '{"sandbox_id":"<id>"}'
```
