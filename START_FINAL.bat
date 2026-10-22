@echo off
setlocal
cd /d "%~dp0"
echo NOVA V11.12 Final - Production Start
if not exist node_modules\fastify\package.json (
  echo Dependencies not found. Running npm install...
  call npm install || exit /b 1
)
call npm run qa || exit /b 1
echo Starting NOVA at http://127.0.0.1:3001
call npm run demo
