@echo off
chcp 65001 >nul
title Postcard Server
cd /d "%~dp0"
set "NODE=C:\Users\ASUS\nodejs-portable\node-v24.19.0-win-x64\node.exe"
if not exist "%NODE%" (
  echo [Error] Node.exe not found: %NODE%
  echo Please unzip the portable Node.js to that path first.
  pause
  exit /b 1
)
echo Starting server... the browser will open automatically.
echo To stop the server: press Ctrl+C or close this window.
echo ================================================
"%NODE%" server.js
echo.
echo Server stopped. Press any key to close this window.
pause >nul
