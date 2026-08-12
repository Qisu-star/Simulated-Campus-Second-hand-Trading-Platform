#!/bin/sh
# =============================================================================
# start.sh — Entrypoint for the Docker container
# Starts both the backend and frontend servers
# =============================================================================
set -e

cd /app

echo "================================================"
echo "  校园二手集市 — Starting services"
echo "================================================"
echo "Backend port: ${BACKEND_PORT:-7001}"
echo "Frontend port: ${FRONTEND_PORT:-3000}"
echo "Data directory: /app/data"
echo "Uploads directory: /app/uploads"
echo "================================================"

# ---- Start backend ----
echo "[backend] Starting Midway.js server..."
cd /app/backend
BACKEND_PORT=${BACKEND_PORT:-7001} \
  node bootstrap.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "[backend] Waiting for server to start..."
for i in $(seq 1 30); do
  if node -e "require('http').get('http://127.0.0.1:${BACKEND_PORT:-7001}/api/items', (r) => {process.exit(r.statusCode ? 0 : 1)}).on('error', () => process.exit(1))" 2>/dev/null; then
    echo "[backend] Ready on port ${BACKEND_PORT:-7001}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "[backend] WARNING: Server did not start in time, continuing anyway..."
  fi
  sleep 1
done

# ---- Start frontend ----
echo "[frontend] Starting Next.js server..."
cd /app/frontend
PORT=${FRONTEND_PORT:-3000} \
  HOSTNAME=0.0.0.0 \
  BACKEND_INTERNAL_URL=http://127.0.0.1:${BACKEND_PORT:-7001} \
  node server.js &
FRONTEND_PID=$!

echo "================================================"
echo "  Frontend: http://0.0.0.0:${FRONTEND_PORT:-3000}"
echo "  Backend:  http://127.0.0.1:${BACKEND_PORT:-7001}"
echo "================================================"

# Trap SIGTERM/SIGINT and forward to child processes
trap 'echo "Shutting down..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; wait' TERM INT

# Wait for either process to exit
wait