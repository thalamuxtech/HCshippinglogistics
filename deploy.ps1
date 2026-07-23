# ─────────────────────────────────────────────────────────────
# Highclass Shipping — one-command backend deploy (PowerShell)
# Usage:   ./deploy.ps1            (deploys rules + indexes + storage + functions)
#          ./deploy.ps1 -Rules    (rules + indexes + storage only, no functions)
#          ./deploy.ps1 -Fn       (functions only)
#
# Deploys as the project owner account. Run from the app/ directory.
# ─────────────────────────────────────────────────────────────
param(
  [switch]$Rules,
  [switch]$Fn
)

$ErrorActionPreference = "Stop"
$Account = "thalamuxtech@gmail.com"
$Project = "highclassshippinglogistics"

Write-Host "→ Highclass Shipping deploy (project: $Project, account: $Account)" -ForegroundColor Cyan

# Ensure functions deps are installed before a functions deploy
if (-not $Rules) {
  if (-not (Test-Path "functions/node_modules")) {
    Write-Host "→ Installing functions dependencies..." -ForegroundColor Yellow
    Push-Location functions; npm install; Pop-Location
  }
}

if ($Rules) {
  $only = "firestore:rules,firestore:indexes,storage"
} elseif ($Fn) {
  $only = "functions"
} else {
  $only = "firestore:rules,firestore:indexes,storage,functions"
}

Write-Host "→ Deploying: $only" -ForegroundColor Yellow
firebase deploy --only $only --project $Project --account $Account

if ($LASTEXITCODE -eq 0) {
  Write-Host "`n✓ Deploy complete." -ForegroundColor Green
} else {
  Write-Host "`n✗ Deploy failed (exit $LASTEXITCODE). See output above." -ForegroundColor Red
}
