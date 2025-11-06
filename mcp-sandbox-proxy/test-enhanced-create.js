// Test the enhanced create_sandbox tool with various parameter scenarios
import fetch from "node-fetch";

const BASE_URL = "http://localhost:8000";

async function testEnhancedCreate() {
  console.log("🧪 Testing enhanced create_sandbox with fallback name...\n");
  
  try {
    // Test with empty/missing name (should use fallback)
    const testData = {
      servers: 1,
      agents: 1,
      ttl_minutes: 30,
      owner: "test-enhanced@example.com"
      // Note: no 'name' field - should trigger fallback
    };
    
    console.log("📝 Testing with missing name (should use fallback):");
    console.log("Request data:", JSON.stringify(testData, null, 2));
    
    const response = await fetch(`${BASE_URL}/create_sandbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `mcp-test-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
        ...testData
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log("✅ Enhanced create successful:");
      console.log(JSON.stringify(result, null, 2));
      
      // Clean up - approve and destroy for testing
      console.log("\n🧹 Cleaning up test sandbox...");
      const approveResponse = await fetch(`${BASE_URL}/approve?approval_id=${result.approval_id}&approver=test@example.com`, {
        method: 'POST'
      });
      
      if (approveResponse.ok) {
        console.log("✅ Approved for cleanup");
        
        // Wait a moment then destroy
        setTimeout(async () => {
          try {
            const destroyResponse = await fetch(`${BASE_URL}/destroy_sandbox?sandbox_id=${result.sandbox_id}`, {
              method: 'POST'
            });
            if (destroyResponse.ok) {
              console.log("✅ Cleanup destroy initiated");
            }
          } catch (e) {
            console.log("⚠️  Cleanup destroy failed:", e.message);
          }
        }, 5000);
      }
      
    } else {
      const error = await response.text();
      console.log("❌ Enhanced create failed:");
      console.log(`Status: ${response.status}`);
      console.log(`Error: ${error}`);
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testEnhancedCreate();