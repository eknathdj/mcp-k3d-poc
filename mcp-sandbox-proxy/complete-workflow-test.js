// Complete k3d sandbox workflow test
import fetch from "node-fetch";

const BASE_URL = "http://localhost:8000";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function completeWorkflowTest() {
  console.log("🚀 Starting complete k3d sandbox workflow test...\n");
  
  try {
    // Step 1: Create sandbox
    console.log("📝 Step 1: Creating sandbox...");
    const createResult = await apiCall("/create_sandbox", "POST", {
      name: "workflow-test-sandbox",
      servers: 1,
      agents: 1,
      ttl_minutes: 60,
      owner: "test@example.com"
    });
    
    console.log("✅ Sandbox created:");
    console.log(`   Sandbox ID: ${createResult.sandbox_id}`);
    console.log(`   Approval ID: ${createResult.approval_id}`);
    console.log(`   Status: ${createResult.status}\n`);
    
    const { sandbox_id, approval_id } = createResult;
    
    // Step 2: Approve sandbox
    console.log("✅ Step 2: Approving sandbox...");
    const approveResult = await apiCall(`/approve?approval_id=${approval_id}&approver=test@example.com`, "POST");
    
    console.log("✅ Sandbox approved:");
    console.log(`   Status: ${approveResult.status}\n`);
    
    // Step 3: Wait for provisioning and check status
    console.log("⏳ Step 3: Waiting for sandbox to become active...");
    let status = "CREATING";
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    
    while (status !== "ACTIVE" && status !== "FAILED" && attempts < maxAttempts) {
      await sleep(1000);
      attempts++;
      
      const statusResult = await apiCall(`/get_sandbox_status/${sandbox_id}`);
      status = statusResult.status;
      
      console.log(`   Attempt ${attempts}: Status = ${status}`);
      
      if (status === "FAILED") {
        throw new Error("Sandbox provisioning failed");
      }
    }
    
    if (status !== "ACTIVE") {
      throw new Error(`Sandbox did not become active within ${maxAttempts} seconds`);
    }
    
    console.log("✅ Sandbox is now ACTIVE!\n");
    
    // Step 4: Get kubeconfig
    console.log("📋 Step 4: Retrieving kubeconfig...");
    const kubeconfigResult = await apiCall(`/get_kubeconfig/${sandbox_id}`);
    
    console.log("✅ Kubeconfig retrieved:");
    console.log(`   Size: ${kubeconfigResult.kubeconfig.length} characters\n`);
    
    // Step 5: Run smoke test
    console.log("🧪 Step 5: Running smoke test...");
    const testResult = await apiCall("/run_test", "POST", {
      sandbox_id: sandbox_id,
      test_id: "smoke"
    });
    
    console.log("✅ Smoke test completed:");
    console.log(`   Return code: ${testResult.rc}`);
    console.log(`   Output: ${testResult.out.substring(0, 200)}...`);
    
    if (testResult.rc !== 0) {
      console.log(`   Error: ${testResult.err}`);
    }
    console.log();
    
    // Step 6: List active sandboxes
    console.log("📋 Step 6: Listing active sandboxes...");
    const activeList = await apiCall("/list_active_sandboxes");
    
    console.log("✅ Active sandboxes:");
    activeList.forEach(sb => {
      console.log(`   - ${sb.name} (${sb.id}) - ${sb.status}`);
    });
    console.log();
    
    // Step 7: Cleanup - Destroy sandbox
    console.log("🧹 Step 7: Destroying sandbox...");
    const destroyResult = await apiCall(`/destroy_sandbox?sandbox_id=${sandbox_id}`, "POST");
    
    console.log("✅ Sandbox destruction initiated:");
    console.log(`   Status: ${destroyResult.status}\n`);
    
    console.log("🎉 Complete workflow test SUCCESSFUL!");
    console.log("\n📊 Summary:");
    console.log(`   - Sandbox created: ${sandbox_id}`);
    console.log(`   - Provisioning: SUCCESS`);
    console.log(`   - Kubeconfig: Retrieved`);
    console.log(`   - Smoke test: ${testResult.rc === 0 ? 'PASSED' : 'FAILED'}`);
    console.log(`   - Cleanup: Initiated`);
    
  } catch (error) {
    console.error("❌ Workflow test failed:", error.message);
    return false;
  }
  
  return true;
}

// Run the test
completeWorkflowTest();