// Test MCP protocol directly with our SSE server
import fetch from "node-fetch";

const SSE_URL = "http://localhost:3001/sse";

async function testMCPProtocol() {
  console.log("🔌 Testing MCP protocol with SSE server...\n");
  
  try {
    // Test 1: Initialize request (what MCP Inspector sends)
    console.log("📡 Test 1: Sending MCP initialize request...");
    const initRequest = {
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        }
      },
      id: 1
    };
    
    const response = await fetch(SSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(initRequest)
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers));
    
    if (response.ok) {
      const result = await response.json();
      console.log("✅ Initialize response:", JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.log("❌ Initialize failed:", errorText);
    }
    
    // Test 2: List tools request
    console.log("\n📡 Test 2: Sending list tools request...");
    const toolsRequest = {
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
      id: 2
    };
    
    const toolsResponse = await fetch(SSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(toolsRequest)
    });
    
    console.log(`Tools response status: ${toolsResponse.status}`);
    
    if (toolsResponse.ok) {
      const toolsResult = await toolsResponse.json();
      console.log("✅ Tools list response:", JSON.stringify(toolsResult, null, 2));
    } else {
      const toolsError = await toolsResponse.text();
      console.log("❌ Tools list failed:", toolsError);
    }
    
  } catch (error) {
    console.error("❌ MCP protocol test failed:", error.message);
  }
}

testMCPProtocol();