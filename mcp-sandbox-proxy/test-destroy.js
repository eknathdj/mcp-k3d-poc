// Test destroy functionality via direct API call to verify it works
import fetch from "node-fetch";

const BASE_URL = "http://localhost:8000";
const SANDBOX_ID = "d9be5c14-ee56-4667-9378-784fbff68b8a";

async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${method} ${endpoint}: ${response.status} ${error}`);
  }
  
  return response.json();
}

async function testDestroy() {
  console.log("🧹 Testing sandbox destruction...\n");
  
  try {
    // Step 1: Check current status
    console.log("📊 Step 1: Checking current sandbox status...");
    const statusBefore = await apiCall(`/get_sandbox_status/${SANDBOX_ID}`);
    console.log("Current status:", JSON.stringify(statusBefore, null, 2));
    
    if (statusBefore.status !== "ACTIVE") {
      console.log("⚠️  Sandbox is not ACTIVE, cannot destroy");
      return;
    }
    
    // Step 2: List active sandboxes before
    console.log("\n📋 Step 2: Listing active sandboxes before destruction...");
    const activeBefore = await apiCall("/list_active_sandboxes");
    console.log(`Found ${activeBefore.length} active sandbox(es):`);
    activeBefore.forEach(sb => {
      console.log(`  - ${sb.name} (${sb.id}) - ${sb.status}`);
    });
    
    // Step 3: Destroy the sandbox
    console.log("\n🧹 Step 3: Destroying sandbox...");
    const destroyResult = await apiCall(`/destroy_sandbox?sandbox_id=${SANDBOX_ID}`, "POST");
    console.log("Destroy initiated:", JSON.stringify(destroyResult, null, 2));
    
    // Step 4: Wait a moment and check status
    console.log("\n⏳ Step 4: Waiting for destruction to complete...");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    
    try {
      const statusAfter = await apiCall(`/get_sandbox_status/${SANDBOX_ID}`);
      console.log("Status after destruction:", JSON.stringify(statusAfter, null, 2));
    } catch (error) {
      console.log("Status check after destruction:", error.message);
    }
    
    // Step 5: List active sandboxes after
    console.log("\n📋 Step 5: Listing active sandboxes after destruction...");
    const activeAfter = await apiCall("/list_active_sandboxes");
    console.log(`Found ${activeAfter.length} active sandbox(es):`);
    activeAfter.forEach(sb => {
      console.log(`  - ${sb.name} (${sb.id}) - ${sb.status}`);
    });
    
    // Step 6: Check Docker containers
    console.log("\n🐳 Step 6: Checking Docker containers...");
    console.log("You can run 'docker ps' to verify k3d containers are removed");
    
    console.log("\n✅ Destroy test completed successfully!");
    
  } catch (error) {
    console.error("❌ Destroy test failed:", error.message);
  }
}

testDestroy();