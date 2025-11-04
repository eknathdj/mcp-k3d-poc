# PowerShell script to create a sandbox, approve it, wait for provisioning, run a test, and confirm
param(
    [string]$ServerUrl = "http://localhost:8000",
    [string]$Name = "test-sandbox",
    [int]$Servers = 1,
    [int]$Agents = 1,
    [int]$TtlMinutes = 60,
    [string]$Owner = "powershell-user"
)

Write-Host "Creating sandbox..."
$createBody = @{
    name = $Name
    servers = $Servers
    agents = $Agents
    ttl_minutes = $TtlMinutes
    owner = $Owner
} | ConvertTo-Json

$createResponse = Invoke-RestMethod -Uri "$ServerUrl/create_sandbox" -Method Post -Body $createBody -ContentType "application/json"
$sandboxId = $createResponse.sandbox_id
$approvalId = $createResponse.approval_id
Write-Host "Sandbox created: $sandboxId, Approval ID: $approvalId"

Write-Host "Approving sandbox..."
$approveResponse = Invoke-RestMethod -Uri "$ServerUrl/approve?approval_id=$approvalId&approver=powershell-auto" -Method Post
Write-Host "Approval status: $($approveResponse.status)"

Write-Host "Waiting for sandbox to become ACTIVE..."
do {
    Start-Sleep -Seconds 5
    $statusResponse = Invoke-RestMethod -Uri "$ServerUrl/get_sandbox_status/$sandboxId" -Method Get
    $status = $statusResponse.status
    Write-Host "Current status: $status"
} while ($status -eq "CREATING")

if ($status -ne "ACTIVE") {
    Write-Error "Sandbox failed to become ACTIVE. Final status: $status"
    exit 1
}

Write-Host "Sandbox is ACTIVE. Running test..."
$testBody = @{
    sandbox_id = $sandboxId
    test_id = "smoke"
} | ConvertTo-Json

$testResponse = Invoke-RestMethod -Uri "$ServerUrl/run_test" -Method Post -Body $testBody -ContentType "application/json"
Write-Host "Test result: $($testResponse | ConvertTo-Json -Depth 3)"

Write-Host "Sandbox creation and test completed successfully."
Write-Host "Sandbox ID: $sandboxId"

Write-Host "Checking k3d cluster list..."
& k3d cluster list

Write-Host "Updating kubectl config to use localhost..."

# Get the k3d cluster port from the cluster list
$clusterName = "sandbox-$($sandboxId.Substring(0,8))"
$clusterJson = & k3d cluster list --output json
$clusterData = $clusterJson | ConvertFrom-Json
$clusterInfo = $clusterData | Where-Object { $_.name -eq $clusterName }
$loadBalancerNode = $clusterInfo.nodes | Where-Object { $_.role -eq "loadbalancer" }
$portMapping = $loadBalancerNode.portMappings.'6443/tcp'[0]
$clusterPort = $portMapping.HostPort

Write-Host "Cluster name: $clusterName"
Write-Host "Cluster port: $clusterPort"

# Fetch the kubeconfig and merge it into global config
$sandboxKubeconfig = Invoke-RestMethod -Uri "$ServerUrl/get_kubeconfig/$sandboxId" -Method Get
$sandboxKubeconfig.kubeconfig | Out-File -FilePath "$env:TEMP\sandbox.yaml" -Encoding UTF8
& kubectl config view --kubeconfig="$env:TEMP\sandbox.yaml" --flatten | & kubectl config view --merge -

# Update the cluster server URL in global kubectl config
# Use the k3d generated cluster name
$actualClusterName = "k3d-$clusterName"
& kubectl config set-cluster $actualClusterName --server=https://127.0.0.1:$clusterPort

# Switch to the new context
& kubectl config use-context $actualClusterName

Write-Host "Checking kubectl nodes..."
& kubectl get nodes