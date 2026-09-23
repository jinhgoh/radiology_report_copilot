@echo off
setlocal
pushd "%~dp0"
set "APP_CSC=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%APP_CSC%" (
    echo The Windows .NET Framework C# compiler was not found.
    popd
    exit /b 1
)
for %%F in (Microsoft.Web.WebView2.Core.dll Microsoft.Web.WebView2.WinForms.dll WebView2Loader.dll RadiologyReportCopilot.ico) do (
    if not exist "%%F" (
        echo Missing %%F. Keep the WebView2 SDK DLLs and icon beside build.bat.
        popd
        exit /b 1
    )
)
"%APP_CSC%" /nologo /target:winexe /platform:x64 /win32manifest:app.manifest ^
    /out:RadiologyReportCopilot.next.exe /win32icon:RadiologyReportCopilot.ico ^
    /reference:Microsoft.Web.WebView2.Core.dll ^
    /reference:Microsoft.Web.WebView2.WinForms.dll ^
    /reference:System.Windows.Forms.dll ^
    /reference:System.Drawing.dll ^
    DesktopApp.cs
if errorlevel 1 (
    popd
    exit /b 1
)
move /y RadiologyReportCopilot.next.exe RadiologyReportCopilot.exe >nul 2>&1
if errorlevel 1 (
    echo Build ready. Close the running app and open run.bat to apply the update.
) else (
    echo Built RadiologyReportCopilot.exe
)
popd
endlocal
