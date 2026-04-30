@echo off
setlocal enabledelayedexpansion

echo =========================================
echo  Spirane na vsichki startirani procesi...
echo =========================================

REM Kill processes on ports (frontend/backend)
call :killPort 3000
call :killPort 3001

REM Optional: kill any remaining node (comment out if you use other Node apps)
REM taskkill /F /IM node.exe >nul 2>&1

echo.
echo =========================================
echo  Startirane na SmolyanKlima...
echo =========================================

REM Start Frontend (Vite) on :3000
start "SmolyanKlima Frontend" cmd /k "cd /d %~dp0 && npm run dev"

REM Start Backend (Next.js) on :3001
start "SmolyanKlima Backend" cmd /k "cd /d %~dp0backend && npm run dev"

echo.
echo Started:
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:3001
echo.
exit /b 0

:killPort
set PORT=%1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Killing PID %%a on port %PORT% ...
  taskkill /F /PID %%a >nul 2>&1
)
exit /b 0
