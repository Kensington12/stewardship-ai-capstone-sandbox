# Windows version of start_demo.sh. Easiest way to run it: double-click start_demo.cmd.
# Ctrl + C stops both.

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$Ui = Join-Path $Root "field_app\ui"
$Url = "http://localhost:4173"

if (-not (Test-Path $Python)) {
    Write-Host "No .venv found. Follow 'Getting started' in field_app\README.md first." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $Ui "node_modules"))) {
    Write-Host "Field app packages missing. Run:  cd field_app\ui ; npm install" -ForegroundColor Red
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm not found. Install Node.js 20 or newer from nodejs.org, then reopen this window." -ForegroundColor Red
    exit 1
}

Write-Host "Starting the central system on http://127.0.0.1:8000 ..."
$server = Start-Process -FilePath $Python `
    -ArgumentList "-m", "uvicorn", "field_app.server.app:app", "--port", "8000" `
    -WorkingDirectory $Root -NoNewWindow -PassThru

try {
    Set-Location $Ui
    Write-Host "Building the field app (with offline support)..."
    npm run build --silent
    if ($LASTEXITCODE -ne 0) { throw "The field app build failed. See the messages above." }

    Start-Job -ScriptBlock { param($u) Start-Sleep -Seconds 3; Start-Process $u } -ArgumentList $Url | Out-Null
    Write-Host "Field app running at $Url  (press Ctrl + C to stop)" -ForegroundColor Green
    npm run preview
}
finally {
    Write-Host "Stopping the central system..."
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
    Set-Location $Root
}
