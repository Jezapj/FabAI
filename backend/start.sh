#!/bin/sh
set -e

PORT="${PORT:-8080}"
echo "Starting gunicorn on 0.0.0.0:${PORT} (PORT env=${PORT})"

exec gunicorn \
  --bind "0.0.0.0:${PORT}" \
  --workers 1 \
  --worker-class sync \
  --timeout 180 \
  --graceful-timeout 30 \
  --access-logfile - \
  --error-logfile - \
  --capture-output \
  backend:app
