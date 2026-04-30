#!/bin/sh
# Matches scheduler_minimal (PORT, /health) vs API (/docs on same PORT).

set -e
port="${PORT:-8000}"
if [ "${PRDIKTIT_RUN_SCHEDULER:-0}" = "1" ]; then
  exec curl -fsS "http://127.0.0.1:${port}/health" >/dev/null
else
  exec curl -fsS "http://127.0.0.1:${port}/docs" >/dev/null
fi
