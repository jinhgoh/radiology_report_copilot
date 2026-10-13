# Exercise desktop control wiring and compiled icon resources without opening a report.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$appRoot = Split-Path $PSScriptRoot -Parent
$executable = Join-Path $appRoot 'RadiologyReportCopilot.next.exe'
if (-not (Test-Path -LiteralPath $executable)) {
    $executable = Join-Path $appRoot 'RadiologyReportCopilot.exe'
}
foreach ($dependency in @('Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll')) {
    [void][Reflection.Assembly]::LoadFrom((Join-Path $appRoot $dependency))
}
$assembly = [Reflection.Assembly]::LoadFrom($executable)
$window = [Activator]::CreateInstance($assembly.GetType('RadiologyReportCopilot.ReportWindow'), $true)
try {
    if ($window.Controls.Count -ne 1 -or $window.Controls[0] -isnot [Microsoft.Web.WebView2.WinForms.WebView2]) {
        throw 'The desktop window must contain only the browser, with no fixed toolbar.'
    }
    $command = $window.GetType().GetMethod('HandleDesktopCommand', [Reflection.BindingFlags]'Instance,NonPublic')
    $source = 'https://radiology-report-copilot.example/index.html'
    if ($window.TopMost) { throw 'Always on top should start disabled.' }
    $response = $command.Invoke($window, @($source, 'always-on-top:on'))
    if (-not $window.TopMost -or $response -ne 'always-on-top:on') { throw 'Checkbox command must enable TopMost.' }
    $response = $command.Invoke($window, @($source, 'desktop-ready'))
    if ($response -ne 'always-on-top:on') { throw 'Reload must preserve and report the current window state.' }
    $response = $command.Invoke($window, @('https://untrusted.example/', 'always-on-top:off'))
    if (-not $window.TopMost -or $null -ne $response) { throw 'Commands from other pages must be ignored.' }
    $response = $command.Invoke($window, @($source, 'always-on-top:off'))
    if ($window.TopMost -or $response -ne 'always-on-top:off') { throw 'Checkbox command must disable TopMost.' }
    Write-Output 'PASS: Toolbar removed; page commands toggle TopMost, restore state, and reject other origins.'
} finally { $window.Dispose() }

$settingsPath = Join-Path $appRoot ('tmp/window-size-' + [Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory((Split-Path $settingsPath -Parent))
$windowType = $assembly.GetType('RadiologyReportCopilot.ReportWindow')
$constructor = $windowType.GetConstructor([Reflection.BindingFlags]'Instance,NonPublic', $null, @([string]), $null)
$closing = $windowType.GetMethod('OnFormClosing', [Reflection.BindingFlags]'Instance,NonPublic')
try {
    $window = $constructor.Invoke(@([string]$settingsPath))
    try {
        $window.Size = New-Object Drawing.Size(900, 700)
        $expected = $window.Size
        $cancelled = New-Object Windows.Forms.FormClosingEventArgs([Windows.Forms.CloseReason]::UserClosing, $true)
        [void]$closing.Invoke($window, @([Windows.Forms.FormClosingEventArgs]$cancelled))
        if (Test-Path -LiteralPath $settingsPath) { throw 'Cancelled close must not save settings.' }
        $accepted = New-Object Windows.Forms.FormClosingEventArgs([Windows.Forms.CloseReason]::UserClosing, $false)
        [void]$closing.Invoke($window, @([Windows.Forms.FormClosingEventArgs]$accepted))
    } finally { $window.Dispose() }
    $window = $constructor.Invoke(@([string]$settingsPath))
    try {
        $available = [Windows.Forms.Screen]::FromControl($window).WorkingArea
        if ($window.Width -ne [Math]::Min($expected.Width, $available.Width) -or
            $window.Height -ne [Math]::Min($expected.Height, $available.Height)) {
            throw 'Reopening must restore the saved window size.'
        }
    } finally { $window.Dispose() }
    [IO.File]::WriteAllLines($settingsPath, @('99999', '99999', 'True'))
    $window = $constructor.Invoke(@([string]$settingsPath))
    try {
        if ($window.WindowState -ne [Windows.Forms.FormWindowState]::Maximized) { throw 'Maximized mode must restore.' }
        $window.WindowState = [Windows.Forms.FormWindowState]::Normal
        $available = [Windows.Forms.Screen]::FromControl($window).WorkingArea
        if ($window.Width -gt $available.Width -or $window.Height -gt $available.Height) {
            throw 'Saved dimensions must fit the current screen.'
        }
    } finally { $window.Dispose() }
    [IO.File]::WriteAllText($settingsPath, 'invalid settings')
    $window = $constructor.Invoke(@([string]$settingsPath))
    try {
        if ($window.ClientSize.Width -ne 1400 -or $window.ClientSize.Height -ne 900) {
            throw 'Invalid settings must fall back to the default size.'
        }
    } finally { $window.Dispose() }
    Write-Output 'PASS: Window size survives closing, maximized mode restores, oversized settings fit the screen, and invalid settings fall back safely.'
} finally {
    if (Test-Path -LiteralPath $settingsPath) { Remove-Item -LiteralPath $settingsPath }
}

$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($executable)
try {
    if ($null -eq $icon) { throw 'Executable has no icon.' }
    $iconFile = [IO.File]::ReadAllBytes((Join-Path $appRoot 'assets/RadiologyReportCopilot.ico'))
    if ([BitConverter]::ToUInt16($iconFile, 2) -ne 1) { throw 'Invalid ICO type.' }
    if ([BitConverter]::ToUInt16($iconFile, 4) -ne 9) { throw 'Expected nine ICO sizes.' }
    Write-Output 'PASS: Compiled icon resource loads and source ICO contains nine sizes.'
} finally { if ($icon) { $icon.Dispose() } }
