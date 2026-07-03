param(
  [switch]$Install,
  [switch]$Build
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root

if (!(Test-Path "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  npm install; if (!$?) { exit 1 }
} elseif ($Install) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  npm install; if (!$?) { exit 1 }
}

if ($Build) {
  Write-Host "Building..." -ForegroundColor Cyan
  npm run build; if (!$?) { exit 1 }
}

Write-Host "Starting nutrition app..." -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Green

npm run dev
