@echo on
setlocal enabledelayedexpansion
echo ============================================
echo   BBMI DEPLOYMENT: bbmihoops
echo   Branch: main
echo   + Auto-sync data to bbmisports
echo ============================================
set PROJECT_DIR=C:\Users\andre\dev\my-app
set PIPELINE_DIR=C:\Users\andre\BoundScraper\bbmi_pipeline
set BRANCH=main
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
echo ============================================
echo   Building tournament results...
echo ============================================
python "%PIPELINE_DIR%\build_tournament_results.py" || (
    echo WARNING: build_tournament_results.py failed — continuing deploy
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
set COMMIT_MSG=Auto-deploy bbmihoops %YY%-%DOW%-%MM% %TS%
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
echo   DEPLOYMENT COMPLETE: bbmihoops [main]
echo ============================================
echo.
echo ============================================
echo   SYNCING DATA TO bbmisports...
echo ============================================
echo.
echo Switching to bbmisports branch...
git checkout bbmisports || (
    echo CHECKOUT bbmisports FAILED
    pause
    exit /b
)
echo.
echo Copying data files from main...
git checkout main -- src/data || (
    echo DATA COPY FAILED
    pause
    exit /b
)
echo.
echo Staging data...
git add src/data || (
    echo GIT ADD DATA FAILED
    pause
    exit /b
)
echo.
git commit -m "Sync data from main %YY%-%DOW%-%MM% %TS%" || echo No data changes to sync.
echo.
echo Pushing bbmisports to GitHub...
git push origin bbmisports || (
    echo GIT PUSH bbmisports FAILED
    pause
    exit /b
)
echo.
echo Switching back to main...
git checkout main
echo.
echo ============================================
echo   ALL DONE: bbmihoops deployed + bbmisports data synced
echo ============================================
popd
echo.
pause
endlocal
