import { MCPClient } from "mcp-use";

async function main() {
  const client = new MCPClient({
    mcpServers: { sandbox: { url: "http://localhost:3000/sse" } },
  });
  await client.createAllSessions();
  const s = client.getSession("sandbox");
  const create = await s.callTool("create_sandbox", { name: "cli-demo" });
  console.log(create);
  await client.closeAllSessions();
}
main();
