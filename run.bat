@echo off
setlocal
if exist "%~dp0RadiologyReportCopilot.next.exe" (
    move /y "%~dp0RadiologyReportCopilot.next.exe" "%~dp0RadiologyReportCopilot.exe" >nul 2>&1
    if errorlevel 1 (
        echo Save your report and close the running app, then open run.bat again to apply the update.
        pause
        exit /b 1
    )
)
if not exist "%~dp0RadiologyReportCopilot.exe" (
    call "%~dp0build.bat"
    if errorlevel 1 (
        pause
        exit /b 1
    )
)
start "" "%~dp0RadiologyReportCopilot.exe"
endlocal
