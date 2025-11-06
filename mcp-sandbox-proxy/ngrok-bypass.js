// Test ngrok connection with proper headers to bypass browser warning
import fetch from "node-fetch";

const NGROK_URL = "https://4e79a3946546.ngrok-free.app";

async function testNgrokBypass() {
  console.log("🌐 Testing ngrok bypass methods...\n");
  
  try {
    // Method 1: Direct SSE connection with bypass headers
    console.log("📡 Method 1: Testing SSE endpoint with bypass headers...");
    const sseResponse = await fetch(`${NGROK_URL}/sse`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'MCP-Inspector/1.0'
      }
    });
    
    console.log(`SSE Status: ${sseResponse.status}`);
    console.log(`SSE Headers:`, Object.fromEntries(sseResponse.headers));
    
    if (sseResponse.status === 409) {
      console.log("✅ SSE endpoint is accessible (409 expected without proper MCP client)");
    }
    
    // Method 2: Test with curl-like headers
    console.log("\n📡 Method 2: Testing with curl-like headers...");
    const curlResponse = await fetch(`${NGROK_URL}/health`, {
      headers: {
        'ngrok-skip-browser-warning': 'any',
        'User-Agent': 'curl/7.68.0'
      }
    });
    
    if (curlResponse.ok) {
      const health = await curlResponse.json();
      console.log("✅ Health check with curl headers successful:");
      console.log(JSON.stringify(health, null, 2));
    }
    
    // Method 3: Test POST request (MCP Inspector uses POST)
    console.log("\n📡 Method 3: Testing POST request to SSE endpoint...");
    const postResponse = await fetch(`${NGROK_URL}/sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'MCP-Inspector/1.0'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        },
        id: 1
      })
    });
    
    console.log(`POST Status: ${postResponse.status}`);
    if (postResponse.ok || postResponse.status === 400) {
      console.log("✅ POST request successful (400 might be expected for test data)");
      try {
        const result = await postResponse.json();
        console.log("Response:", JSON.stringify(result, null, 2));
      } catch (e) {
        console.log("Response body:", await postResponse.text());
      }
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testNgrokBypass();