@echo off
setlocal
if not exist "%~dp0index.html" (
    echo Could not find index.html. Keep run.bat in the app folder.
    pause
    exit /b 1
)
start "" "%~dp0index.html"
if errorlevel 1 (
    echo Could not open the app. Open index.html in your browser manually.
    pause
    exit /b 1
)
endlocal
