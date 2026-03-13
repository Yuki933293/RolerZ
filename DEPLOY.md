# RolerZ 开发 & 部署指南

## 环境要求

- Python 3.10+
- Node.js 22+（Vite 7 要求 ≥20.19 或 ≥22.12）
- 服务器：Ubuntu 22.04，1 核 2G 内存起步

---

## 本地开发

```bash
# 一键启动前后端
./start.sh

# 或分别启动
# 后端
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 前端
cd frontend && npm install && npm run dev
```

启动后访问 `http://localhost:5173`，首个注册用户自动成为管理员。

---

## 一、首次部署（域名已备案解析）

```bash
# 1. SSH 到服务器
ssh root@你的服务器IP

# 2. 克隆代码
git clone https://github.com/Yuki933293/RolerZ.git
cd RolerZ

# 3. 执行一键部署
chmod +x deploy.sh
sudo ./deploy.sh your-domain.com
```

部署脚本会自动完成：
- 安装 Python3、Node.js 22、nginx
- 创建应用用户 `rolerz`，代码放在 `/opt/rolerz`
- Python 虚拟环境 + 依赖安装
- 前端 `npm install && npm run build`
- 生成 `.env`（随机 JWT_SECRET）
- 配置 systemd 服务（自动重启）
- 配置 nginx 反向代理（前端静态文件 + API 转发）
- 申请 Let's Encrypt HTTPS 证书
- SQLite 每日定时备份（保留 30 天）

部署完成后访问 `https://your-domain.com`，**首个注册用户自动成为管理员**。

---

## 二、临时部署（域名未备案，仅 IP 访问）

```bash
# 1. 克隆代码并复制到应用目录
git clone https://github.com/Yuki933293/RolerZ.git
cd RolerZ
sudo mkdir -p /opt/rolerz
sudo cp -r . /opt/rolerz/
cd /opt/rolerz

# 2. 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# 3. 安装 Python 依赖
sudo apt install -y python3 python3-pip python3-venv nginx
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn python-jose[cryptography] pydantic anthropic openai httpx

# 4. 构建前端
cd frontend && npm install && npm run build && cd ..

# 5. 配置环境变量
cat > .env << 'EOF'
JWT_SECRET=替换为随机密钥
CORS_ORIGINS=http://你的服务器IP
DEV_MODE=
EOF
# 生成随机密钥: python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# 6. 配置 nginx
sudo tee /etc/nginx/sites-available/rolerz > /dev/null << 'NGINX'
server {
    listen 80;
    server_name _;

    root /opt/rolerz/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/rolerz /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 7. 启动后端（推荐配 systemd，此处用前台演示）
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

访问 `http://39.107.106.100/`，**首个注册用户自动成为管理员**。

---

## 三、后续更新

每次本地改好代码 push 到 GitHub 后，在服务器上执行：

```bash
cd /opt/rolerz && sudo ./update.sh
```

脚本会自动：拉代码 → 更新依赖 → 重新构建前端 → 重启后端服务。

---

## 四、域名备案通过后

```bash
# 1. 在域名服务商添加 A 记录，指向服务器 IP

# 2. 申请 HTTPS 证书
sudo certbot --nginx -d your-domain.com

# 3. 更新 CORS 配置
sudo vim /opt/rolerz/.env
# 修改 CORS_ORIGINS=https://your-domain.com

# 4. 重启服务
sudo systemctl restart rolerz
```

---

## 五、常用运维命令

```bash
# 查看后端状态
sudo systemctl status rolerz

# 查看实时日志
sudo journalctl -u rolerz -f

# 手动重启
sudo systemctl restart rolerz

# 查看 nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 手动备份数据库
sudo -u rolerz cp /opt/rolerz/data/persona_forge.db /opt/rolerz/backups/manual_backup.db
```

---

## 六、故障排查

| 问题 | 排查 |
|------|------|
| 502 Bad Gateway | `sudo systemctl status rolerz` 查看后端是否运行 |
| 前端白屏 | 检查 `/opt/rolerz/frontend/dist/` 是否存在 |
| API 401 | JWT_SECRET 是否配置、token 是否过期 |
| 注册后无管理员权限 | 确认是 id=1 的首个用户；若数据库已有旧数据需删除重建 |
| LLM 生成超时 | 检查 API Key 配置、网络是否能访问对应 Provider |
