# PowerShell script to set up ngrok with MCP SSE server
Write-Host "🌐 Setting up ngrok with MCP SSE server..." -ForegroundColor Green

# Check if ngrok is installed
try {
    $ngrokVersion = ngrok version
    Write-Host "✅ ngrok found: $ngrokVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ngrok not found. Please install ngrok first:" -ForegroundColor Red
    Write-Host "   1. Download from https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "   2. Or use: choco install ngrok" -ForegroundColor Yellow
    exit 1
}

# Check if authenticated
try {
    ngrok config check
    Write-Host "✅ ngrok is authenticated" -ForegroundColor Green
} catch {
    Write-Host "⚠️  ngrok not authenticated. Run: ngrok authtoken YOUR_TOKEN" -ForegroundColor Yellow
    Write-Host "   Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 Starting MCP SSE server on port 3001..." -ForegroundColor Green
Write-Host "📋 Instructions:" -ForegroundColor Cyan
Write-Host "   1. This will start the SSE server" -ForegroundColor White
Write-Host "   2. In another terminal, run: ngrok http 3001" -ForegroundColor White
Write-Host "   3. Copy the https URL from ngrok" -ForegroundColor White
Write-Host "   4. Use https://your-url.ngrok.io/sse in MCP Inspector" -ForegroundColor White
Write-Host ""

# Start the SSE server
node sse-server.ts