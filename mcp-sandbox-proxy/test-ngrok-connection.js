// Test ngrok connection to our MCP SSE server
import fetch from "node-fetch";

const NGROK_URL = "https://4e79a3946546.ngrok-free.app";

async function testNgrokConnection() {
  console.log("🌐 Testing ngrok connection to MCP SSE server...\n");
  
  try {
    // Test health endpoint
    console.log("📊 Testing health endpoint...");
    const healthResponse = await fetch(`${NGROK_URL}/health`, {
      headers: {
        'ngrok-skip-browser-warning': 'true'  // Skip ngrok warning page
      }
    });
    
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log("✅ Health check successful:");
      console.log(JSON.stringify(health, null, 2));
    } else {
      console.log("❌ Health check failed:", healthResponse.status);
      const text = await healthResponse.text();
      console.log("Response:", text.substring(0, 200) + "...");
    }
    
    // Test MCP SSE endpoint
    console.log("\n📡 Testing MCP SSE endpoint...");
    const sseResponse = await fetch(`${NGROK_URL}/sse`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'ngrok-skip-browser-warning': 'true'
      }
    });
    
    console.log(`SSE endpoint status: ${sseResponse.status}`);
    console.log(`SSE endpoint headers:`, Object.fromEntries(sseResponse.headers));
    
    if (sseResponse.status === 406) {
      console.log("✅ SSE endpoint responding correctly (406 expected for GET without proper MCP headers)");
    }
    
    console.log("\n🎯 MCP Inspector Configuration:");
    console.log("================================");
    console.log(`Transport Type: SSE`);
    console.log(`URL: ${NGROK_URL}/sse`);
    console.log("Note: ngrok free accounts show a warning page on first visit");
    console.log("The MCP Inspector should bypass this automatically");
    
  } catch (error) {
    console.error("❌ Connection test failed:", error.message);
  }
}

testNgrokConnection();