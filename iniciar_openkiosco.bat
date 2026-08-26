@echo off
setlocal
title OpenKiosco Launcher
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-openkiosco.ps1" %*
endlocal
