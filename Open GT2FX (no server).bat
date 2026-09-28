@echo off
title GT2FX Journal (offline file)

REM Opens the self-contained built app directly in your browser - no server needed.
REM If this file is missing or the app looks outdated, run "npm run build" first.

if exist "%~dp0dist\index.html" (
  start "" "%~dp0dist\index.html"
) else (
  echo dist\index.html not found.
  echo Run "npm run build" first, then try again.
  pause
)
