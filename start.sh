#!/bin/sh
set -e

# Start FastAPI backend in background
echo "[start.sh] Starting backend on :8000..."
cd /app
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start ttyd (web terminal) on port 7681 with SSL
echo "[start.sh] Starting web terminal on :7681..."
ttyd -p 7681 -W -S -C /etc/ssl/server.crt -K /etc/ssl/server.key bash --login &

# Wait for backend to be ready
echo "[start.sh] Waiting for backend..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
    echo "[start.sh] Backend ready!"
    break
  fi
  sleep 1
done

# Start Next.js frontend (standalone) - this is the main process
echo "[start.sh] Starting frontend on :3000..."
cd /app/frontend
API_URL=http://localhost:8000 PORT=3000 HOSTNAME=0.0.0.0 exec node server.js
