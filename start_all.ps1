# Vision Lab AI Launcher for PowerShell
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "            KHOI DONG VISION LAB AI" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Dang khoi dong Backend (FastAPI - Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload"

Write-Host "2. Dang khoi dong Frontend (Vite - Port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm --prefix frontend run dev"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Da khoi dong xong ca 2 tien trinh:" -ForegroundColor White
Write-Host "  - Backend API:  http://127.0.0.1:8000" -ForegroundColor Gray
Write-Host "  - Frontend App: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Mo trinh duyet va truy cap: http://localhost:5173" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
