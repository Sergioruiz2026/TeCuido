$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$keystorePath = Join-Path $repoRoot 'android\app\tecuido-release.keystore'

if (Test-Path -LiteralPath $keystorePath) {
    throw "Ya existe el keystore $keystorePath. No se sobrescribirá."
}

$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool -and $env:JAVA_HOME) {
    $javaKeytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
    if (Test-Path -LiteralPath $javaKeytool) {
        $keytool = Get-Item -LiteralPath $javaKeytool
    }
}

if (-not $keytool) {
    throw 'No se encontró keytool. Instala un JDK o configura JAVA_HOME.'
}

& $keytool.Source -genkeypair -v `
    -keystore $keystorePath `
    -alias tecuido `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000

if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo crear el keystore de producción.'
}

Write-Output "Keystore creado en $keystorePath. Haz una copia de seguridad fuera del repositorio."
