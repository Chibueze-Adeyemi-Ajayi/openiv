#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Run the OpenIV backend locally.
#
# Behavior:
#   * Working dir is forced to this script's folder (backend/) so that
#     config/application.json resolves correctly.
#   * If config/application.json is missing, it's seeded from the .example.
#   * If the fat jar is missing (or --rebuild is passed), mvn package runs.
#   * All remaining args are forwarded to the JVM.
#
# Usage:
#   ./run.sh                 # build-if-needed, then run
#   ./run.sh --rebuild       # force a fresh package, then run
# ---------------------------------------------------------------------------

cd "$(dirname "$0")" || exit 1

JAR="target/openiv-backend-0.1.0-SNAPSHOT-fat.jar"
CONFIG="config/application.json"
EXAMPLE="config/application.json.example"

REBUILD=0
if [ "$1" = "--rebuild" ]; then
  REBUILD=1
  shift
fi

if [ ! -f "$CONFIG" ]; then
  if [ -f "$EXAMPLE" ]; then
    echo "[run] $CONFIG missing; seeding from $EXAMPLE"
    cp "$EXAMPLE" "$CONFIG"
  else
    echo "[run] WARNING: $CONFIG not found and no example available."
    echo "[run] Falling back to built-in defaults (user/password = openiv/openiv)."
  fi
fi

fail() {
  echo "[run] Build failed. Fix errors above and retry."
  exit 1
}

if [ "$REBUILD" -eq 1 ]; then
  echo "[run] Forcing rebuild..."
  mvn -q package -DskipTests || fail
else
  NEEDS_PKG=0
  if [ ! -f "$JAR" ]; then
    NEEDS_PKG=1
    echo "[run] Jar missing."
  else
    # Smart check: is anything in src/ or pom.xml newer than the jar?
    # Using find to check if any file in src/ or pom.xml is newer than the jar
    # We ignore standard error to suppress warnings if src/ doesn't exist etc.
    NEWER_FILES=$(find src pom.xml -type f -newer "$JAR" 2>/dev/null | head -n 1)
    if [ -n "$NEWER_FILES" ]; then
      NEEDS_PKG=1
    fi
  fi

  if [ "$NEEDS_PKG" -eq 1 ]; then
    echo "[run] Source changes detected; rebuilding..."
    mvn -q package -DskipTests || fail
  fi
fi

echo "[run] Starting openiv-backend (java -jar $JAR)"
exec java \
  -XX:+ShowCodeDetailsInExceptionMessages \
  -Dfile.encoding=UTF-8 \
  -jar "$JAR" "$@"
