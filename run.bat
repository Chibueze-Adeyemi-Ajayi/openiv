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

setlocal EnableExtensions
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
) else if not exist "%JAR%" (
  echo [run] Fat jar missing; running mvn package...
  call mvn -q package -DskipTests
  if errorlevel 1 goto :fail
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
