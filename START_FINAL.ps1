$ErrorActionPreference = "Stop"
Write-Host "NOVA V11.12 Final — Production Start" -ForegroundColor Cyan
if (-not (Test-Path "node_modules/fastify/package.json")) {
  Write-Host "Dependencies not found. Running npm install..." -ForegroundColor Yellow
  npm install
}
npm run qa
Write-Host "Starting NOVA at http://127.0.0.1:3001" -ForegroundColor Green
npm run demo
