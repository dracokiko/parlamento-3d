Set-Location "C:\Users\HP\parlamento-3d"
$logFile = "logs\sync.log"
$timestamp = Get-Date -Format "[dd/MM/yyyy HH:mm:ss]"
Add-Content -Path $logFile -Value "$timestamp ===== SYNC INICIADO =====" -Encoding UTF8
node ar-data-sync\src\sync.js 2>&1 | Add-Content -Path $logFile -Encoding UTF8
$timestamp = Get-Date -Format "[dd/MM/yyyy HH:mm:ss]"
Add-Content -Path $logFile -Value "$timestamp ===== SYNC CONCLUIDO =====" -Encoding UTF8
