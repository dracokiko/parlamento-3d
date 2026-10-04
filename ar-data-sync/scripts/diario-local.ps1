<#
  Diário da AR a partir do computador do projecto — o que a tarefa agendada
  do Windows corre todos os dias. Ver ar-data-sync/src/darLocal.js.

  1. Actualiza o código (git pull --ff-only: só avança, nunca mexe em
     alterações locais; se não puder, corre com o que está).
  2. Instala as dependências se faltarem ou se o package.json mudou.
  3. Corre o passo do Diário e acrescenta a saída ao registo, que guarda só
     as últimas ~3000 linhas.

  Registo: %LOCALAPPDATA%\Parlamento3D\diario-local.log
#>
param(
  [string]$Node = 'node'
)

$ErrorActionPreference = 'Continue'
# O node escreve em UTF-8; sem isto os acentos chegam estragados ao registo.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$repo   = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sync   = Join-Path $repo 'ar-data-sync'
$pasta  = Join-Path $env:LOCALAPPDATA 'Parlamento3D'
$registo = Join-Path $pasta 'diario-local.log'
New-Item -ItemType Directory -Force -Path $pasta | Out-Null

function Escrever([string]$texto) {
  Add-Content -Path $registo -Value $texto -Encoding utf8
}

Escrever ''
Escrever ('=' * 60)
Escrever "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  início"

# 1. Código actualizado — só avança; nunca estraga trabalho local.
Push-Location $repo
$git = & cmd /c 'git pull --ff-only 2>&1' | Out-String
Escrever "git pull: $($git.Trim())"
Pop-Location

# 2. Dependências, se faltarem ou estiverem mais velhas do que o package.json.
$modulos = Join-Path $sync 'node_modules'
$pacote  = Join-Path $sync 'package.json'
if (-not (Test-Path $modulos) -or ((Get-Item $pacote).LastWriteTime -gt (Get-Item $modulos).LastWriteTime)) {
  Push-Location $sync
  $npm = & cmd /c 'npm install --no-audit --no-fund 2>&1' | Out-String
  Escrever "npm install: $($npm.Trim() -split "`n" | Select-Object -Last 1)"
  Pop-Location
}

# 3. O passo do Diário.
Push-Location $sync
# Pelo cmd: no PowerShell 5.1, o stderr de um programa vem embrulhado em
# erros do PowerShell e suja o registo.
$saida = & cmd /c "`"$Node`" src/darLocal.js 2>&1" | Out-String
$codigo = $LASTEXITCODE
Pop-Location
# As linhas de progresso usam \r; no registo só interessa a última de cada.
$limpa = ($saida -split "`n" | ForEach-Object { ($_ -split "`r")[-1] } | Where-Object { $_.Trim() -ne '' }) -join "`n"
Escrever $limpa
Escrever "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  fim (código $codigo)"

# Registo curto: as últimas ~3000 linhas chegam para perceber qualquer dia.
$linhas = Get-Content -Path $registo -Encoding utf8
if ($linhas.Count -gt 3000) {
  $linhas | Select-Object -Last 3000 | Set-Content -Path $registo -Encoding utf8
}

exit $codigo
