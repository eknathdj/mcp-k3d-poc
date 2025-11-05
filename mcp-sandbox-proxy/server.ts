import { createMCPServer } from "mcp-use/server";
import { z } from "zod";
import fetch from "node-fetch";

const BASE = process.env.SANDBOX_BASE ?? "http://localhost:8000";
const AUTH = process.env.SANDBOX_BEARER ?? "";

async function callREST(path, init = {}) {
  const headers = { "Content-Type": "application/json", ...(init.headers || {}) };
  if (AUTH) headers["Authorization"] = AUTH;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const server = createMCPServer("mcp-sandbox-proxy", {
  version: "0.1.0",
  description: "MCP wrapper for k3d sandbox PoC",
});

server.tool("create_sandbox", {
  description: "Create sandbox",
  parameters: z.object({
    name: z.string(),
    servers: z.number().default(1),
    agents: z.number().default(1),
    ttl_minutes: z.number().default(60),
    owner: z.string().default("you@example.com"),
  }),
  execute: (p) => callREST("/create_sandbox", { method: "POST", body: JSON.stringify(p) }),
});

server.tool("approve", {
  description: "Approve sandbox",
  parameters: z.object({
    approval_id: z.string(),
    approver: z.string().default("you@example.com"),
  }),
  execute: (p) =>
    callREST(`/approve?approval_id=${encodeURIComponent(p.approval_id)}&approver=${encodeURIComponent(p.approver)}`, { method: "POST" }),
});

server.tool("get_status", {
  description: "Get status",
  parameters: z.object({ sandbox_id: z.string() }),
  execute: (p) => callREST(`/get_sandbox_status/${encodeURIComponent(p.sandbox_id)}`),
});

server.tool("get_kubeconfig", {
  description: "Get kubeconfig",
  parameters: z.object({ sandbox_id: z.string() }),
  execute: (p) => callREST(`/get_kubeconfig/${encodeURIComponent(p.sandbox_id)}`),
});

server.tool("run_test", {
  description: "Run test",
  parameters: z.object({ sandbox_id: z.string(), test_id: z.string().default("smoke") }),
  execute: (p) => callREST("/run_test", { method: "POST", body: JSON.stringify(p) }),
});

server.tool("destroy_sandbox", {
  description: "Destroy sandbox",
  parameters: z.object({ sandbox_id: z.string() }),
  execute: (p) => callREST("/destroy_sandbox", { method: "POST", body: JSON.stringify(p) }),
});

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT);
console.log(`MCP server running: http://localhost:${PORT}/inspector`);
