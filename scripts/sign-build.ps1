# Builds the installers and signs them with a code signing certificate.
#
# Without a commercial certificate a self-signed one is created: the signature
# itself is valid, but Windows does not trust that issuer, so other machines
# still show "unknown publisher" and SmartScreen keeps warning.
# To use a real certificate, install it in CurrentUser\My and pass -Subject
# (or keep the same subject); nothing else in this script changes.
#
# Usage:  ./scripts/sign-build.ps1                 # build, sign, verify
#         ./scripts/sign-build.ps1 -SkipBuild      # sign existing artefacts
#         ./scripts/sign-build.ps1 -Trust          # also trust the certificate locally
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 files as
# ANSI unless they carry a BOM, so non-ASCII text here breaks the parser.
param(
    [string] $Subject = 'CN=Veryverycai, O=Npcc, C=CN',
    [switch] $SkipBuild,
    # Installs the public certificate into the current user's trust stores so
    # Windows shows the publisher instead of "unknown publisher".
    [switch] $Trust
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$certDir = Join-Path $root 'certs'

# signtool ships with the Windows SDK; tauri finds it through PATH while bundling.
$signtool = Get-ChildItem (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin') `
    -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
if (-not $signtool) {
    throw 'signtool.exe not found. Install the Windows SDK.'
}
$env:PATH = "$($signtool.DirectoryName);$env:PATH"
Write-Output "signtool: $($signtool.FullName)"

# 1. Reuse or create the self-signed certificate. The private key stays in the
#    current user's certificate store, never in the repository.
$codeSigningOid = '1.3.6.1.5.5.7.3.3'
$cert = Get-ChildItem Cert:\CurrentUser\My |
    Where-Object {
        $_.Subject -eq $Subject -and
        $_.HasPrivateKey -and
        $_.EnhancedKeyUsageList.ObjectId -contains $codeSigningOid
    } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

if (-not $cert) {
    Write-Output "creating self-signed code signing certificate: $Subject"
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $Subject `
        -FriendlyName 'Npcc code signing (self-signed)' `
        -KeyUsage DigitalSignature `
        -KeyExportPolicy Exportable `
        -NotAfter (Get-Date).AddYears(3) `
        -CertStoreLocation Cert:\CurrentUser\My
}

Write-Output "certificate: $($cert.Thumbprint) valid until $($cert.NotAfter.ToString('yyyy-MM-dd'))"

# 2. Export the public certificate so a user can trust the local builds.
New-Item -ItemType Directory -Force -Path $certDir | Out-Null
$cerFile = Join-Path $certDir 'npcc-selfsigned.cer'
Export-Certificate -Cert $cert -FilePath $cerFile -Force | Out-Null

# 2b. -Trust installs the public half into the current user's stores. Both are
#     per-user, so no administrator rights are needed and nothing is written for
#     other accounts on the machine. certutil is used instead of
#     Import-Certificate because the latter demands a UI confirmation for the
#     root store and fails from a non-interactive session.
if ($Trust) {
    foreach ($store in 'Root', 'TrustedPublisher') {
        & certutil -user -addstore $store $cerFile 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "adding the certificate to $store failed (exit $LASTEXITCODE)" }
        Write-Output "trusted: CurrentUser\$store"
    }
}

# 3. Build. --config hands the thumbprint to tauri so npcc.exe, the NSIS setup
#    and the MSI are all signed during bundling.
$signingConfig = Join-Path $root 'src-tauri\tauri.signing.json'
@{
    bundle = @{
        windows = @{
            certificateThumbprint = $cert.Thumbprint
            digestAlgorithm       = 'sha256'
            timestampUrl          = 'http://timestamp.digicert.com'
        }
    }
} | ConvertTo-Json -Depth 6 | Set-Content -Path $signingConfig -Encoding ASCII

try {
    if (-not $SkipBuild) {
        # The linker cannot replace a binary that is running. Only a process
        # started from the build output blocks the build -- an installed copy
        # running from %LOCALAPPDATA% is harmless and must not be killed, the
        # user may be editing something in it.
        $buildExe = Join-Path $root 'src-tauri\target\release\npcc.exe'
        $blocking = @(Get-Process -Name 'npcc' -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -eq $buildExe })
        if ($blocking.Count -gt 0) {
            throw 'The built npcc.exe is still running. Close it and run the script again; the linker cannot overwrite a running binary.'
        }

        # Call the local Tauri CLI directly instead of `npm run tauri -- build
        # --config ...`: npm treats --config as one of its own options, strips it
        # and passes the bare path to tauri, which then fails with
        # "unexpected argument ... found".
        $tauriCli = Join-Path $root 'node_modules\.bin\tauri.cmd'
        if (-not (Test-Path $tauriCli)) {
            throw "tauri CLI not found at $tauriCli. Run npm install first."
        }
        Push-Location $root
        try {
            & (Join-Path $PSScriptRoot 'with-msvc.ps1') $tauriCli build --config $signingConfig
            if ($LASTEXITCODE -ne 0) { throw "tauri build failed (exit $LASTEXITCODE)" }
        }
        finally {
            Pop-Location
        }
    }
}
finally {
    Remove-Item $signingConfig -ErrorAction SilentlyContinue
}

# 4. tauri stamps the bundle type into npcc.exe before each bundler run and
#    restores the original file afterwards, which drops the signature it applied
#    a moment earlier. Sign the shipped exe once more so a portable copy of it is
#    covered as well.
$exe = Join-Path $root 'src-tauri\target\release\npcc.exe'
if (Test-Path $exe) {
    if (-not (Get-AuthenticodeSignature -FilePath $exe).SignerCertificate) {
        Write-Output 're-signing npcc.exe (tauri restored it after bundling)'
        & $signtool.FullName sign /sha1 $cert.Thumbprint /fd sha256 `
            /tr http://timestamp.digicert.com /td sha256 $exe | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "signing npcc.exe failed (exit $LASTEXITCODE)" }
    }
}

# 5. Verify every artefact. Once the certificate sits in the root store,
#    `signtool verify /pa` is the authoritative check; before that a self-signed
#    chain always fails there (the root is untrusted), so the fallback looks at
#    the signature itself: present, from our certificate, file unmodified since.
$nsis = Get-ChildItem (Join-Path $root 'src-tauri\target\release\bundle\nsis') -Filter '*-setup.exe' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
$msi = Get-ChildItem (Join-Path $root 'src-tauri\target\release\bundle\msi') -Filter '*.msi' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

$trusted = [bool](Get-ChildItem Cert:\CurrentUser\Root | Where-Object Thumbprint -eq $cert.Thumbprint)
$accepted = if ($trusted) { @('Valid') } else { @('Valid', 'UnknownError', 'NotTrusted') }

$artifacts = @(
    $exe,
    $nsis.FullName,
    $msi.FullName
) | Where-Object { $_ -and (Test-Path $_) } | ForEach-Object { (Resolve-Path $_).Path }

foreach ($artifact in $artifacts) {
    $signature = Get-AuthenticodeSignature -FilePath $artifact
    if (-not $signature.SignerCertificate) {
        throw "not signed: $artifact"
    }
    if ($signature.SignerCertificate.Thumbprint -ne $cert.Thumbprint) {
        throw "signed by an unexpected certificate: $artifact"
    }
    if ($signature.Status -notin $accepted) {
        throw "signature status $($signature.Status): $artifact"
    }
    if ($trusted) {
        & $signtool.FullName verify /pa /q $artifact | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "signtool verify failed: $artifact" }
    }
    $trustLabel = if ($trusted) { 'trusted' } else { 'self-signed, run with -Trust to trust it locally' }
    Write-Output ("OK  {0}  [{1}]  {2}" -f (Split-Path $artifact -Leaf), $signature.SignerCertificate.Subject, $trustLabel)
}
