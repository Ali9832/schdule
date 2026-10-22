@echo off
chcp 65001 >nul
cd /d %~dp0
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo Starting NOVA on http://127.0.0.1:3001
call npm run demo
pause
