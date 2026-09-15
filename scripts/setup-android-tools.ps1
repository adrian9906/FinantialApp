param([switch]$AcceptAndroidLicense)
$ErrorActionPreference = 'Stop'
if (-not $AcceptAndroidLicense) { throw 'Para instalar el SDK, revisa https://developer.android.com/studio#terms y ejecuta con -AcceptAndroidLicense.' }
$toolsRoot = Join-Path (Split-Path $PSScriptRoot -Parent) '.codex-tools'
New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
$javaRoot = Join-Path $toolsRoot 'java'
if (-not (Test-Path -LiteralPath $javaRoot)) {
    $javaAsset = @(Invoke-RestMethod -Uri 'https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse')[0]
    $javaZip = Join-Path $toolsRoot 'jdk21.zip'
    Invoke-WebRequest -Uri $javaAsset.binary.package.link -OutFile $javaZip -TimeoutSec 300
    if ((Get-FileHash -LiteralPath $javaZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $javaAsset.binary.package.checksum) { throw 'Checksum del JDK incorrecto.' }
    Expand-Archive -LiteralPath $javaZip -DestinationPath $javaRoot -Force
}
$jdkRoot = @(Get-ChildItem -LiteralPath $javaRoot -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin/java.exe') })[0].FullName
if (-not $jdkRoot) { throw 'JDK 21 no encontrado.' }
$env:JAVA_HOME = $jdkRoot
$sdkRoot = Join-Path $toolsRoot 'android-sdk'
$sdkManager = Join-Path $sdkRoot 'cmdline-tools/latest/bin/sdkmanager.bat'
if (-not (Test-Path -LiteralPath $sdkManager)) {
    $sdkZip = Join-Path $toolsRoot 'android-commandline.zip'
    [xml]$sdkRepository = (Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/repository2-3.xml' -TimeoutSec 60).Content
    $sdkPackage = (Select-Xml -Xml $sdkRepository -XPath "//*[local-name()='remotePackage' and @path='cmdline-tools;latest']").Node
    $sdkArchive = @($sdkPackage.archives.archive | Where-Object { $_.'host-os' -eq 'windows' })[0].complete
    if (-not $sdkArchive.url) { throw 'No se encontraron herramientas Windows en el repositorio oficial Android.' }
    Invoke-WebRequest -Uri ('https://dl.google.com/android/repository/' + $sdkArchive.url) -OutFile $sdkZip -TimeoutSec 300
    if ((Get-FileHash -LiteralPath $sdkZip -Algorithm $sdkArchive.checksum.type.ToUpperInvariant()).Hash.ToLowerInvariant() -ne $sdkArchive.checksum.InnerText) { throw 'Checksum de herramientas Android incorrecto.' }
    $sdkExtract = Join-Path $toolsRoot 'android-commandline'
    Expand-Archive -LiteralPath $sdkZip -DestinationPath $sdkExtract -Force
    New-Item -ItemType Directory -Path (Join-Path $sdkRoot 'cmdline-tools') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $sdkExtract 'cmdline-tools') -Destination (Join-Path $sdkRoot 'cmdline-tools/latest') -Recurse
}
1..40 | ForEach-Object { 'y' } | & $sdkManager "--sdk_root=$sdkRoot" --licenses | Select-Object -Last 5
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron aceptar las licencias del SDK.' }
& $sdkManager "--sdk_root=$sdkRoot" 'platform-tools' 'platforms;android-35' 'build-tools;35.0.0'
if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar el SDK Android.' }
$androidRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'apps/web/android'
[System.IO.File]::WriteAllText((Join-Path $androidRoot 'local.properties'), 'sdk.dir=' + $sdkRoot.Replace('\', '/') + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Output "Herramientas listas en $toolsRoot"
