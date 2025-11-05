// server.ts — Official SDK server wrapping your FastAPI sandbox
import express from "express";
import fetch from "node-fetch";
import { z } from "zod";
import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport }
  from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// === Config (reuse your FastAPI sandbox) ===
const BASE = process.env.SANDBOX_BASE ?? "http://localhost:8000";
const AUTH = process.env.SANDBOX_BEARER ?? ""; // e.g., "Bearer super-secret-poctoken"

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
    name: { type: "string" },
    servers: { type: "number", default: 1 },
    agents: { type: "number", default: 1 },
    ttl_minutes: { type: "number", default: 60 },
    owner: { type: "string", default: "you@example.com" },
  },
  required: ["name"],
}, async (args) => {
  const body = JSON.stringify(args);
  const out = await callREST("/create_sandbox", { method: "POST", body });
  return { content: [{ type: "text", text: JSON.stringify(out) }] };
});

mcp.tool("approve", "Approve a pending sandbox request", {
  type: "object",
  properties: {
    approval_id: { type: "string" },
    approver: { type: "string", default: "you@example.com" },
  },
  required: ["approval_id"],
}, async (args) => {
  const out = await callREST(
    `/approve?approval_id=${encodeURIComponent(args.approval_id)}&approver=${encodeURIComponent(args.approver ?? "you@example.com")}`,
    { method: "POST" }
  );
  return { content: [{ type: "text", text: JSON.stringify(out) }] };
});

mcp.tool("get_status", "Get sandbox status", {
  type: "object",
  properties: { sandbox_id: { type: "string" } },
  required: ["sandbox_id"],
}, async (args) => {
  const out = await callREST(`/get_sandbox_status/${encodeURIComponent(args.sandbox_id)}`);
  return { content: [{ type: "text", text: JSON.stringify(out) }] };
});

mcp.tool("get_kubeconfig", "Fetch kubeconfig for sandbox", {
  type: "object",
  properties: { sandbox_id: { type: "string" } },
  required: ["sandbox_id"],
}, async (args) => {
  const out = await callREST(`/get_kubeconfig/${encodeURIComponent(args.sandbox_id)}`);
  return { content: [{ type: "text", text: JSON.stringify(out) }] };
});

mcp.tool("run_test", "Run smoke test on sandbox", {
  type: "object",
  properties: {
    sandbox_id: { type: "string" },
    test_id: { type: "string", default: "smoke" },
  },
  required: ["sandbox_id"],
}, async (args) => {
  const body = JSON.stringify(args);
  const out = await callREST("/run_test", { method: "POST", body });
  return { content: [{ type: "text", text: JSON.stringify(out) }] };
});

mcp.tool("destroy_sandbox", "Destroy a sandbox cluster", {
  type: "object",
  properties: { sandbox_id: { type: "string" } },
  required: ["sandbox_id"],
}, async (args) => {
  const body = JSON.stringify(args);
  const out = await callREST("/destroy_sandbox", { method: "POST", body });
  return { content: [{ type: "text", text: JSON.stringify(out) }] };
});

// Express + streamable HTTP transport for SSE
const app = express();
const transport = new StreamableHTTPServerTransport(app);

// Connect MCP server to transport
await mcp.connect(transport);

// Set up SSE routes manually
app.get('/sse', (req, res) => transport.handleGetRequest(req, res));
app.post('/sse', express.json(), (req, res) => transport.handlePostRequest(req, res));

// Start the Express server
const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`✅ MCP server ready on http://localhost:${PORT}/sse`);
  console.log(`👉 Use MCP Inspector to connect to this SSE endpoint.`);
});
