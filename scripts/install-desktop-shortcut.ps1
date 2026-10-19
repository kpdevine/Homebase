$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath 'Pocket Planet.lnk'
$launcherPath = Join-Path $PSScriptRoot 'start-homebase.ps1'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
if ((Test-Path -LiteralPath $shortcutPath) -and $shortcut.Description -notlike 'Pocket Planet local dashboard*') { throw "An unrelated Pocket Planet shortcut already exists at $shortcutPath. It was left unchanged." }
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcherPath + '"'
$shortcut.WorkingDirectory = $workspacePath
$shortcut.Description = 'Pocket Planet local dashboard - starts the server and opens your personal workspace'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Output $shortcutPath
