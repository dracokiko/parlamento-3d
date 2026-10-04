<#
  Instala a tarefa agendada que lê o Diário da AR a partir deste computador.

  - Todos os dias às 11:00; se o computador estiver desligado a essa hora,
    corre assim que for ligado (StartWhenAvailable).
  - Corre também com o portátil a bateria, e só com rede.
  - Nunca duas ao mesmo tempo; no máximo 2 horas.

  Para desligar (por exemplo, se a AR pedir que paremos, ou quando o GitHub
  voltar a ser aceite):
      Unregister-ScheduledTask -TaskName 'Parlamento3D - Diario da AR' -Confirm:$false
  e tirar DIARIO_FORA_DO_GITHUB de .github/workflows/ar-sync.yml.
#>
$ErrorActionPreference = 'Stop'

$nome   = 'Parlamento3D - Diario da AR'
$script = Join-Path $PSScriptRoot 'diario-local.ps1'
$node   = (Get-Command node -ErrorAction Stop).Source
$repo   = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$acao = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Node `"$node`"" `
  -WorkingDirectory $repo
$quando = New-ScheduledTaskTrigger -Daily -At '11:00'
$regras = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$descricao = 'Lê o Diário da Assembleia da República para o Parlamento 3D a partir deste computador, enquanto o site da AR recusar os servidores do GitHub. Ver ar-data-sync/src/darLocal.js.'

# Primeiro sem janela e sem precisar de sessão aberta (S4U); se o Windows
# não deixar sem privilégios de administrador, fica a correr com a sessão
# aberta, numa janela escondida.
try {
  $quem = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited
  Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $quando -Settings $regras -Principal $quem `
    -Description $descricao -Force -ErrorAction Stop | Out-Null
  Write-Output "Tarefa instalada (corre mesmo sem sessão aberta): $nome"
} catch {
  $quem = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $quando -Settings $regras -Principal $quem `
    -Description $descricao -Force -ErrorAction Stop | Out-Null
  Write-Output "Tarefa instalada (corre com a sessão aberta): $nome"
}
Write-Output "node: $node"
Write-Output "registo: $(Join-Path $env:LOCALAPPDATA 'Parlamento3D\diario-local.log')"
