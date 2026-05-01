#!/bin/sh
# Railway / Docker: Gunicorn API vs scheduler worker.
# Set PRDIKTIT_RUN_SCHEDULER=1 on the scheduler Railway service only (not the public API).

set -e

cd /app || {
  echo "railway-start: ERROR cannot cd to /app (pwd=$(pwd))" >&2
  exit 1
}

# Sanitize PORT (strip CR/LF/spaces; Railway must match this bind).
_raw="${PORT:-8000}"
PORT=$(printf '%s' "$_raw" | tr -d '\r\n\t ')
case "$PORT" in ''|*[!0-9]*) PORT=8000 ;; esac
export PORT

echo "railway-start: cwd=$(pwd) PORT=${PORT} PRDIKTIT_RUN_SCHEDULER=${PRDIKTIT_RUN_SCHEDULER:-0} WEB_CONCURRENCY=${WEB_CONCURRENCY:-2}" >&2

if [ "${PRDIKTIT_RUN_SCHEDULER:-0}" = "1" ]; then
  exec python -m app.scheduler_minimal
fi

WORKERS="${WEB_CONCURRENCY:-2}"
case "$WORKERS" in ''|*[!0-9]*) WORKERS=2 ;; esac

exec gunicorn app.main:app \
  -w "$WORKERS" \
  -k uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT}" \
  --access-logfile - \
  --error-logfile -
