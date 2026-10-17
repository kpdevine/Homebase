param(
    [ValidateRange(1024, 65535)][int]$Port = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$appUrl = "http://127.0.0.1:$Port/"

function Get-HomebaseStatus {
    try {
        $page = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
        if ($page.StatusCode -eq 200 -and $page.Content -match '<title>Homebase' -and $page.Content -match 'app\.mjs') { return 'ready' }
        return 'occupied'
    } catch {
        if ($_.Exception.Response) { return 'occupied' }
        return 'offline'
    }
}

try {
    $status = Get-HomebaseStatus
    if ($status -eq 'occupied') { throw "Port $Port is being used by another app. Homebase has kept its usual address so your saved entries stay together. Close the other service and try again." }
    $serverProcess = $null
    if ($status -ne 'ready') {
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
        if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js is needed to run Homebase. Its installation could not be found.' }
        $runtimePath = Join-Path $workspacePath '.local'
        New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
        $oldPort = $env:PORT
        try {
            $env:PORT = [string]$Port
            $serverPath = Join-Path $PSScriptRoot 'serve.mjs'
            $serverProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $workspacePath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath "server-$Port.log") -RedirectStandardError (Join-Path $runtimePath "server-$Port.error.log") -PassThru
        } finally { $env:PORT = $oldPort }
        $deadline = [DateTime]::UtcNow.AddSeconds(15)
        do {
            $status = Get-HomebaseStatus
            if ($status -eq 'ready') { break }
            if ($status -eq 'occupied') { throw "Another service is using port $Port. Homebase did not open it." }
            if ($serverProcess.HasExited) { throw "Homebase could not start. See .local\server-$Port.error.log in the project folder." }
            Start-Sleep -Milliseconds 200
        } while ([DateTime]::UtcNow -lt $deadline)
        if ($status -ne 'ready') { throw "Homebase did not become ready at $appUrl. Try again, or inspect the logs in the project's .local folder." }
    }
    if (-not $NoBrowser) { Start-Process $appUrl }
    [pscustomobject]@{ Url=$appUrl; ReusedServer=($null -eq $serverProcess); StartedProcessId=$(if ($serverProcess) { $serverProcess.Id } else { $null }) }
} catch {
    if ($NoBrowser) { throw }
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Homebase could not open', 'OK', 'Error') | Out-Null
    exit 1
}
