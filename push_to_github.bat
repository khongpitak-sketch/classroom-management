@echo off
chcp 65001 > nul
set "PATH=C:\Users\PNUCOM4_043\.gemini\antigravity\scratch\mingit\cmd;C:\Users\PNUCOM4_043\.gemini\antigravity\scratch\mingit\mingw64\bin;%PATH%"

echo ========================================================
echo   อัปโหลดโปรเจกต์ระบบจัดการห้องเรียนขึ้น GitHub
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] ตรวจสอบความพร้อม...
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/khongpitak-sketch/classroom-management.git

echo.
echo [2/3] บันทึกไฟล์ล่าสุด...
git add .
git commit -m "Update Classroom Management System" 2>nul

echo.
echo [3/3] กำลังส่งขึ้น GitHub: https://github.com/khongpitak-sketch/classroom-management.git
echo (หากมีหน้าต่างเด้งขึ้นมา ให้เลือก 'Sign in with your browser' เพื่อเข้าสู่ระบบ)
echo.
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   [สำเร็จ] ส่งโปรเจกต์ขึ้น GitHub เรียบร้อยแล้ว!
    echo   URL: https://github.com/khongpitak-sketch/classroom-management
    echo ========================================================
) else (
    echo.
    echo [!] หากพบปัญหาการยืนยันตัวตน สามารถใช้ GitHub Personal Access Token ได้ครับ
)

pause
