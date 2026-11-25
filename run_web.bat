@echo off
title Mishkah - منصة مشكاة الدينية المتكاملة
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8090
set MISHKAH_DEMO_MODE=true
echo ==========================================================
echo   منصة مشكاة الدينية المتكاملة - Mishkah
echo   Port: 8090 ^| URL: http://localhost:8090
echo ==========================================================
start "" "http://localhost:8090"
node server/index.js
pause
