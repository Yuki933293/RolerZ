# RolerZ 部署指南

## 环境要求

| 组件 | 版本要求 |
|------|----------|
| Python | 3.10+ |
| Node.js | 22+（Vite 7 要求 ≥20.19 或 ≥22.12） |
| PostgreSQL | 14+ |
| npm | 9+ |
| 服务器 | Ubuntu 22.04，1 核 2G 内存起步 |

---

## 本地开发

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 JWT_SECRET、DATABASE_URL 等

# 2. 创建 PostgreSQL 数据库
createdb rolerz

# 3. 安装依赖
pip install fastapi uvicorn "psycopg[binary]" python-jose[cryptography] \
    pydantic cryptography anthropic openai httpx
cd frontend && npm install && cd ..

# 4. 一键启动前后端
./start.sh

# 或分别启动
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
cd frontend && npm run dev
```

启动后访问 `http://localhost:5173`，表结构由 `database.init_db()` 自动创建（共 14 张表），**首个注册用户自动成为管理员**。

---

## 环境变量说明

编辑 `.env`（从 `.env.example` 复制）：

### 必填

| 变量 | 说明 | 示例 |
|------|------|------|
| `JWT_SECRET` | JWT 签名密钥 | `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:password@localhost:5432/rolerz` |

### 邮件服务（邮箱注册/密码重置必填）

| 变量 | 说明 | 示例 |
|------|------|------|
| `SMTP_HOST` | SMTP 服务器 | `smtp.qq.com` |
| `SMTP_PORT` | SMTP 端口 | `465` |
| `SMTP_USER` | 发件邮箱 | `your-email@qq.com` |
| `SMTP_PASSWORD` | 邮箱授权码 | QQ 邮箱授权码（非 QQ 密码） |

### 可选

| 变量 | 说明 |
|------|------|
| `ENCRYPTION_KEY` | Fernet 加密密钥（留空则自动生成 `data/.encryption_key`） |
| `ANTHROPIC_API_KEY` | Claude API 密钥 |
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |

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
- 安装 Python3、Node.js 22、nginx、PostgreSQL
- 创建应用用户 `rolerz`，代码放在 `/opt/rolerz`
- Python 虚拟环境 + 依赖安装
- 前端 `npm install && npm run build`
- 创建 PostgreSQL 数据库 `rolerz`
- 生成 `.env`（随机 JWT_SECRET + DATABASE_URL）
- 配置 systemd 服务（自动重启）
- 配置 nginx 反向代理（前端静态文件 + API 转发 + SPA 路由回退）
- 申请 Let's Encrypt HTTPS 证书

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

# 2. 安装系统依赖
sudo apt install -y python3 python3-pip python3-venv nginx postgresql
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# 3. 创建 PostgreSQL 数据库
sudo -u postgres createuser rolerz
sudo -u postgres createdb -O rolerz rolerz

# 4. 安装 Python 依赖
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn "psycopg[binary]" python-jose[cryptography] \
    pydantic cryptography anthropic openai httpx

# 5. 构建前端
cd frontend && npm install && npm run build && cd ..

# 6. 配置环境变量
cat > .env << 'EOF'
JWT_SECRET=替换为随机密钥
DATABASE_URL=postgresql://rolerz@localhost:5432/rolerz
EOF
# 生成随机密钥: python3 -c "import secrets; print(secrets.token_hex(32))"

# 7. 配置 nginx
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
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # SPA 路由回退 — 确保 /:lang/* 路径正确工作
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

# 8. 配置 systemd 服务
sudo tee /etc/systemd/system/rolerz.service > /dev/null << 'SERVICE'
[Unit]
Description=RolerZ Backend
After=network.target postgresql.service

[Service]
Type=simple
User=rolerz
WorkingDirectory=/opt/rolerz
EnvironmentFile=/opt/rolerz/.env
ExecStart=/opt/rolerz/venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable rolerz
sudo systemctl start rolerz
```

访问 `http://你的服务器IP/`，**首个注册用户自动成为管理员**。

---

## 三、后续更新

每次本地改好代码 push 到 GitHub 后，在服务器上执行：

```bash
cd /opt/rolerz && sudo ./update.sh
```

脚本会自动：拉代码 → 更新依赖 → 重新构建前端 → 重启后端服务。

> 注意：`update.sh` 中的 `pip install` 需要包含 `"psycopg[binary]"`，确保 PostgreSQL 驱动始终可用。

---

## 四、域名备案通过后

```bash
# 1. 在域名服务商添加 A 记录，指向服务器 IP

# 2. 申请 HTTPS 证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 3. 重启服务
sudo systemctl restart rolerz
```

---

## 五、PostgreSQL 运维

```bash
# 连接数据库
psql -d rolerz

# 查看所有表
psql -d rolerz -c "\dt"

# 备份数据库
pg_dump rolerz > backup_$(date +%Y%m%d).sql

# 恢复数据库
psql rolerz < backup_20260313.sql

# 查看数据库大小
psql -d rolerz -c "SELECT pg_size_pretty(pg_database_size('rolerz'));"
```

### 定时备份（推荐）

```bash
# 添加 crontab，每天凌晨 3 点备份
sudo crontab -e -u rolerz
# 添加以下行：
0 3 * * * pg_dump rolerz | gzip > /opt/rolerz/backups/rolerz_$(date +\%Y\%m\%d).sql.gz && find /opt/rolerz/backups -name "*.sql.gz" -mtime +30 -delete
```

---

## 六、常用运维命令

```bash
# 查看后端状态
sudo systemctl status rolerz

# 查看实时日志
sudo journalctl -u rolerz -f

# 手动重启
sudo systemctl restart rolerz

# 查看 nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

---

## 七、故障排查

| 问题 | 排查 |
|------|------|
| 502 Bad Gateway | `sudo systemctl status rolerz` 查看后端是否运行 |
| 前端白屏 | 检查 `/opt/rolerz/frontend/dist/` 是否存在 |
| 语言路由 404 | 确认 nginx 配置了 `try_files $uri $uri/ /index.html` SPA 回退 |
| API 401 | JWT_SECRET 是否配置、token 是否过期 |
| 数据库连接失败 | 检查 `DATABASE_URL` 格式、PostgreSQL 服务是否运行 |
| 注册后无管理员权限 | 确认是 id=1 的首个用户；若数据库已有旧数据需清空 users 表 |
| 邮件发送失败 | 检查 SMTP 配置、授权码是否正确、端口 465 是否开放 |
| LLM 生成超时 | 检查 API Key 配置、网络是否能访问对应 Provider |

---

## 八、安全检查清单

- [ ] `.env` 已配置且不在 Git 中（已在 `.gitignore`）
- [ ] `data/.encryption_key` 不在 Git 中（已在 `.gitignore`）
- [ ] `JWT_SECRET` 使用随机生成的强密钥
- [ ] PostgreSQL 使用独立用户，非 superuser
- [ ] Nginx 已配置 HTTPS
- [ ] 邮箱授权码（非明文密码）已配置
- [ ] 防火墙仅开放 80/443 端口，8000 端口不对外暴露
