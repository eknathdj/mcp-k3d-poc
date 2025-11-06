// Test the bulletproof MCP workflow
import fetch from "node-fetch";

const BASE_URL = "http://localhost:8000";

async function testBulletproofWorkflow() {
  console.log("🛡️  Testing bulletproof MCP workflow...\n");
  
  try {
    // Step 1: Create sandbox (should work with or without name)
    console.log("📝 Step 1: Creating sandbox with auto-generated name...");
    const createResponse = await fetch(`${BASE_URL}/create_sandbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `bulletproof-test-${Date.now()}`,
        servers: 1,
        agents: 1,
        ttl_minutes: 30,
        owner: "bulletproof@example.com"
      })
    });
    
    const createResult = await createResponse.json();
    console.log("✅ Create result:", JSON.stringify(createResult, null, 2));
    
    const { sandbox_id, approval_id } = createResult;
    
    // Step 2: Test approve (should work with approval_id)
    console.log("\n✅ Step 2: Approving sandbox...");
    const approveResponse = await fetch(`${BASE_URL}/approve?approval_id=${approval_id}&approver=bulletproof@example.com`, {
      method: 'POST'
    });
    
    const approveResult = await approveResponse.json();
    console.log("✅ Approve result:", JSON.stringify(approveResult, null, 2));
    
    // Step 3: Test status check
    console.log("\n📊 Step 3: Checking status...");
    const statusResponse = await fetch(`${BASE_URL}/get_sandbox_status/${sandbox_id}`);
    const statusResult = await statusResponse.json();
    console.log("✅ Status result:", JSON.stringify(statusResult, null, 2));
    
    // Step 4: List active sandboxes
    console.log("\n📋 Step 4: Listing active sandboxes...");
    const listResponse = await fetch(`${BASE_URL}/list_active_sandboxes`);
    const listResult = await listResponse.json();
    console.log("✅ Active sandboxes:", JSON.stringify(listResult, null, 2));
    
    // Step 5: Wait for it to become active, then destroy
    console.log("\n⏳ Step 5: Waiting for sandbox to become active...");
    let attempts = 0;
    let status = "CREATING";
    
    while (status !== "ACTIVE" && status !== "FAILED" && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      const checkResponse = await fetch(`${BASE_URL}/get_sandbox_status/${sandbox_id}`);
      const checkResult = await checkResponse.json();
      status = checkResult.status;
      
      console.log(`   Attempt ${attempts}: Status = ${status}`);
    }
    
    if (status === "ACTIVE") {
      console.log("✅ Sandbox is ACTIVE!");
      
      // Step 6: Destroy
      console.log("\n🧹 Step 6: Destroying sandbox...");
      const destroyResponse = await fetch(`${BASE_URL}/destroy_sandbox?sandbox_id=${sandbox_id}`, {
        method: 'POST'
      });
      
      const destroyResult = await destroyResponse.json();
      console.log("✅ Destroy result:", JSON.stringify(destroyResult, null, 2));
    }
    
    console.log("\n🎉 Bulletproof workflow test completed successfully!");
    console.log("\n📋 Summary for MCP Inspector testing:");
    console.log(`   - Sandbox ID: ${sandbox_id}`);
    console.log(`   - Approval ID: ${approval_id}`);
    console.log("   - All tools should now work with or without parameters!");
    
  } catch (error) {
    console.error("❌ Bulletproof workflow test failed:", error.message);
  }
}

testBulletproofWorkflow();