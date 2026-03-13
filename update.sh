#!/usr/bin/env bash
# ── RolerZ 服务器更新脚本 ──
# 用法: sudo ./update.sh
# 在服务器 /opt/rolerz 目录下执行

set -euo pipefail

APP_DIR="/opt/rolerz"
APP_USER="rolerz"

if [ "$(id -u)" -ne 0 ]; then
    echo "请使用 sudo 执行"
    exit 1
fi

echo "=== RolerZ 更新开始 ==="

# ── 1. 拉取最新代码 ──
echo "[1/4] 拉取最新代码..."
cd "$APP_DIR"
sudo -u "$APP_USER" git pull origin main

# ── 2. Python 依赖更新 ──
echo "[2/4] 更新 Python 依赖..."
sudo -u "$APP_USER" bash -c "
    source $APP_DIR/venv/bin/activate
    pip install -q --upgrade pip
    pip install -q fastapi uvicorn 'psycopg[binary]' python-jose[cryptography] pydantic cryptography anthropic openai httpx
"

# ── 3. 前端重新构建 ──
echo "[3/4] 构建前端..."
cd "$APP_DIR/frontend"
sudo -u "$APP_USER" npm install --silent
sudo -u "$APP_USER" npm run build

# ── 4. 重启后端服务 ──
echo "[4/4] 重启服务..."
systemctl restart rolerz

echo ""
echo "=== 更新完成 ==="
echo "  后端状态: sudo systemctl status rolerz"
echo "  查看日志: sudo journalctl -u rolerz -f"
