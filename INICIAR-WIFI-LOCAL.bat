@echo off
chcp 65001 >nul
where node >nul 2>nul || (echo Necesitas instalar Node.js desde https://nodejs.org y volver a abrir esto. & pause & exit /b)
node "%~dp0server\lan-server.js"
pause
