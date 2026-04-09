@echo off
echo Iniciando TradeFlow...
cd "C:\Users\Brais\Desktop\TradeFlow (previa de final)"
start /min cmd /c "npm run dev"
timeout /t 3 /nobreak > NUL
start http://localhost:3000