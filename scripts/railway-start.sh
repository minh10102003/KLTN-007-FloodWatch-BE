#!/usr/bin/env bash
# Monolith: FastAPI routing (python_routing) + Express (Node) trong cùng 1 Railway service.
# Railway: ưu tiên dùng `node scripts/railway-start.js` (path ổn định). Script bash giữ cho máy dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY_PORT="${PYTHON_ROUTING_PORT:-8001}"

cd "$ROOT/python_routing"
# python3: image Dockerfile cài venv PATH; local có thể là python
if command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi
"$PY" main.py &
PY_PID=$!

cleanup() {
  if kill -0 "$PY_PID" 2>/dev/null; then
    kill "$PY_PID" 2>/dev/null || true
    wait "$PY_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "$ROOT"
echo "[railway-start] Waiting for Python routing /health on 127.0.0.1:${PY_PORT} ..."
READY=0
if ! command -v curl >/dev/null 2>&1; then
  echo "[railway-start] ERROR: curl is required for health wait." >&2
  exit 1
fi
for _ in $(seq 1 120); do
  if curl -sf "http://127.0.0.1:${PY_PORT}/health" >/dev/null; then
    echo "[railway-start] Python routing is up."
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" != 1 ]; then
  echo "[railway-start] ERROR: Python /health did not become ready in time." >&2
  exit 1
fi

# Không dùng exec để trap EXIT chạy được và tắt Python khi Node thoát.
node server.js
