@echo off
REM ---------------------------------------------------------------------------
REM Periodic vulnerability scan for openiv-backend.
REM
REM Runs the OWASP dependency-check Maven profile (-Psecurity-scan) which fails
REM the build on any compile/runtime dep with CVSS >= 7.0 (High/Critical).
REM Excluded from the default build so dev iteration stays fast.
REM
REM Reports:
REM   * Latest:    target\dependency-check-report.html
REM   * Archived:  security-reports\report-YYYYMMDD_HHMMSS.html (audit trail)
REM
REM NVD API key (STRONGLY recommended):
REM   Without a key, the first run takes 10-20 minutes and is rate-limited.
REM   With a key, first run is ~2-3 min; incremental runs ~30s.
REM   1) Request free key: https://nvd.nist.gov/developers/request-an-api-key
REM   2) Persist it:       setx NVD_API_KEY your-key-here
REM   3) Open a new shell, then run this script.
REM
REM Exit codes:
REM   0  Clean (no vulns above threshold)
REM   1  Vulnerabilities found OR scan error (see report)
REM
REM Usage:
REM   security-scan.bat              full scan, fails build on high/critical CVEs
REM   security-scan.bat --offline    re-analyze using the cached NVD data only
REM   security-scan.bat --updates    also list outdated dependencies (advisory)
REM
REM Scheduling (run weekly):
REM   schtasks /Create /SC WEEKLY /D MON /TN "openiv-sec-scan" /TR ^
REM     "c:\Users\Chibueze\Projects\openiv\backend\security-scan.bat" /ST 06:00
REM ---------------------------------------------------------------------------

setlocal EnableExtensions
cd /d "%~dp0"

set "ARCHIVE_DIR=security-reports"
if not exist "%ARCHIVE_DIR%" mkdir "%ARCHIVE_DIR%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%i"

set "MVN_EXTRA="
if defined NVD_API_KEY (
  echo [scan] Using NVD API key from environment.
  set "MVN_EXTRA=-DnvdApiKey=%NVD_API_KEY%"
) else (
  echo [scan] WARNING: NVD_API_KEY is not set. First scan may take 15+ minutes.
  echo [scan]          Request a free key at https://nvd.nist.gov/developers/request-an-api-key
  echo [scan]          then: setx NVD_API_KEY your-key-here
)

set "FLAG_OFFLINE=0"
set "FLAG_UPDATES=0"
if /I "%~1"=="--offline" set "FLAG_OFFLINE=1"
if /I "%~1"=="--updates" set "FLAG_UPDATES=1"
if /I "%~2"=="--updates" set "FLAG_UPDATES=1"

if "%FLAG_OFFLINE%"=="1" set "MVN_EXTRA=%MVN_EXTRA% -DautoUpdate=false"

echo [scan] Starting dependency-check at %TS%
echo [scan] Archive dir: %ARCHIVE_DIR%
echo.

call mvn -Psecurity-scan verify %MVN_EXTRA%
set "RC=%ERRORLEVEL%"

if exist "target\dependency-check-report.html" (
  copy /Y "target\dependency-check-report.html" "%ARCHIVE_DIR%\report-%TS%.html" >nul
  echo [scan] HTML report archived: %ARCHIVE_DIR%\report-%TS%.html
)
if exist "target\dependency-check-report.json" (
  copy /Y "target\dependency-check-report.json" "%ARCHIVE_DIR%\report-%TS%.json" >nul
)
if exist "target\dependency-check-report.xml" (
  copy /Y "target\dependency-check-report.xml" "%ARCHIVE_DIR%\report-%TS%.xml" >nul
)

echo.
if "%RC%"=="0" (
  echo [scan] PASS: no vulnerabilities above CVSS 7.0 threshold.
) else (
  echo [scan] FAIL: see %ARCHIVE_DIR%\report-%TS%.html
  echo [scan]       Fix: bump the dep, add a verified suppression to
  echo [scan]            dependency-check-suppressions.xml, or raise the issue.
)

if "%FLAG_UPDATES%"=="1" (
  echo.
  echo [scan] --updates: listing outdated dependencies ^(advisory only^)...
  call mvn -q versions:display-dependency-updates versions:display-plugin-updates
)

endlocal & exit /b %RC%
