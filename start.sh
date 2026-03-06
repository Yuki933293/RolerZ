#!/bin/bash
# Persona Forge — 启动前后端
# Usage: ./start.sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Persona Forge ==="
echo "启动后端 (FastAPI) ..."
cd "$ROOT_DIR"
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "启动前端 (Vite) ..."
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "后端: http://localhost:8000"
echo "前端: http://localhost:5173"
echo "API 文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
