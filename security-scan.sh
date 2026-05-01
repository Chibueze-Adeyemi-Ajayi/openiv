#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Periodic vulnerability scan for openiv-backend.
#
# Runs the OWASP dependency-check Maven profile (-Psecurity-scan) which fails
# the build on any compile/runtime dep with CVSS >= 7.0 (High/Critical).
# Excluded from the default build so dev iteration stays fast.
#
# Reports:
#   * Latest:    target/dependency-check-report.html
#   * Archived:  security-reports/report-YYYYMMDD_HHMMSS.html (audit trail)
#
# Usage:
#   ./security-scan.sh              full scan, fails build on high/critical CVEs
#   ./security-scan.sh --offline    re-analyze using the cached NVD data only
#   ./security-scan.sh --updates    also list outdated dependencies (advisory)
# ---------------------------------------------------------------------------

cd "$(dirname "$0")" || exit 1

ARCHIVE_DIR="security-reports"
mkdir -p "$ARCHIVE_DIR"

TS=$(date +"%Y%m%d_%H%M%S")

MVN_EXTRA=""
if [ -n "$NVD_API_KEY" ]; then
  echo "[scan] Using NVD API key from environment."
  MVN_EXTRA="-DnvdApiKey=$NVD_API_KEY"
else
  echo "[scan] WARNING: NVD_API_KEY is not set. First scan may take 15+ minutes."
  echo "[scan]          Request a free key at https://nvd.nist.gov/developers/request-an-api-key"
  echo "[scan]          then: export NVD_API_KEY=your-key-here"
fi

FLAG_OFFLINE=0
FLAG_UPDATES=0

for arg in "$@"; do
  if [ "$arg" = "--offline" ]; then
    FLAG_OFFLINE=1
  elif [ "$arg" = "--updates" ]; then
    FLAG_UPDATES=1
  fi
done

if [ "$FLAG_OFFLINE" -eq 1 ]; then
  MVN_EXTRA="$MVN_EXTRA -DautoUpdate=false"
fi

echo "[scan] Starting dependency-check at $TS"
echo "[scan] Archive dir: $ARCHIVE_DIR"
echo

mvn -Psecurity-scan verify $MVN_EXTRA
RC=$?

if [ -f "target/dependency-check-report.html" ]; then
  cp "target/dependency-check-report.html" "$ARCHIVE_DIR/report-$TS.html"
  echo "[scan] HTML report archived: $ARCHIVE_DIR/report-$TS.html"
fi
if [ -f "target/dependency-check-report.json" ]; then
  cp "target/dependency-check-report.json" "$ARCHIVE_DIR/report-$TS.json"
fi
if [ -f "target/dependency-check-report.xml" ]; then
  cp "target/dependency-check-report.xml" "$ARCHIVE_DIR/report-$TS.xml"
fi

echo
if [ $RC -eq 0 ]; then
  echo "[scan] PASS: no vulnerabilities above CVSS 7.0 threshold."
else
  echo "[scan] FAIL: see $ARCHIVE_DIR/report-$TS.html"
  echo "[scan]       Fix: bump the dep, add a verified suppression to"
  echo "[scan]            dependency-check-suppressions.xml, or raise the issue."
fi

if [ "$FLAG_UPDATES" -eq 1 ]; then
  echo
  echo "[scan] --updates: listing outdated dependencies (advisory only)..."
  mvn -q versions:display-dependency-updates versions:display-plugin-updates
fi

exit $RC
