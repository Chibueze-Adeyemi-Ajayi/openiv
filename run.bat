@echo off
REM ---------------------------------------------------------------------------
REM Run the OpenIV backend locally.
REM
REM Behavior:
REM   * Working dir is forced to this script's folder (backend\) so that
REM     config\application.json resolves correctly.
REM   * If config\application.json is missing, it's seeded from the .example.
REM   * If the fat jar is missing (or --rebuild is passed), mvn package runs.
REM   * All remaining args are forwarded to the JVM.
REM
REM Usage:
REM   run.bat                 # build-if-needed, then run
REM   run.bat --rebuild       # force a fresh package, then run
REM ---------------------------------------------------------------------------

setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "JAR=target\openiv-backend-0.1.0-SNAPSHOT-fat.jar"
set "CONFIG=config\application.json"
set "EXAMPLE=config\application.json.example"

set "REBUILD=0"
if /I "%~1"=="--rebuild" (
  set "REBUILD=1"
  shift
)

if not exist "%CONFIG%" (
  if exist "%EXAMPLE%" (
    echo [run] %CONFIG% missing; seeding from %EXAMPLE%
    copy /Y "%EXAMPLE%" "%CONFIG%" >nul
  ) else (
    echo [run] WARNING: %CONFIG% not found and no example available.
    echo [run] Falling back to built-in defaults ^(user/password = openiv/openiv^).
  )
)

if "%REBUILD%"=="1" (
  echo [run] Forcing rebuild...
  call mvn -q package -DskipTests
  if errorlevel 1 goto :fail
) else (
  set "NEEDS_PKG=0"
  if not exist "%JAR%" (
    set "NEEDS_PKG=1"
    echo [run] Jar missing.
  ) else (
    rem Smart check: is anything in src/ newer than the jar? 
    rem xcopy /D /L returns files that would be copied (newer).
    for /f %%i in ('xcopy /D /L /S /Y "src" "%JAR%" 2^>nul ^| find /c /v ""') do if %%i gtr 1 set "NEEDS_PKG=1"
    for /f %%i in ('xcopy /D /L /Y "pom.xml" "%JAR%" 2^>nul ^| find /c /v ""') do if %%i gtr 1 set "NEEDS_PKG=1"
  )

  if "!NEEDS_PKG!"=="1" (
    echo [run] Source changes detected; rebuilding...
    call mvn -q package -DskipTests
    if errorlevel 1 goto :fail
  )
)

echo [run] Starting openiv-backend ^(java -jar %JAR%^)
java ^
  -XX:+ShowCodeDetailsInExceptionMessages ^
  -Dfile.encoding=UTF-8 ^
  -jar "%JAR%" %*

endlocal
goto :eof

:fail
echo [run] Build failed. Fix errors above and retry.
endlocal
exit /b 1
