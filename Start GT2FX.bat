@echo off
title GT2FX Journal
cd /d "%~dp0"

echo ============================================
echo    GT2FX Journal - starting...
echo ============================================
echo.

REM Serve the built app (dist folder). Falls back to npx download if needed.
echo If your browser does not open by itself, go to:  http://localhost:4173
echo.
echo Keep this window OPEN while you use the journal. Close it to stop the server.
echo.

npx -y vite preview --port 4173 --strictPort

pause
