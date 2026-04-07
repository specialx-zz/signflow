@echo off
echo ========================================
echo   MagicInfo Clone - Setup Script
echo ========================================
echo.

echo [1/4] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Backend npm install failed
    pause
    exit /b 1
)

echo.
echo [2/4] Setting up database...
call npx prisma db push
if %errorlevel% neq 0 (
    echo ERROR: Database setup failed
    pause
    exit /b 1
)

echo.
echo [3/4] Seeding database with sample data...
call node src/utils/seed.js
if %errorlevel% neq 0 (
    echo ERROR: Database seeding failed
    pause
    exit /b 1
)

echo.
echo [4/4] Installing frontend dependencies...
cd ..\frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend npm install failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo To start the application:
echo   1. Backend: cd backend ^&^& npm run dev
echo   2. Frontend: cd frontend ^&^& npm run dev
echo.
echo Login credentials:
echo   Admin: admin@magicinfo.com / admin123
echo   User:  user@magicinfo.com / user123
echo.
pause
