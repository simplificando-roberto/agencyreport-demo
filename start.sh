#!/bin/sh
# Start FastAPI backend in background
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start Next.js frontend (standalone) - this is the main process
cd /app/frontend
API_URL=http://localhost:8000 PORT=3000 HOSTNAME=0.0.0.0 node server.js
