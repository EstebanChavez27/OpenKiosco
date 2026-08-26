$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'OpenKiosco-Launcher.exe'

if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Write-Host "Instalando modulo ps2exe (solo la primera vez)..."
    Install-Module ps2exe -Scope CurrentUser -Force
}

Import-Module ps2exe

Invoke-ps2exe `
    -inputFile (Join-Path $PSScriptRoot 'run-openkiosco.ps1') `
    -outputFile $output `
    -title 'OpenKiosco' `
    -description 'Launcher de escritorio para OpenKiosco POS' `
    -company 'OpenKiosco' `
    -version '0.1.0.0'

Write-Host ""
Write-Host "Ejecutable generado: $output"
Write-Host "Nota: el .exe sigue necesitando Node.js 20+ instalado en la maquina."
