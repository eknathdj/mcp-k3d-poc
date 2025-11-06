// Create a new sandbox for MCP Inspector testing
import fetch from "node-fetch";

const BASE_URL = "http://localhost:8000";

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

async function setupTestSandbox() {
  console.log("🚀 Setting up a new sandbox for MCP Inspector testing...\n");
  
  try {
    // Step 1: Create sandbox
    console.log("📝 Step 1: Creating sandbox...");
    const createResult = await apiCall("/create_sandbox", "POST", {
      name: "mcp-inspector-test",
      servers: 1,
      agents: 1,
      ttl_minutes: 30,
      owner: "mcp-test@example.com"
    });
    
    console.log("✅ Sandbox created:");
    console.log(`   Sandbox ID: ${createResult.sandbox_id}`);
    console.log(`   Approval ID: ${createResult.approval_id}`);
    console.log(`   Status: ${createResult.status}\n`);
    
    // Step 2: Approve sandbox
    console.log("✅ Step 2: Approving sandbox...");
    const approveResult = await apiCall(`/approve?approval_id=${createResult.approval_id}&approver=mcp-test@example.com`, "POST");
    
    console.log("✅ Sandbox approved:");
    console.log(`   Status: ${approveResult.status}\n`);
    
    // Step 3: Wait for it to become active
    console.log("⏳ Step 3: Waiting for sandbox to become active...");
    let status = "CREATING";
    let attempts = 0;
    const maxAttempts = 20;
    
    while (status !== "ACTIVE" && status !== "FAILED" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      const statusResult = await apiCall(`/get_sandbox_status/${createResult.sandbox_id}`);
      status = statusResult.status;
      
      console.log(`   Attempt ${attempts}: Status = ${status}`);
      
      if (status === "FAILED") {
        throw new Error("Sandbox provisioning failed");
      }
    }
    
    if (status === "ACTIVE") {
      console.log("✅ Sandbox is now ACTIVE!\n");
      
      console.log("🎯 MCP Inspector Test Instructions:");
      console.log("=====================================");
      console.log("1. Open MCP Inspector at:");
      console.log("   http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=0b511df4fc5be58b82ce24cf5a8bd169891f8c0391825a66a2e00b25f0b9b5d2");
      console.log("");
      console.log("2. Connect using STDIO transport");
      console.log("");
      console.log("3. Test the destroy_sandbox tool with:");
      console.log(`   sandbox_id: ${createResult.sandbox_id}`);
      console.log("");
      console.log("4. You should see the sandbox status change to 'DESTROYING'");
      console.log("");
      console.log("📋 Current Active Sandboxes:");
      
      const activeList = await apiCall("/list_active_sandboxes");
      activeList.forEach(sb => {
        console.log(`   - ${sb.name} (${sb.id}) - ${sb.status}`);
      });
      
    } else {
      console.log(`❌ Sandbox did not become active within ${maxAttempts * 2} seconds`);
    }
    
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
  }
}

setupTestSandbox();