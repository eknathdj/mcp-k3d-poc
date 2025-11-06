import fetch from "node-fetch";

async function checkStatus() {
  try {
    const response = await fetch('http://localhost:8000/get_sandbox_status/d9be5c14-ee56-4667-9378-784fbff68b8a');
    const result = await response.json();
    console.log("Current status:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkStatus();