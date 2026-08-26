param(
    [switch]$AutoQuit,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$script:ApiProc = $null
$script:WebProc = $null

function Fail([string]$msg) {
    Write-Host ""
    Write-Host "[ERROR] $msg" -ForegroundColor Red
    if (-not $AutoQuit) { Read-Host "Presiona Enter para cerrar" | Out-Null }
    exit 1
}

function Cleanup {
    foreach ($p in @($script:ApiProc, $script:WebProc)) {
        if ($p -and -not $p.HasExited) {
            & taskkill /PID $p.Id /T /F 2>$null | Out-Null
        }
    }
}

try { $nodeVersionOutput = (node -v) 2>$null } catch { $nodeVersionOutput = $null }
if (-not $nodeVersionOutput) {
    Fail "Node.js no esta instalado o no esta en PATH. Instalalo desde https://nodejs.org (version 20 o superior)."
}
$nodeMajor = [int]($nodeVersionOutput -replace '^v', '').Split('.')[0]
if ($nodeMajor -lt 20) {
    Fail "Se requiere Node.js 20 o superior. Encontrado: $nodeVersionOutput"
}

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "   OpenKiosco - Iniciando..."    -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

if (-not (Test-Path "$Root\node_modules")) {
    Write-Host "[1/4] Primera vez: instalando dependencias (puede tardar varios minutos)..."
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail "npm install fallo. Revisa tu conexion e intenta de nuevo." }
} else {
    Write-Host "[1/4] Dependencias OK"
}

if (-not (Test-Path "$Root\apps\api\prisma\dev.db")) {
    Write-Host "[2/4] Preparando base de datos por primera vez..."
    Push-Location "$Root\apps\api"
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "La migracion de la base de datos fallo." }
    npx tsx prisma/seed.ts
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "El seed fallo." }
    Pop-Location
} else {
    Write-Host "[2/4] Base de datos OK"
}

Write-Host "[3/4] Iniciando servidores en segundo plano..."

$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if ($npmCmd) { $npmPath = $npmCmd.Source } else { $npmPath = (Get-Command npm).Source }

$script:ApiProc = Start-Process -FilePath $npmPath `
    -ArgumentList @('run', 'dev', '-w', 'apps/api') `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput "$Root\api.log" `
    -RedirectStandardError "$Root\api.err.log"

$script:WebProc = Start-Process -FilePath $npmPath `
    -ArgumentList @('run', 'dev', '-w', 'apps/web') `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput "$Root\web.log" `
    -RedirectStandardError "$Root\web.err.log"

Write-Host "[4/4] Esperando a que OpenKiosco este disponible..."

$ready = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Milliseconds 2000
    try {
        $response = Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
}

if (-not $ready) {
    Cleanup
    Fail "El frontend no respondio en http://localhost:5173. Revisa web.log y api.log en la carpeta del proyecto."
}

Write-Host ""
Write-Host "OpenKiosco esta listo:" -ForegroundColor Green
Write-Host "   App:     http://localhost:5173"
Write-Host "   API:     http://localhost:3000/api"
Write-Host ""
Write-Host "Usuarios demo -> admin PIN 1234 | caja1 PIN 1111"

if (-not $NoBrowser) {
    Start-Process 'http://localhost:5173'
}

if ($AutoQuit) {
    Start-Sleep -Seconds 1
    Cleanup
    exit 0
}

Write-Host ""
Write-Host "Mantén esta ventana abierta mientras usás el sistema."
Write-Host "Para detener todo: presioná Q o cerrá esta ventana."

try {
    while ($true) {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq 'Q') { break }
    }
} finally {
    Write-Host ""
    Write-Host "Deteniendo OpenKiosco..."
    try { Cleanup } catch {}
    Write-Host "Listo."
}
