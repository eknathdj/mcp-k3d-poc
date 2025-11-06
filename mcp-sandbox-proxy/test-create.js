// Test script to verify create_sandbox works with proper parameters
import fetch from "node-fetch";

async function testCreateSandbox() {
  console.log("🧪 Testing create_sandbox API directly...");
  
  const testData = {
    name: "test-sandbox-123",
    servers: 1,
    agents: 1,
    ttl_minutes: 60,
    owner: "test@example.com"
  };
  
  try {
    const response = await fetch('http://localhost:8000/create_sandbox', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log("✅ Direct API call successful:");
      console.log(JSON.stringify(result, null, 2));
      return result;
    } else {
      const error = await response.text();
      console.log("❌ Direct API call failed:");
      console.log(`Status: ${response.status}`);
      console.log(`Error: ${error}`);
    }
  } catch (error) {
    console.error("❌ Network error:", error.message);
  }
}

testCreateSandbox();