#!/usr/bin/env pwsh
# Start backend offline (no Firebase)

$ScriptDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ScriptDir)) {
    $ScriptDir = Get-Location
}
$RepoRoot = $ScriptDir
$PythonPath = Join-Path $RepoRoot "..\.venv\Scripts\python.exe"

if (!(Test-Path $PythonPath)) {
    Write-Host "Python venv nao encontrado em $PythonPath" -ForegroundColor Red
    exit 1
}

$env:FIREBASE_DISABLED = "1"

Push-Location (Join-Path $RepoRoot "backend")
& $PythonPath -m uvicorn main:app --host 0.0.0.0 --port 8001
Pop-Location
