#!/bin/sh
# API: /docs on PORT; scheduler: /health on PORT (see scheduler_minimal).

set -e
cd /app 2>/dev/null || true

_raw="${PORT:-8000}"
port=$(printf '%s' "$_raw" | tr -d '\r\n\t ')
case "$port" in ''|*[!0-9]*) port=8000 ;; esac

if [ "${PRDIKTIT_RUN_SCHEDULER:-0}" = "1" ]; then
  exec curl -fsS "http://127.0.0.1:${port}/health" >/dev/null
else
  exec curl -fsS "http://127.0.0.1:${port}/docs" >/dev/null
fi
