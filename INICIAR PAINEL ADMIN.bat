@echo off
chcp 65001 >nul
title LIVE MUSIC Studio V3.4
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install
  if errorlevel 1 (
    echo.
    echo Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)
start "" http://localhost:5173/admin
call npm run dev
pause
