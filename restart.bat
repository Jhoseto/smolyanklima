@echo off
echo =========================================
echo  Spirane na vsichki startirani procesi...
echo =========================================

:: Убиване на всички Node.js процеси (което ще спре Vite сървъра)
taskkill /F /IM node.exe >nul 2>&1

echo.
echo =========================================
echo  Startirane na SmolyanKlima...
echo =========================================

:: Стартиране на приложението
npm run dev
