@echo off
chcp 65001 > nul
cd /d "C:\Users\HP\parlamento-3d"
echo [%date% %time%] ===== SYNC INICIADO ===== >> logs\sync.log
node ar-data-sync\src\sync.js >> logs\sync.log 2>&1
echo [%date% %time%] ===== SYNC CONCLUIDO ===== >> logs\sync.log
