# MCP k3d Sandbox PoC

A simple MCP (Model Context Protocol) server that provisions ephemeral Kubernetes sandboxes using k3d for testing and development purposes.

## What is this?

This project provides an easy way to create isolated Kubernetes environments (sandboxes) for testing applications, running experiments, or learning Kubernetes. Each sandbox is a complete k3d cluster with configurable nodes that can be created, used, and destroyed through a simple REST API.

## Features

- 🚀 **Quick Sandbox Creation**: Create Kubernetes sandboxes with custom server/agent configurations
- 🔒 **Approval Workflow**: Built-in approval system for sandbox creation
- 🧪 **Smoke Testing**: Run automated tests on sandboxes
- 📊 **Monitoring**: Prometheus metrics and audit logging
- 🧹 **Auto Cleanup**: TTL-based automatic destruction
- 🛠️ **PowerShell Automation**: Ready-to-use scripts for Windows users

## Prerequisites

### Required Software
- **Docker Desktop**: Running locally with sufficient resources
- **k3d**: Kubernetes in Docker - `choco install k3d` (Windows) or follow [k3d installation guide](https://k3d.io/v5.6.0/#installation)
- **kubectl**: Kubernetes CLI tool
- **Python 3.9+**: With pip package manager

### Optional Tools
- **jq**: For JSON processing in bash scripts
- **PowerShell 5.1+**: For automated scripts (Windows)

## Quick Start

### 1. Setup the Server

```bash
# Clone the repository
git clone <repository-url>
cd mcp-k3d-poc

# Setup Python environment
cd server
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Start the MCP Server

```bash
# Start the server (will run on http://localhost:8000)
uvicorn app:app --reload --port 8000
```

### 3. Create Your First Sandbox

#### Option A: Using PowerShell Script (Recommended for Windows)

```powershell
# This script will create, approve, test, and verify a sandbox automatically
.\create_approve_test.ps1
```

#### Option B: Manual API Calls

```bash
# Create a sandbox
curl -X POST "http://localhost:8000/create_sandbox" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-test-sandbox", "servers": 1, "agents": 1, "ttl_minutes": 60}'

# Note the sandbox_id and approval_id from the response
```

```bash
# Approve the sandbox creation
curl -X POST "http://localhost:8000/approve?approval_id=<approval_id>&approver=your-email@example.com"
```

```bash
# Check status until it's ACTIVE
curl "http://localhost:8000/get_sandbox_status/<sandbox_id>"
```

### 4. Use Your Sandbox

```bash
# Get kubeconfig
curl "http://localhost:8000/get_kubeconfig/<sandbox_id>" | jq -r .kubeconfig > kubeconfig.yaml

# Use kubectl with the sandbox
export KUBECONFIG=./kubeconfig.yaml
kubectl get nodes
kubectl get pods -A
```

### 5. Run Tests

```bash
# Run smoke test
curl -X POST "http://localhost:8000/run_test" \
  -H "Content-Type: application/json" \
  -d '{"sandbox_id": "<sandbox_id>", "test_id": "smoke"}'
```

### 6. Cleanup

#### Option A: Using PowerShell Script
```powershell
# Destroys the latest active sandbox
.\destroy_latest.ps1
```

#### Option B: Manual API Call
```bash
# Destroy the sandbox
curl -X POST "http://localhost:8000/destroy_sandbox?sandbox_id=<sandbox_id>" \
  -H "Content-Type: application/json"
```

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/.well-known/mcp-manifest` | Get MCP manifest |
| POST | `/create_sandbox` | Create a new sandbox |
| POST | `/approve` | Approve sandbox creation |
| GET | `/get_sandbox_status/{sandbox_id}` | Get sandbox status |
| GET | `/get_kubeconfig/{sandbox_id}` | Get kubeconfig for sandbox |
| POST | `/run_test` | Run tests on sandbox |
| POST | `/destroy_sandbox` | Destroy sandbox |
| GET | `/list_active_sandboxes` | List all active sandboxes |
| GET | `/metrics` | Prometheus metrics |

### Sandbox Configuration

```json
{
  "name": "my-sandbox",
  "servers": 1,
  "agents": 1,
  "ttl_minutes": 60,
  "owner": "your-email@example.com"
}
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PowerShell    │    │   MCP Server    │    │      k3d        │
│   Scripts       │───▶│   (FastAPI)     │───▶│   Clusters      │
│                 │    │                 │    │                 │
│ • create_approve│    │ • Sandbox Mgmt  │    │ • Ephemeral K8s │
│   _test.ps1     │    │ • Approval Flow  │    │ • Auto Cleanup  │
│ • destroy_latest│    │ • Kubeconfig    │    │                 │
│   .ps1         │    │ • Testing        │    └─────────────────┘
└─────────────────┘    │ • Metrics       │
                       │ • Audit Log     │
                       └─────────────────┘
```

## File Structure

```
mcp-k3d-poc/
├── server/                    # MCP server code
│   ├── app.py                # Main FastAPI application
│   ├── requirements.txt      # Python dependencies
│   ├── mcp_manifest.json     # MCP manifest
│   ├── mcp.db               # SQLite database (auto-created)
│   └── kubeconfigs/         # Stored kubeconfigs
├── scripts/                  # Bash automation scripts
│   ├── create_demo_cluster.sh
│   └── run_demo_test.sh
├── examples/                 # Example API calls
│   ├── curl_examples.md
│   └── sample_spec.json
├── create_approve_test.ps1   # PowerShell: Create & test sandbox
├── destroy_latest.ps1        # PowerShell: Destroy latest sandbox
└── README.md
```

## Troubleshooting

### Common Issues

1. **kubectl connection fails**
   - Ensure Docker Desktop is running
   - Check that the sandbox is in ACTIVE status
   - Verify kubeconfig was downloaded correctly

2. **Port conflicts**
   - k3d uses random ports; check `k3d cluster list` for actual ports

3. **Permission denied on kubeconfig**
   - The server sets appropriate file permissions automatically

### Logs and Debugging

- Server logs appear in the terminal where uvicorn is running
- Check `server/mcp.db` for sandbox status
- Use `k3d cluster list` to see running clusters
- Check `kubectl config view` for current configuration

## Development

### Adding New Tests

Tests are defined in `scripts/run_demo_test.sh`. To add new test types:

1. Modify the test script to accept different `test_id` values
2. Update the API to handle new test types
3. Add test logic in the bash script

### Extending the API

The server is built with FastAPI. Add new endpoints in `server/app.py`:

```python
@app.post("/new_endpoint")
def new_endpoint(data: SomeModel):
    # Your logic here
    return {"result": "success"}
```

## Security Considerations

This is a proof-of-concept implementation. For production use:

- **Authentication**: Add proper user authentication and authorization
- **Encryption**: Store kubeconfigs in a secure vault (e.g., HashiCorp Vault)
- **Database**: Replace SQLite with PostgreSQL
- **TLS**: Enable HTTPS for all API endpoints
- **RBAC**: Implement role-based access control
- **Auditing**: Enhanced audit logging and monitoring
- **Resource Limits**: Add quotas and resource constraints

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
