# PowerShell script to fetch the latest active sandbox and destroy it
param(
    [string]$ServerUrl = "http://localhost:8000"
)

Write-Host "Fetching list of active sandboxes..."
$activeSandboxes = Invoke-RestMethod -Uri "$ServerUrl/list_active_sandboxes" -Method Get

if ($activeSandboxes.Count -eq 0) {
    Write-Host "No active sandboxes found."
    exit 0
}

# Get the latest (most recent) active sandbox
$latestSandbox = $activeSandboxes[0]  # Already ordered by created_at DESC
$sandboxId = $latestSandbox.id
Write-Host "Latest active sandbox: $sandboxId (created: $($latestSandbox.created_at))"

Write-Host "Destroying sandbox..."
$destroyResponse = Invoke-RestMethod -Uri "$ServerUrl/destroy_sandbox?sandbox_id=$sandboxId" -Method Post
Write-Host "Destroy status: $($destroyResponse.status)"

Write-Host "Sandbox destruction initiated."