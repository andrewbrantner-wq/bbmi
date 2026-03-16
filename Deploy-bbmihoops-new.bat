@echo off
setlocal enabledelayedexpansion
cd /d C:\Users\andre\dev\my-app

echo ============================================================
echo   BBMI Deploy Script
echo ============================================================
echo.

:: ── STEP 1: Push main to production (bbmihoops) ──────────────

echo [1/3] Deploying main branch to production (bbmihoops.com)...
echo.

git checkout main
if errorlevel 1 (
    echo ERROR: Could not switch to main branch.
    pause
    exit /b 1
)

git add -A

:: Get today's date for commit message
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set DATESTR=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%

git diff --cached --quiet
if errorlevel 1 (
    git commit -m "Update %DATESTR%"
    git push origin main
    echo.
    echo [OK] main pushed to production.
) else (
    echo [SKIP] No staged changes on main — checking for unpushed commits...
    git push origin main
)
echo.

:: ── STEP 2: Ask about bbmisports sync ────────────────────────

echo ============================================================
echo [2/3] Sync files to bbmisports?
echo ============================================================
echo.
set /p SYNC_CHOICE="Sync selected files to bbmisports? (y/n): "
if /i not "%SYNC_CHOICE%"=="y" (
    echo.
    echo [SKIP] bbmisports sync skipped.
    echo.
    echo ============================================================
    echo   Deploy complete!
    echo ============================================================
    pause
    exit /b 0
)

:: ── STEP 3: Pick files to sync ───────────────────────────────

echo.
echo ============================================================
echo [3/3] Select files to sync from main to bbmisports
echo ============================================================
echo.
echo Which files do you want to sync? Enter numbers separated by
echo spaces (e.g. "1 3 5"), or "A" for all except navbar.
echo.
echo   --- Pages ---
echo   1  Today's Picks        src/app/ncaa-todays-picks/page.tsx
echo   2  Rankings Page         src/app/ncaa-rankings/page.tsx
echo   3  Team Page             src/app/ncaa-team/[team]/page.tsx
echo   4  Picks History         src/app/ncaa-model-picks-history/page.tsx
echo   5  Bracket Challenge     src/app/bracket-challenge
echo   6  Bracket Leaderboard   src/app/bracket-leaderboard
echo   7  Homepage              src/app/page.tsx
echo   8  Auth Context          src/app/AuthContext.tsx
echo.
echo   --- Components (Navbar is NEVER synced) ---
echo   9  All components        src/components (excludes Navbar.tsx)
echo  10  BracketPulseTable     src/components/BracketPulseTable.tsx
echo  11  WIAA Bracket Table    src/components/WIAABracketPulseTable.tsx
echo  12  Edge Performance      src/components/EdgePerformanceGraph.tsx
echo.
echo   --- Data ---
echo  13  All data (JSON)       src/data
echo.
set /p FILE_CHOICE="Your selection: "

:: Build the file list
set "FILES="
set "NEED_COMPONENT_RESTORE=0"

:: Check for "all"
if /i "%FILE_CHOICE%"=="A" (
    set "FILES=src/app/ncaa-todays-picks/page.tsx src/app/ncaa-rankings/page.tsx src/app/ncaa-team src/app/ncaa-model-picks-history/page.tsx src/app/bracket-challenge src/app/bracket-leaderboard src/app/page.tsx src/app/AuthContext.tsx src/components src/data"
    set "NEED_COMPONENT_RESTORE=1"
    goto :DO_SYNC
)

:: Parse individual selections
for %%N in (%FILE_CHOICE%) do (
    if "%%N"=="1"  set "FILES=!FILES! src/app/ncaa-todays-picks/page.tsx"
    if "%%N"=="2"  set "FILES=!FILES! src/app/ncaa-rankings/page.tsx"
    if "%%N"=="3"  set "FILES=!FILES! src/app/ncaa-team"
    if "%%N"=="4"  set "FILES=!FILES! src/app/ncaa-model-picks-history/page.tsx"
    if "%%N"=="5"  set "FILES=!FILES! src/app/bracket-challenge"
    if "%%N"=="6"  set "FILES=!FILES! src/app/bracket-leaderboard"
    if "%%N"=="7"  set "FILES=!FILES! src/app/page.tsx"
    if "%%N"=="8"  set "FILES=!FILES! src/app/AuthContext.tsx"
    if "%%N"=="9"  set "FILES=!FILES! src/components" & set "NEED_COMPONENT_RESTORE=1"
    if "%%N"=="10" set "FILES=!FILES! src/components/BracketPulseTable.tsx"
    if "%%N"=="11" set "FILES=!FILES! src/components/WIAABracketPulseTable.tsx"
    if "%%N"=="12" set "FILES=!FILES! src/components/EdgePerformanceGraph.tsx"
    if "%%N"=="13" set "FILES=!FILES! src/data"
)

if "%FILES%"=="" (
    echo.
    echo [SKIP] No valid selections — skipping bbmisports sync.
    pause
    exit /b 0
)

:DO_SYNC
echo.
echo Syncing to bbmisports:%FILES%
if "%NEED_COMPONENT_RESTORE%"=="1" (
    echo.
    echo ** Navbar.tsx will be preserved on bbmisports **
)
echo.

git checkout bbmisports
if errorlevel 1 (
    echo ERROR: Could not switch to bbmisports branch.
    git checkout main
    pause
    exit /b 1
)

:: Save bbmisports navbar before syncing components
if "%NEED_COMPONENT_RESTORE%"=="1" (
    echo Backing up bbmisports Navbar.tsx...
    copy /Y src\components\Navbar.tsx src\components\Navbar.tsx.bbmisports.bak >nul 2>&1
    copy /Y src\components\NavBar.tsx src\components\NavBar.tsx.bbmisports.bak >nul 2>&1
)

git checkout main -- %FILES%
if errorlevel 1 (
    echo ERROR: Could not checkout files from main.
    git checkout main
    pause
    exit /b 1
)

:: Restore bbmisports navbar after component sync
if "%NEED_COMPONENT_RESTORE%"=="1" (
    echo Restoring bbmisports Navbar.tsx...
    if exist src\components\Navbar.tsx.bbmisports.bak (
        copy /Y src\components\Navbar.tsx.bbmisports.bak src\components\Navbar.tsx >nul
        del src\components\Navbar.tsx.bbmisports.bak >nul 2>&1
        git add src\components\Navbar.tsx
    )
    if exist src\components\NavBar.tsx.bbmisports.bak (
        copy /Y src\components\NavBar.tsx.bbmisports.bak src\components\NavBar.tsx >nul
        del src\components\NavBar.tsx.bbmisports.bak >nul 2>&1
        git add src\components\NavBar.tsx
    )
)

git commit -m "Sync from main %DATESTR%"
git push origin bbmisports

echo.
echo [OK] bbmisports updated and pushed.

:: Switch back to main
git checkout main

echo.
echo ============================================================
echo   Deploy complete!
echo   - main pushed to bbmihoops.com
echo   - bbmisports synced and pushed (Navbar preserved)
echo ============================================================
pause
