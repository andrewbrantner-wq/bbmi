@echo on
setlocal enabledelayedexpansion
echo ============================================
echo   BBMI DEPLOYMENT: bbmisports
echo   Branch: bbmisports
echo ============================================

set PROJECT_DIR=C:\Users\andre\dev\my-app
set BRANCH=bbmisports

pushd "%PROJECT_DIR%" || (
    echo FAILED: Could not change directory to %PROJECT_DIR%
    pause
    exit /b
)
cd /d "%PROJECT_DIR%" || (
    echo FAILED: cd /d to project directory failed
    pause
    exit /b
)

echo.
echo CURRENT DIRECTORY:
cd
echo.

echo Checking out branch: %BRANCH%
git checkout %BRANCH% || (
    echo CHECKOUT FAILED
    pause
    exit /b
)

echo.
echo Pulling latest changes from GitHub...
git pull || (
    echo GIT PULL FAILED
    pause
    exit /b
)

echo.
echo Staging changes...
git add -A || (
    echo GIT ADD FAILED
    pause
    exit /b
)

echo.
for /f "tokens=1-4 delims=/ " %%a in ("%date%") do (
    set MM=%%a
    set DD=%%b
    set DOW=%%c
    set YY=%%d
)
set TS=%time: =0%
set TS=%TS::=%
set COMMIT_MSG=Auto-deploy bbmisports %YY%-%DOW%-%MM% %TS%

echo Committing with message: "%COMMIT_MSG%"
git commit -m "%COMMIT_MSG%" || echo No changes to commit.

echo.
echo Pushing to GitHub (branch: %BRANCH%)...
git push origin %BRANCH% || (
    echo GIT PUSH FAILED
    pause
    exit /b
)

echo.
echo Forcing correct directory before Vercel deploy...
cd /d "%PROJECT_DIR%"

echo.
echo Deploying to Vercel (prod)...
vercel --prod --yes || (
    echo VERCEL DEPLOY FAILED
    pause
    exit /b
)

echo.
echo ============================================
echo   DEPLOYMENT COMPLETE: bbmisports [bbmisports]
echo ============================================
popd
echo.
pause
endlocal
