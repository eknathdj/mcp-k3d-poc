// stdio-server.ts — MCP server using stdio transport for MCP Inspector
import fetch from "node-fetch";
import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// === Config (reuse your FastAPI sandbox) ===
const BASE = process.env.SANDBOX_BASE ?? "http://localhost:8000";
const AUTH = process.env.SANDBOX_BEARER ?? ""; // e.g., "Bearer super-secret-poctoken"

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

// Robust parameter extraction that handles MCP Inspector quirks
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
  name: "mcp-sandbox-proxy",
  version: "0.1.0",
  description: "MCP proxy for k3d sandbox PoC",
});

// === Define MCP tools ===
mcp.tool("create_sandbox", "Create ephemeral k3d sandbox", {
  type: "object",
  properties: {
    name: { 
      type: "string",
      description: "Name for the sandbox (required) - e.g. 'my-test-sandbox'"
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
      default: "you@example.com",
      description: "Owner email (default: you@example.com)"
    },
  },
  required: ["name"],
}, async (args) => {
  // Debug: Log what we received
  console.error("=== CREATE SANDBOX TOOL CALLED ===");
  console.error("Raw args received:", JSON.stringify(args, null, 2));
  console.error("Args keys:", Object.keys(args || {}));
  console.error("Name value:", args?.name);
  console.error("Name type:", typeof args?.name);
  
  // Handle MCP Inspector quirks - sometimes parameters come in different structures
  let name = args?.name;
  
  // If name is still missing, try to extract from different possible structures
  if (!name) {
    // Check if args is nested or has different structure
    if (args && typeof args === 'object') {
      // Try common alternative structures
      name = args.arguments?.name || args.params?.name || args.input?.name;
    }
  }
  
  // If still no name, provide a default with timestamp for testing
  if (!name || name.trim() === '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    name = `mcp-test-${timestamp}`;
    console.error(`No name provided, using default: ${name}`);
  }
  
  // Filter out MCP metadata and only keep the actual parameters
  const cleanArgs = {
    name: name,
    servers: args?.servers || 1,
    agents: args?.agents || 1,
    ttl_minutes: args?.ttl_minutes || 60,
    owner: args?.owner || "mcp-inspector@example.com"
  };
  
  console.error("Clean args to send:", JSON.stringify(cleanArgs, null, 2));
  
  try {
    const body = JSON.stringify(cleanArgs);
    const out = await callREST("/create_sandbox", { method: "POST", body });
    console.error("API response:", JSON.stringify(out, null, 2));
    
    // Store the last created sandbox info for other tools to use
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
      description: "Approval ID from create_sandbox response (leave empty to use last created)"
    },
    approver: { 
      type: "string", 
      default: "you@example.com",
      description: "Approver email address"
    },
  },
  required: [],
}, async (args) => {
  console.error("=== APPROVE TOOL CALLED ===");
  
  let approvalId = extractParam(args, "approval_id");
  const approver = extractParam(args, "approver", "mcp-inspector@example.com");
  
  // If no approval_id provided, use the last created sandbox
  if (!approvalId && lastCreatedSandbox) {
    approvalId = lastCreatedSandbox.approval_id;
    console.error(`Using last created approval_id: ${approvalId}`);
  }
  
  if (!approvalId) {
    throw new Error("No approval_id provided and no recent sandbox creation found. Please provide approval_id or create a sandbox first.");
  }
  
  console.error(`Approving with approval_id: ${approvalId}, approver: ${approver}`);
  
  const out = await callREST(
    `/approve?approval_id=${encodeURIComponent(approvalId)}&approver=${encodeURIComponent(approver)}`,
    { method: "POST" }
  );
  
  console.error("Approve response:", JSON.stringify(out, null, 2));
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

mcp.tool("get_status", "Get sandbox status", {
  type: "object",
  properties: { 
    sandbox_id: { 
      type: "string",
      description: "Sandbox ID (leave empty to use last created sandbox)"
    } 
  },
  required: [],
}, async (args) => {
  console.error("=== GET STATUS TOOL CALLED ===");
  
  let sandboxId = extractParam(args, "sandbox_id");
  
  // If no sandbox_id provided, use the last created sandbox
  if (!sandboxId && lastCreatedSandbox) {
    sandboxId = lastCreatedSandbox.sandbox_id;
    console.error(`Using last created sandbox_id: ${sandboxId}`);
  }
  
  if (!sandboxId) {
    throw new Error("No sandbox_id provided and no recent sandbox creation found. Please provide sandbox_id or create a sandbox first.");
  }
  
  console.error(`Getting status for sandbox_id: ${sandboxId}`);
  
  const out = await callREST(`/get_sandbox_status/${encodeURIComponent(sandboxId)}`);
  console.error("Status response:", JSON.stringify(out, null, 2));
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

mcp.tool("get_kubeconfig", "Fetch kubeconfig for sandbox", {
  type: "object",
  properties: { 
    sandbox_id: { 
      type: "string",
      description: "Sandbox ID (leave empty to use last created sandbox)"
    } 
  },
  required: [],
}, async (args) => {
  console.error("=== GET KUBECONFIG TOOL CALLED ===");
  
  let sandboxId = extractParam(args, "sandbox_id");
  
  // If no sandbox_id provided, use the last created sandbox
  if (!sandboxId && lastCreatedSandbox) {
    sandboxId = lastCreatedSandbox.sandbox_id;
    console.error(`Using last created sandbox_id: ${sandboxId}`);
  }
  
  if (!sandboxId) {
    throw new Error("No sandbox_id provided and no recent sandbox creation found. Please provide sandbox_id or create a sandbox first.");
  }
  
  console.error(`Getting kubeconfig for sandbox_id: ${sandboxId}`);
  
  const out = await callREST(`/get_kubeconfig/${encodeURIComponent(sandboxId)}`);
  console.error("Kubeconfig response size:", JSON.stringify(out).length);
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

mcp.tool("run_test", "Run smoke test on sandbox", {
  type: "object",
  properties: {
    sandbox_id: { 
      type: "string",
      description: "Sandbox ID (leave empty to use last created sandbox)"
    },
    test_id: { 
      type: "string", 
      default: "smoke",
      description: "Test type to run (default: smoke)"
    },
  },
  required: [],
}, async (args) => {
  console.error("=== RUN TEST TOOL CALLED ===");
  
  let sandboxId = extractParam(args, "sandbox_id");
  const testId = extractParam(args, "test_id", "smoke");
  
  // If no sandbox_id provided, use the last created sandbox
  if (!sandboxId && lastCreatedSandbox) {
    sandboxId = lastCreatedSandbox.sandbox_id;
    console.error(`Using last created sandbox_id: ${sandboxId}`);
  }
  
  if (!sandboxId) {
    throw new Error("No sandbox_id provided and no recent sandbox creation found. Please provide sandbox_id or create a sandbox first.");
  }
  
  const cleanArgs = {
    sandbox_id: sandboxId,
    test_id: testId
  };
  
  console.error(`Running test with args:`, JSON.stringify(cleanArgs, null, 2));
  
  const body = JSON.stringify(cleanArgs);
  const out = await callREST("/run_test", { method: "POST", body });
  console.error("Test response:", JSON.stringify(out, null, 2));
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

mcp.tool("destroy_sandbox", "Destroy a sandbox cluster", {
  type: "object",
  properties: { 
    sandbox_id: { 
      type: "string",
      description: "ID of the sandbox to destroy (leave empty to use last created sandbox)"
    } 
  },
  required: [],
}, async (args) => {
  console.error("=== DESTROY SANDBOX TOOL CALLED ===");
  
  let sandboxId = extractParam(args, "sandbox_id");
  
  // If no sandbox_id provided, use the last created sandbox
  if (!sandboxId && lastCreatedSandbox) {
    sandboxId = lastCreatedSandbox.sandbox_id;
    console.error(`Using last created sandbox_id: ${sandboxId}`);
  }
  
  if (!sandboxId) {
    throw new Error("No sandbox_id provided and no recent sandbox creation found. Please provide sandbox_id or create a sandbox first.");
  }
  
  console.error(`Destroying sandbox_id: ${sandboxId}`);
  
  // Use query parameter instead of request body for destroy endpoint
  const out = await callREST(`/destroy_sandbox?sandbox_id=${encodeURIComponent(sandboxId)}`, { method: "POST" });
  console.error("Destroy response:", JSON.stringify(out, null, 2));
  
  // Clear the last created sandbox if we just destroyed it
  if (lastCreatedSandbox && lastCreatedSandbox.sandbox_id === sandboxId) {
    lastCreatedSandbox = null;
    console.error("Cleared last created sandbox reference");
  }
  
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

mcp.tool("list_active", "List all active sandboxes", {
  type: "object",
  properties: {},
  required: [],
}, async (args) => {
  console.error("=== LIST ACTIVE TOOL CALLED ===");
  
  const out = await callREST("/list_active_sandboxes");
  console.error("List active response:", JSON.stringify(out, null, 2));
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

// Use stdio transport for MCP Inspector
const transport = new StdioServerTransport();
await mcp.connect(transport);

console.error("MCP server running on stdio");