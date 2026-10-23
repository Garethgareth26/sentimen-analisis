@echo off
cd /d %~dp0frontend
if not exist node_modules (
  echo [Setup] Menginstall Node.js dependencies frontend...
  call npm install
)
echo [AI X-Ray] Menjalankan Frontend Web Dashboard...
npm run dev
pause
