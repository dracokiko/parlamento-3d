Set-Location "C:\Users\HP\parlamento-3d"
$logFile = "C:\Users\HP\parlamento-3d\logs\sync.log"

$fs = [System.IO.FileStream]::new($logFile, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
$sw = [System.IO.StreamWriter]::new($fs, [System.Text.Encoding]::UTF8)
$sw.AutoFlush = $true

$sw.WriteLine("$(Get-Date -Format '[dd/MM/yyyy HH:mm:ss]') ===== SYNC INICIADO =====")

node ar-data-sync\src\sync.js 2>&1 | ForEach-Object { $sw.WriteLine($_) }

$sw.WriteLine("$(Get-Date -Format '[dd/MM/yyyy HH:mm:ss]') ===== SYNC CONCLUIDO =====")
$sw.Close()
$fs.Close()
