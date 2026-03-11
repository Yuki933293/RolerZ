#!/usr/bin/env bash
# ── RolerZ 一键部署脚本（Ubuntu 22.04） ──
# 用法: 在服务器上执行
#   1. git clone https://github.com/Yuki933293/RolerZ.git
#   2. cd RolerZ
#   3. chmod +x deploy.sh
#   4. sudo ./deploy.sh YOUR_DOMAIN.com
#
# 前置条件: 域名已解析到服务器 IP

set -euo pipefail

DOMAIN="${1:-}"
APP_DIR="/opt/rolerz"
APP_USER="rolerz"

if [ -z "$DOMAIN" ]; then
    echo "用法: sudo ./deploy.sh YOUR_DOMAIN.com"
    exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
    echo "请使用 sudo 执行"
    exit 1
fi

echo "=== RolerZ 部署开始 ==="
echo "域名: $DOMAIN"

# ── 1. 系统依赖 ──
echo "[1/8] 安装系统依赖..."
apt update -qq
apt install -y -qq python3 python3-pip python3-venv nginx certbot python3-certbot-nginx curl

# 安装 Node.js 18 (via NodeSource)
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y -qq nodejs
fi

# ── 2. 创建应用用户和目录 ──
echo "[2/8] 创建应用目录..."
id -u "$APP_USER" &>/dev/null || useradd -r -m -s /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"
cp -r . "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ── 3. Python 虚拟环境 + 依赖 ──
echo "[3/8] 安装 Python 依赖..."
cd "$APP_DIR"
sudo -u "$APP_USER" python3 -m venv venv
sudo -u "$APP_USER" bash -c "
    source $APP_DIR/venv/bin/activate
    pip install -q --upgrade pip
    pip install -q fastapi uvicorn python-jose[cryptography] pydantic anthropic openai httpx
"

# ── 4. 前端构建 ──
echo "[4/8] 构建前端..."
cd "$APP_DIR/frontend"
sudo -u "$APP_USER" npm install --silent
sudo -u "$APP_USER" npm run build

# ── 5. 环境变量 ──
echo "[5/8] 配置环境变量..."
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << EOF
JWT_SECRET=$JWT_SECRET
CORS_ORIGINS=https://$DOMAIN
DEV_MODE=
EOF
    chown "$APP_USER:$APP_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo "  .env 已生成（JWT_SECRET 随机生成）"
else
    echo "  .env 已存在，跳过"
fi

# ── 6. systemd 服务 ──
echo "[6/8] 配置 systemd 服务..."
cat > /etc/systemd/system/rolerz.service << EOF
[Unit]
Description=RolerZ Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$APP_DIR/venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rolerz
systemctl restart rolerz

# ── 7. nginx 配置 ──
echo "[7/8] 配置 nginx..."
cat > /etc/nginx/sites-available/rolerz << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # 前端静态文件
    root $APP_DIR/frontend/dist;
    index index.html;

    # API 反代到 uvicorn
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    # SPA fallback — 所有非文件请求返回 index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 静态资源缓存
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/rolerz /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 8. HTTPS (Let's Encrypt) ──
echo "[8/8] 申请 HTTPS 证书..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || {
    echo "  HTTPS 申请失败（域名可能未解析到此服务器），可稍后手动执行:"
    echo "  sudo certbot --nginx -d $DOMAIN"
}

# ── 9. SQLite 定时备份 ──
BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR"
chown "$APP_USER:$APP_USER" "$BACKUP_DIR"
cat > /etc/cron.d/rolerz-backup << 'EOF'
# 每天凌晨 3 点备份 SQLite，保留最近 30 天
0 3 * * * rolerz cp /opt/rolerz/persona_forge.db /opt/rolerz/backups/persona_forge_$(date +\%Y\%m\%d).db && find /opt/rolerz/backups -name "*.db" -mtime +30 -delete
EOF

echo ""
echo "=== 部署完成 ==="
echo "  访问: https://$DOMAIN"
echo "  后端状态: sudo systemctl status rolerz"
echo "  查看日志: sudo journalctl -u rolerz -f"
echo "  更新部署: cd $APP_DIR && git pull && sudo systemctl restart rolerz"
echo ""
echo "  首次注册的用户(id=1)自动成为管理员"
