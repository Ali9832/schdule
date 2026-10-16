@echo off
setlocal
cd /d "%~dp0"
set "PATH=%~dp0..\.runtime\node-v22.16.0-win-x64;%~dp0runtime;%PATH%"
set "PORT=3002"
set "CLIENT_ORIGIN=http://127.0.0.1:3001"
set "NOVA_LOCAL_STORE=%~dp0.local\development.json"
if not exist ".local\development.json" (
  if not exist ".local" mkdir ".local"
  if exist ".local\memory-3001.json" copy /y ".local\memory-3001.json" ".local\development.json" >nul
)
echo Development preview: http://127.0.0.1:3001
echo Version 1.1 is frozen in the separate release archive.
call npm.cmd run dev
pause
