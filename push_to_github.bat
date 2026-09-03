@echo off
chcp 65001 > nul
set "PATH=C:\Users\PNUCOM4_043\.gemini\antigravity\scratch\mingit\cmd;%PATH%"

echo ========================================================
echo   อัปโหลดโปรเจกต์ระบบจัดการห้องเรียนขึ้น GitHub
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] ตรวจสอบสถานะ Git...
git status

echo.
echo [2/4] กำลังบันทึกไฟล์ทั้งหมด (git add & commit)...
git add .
git commit -m "Update Classroom Management System with Google Apps Script and Sheets integration"

echo.
echo [3/4] ตั้งค่า Branch หลักเป็น main...
git branch -M main

echo.
echo [4/4] เตรียมส่งขึ้น GitHub
echo --------------------------------------------------------
echo กรุณากรอก URL GitHub Repository ของคุณ
echo เช่น: https://github.com/username/classroom-system.git
echo --------------------------------------------------------
set /p REPO_URL="URL Repository: "

if "%REPO_URL%"=="" (
    echo [!] ไม่ได้กรอก URL กรุณาสร้าง Repository ที่ https://github.com/new แล้วรันไฟล์นี้ใหม่อีกครั้ง
    pause
    exit /b
)

git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo.
echo กำลัง Push ขึ้น GitHub...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   สำเร็จ! โปรเจกต์ถูกอัปโหลดขึ้น GitHub เรียบร้อยแล้ว
    echo ========================================================
) else (
    echo.
    echo [!] เกิดข้อผิดพลาดในการ Push กรุณาตรวจสอบสิทธิ์การเข้าสู่ระบบ GitHub หรือ Personal Access Token
)

pause
