# Todo App 部署文档（99/年 ECS 适配版）

## 架构概览

```
[公网] ──> [Caddy :443] ──> [Next.js :3000] ──> [PostgreSQL 16 :5432]
                  │              │
                  │              └─> [/data/uploads] 本地存储
                  │
                  └─> 自动 HTTPS（Let's Encrypt）
```

**精简原则**：100 用户单机部署，去掉 Redis / MinIO / MailHog 等中间件，节省内存。

## 内存预估（2GiB ECS）

| 服务 | 占用 |
|---|---|
| Alibaba Linux 3 + 系统 | ~150MB |
| PostgreSQL 16（调优后） | ~250MB |
| Next.js（standalone，限堆 512MB） | ~300MB |
| Caddy | ~30MB |
| **合计** | **~730MB** |
| **空闲** | **~1.3GB** |
| Swap 兜底 | **2GB** |

## 一键部署（推荐）

### 1. 本地准备代码

```bash
cd /Users/qi/Desktop/todo
# 提交代码
git add -A && git commit -m "feat: production ready"
git remote add origin https://github.com/your-username/todo-app.git
git push -u origin main
```

### 2. 服务器初始化（首次）

```bash
# SSH 登录
ssh root@your-server-ip

# 上传 init.sh（用 scp 或者直接 cat 粘贴）
chmod +x deploy/init.sh
./deploy/init.sh
```

`init.sh` 会自动：
1. 创建 2GB Swap（防 OOM）
2. 安装 Docker + Docker Compose
3. 配置防火墙（开放 80/443）
4. 创建项目目录 `/opt/todo`

### 3. 上传项目代码

```bash
# 在本地执行
scp -r ./apps/web ./packages ./deploy root@your-server-ip:/opt/todo/app/

# 或者用 git
ssh root@your-server-ip
cd /opt/todo
git clone https://github.com/your-username/todo-app.git app
```

### 4. 配置环境变量

```bash
ssh root@your-server-ip
cd /opt/todo/app/deploy
cp .env.example .env
nano .env
```

**必改**：
```bash
DB_PASSWORD=你的强密码（32 位）
NEXTAUTH_SECRET=$(openssl rand -base64 32)
DOMAIN=你的域名（或 ECS 公网 IP）
```

### 5. 启动服务

```bash
cd /opt/todo/app
docker compose -f deploy/docker-compose.prod.yml up -d
```

首次启动会自动：
- 构建 Next.js 镜像（3-5 分钟）
- 启动 PostgreSQL
- 启动 Caddy
- 申请 HTTPS 证书（需要 80/443 端口可达 + DNS 已解析）

### 6. 跑数据库迁移

```bash
docker compose -f deploy/docker-compose.prod.yml exec db pg_isready -U $DB_USER
# 等数据库 ready 后：

docker compose -f deploy/docker-compose.prod.yml exec web sh -c "cd /app/packages/db && pnpm db:deploy"
```

### 7. 验证

```bash
# 看日志
docker compose -f deploy/docker-compose.prod.yml logs -f web

# 健康检查
curl https://your-domain.com
```

## 域名配置（重要）

**如果用域名**：
1. 在阿里云 DNS 控制台添加 A 记录 → ECS 公网 IP
2. 等 DNS 生效（5-30 分钟）
3. Caddy 首次启动会自动申请 Let's Encrypt 证书

**没有域名（用 IP 临时测试）**：
1. 修改 Caddyfile 第 7 行的域名改为 `:80`
2. 不申请 HTTPS，用 HTTP 访问（生产不建议）

## 日常运维

### 看日志

```bash
# 全部日志
docker compose -f deploy/docker-compose.prod.yml logs -f

# 特定服务
docker compose -f deploy/docker-compose.prod.yml logs -f web
```

### 重启服务

```bash
docker compose -f deploy/docker-compose.prod.yml restart web
```

### 备份数据库

```bash
# 每天凌晨自动备份（加入 crontab）
0 3 * * * docker compose -f /opt/todo/app/deploy/docker-compose.prod.yml exec -T db pg_dump -U $DB_USER $DB_NAME | gzip > /opt/todo/backups/db-$(date +\%Y\%m\%d).sql.gz
```

### 升级代码

```bash
cd /opt/todo/app
git pull
docker compose -f deploy/docker-compose.prod.yml build web
docker compose -f deploy/docker-compose.prod.yml up -d web
```

### 监控资源

```bash
# 实时内存
free -h

# 容器资源
docker stats

# 磁盘
df -h
```

## 故障排查

### 1. Next.js 502 Bad Gateway

Caddy 连不到 web 容器。看 `docker logs todo-web` 是否启动。

### 2. 数据库连接失败

检查 `.env` 中 `DATABASE_URL` 用户名密码是否正确，以及 `db` 容器是否健康：
```bash
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs db
```

### 3. OOM Killed（最常见）

2GiB 不够用。看 `dmesg | grep -i oom`：
- 增加 swap（已有 2GB）
- 降低 Next.js 堆：`NODE_OPTIONS=--max-old-space-size=384`
- 升级到 4GiB ECS（约 ¥130/月）

### 4. HTTPS 证书申请失败

Caddy 需要 80 端口可达 + DNS 已解析到服务器 IP。检查：
```bash
curl -I http://your-domain.com  # 应该返回 Caddy 响应
nslookup your-domain.com       # 应该返回 ECS IP
```

## 性能调优（100 用户场景）

| 指标 | 当前 | 监控命令 |
|---|---|---|
| 内存使用 | ~730MB | `free -h` |
| 磁盘 | ~10GB（系统 + Docker + 数据） | `df -h` |
| 带宽 | 3Mbps（峰值 QPS<5 足够） | `iftop` |
| QPS | <5 | Nginx 日志 |

## 升级路径

| 阶段 | 用户数 | 配置 |
|---|---|---|
| MVP（现在） | 100 | 2 vCPU 2GiB + 3M 带宽 |
| 半年后 | 500 | 4 vCPU 4GiB + 5M |
| 一年后 | 2000+ | 8 vCPU 8GiB + 10M + OSS + Redis |

---

## 紧急联系

- 阿里云工单：https://workorder.console.aliyun.com/
- Caddy 文档：https://caddyserver.com/docs/
- Next.js 部署：https://nextjs.org/docs/app/building-your-application/deploying

## 文件清单

```
deploy/
├── init.sh               # 服务器初始化
├── docker-compose.prod.yml # 生产编排
├── Caddyfile             # 反向代理 + HTTPS
├── Dockerfile.web        # Next.js 构建镜像
├── postgresql.conf       # 2GiB 调优
├── .env.example          # 环境变量模板
└── README.md             # 本文档
```