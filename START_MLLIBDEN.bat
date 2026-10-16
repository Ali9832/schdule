@echo off
cd /d "%~dp0"
echo mllibden 1.1 - http://127.0.0.1:3001
if exist "runtime\node.exe" (
  "runtime\node.exe" "server\index.js"
) else (
  node "server\index.js"
)
pause
