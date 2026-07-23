# -------------------------------------------------------------
# Highclass Shipping - one-command deploy (PowerShell)
# Usage:
#   ./deploy.ps1            full: build site + deploy hosting + rules + indexes + storage + functions
#   ./deploy.ps1 -Site      build + deploy Hosting (the website) only
#   ./deploy.ps1 -Rules     deploy rules + indexes + storage only
#   ./deploy.ps1 -Fn        deploy functions only
#
# Run from the app/ directory, as the project owner account.
# -------------------------------------------------------------
param(
  [switch]$Site,
  [switch]$Rules,
  [switch]$Fn
)

$ErrorActionPreference = "Stop"
$Account = "thalamuxtech@gmail.com"
$Project = "highclassshippinglogistics"

Write-Host "Highclass Shipping deploy (project: $Project, account: $Account)" -ForegroundColor Cyan

# Build the static site unless deploying only rules/functions.
if (-not $Rules -and -not $Fn) {
  Write-Host "Building static site (npm run build)..." -ForegroundColor Yellow
  npm run build
  if ($LASTEXITCODE -ne 0) { Write-Host "Build failed." -ForegroundColor Red; exit 1 }
}

# Ensure functions deps before a functions deploy.
if (-not $Rules -and -not $Site) {
  if (-not (Test-Path "functions/node_modules")) {
    Write-Host "Installing functions dependencies..." -ForegroundColor Yellow
    Push-Location functions; npm install; Pop-Location
  }
}

if ($Site) {
  $only = "hosting"
} elseif ($Rules) {
  $only = "firestore:rules,firestore:indexes,storage"
} elseif ($Fn) {
  $only = "functions"
} else {
  $only = "hosting,firestore:rules,firestore:indexes,storage,functions"
}

Write-Host "Deploying: $only" -ForegroundColor Yellow
firebase deploy --only $only --project $Project --account $Account

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "Deploy complete. Site: https://$Project.web.app" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "Deploy failed (exit $LASTEXITCODE). See output above." -ForegroundColor Red
}
