@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 from https://nodejs.org/ then run this file again.
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 (
  echo Package installation failed. Check your internet connection and try again.
  pause
  exit /b 1
)
start "" http://localhost:3000
call npm start
pause
