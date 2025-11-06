// Test the fixed destroy functionality
import fetch from "node-fetch";

const BASE_URL = "http://localhost:8000";
const SANDBOX_ID = "32840619-58ab-48c9-bfd4-4e5c4f97f7ad";

async function testFixedDestroy() {
  console.log("🧹 Testing fixed destroy functionality...\n");
  
  try {
    // Check current status
    console.log("📊 Current sandbox status:");
    const statusResponse = await fetch(`${BASE_URL}/get_sandbox_status/${SANDBOX_ID}`);
    const status = await statusResponse.json();
    console.log(JSON.stringify(status, null, 2));
    
    if (status.status !== "ACTIVE") {
      console.log("⚠️  Sandbox is not ACTIVE, cannot test destroy");
      return;
    }
    
    // Test destroy with query parameter (correct way)
    console.log("\n🧹 Testing destroy with query parameter...");
    const destroyResponse = await fetch(`${BASE_URL}/destroy_sandbox?sandbox_id=${SANDBOX_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (destroyResponse.ok) {
      const result = await destroyResponse.json();
      console.log("✅ Destroy successful:");
      console.log(JSON.stringify(result, null, 2));
    } else {
      const error = await destroyResponse.text();
      console.log("❌ Destroy failed:");
      console.log(`Status: ${destroyResponse.status}`);
      console.log(`Error: ${error}`);
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testFixedDestroy();