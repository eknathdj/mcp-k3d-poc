// Simple test to verify MCP server is responding
import fetch from 'node-fetch';

async function testMCPConnection() {
    try {
        console.log('🔍 Testing MCP server connection...');

        // Test the SSE endpoint with proper headers
        const response = await fetch('http://localhost:3000/sse', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: {
                        name: 'test-client',
                        version: '1.0.0'
                    }
                },
                id: 1
            })
        });

        console.log(`📡 Response status: ${response.status}`);
        console.log(`📋 Response headers:`, Object.fromEntries(response.headers));

        if (response.ok) {
            console.log('✅ MCP server is responding correctly!');
            console.log('🎯 You can now connect MCP Inspector to: http://localhost:3000/sse');
        } else {
            console.log('❌ MCP server returned an error');
            const text = await response.text();
            console.log('Response:', text);
        }

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

testMCPConnection();