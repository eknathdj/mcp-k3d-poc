// sse-server.ts — MCP server using SSE transport for remote access via ngrok
import express from "express";
import fetch from "node-fetch";
import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// === Config ===
const BASE = process.env.SANDBOX_BASE ?? "http://localhost:8000";
const AUTH = process.env.SANDBOX_BEARER ?? "";
const PORT = Number(process.env.MCP_PORT ?? 3001);

// Global state to store sandbox info for cross-tool usage
let lastCreatedSandbox: { sandbox_id: string; approval_id: string } | null = null;

// Helper to call FastAPI
async function callREST(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (AUTH) headers["Authorization"] = AUTH;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${path}: ${text}`);
  }
  return res.json();
}

// Robust parameter extraction
function extractParam(args: any, paramName: string, fallback?: any): any {
  console.error(`Extracting param '${paramName}' from:`, JSON.stringify(args, null, 2));
  
  if (!args) return fallback;
  
  // Direct access
  if (args[paramName] !== undefined && args[paramName] !== null && args[paramName] !== '') {
    console.error(`Found ${paramName} directly:`, args[paramName]);
    return args[paramName];
  }
  
  // Try nested structures
  const nestedPaths = [
    args.arguments?.[paramName],
    args.params?.[paramName], 
    args.input?.[paramName],
    args.data?.[paramName]
  ];
  
  for (const value of nestedPaths) {
    if (value !== undefined && value !== null && value !== '') {
      console.error(`Found ${paramName} in nested structure:`, value);
      return value;
    }
  }
  
  console.error(`Param '${paramName}' not found, using fallback:`, fallback);
  return fallback;
}

// === Wire up SDK server ===
const mcp = new McpServer({
  name: "mcp-sandbox-sse",
  version: "0.1.0",
  description: "MCP proxy for k3d sandbox PoC (SSE Transport)",
});

// === Define MCP tools (same as STDIO version) ===
mcp.tool("create_sandbox", "Create ephemeral k3d sandbox", {
  type: "object",
  properties: {
    name: { 
      type: "string",
      description: "Name for the sandbox (leave empty for auto-generation)"
    },
    servers: { 
      type: "number", 
      default: 1,
      description: "Number of server nodes (default: 1)"
    },
    agents: { 
      type: "number", 
      default: 1,
      description: "Number of agent nodes (default: 1)"
    },
    ttl_minutes: { 
      type: "number", 
      default: 60,
      description: "Time to live in minutes (default: 60)"
    },
    owner: { 
      type: "string", 
      default: "sse@example.com",
      description: "Owner email"
    },
  },
  required: [],
}, async (args) => {
  console.error("=== CREATE SANDBOX TOOL CALLED (SSE) ===");
  
  let name = extractParam(args, "name");
  
  if (!name || name.trim() === '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    name = `sse-sandbox-${timestamp}`;
    console.error(`No name provided, using default: ${name}`);
  }
  
  const cleanArgs = {
    name: name,
    servers: extractParam(args, "servers", 1),
    agents: extractParam(args, "agents", 1),
    ttl_minutes: extractParam(args, "ttl_minutes", 60),
    owner: extractParam(args, "owner", "sse@example.com")
  };
  
  console.error("Clean args to send:", JSON.stringify(cleanArgs, null, 2));
  
  try {
    const body = JSON.stringify(cleanArgs);
    const out = await callREST("/create_sandbox", { method: "POST", body });
    console.error("API response:", JSON.stringify(out, null, 2));
    
    // Store the last created sandbox info
    if (out.sandbox_id && out.approval_id) {
      lastCreatedSandbox = {
        sandbox_id: out.sandbox_id,
        approval_id: out.approval_id
      };
      console.error("Stored last created sandbox:", lastCreatedSandbox);
    }
    
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  } catch (error) {
    console.error("API call failed:", error.message);
    throw error;
  }
});

mcp.tool("approve", "Approve a pending sandbox request", {
  type: "object",
  properties: {
    approval_id: { 
      type: "string",
      description: "Approval ID (leave empty to use last created)"
    },
    approver: { 
      type: "string", 
      default: "sse@example.com",
      description: "Approver email"
    },
  },
  required: [],
}, async (args) => {
  console.error("=== APPROVE TOOL CALLED (SSE) ===");
  
  let approvalId = extractParam(args, "approval_id");
  const approver = extractParam(args, "approver", "sse@example.com");
  
  if (!approvalId && lastCreatedSandbox) {
    approvalId = lastCreatedSandbox.approval_id;
    console.error(`Using last created approval_id: ${approvalId}`);
  }
  
  if (!approvalId) {
    throw new Error("No approval_id provided and no recent sandbox creation found.");
  }
  
  const out = await callREST(
    `/approve?approval_id=${encodeURIComponent(approvalId)}&approver=${encodeURIComponent(approver)}`,
    { method: "POST" }
  );
  
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

mcp.tool("get_status", "Get sandbox status", {
  type: "object",
  properties: { 
    sandbox_id: { 
      type: "string",
      description: "Sandbox ID (leave empty to use last created)"
    } 
  },
  required: [],
}, async (args) => {
  let sandboxId = extractParam(args, "sandbox_id");
  
  if (!sandboxId && lastCreatedSandbox) {
    sandboxId = lastCreatedSandbox.sandbox_id;
  }
  
  if (!sandboxId) {
    throw new Error("No sandbox_id provided and no recent sandbox creation found.");
  }
  
  const out = await callREST(`/get_sandbox_status/${encodeURIComponent(sandboxId)}`);
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

mcp.tool("destroy_sandbox", "Destroy a sandbox cluster", {
  type: "object",
  properties: { 
    sandbox_id: { 
      type: "string",
      description: "Sandbox ID (leave empty to use last created)"
    } 
  },
  required: [],
}, async (args) => {
  let sandboxId = extractParam(args, "sandbox_id");
  
  if (!sandboxId && lastCreatedSandbox) {
    sandboxId = lastCreatedSandbox.sandbox_id;
  }
  
  if (!sandboxId) {
    throw new Error("No sandbox_id provided and no recent sandbox creation found.");
  }
  
  const out = await callREST(`/destroy_sandbox?sandbox_id=${encodeURIComponent(sandboxId)}`, { method: "POST" });
  
  // Clear the last created sandbox if we just destroyed it
  if (lastCreatedSandbox && lastCreatedSandbox.sandbox_id === sandboxId) {
    lastCreatedSandbox = null;
  }
  
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

mcp.tool("list_active", "List all active sandboxes", {
  type: "object",
  properties: {},
  required: [],
}, async (args) => {
  const out = await callREST("/list_active_sandboxes");
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

// === Express + SSE Setup ===
const app = express();

// Enhanced CORS middleware for ngrok and remote access
app.use((req, res, next) => {
  // Allow all origins for development
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning, Cache-Control');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Add ngrok-specific headers to bypass browser warning
app.use((req, res, next) => {
  // Log all requests for debugging
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
  
  // Set headers to bypass ngrok browser warning
  res.header('ngrok-skip-browser-warning', 'true');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    transport: 'sse',
    timestamp: new Date().toISOString(),
    lastCreatedSandbox: lastCreatedSandbox,
    ngrokUrl: 'https://4e79a3946546.ngrok-free.app'
  });
});

// Test endpoint for MCP Inspector connectivity
app.get('/test-connection', (req, res) => {
  console.log('Test connection endpoint hit');
  res.json({
    message: 'MCP SSE server is reachable via ngrok',
    timestamp: new Date().toISOString(),
    headers: req.headers,
    method: req.method,
    url: req.url
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'MCP SSE Server',
    endpoints: {
      health: '/health',
      sse: '/sse',
      test: '/test-connection'
    },
    ngrokUrl: 'https://4e79a3946546.ngrok-free.app/sse'
  });
});

// Create transport
const transport = new StreamableHTTPServerTransport(app);

// Connect MCP server to transport
await mcp.connect(transport);

// Enhanced SSE routes with debugging
app.get('/sse', (req, res) => {
  console.log('SSE GET request received:', {
    headers: req.headers,
    query: req.query,
    url: req.url
  });
  transport.handleGetRequest(req, res);
});

app.post('/sse', express.json(), (req, res) => {
  console.log('SSE POST request received:', {
    headers: req.headers,
    body: req.body,
    url: req.url
  });
  transport.handlePostRequest(req, res);
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 MCP SSE server ready on http://localhost:${PORT}/sse`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 For ngrok: ngrok http ${PORT}`);
  console.log(`🔗 Then use: https://your-ngrok-url.ngrok.io/sse in MCP Inspector`);
});