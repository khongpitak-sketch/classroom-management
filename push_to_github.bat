@echo off
chcp 65001 > nul
set "PATH=C:\Users\PNUCOM4_043\.gemini\antigravity\scratch\mingit\cmd;C:\Users\PNUCOM4_043\.gemini\antigravity\scratch\mingit\mingw64\bin;%PATH%"

echo =========================================================================
echo   🚀 ระบบอัปโหลด Classroom Management System ขึ้น GitHub
echo =========================================================================
echo Repository: https://github.com/khongpitak-sketch/classroom-management.git
echo สาขา (Branch): main
echo =========================================================================
echo.

cd /d "%~dp0"

echo [1/3] กำลังเตรียมไฟล์และบันทึก Commit...
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/khongpitak-sketch/classroom-management.git
git add .
git commit -m "Upload complete classroom management system with Google Sheets integration" 2>nul

echo.
echo [2/3] เลือกวิธีการเข้าสู่ระบบ GitHub:
echo -------------------------------------------------------------------------
echo  [1] ล็อกอินผ่านเว็บเบราว์เซอร์ (GitHub Browser Sign-in) - แนะนำ
echo  [2] ใช้ Personal Access Token (PAT)
echo -------------------------------------------------------------------------
set /p LOGIN_CHOICE="เลือกวิธี (กด 1 หรือ 2 แล้วกด Enter, หรือกด Enter ทันทีเพื่อใช้แบบที่ 1): "

if "%LOGIN_CHOICE%"=="2" (
    echo.
    echo กรุณาวาง GitHub Personal Access Token ของคุณ (เช่น ghp_xxxxxxxx...):
    set /p GITHUB_PAT="Token: "
    if not "%GITHUB_PAT%"=="" (
        echo กำลัง Push ด้วย Token...
        git push -u https://%GITHUB_PAT%@github.com/khongpitak-sketch/classroom-management.git main
        goto FINISH
    )
)

echo.
echo [3/3] กำลังเชื่อมต่อ GitHub...
echo (หากมีหน้าต่าง Browser เด้งขึ้นมา ให้กด 'Sign in with your browser' / 'Authorize')
echo.
git push -u origin main

:FINISH
if %ERRORLEVEL% EQU 0 (
    echo.
    echo =========================================================================
    echo   🎉 [สำเร็จ 100%%] ไฟล์ทั้งหมดถูก Push ขึ้น GitHub เรียบร้อยแล้ว!
    echo   👉 ดูไฟล์ใน Repo: https://github.com/khongpitak-sketch/classroom-management
    echo =========================================================================
    echo.
    echo 💡 ขั้นตอนเปิดเว็บฟรี (GitHub Pages):
    echo   1. ไปที่ https://github.com/khongpitak-sketch/classroom-management/settings/pages
    echo   2. ที่หัวข้อ Branch เลือก 'main' แล้วกด Save
    echo   3. จะได้ลิงก์เว็บใช้งานได้ทันที: https://khongpitak-sketch.github.io/classroom-management/
) else (
    echo.
    echo [!] หากพบปัญหาการยืนยันตัวตน สามารถสร้าง Personal Access Token ได้ที่:
    echo     https://github.com/settings/tokens (ติ๊กเลือกสิทธิ์ repo)
)

echo.
pause
