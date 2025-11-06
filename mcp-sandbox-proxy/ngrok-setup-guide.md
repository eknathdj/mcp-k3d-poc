# 🌐 ngrok Setup Guide for MCP SSE Server

## Quick Setup (3 Steps)

### Step 1: Install ngrok
```bash
# Option A: Chocolatey (Windows)
choco install ngrok

# Option B: Download from https://ngrok.com/download
```

### Step 2: Authenticate (One-time setup)
```bash
# Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken
ngrok authtoken YOUR_TOKEN_HERE
```

### Step 3: Run the Services

#### Terminal 1: Start SSE Server
```bash
cd mcp-sandbox-proxy
node sse-server.ts
```
**Output**: `🚀 MCP SSE server ready on http://localhost:3001/sse`

#### Terminal 2: Start ngrok
```bash
ngrok http 3001
```
**Output**: 
```
Session Status    online
Account           your-email@example.com
Version           3.x.x
Region            United States (us)
Latency           -
Web Interface     http://127.0.0.1:4040
Forwarding        https://abc123.ngrok.io -> http://localhost:3001
```

### Step 4: Use in MCP Inspector
- **Transport Type**: `SSE`
- **URL**: `https://abc123.ngrok.io/sse` (copy from ngrok output)

## 🔧 Complete Example

### Current Working Setup (STDIO)
```
MCP Inspector -> STDIO -> stdio-server.ts -> FastAPI (localhost:8000)
```

### New Remote Setup (SSE + ngrok)
```
MCP Inspector -> HTTPS -> ngrok -> sse-server.ts -> FastAPI (localhost:8000)
```

## 🎯 When to Use Each

### Use STDIO (Current) When:
- ✅ Local testing (what you're doing now)
- ✅ Simple setup
- ✅ No remote access needed

### Use SSE + ngrok When:
- ✅ Demo to others remotely
- ✅ Access from different machines
- ✅ Testing mobile MCP clients
- ✅ Sharing with team members

## 🛡️ Security Notes

### ngrok Free Account:
- ✅ HTTPS encryption
- ✅ Temporary URLs (expire when stopped)
- ⚠️ Public internet access
- ⚠️ Rate limits

### For Production:
- Use ngrok paid plans for custom domains
- Add authentication to your MCP server
- Monitor access via ngrok dashboard

## 🚀 Testing Both Options

You now have both options available:

### Option 1: STDIO (Keep using this - it works perfectly!)
```bash
npx @modelcontextprotocol/inspector node stdio-server.ts
```

### Option 2: SSE + ngrok (For remote access)
```bash
# Terminal 1
node sse-server.ts

# Terminal 2  
ngrok http 3001

# Use https://your-url.ngrok.io/sse in MCP Inspector with SSE transport
```

Both servers have the same bulletproof functionality - the only difference is how you connect to them!