# Push local changes to GitHub (run from project root on Windows)
# Usage: .\deploy.ps1 "Your commit message"
#        npm run deploy -- "Your commit message"

param(
    [Parameter(Mandatory = $false)]
    [string]$Message = "Deploy update"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== OBE Portal — Deploy to GitHub ===" -ForegroundColor Cyan

git status --short

$changes = git status --porcelain
if (-not $changes) {
    Write-Host "No changes to commit." -ForegroundColor Yellow
    Write-Host "Pushing anyway in case local branch is ahead..."
    git push origin main
    exit 0
}

git add -A
git commit -m $Message
git push origin main

Write-Host ""
Write-Host "Done — pushed to GitHub." -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEP (on VPS, after SSH):" -ForegroundColor Yellow
Write-Host "  cd /www/wwwroot/obe-portal && ./update-server.sh" -ForegroundColor White
Write-Host ""
Write-Host "Note: .env is NOT in Git — server secrets stay on VPS only." -ForegroundColor DarkGray
Write-Host "See DEPLOYMENT.md for .env setup and full workflow." -ForegroundColor DarkGray
