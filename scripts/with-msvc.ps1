# Runs a command with the MSVC toolchain environment.
#
# rustc finds `link.exe` through PATH and the `LIB`/`INCLUDE` variables, which a
# plain PowerShell (or CI) session does not have. This script reproduces what
# `VsDevCmd.bat` would set, without requiring a Developer Command Prompt.
#
# Usage:  ./scripts/with-msvc.ps1 cargo check
#         ./scripts/with-msvc.ps1 cargo test
#         ./scripts/with-msvc.ps1 npm.cmd run tauri build
param(
    [Parameter(Mandatory = $true, Position = 0)][string] $Exe,
    [Parameter(ValueFromRemainingArguments = $true)][string[]] $ExeArgs
)

$ErrorActionPreference = 'Stop'

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path $vswhere)) {
    throw "vswhere.exe not found. Install the Visual Studio Build Tools with the C++ workload."
}

$vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vsPath) {
    throw 'No Visual Studio installation with the C++ x64 toolset was found.'
}

$msvcRoot = Join-Path $vsPath 'VC\Tools\MSVC'
$msvc = (Get-ChildItem $msvcRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
if (-not $msvc) {
    throw "No MSVC toolset under $msvcRoot."
}

$kitsRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10'
$sdkLib = (Get-ChildItem (Join-Path $kitsRoot 'Lib') -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
$sdkInc = (Get-ChildItem (Join-Path $kitsRoot 'Include') -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
if (-not $sdkLib -or -not $sdkInc) {
    throw 'The Windows SDK libraries are missing. Install the Windows 11 SDK component.'
}

$binDir = Join-Path $msvc 'bin\Hostx64\x64'
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'

[Environment]::SetEnvironmentVariable('PATH', "$binDir;$cargoBin;" + [Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process')
[Environment]::SetEnvironmentVariable('LIB', (Join-Path $msvc 'lib\x64') + ';' + (Join-Path $sdkLib 'ucrt\x64') + ';' + (Join-Path $sdkLib 'um\x64'), 'Process')
[Environment]::SetEnvironmentVariable(
    'INCLUDE',
    (Join-Path $msvc 'include') + ';' + (Join-Path $sdkInc 'ucrt') + ';' + (Join-Path $sdkInc 'um') + ';' + (Join-Path $sdkInc 'winrt') + ';' + (Join-Path $sdkInc 'cppwinrt'),
    'Process'
)

Push-Location (Join-Path $PSScriptRoot '..')
try {
    & $Exe @ExeArgs
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
