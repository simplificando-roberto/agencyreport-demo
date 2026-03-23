#!/bin/sh
set -e

echo "[start.sh] Starting backend on :8000..."
cd /app
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

echo "[start.sh] Waiting for backend..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
    echo "[start.sh] Backend ready!"
    break
  fi
  sleep 1
done

echo "[start.sh] Starting frontend on :3000..."
cd /app/frontend
API_URL=http://localhost:8000 PORT=3000 HOSTNAME=0.0.0.0 exec node server.js
