#!/bin/sh
# Railway / Docker entry: backend API vs scheduler worker.
# Set PRDIKTIT_RUN_SCHEDULER=1 on the scheduler Railway service only.

set -e

if [ "${PRDIKTIT_RUN_SCHEDULER:-0}" = "1" ]; then
  exec python -m app.scheduler_minimal
fi

exec gunicorn app.main:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT:-8000}" \
  --access-logfile - \
  --error-logfile -
