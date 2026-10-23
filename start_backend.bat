@echo off
cd /d %~dp0backend
rem 1. Deteksi path Python (Gunakan Anaconda jika ada, fallback ke python sistem)
if exist "C:\Users\LENOVO\AppData\Local\anaconda3\envs\ai_vision\python.exe" (
  set "PYTHON_BIN=C:\Users\LENOVO\AppData\Local\anaconda3\envs\ai_vision\python.exe"
) else (
  set "PYTHON_BIN=python"
)

rem 2. Install dependencies jika pertama kali dipindahkan
if not exist node_modules (
  echo [Setup] Menginstall Node.js dependencies backend...
  call npm install
)

rem 3. Jalankan server
echo [AI X-Ray] Menjalankan Backend & AI Sidecar...
npm start
pause
