# 在这台服务器上部署第二个项目 · 操作清单

> 目标服务器：47.107.46.78（阿里云 ECS，2 核 / 1.87GB 内存 / 79GB 磁盘）
> 现有项目：`todo`（juststartit.cn，Next.js + PostgreSQL + Caddy）
> 结论先行：**资源够用**（容器才占 145MB，可用内存 1.35GB，还有 4G swap），
> 但有 **3 件事必须先做**，否则第二个项目会踩坑或跟第一个项目互相干扰。

---

## 0. 现状速查（实测数据，2026-11-04）

| 项 | 现状 | 判断 |
|---|---|---|
| 内存 | 1870MB 总量，已用 519MB，**可用 1351MB**，swap 4G | ✅ 够再加一个项目 |
| 磁盘 | 79G，已用 35G，**剩 41G** | ⚠️ 够，但镜像在涨 |
| 容器内存 | web 83MB + caddy 34MB + db 28MB = **145MB** | ✅ 很轻 |
| 镜像 | **78 个**（todo-web 占 72 个 × 263MB） | 🔴 该清了 |
| 端口 | 22 / 80 / 443 / **3000** | 🔴 3000 暴露在公网，要收口 |
| compose | project=`todo`，网络 `todo_default`，卷前缀 `todo_*` | ✅ 新项目必须换 project 名 |
| Caddy | **不在 compose 里**（手动 `docker run` 起的） | ⚠️ 加域名要单独 reload |

---

## 1. 必做前置（跟第二个项目无关，但会被它放大）

### ① 清掉历史镜像

每次部署都打一个新 tag（`v-YYYYMMDD-HHMMSS`），从不清旧的 → **72 个 todo-web 镜像**。
这不只是占磁盘：镜像多会让 `dockerd` 的元数据内存暴涨（上个月实测冲到 1.27GB，
直接导致 OOM 把网站搞挂）。

```bash
# 只保留当前运行的 + 稳定标签 + latest
docker images todo-web --format '{{.Repository}}:{{.Tag}}' | grep -v -E 'v-stable-stable|^todo-web:latest$' | xargs -r docker rmi
docker image prune -f          # 清理悬空层
```
> 删之前先确认 `docker ps` 里的镜像 tag 不在上面这个列表里（当前跑的是 `todo-web:latest`）。

### ② 把 3000 端口从公网收回来

现在 `todo-web` 的端口映射是 `"3000:3000"` → **绑定 0.0.0.0**，
意味着任何人都能 `http://47.107.46.78:3000` 直连，**绕过 Caddy**：
没有 HTTPS、没有 ICP 备案号页脚、没有 `X-Frame-Options` 等安全头。
（备案审核员如果用这个地址看，页脚备案号就不在了。）

改法（`deploy/docker-compose.prod.yml`）：
```yaml
    ports:
      - "127.0.0.1:3000:3000"    # 只绑本地，外部一律走 Caddy 的 80/443
```
然后 `docker compose -p todo -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --no-deps web`

> Caddy 在同一个 docker 网络里，反代用的是容器名 `web:3000`，**不受影响** ✓

### ③ 新项目必须遵守的 3 条命名/端口规范

| 规范 | 本项目 | 新项目应该叫 |
|---|---|---|
| compose project 名 | `todo` | 例如 `doorapp`（**必须不同**） |
| 卷名前缀 | `todo_pgdata` / `todo_uploads` | 例如 `doorapp_pgdata` |
| 容器名 | `todo-web` / `todo-db` / `todo-caddy` | 例如 `doorapp-web` / `doorapp-db` |

> ⚠️ project 名撞了会怎样：compose 会把新项目的卷挂到**同一个** `todo_pgdata` 上 →
> 两个项目的数据混在一个卷里 → 一方重建卷就把另一方的数据冲掉。
> （服务器上现在还留着 `deploy_*` 和 `todo_*` 两套孤儿卷，就是早先 project 名改过留下的残骸。）

---

## 2. 端口规划

| 端口 | 用途 | 谁能访问 |
|---|---|---|
| 22 | SSH | 公网 |
| 80 / 443 | Caddy（所有项目共用） | 公网 |
| 3000 | todo-web（**改成只绑 127.0.0.1**） | 仅本机 / Caddy |
| 3001 | 新项目 web（**只绑 127.0.0.1**） | 仅本机 / Caddy |
| 5432 | PostgreSQL | **不映射到宿主机**，只在 docker 网络内 |

规则：**业务端口一律 `127.0.0.1:端口:容器端口`，对外只暴露 80/443 给 Caddy。**

---

## 3. Caddy 怎么加第二个域名

Caddyfile 在 `/opt/todo/app/deploy/Caddyfile`（宿主机），以只读方式挂进容器。
加一个新站点块：

```caddyfile
# ---- 第二个项目 ----
新域名.com, www.新域名.com {
	encode zstd gzip
	reverse_proxy 新项目服务名:容器端口 {
		header_up Host {host}
		header_up X-Real-IP {remote}
		header_up X-Forwarded-For {remote}
		header_up X-Forwarded-Proto {scheme}
	}
	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
}
```

改完 **必须 reload，不要重启**（重启会断连接）：
```bash
docker exec todo-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec todo-caddy caddy reload  --config /etc/caddy/Caddyfile --adapter caddyfile
```

**前置条件**：域名要先解析到这台服务器（阿里云 DNS 加一条 A 记录 → 47.107.46.78），
Caddy 才能自动申请 Let's Encrypt 证书。
> 如果新项目用 `juststartit.cn` 的子域名：主域名已备案，子域名一般不需要单独备案
> （以当地管局口径为准）。如果是**独立域名**：国内必须单独走一次 ICP 备案，
> 审核期间只能先用 IP+端口或临时域名访问。

---

## 4. 第二个项目的 compose 骨架

放到新项目仓库的 `deploy/docker-compose.prod.yml`，关键约定：

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: doorapp-db
    restart: unless-stopped
    shm_size: 128mb
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  web:
    image: doorapp-web:latest
    container_name: doorapp-web
    restart: unless-stopped
    build:
      context: ..
      dockerfile: Dockerfile.prod
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "127.0.0.1:3001:3000"     # ← 只绑本地
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      NODE_ENV: production
    volumes:
      - app-logs:/var/log/app
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
    healthcheck:
      test: ["CMD-SHELL", "wget --spider --quiet http://127.0.0.1:3000/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  pgdata:
  app-logs:
```

> **volumes 名字不带前缀**是 compose 的默认行为，实际卷名会变成 `<project>_pgdata`，
> 所以只要 **project 名不同**（`docker compose -p doorapp`）就不会撞。
> 现在服务器上 `todo_pgdata` 和 `deploy_pgdata` 并存，就是 project 名变过留下的。

### 部署命令（务必带 `-p` 和 `--env-file`）

```bash
cd /opt/新项目
docker compose -p doorapp -f deploy/docker-compose.prod.yml \
  --env-file deploy/.env up -d --no-deps web
```
> ⚠️ `--env-file` 必须带：compose 默认只在**当前工作目录**找 `.env`，
> 我们的 `.env` 在 `deploy/` 下 → 不带这个参数，所有 `${DB_PASSWORD}` 会解析成空。
> ⚠️ `--no-deps web`：不要用裸 `up -d`（见下面「踩过的坑」）。

---

## 5. 踩过的坑（照抄就行，别自己踩）

| 坑 | 现象 | 解法 |
|---|---|---|
| 裸 `docker compose up -d` | 会试图新建 `todo-caddy` → 容器名已被占用 → 报错中断 → web 停了但没人 start → **502** | 只 `up -d --no-deps <service>`；Caddy 不归 compose 管 |
| 忘了 `--env-file` | 新容器里密码/密钥全空 | 每次都带 `--env-file deploy/.env` |
| compose `environment` 是白名单 | `.env` 里加了变量，compose 文件没列 → 容器里没有 | 变量加到 `.env` **和** compose 的 environment 两处 |
| 端口 `0.0.0.0` 暴露 | 绕过 Caddy，没有 HTTPS/备案号/安全头 | 一律 `127.0.0.1:端口:端口` |
| 镜像 tag 只增不减 | dockerd 内存暴涨 → OOM 掉网站 | 每次部署后清旧镜像（见 §1①） |

---

## 6. 备份（两个项目都要，现在一个都没有）

现状：`/opt/todo/.backup/` 里只有一个 **2026-10-07** 的 12KB 快照，
crontab 里只有健康检查，**没有任何备份定时任务**。
生产库硬删不可逆（8 月误删过一次，只能靠截图重建）。

通用备份脚本见同目录 `backup.sh`，接入方式：

```bash
# /etc/cron.d/todo-backup
17 4 * * * root /opt/todo/app/scripts/backup.sh todo >> /var/log/todo-backup.log 2>&1
```

建议：数据库 `pg_dump` + 上传目录打包 + 保留 30 天 + **每周同步一份到另一台机器/对象存储**。

---

## 7. 资源兜底：别让一个项目把另一个挤死

机器只有 1.87GB。给两个项目都加内存上限，超了就用 swap 兜：

```yaml
    mem_limit: 512m      # web
    mem_limit: 256m      # db
```

再加一条兜底 cron（每 5 分钟检查）：
```bash
*/5 * * * * root /opt/todo/app/scripts/healthcheck-watchdog.sh >> /var/log/todo-watchdog.log 2>&1
```
（现有的 watchdog 只盯着 todo 项目，新项目要么加进去，要么复制一份改脚本名。）

---

## 8. 落地顺序（建议）

1. ☐ 清 71 个旧镜像 + 把 3000 收成 `127.0.0.1`（对现有项目零影响）
2. ☐ 新项目代码放 `/opt/新项目`，写好 Dockerfile.prod + compose.prod.yml
3. ☐ 新项目 `.env`（所有密钥只放这里，chmod 600，不进仓库）
4. ☐ `docker compose -p 新项目名 ... up -d --no-deps web`，确认容器 healthy
5. ☐ DNS 加 A 记录 → Caddyfile 加站点块 → `caddy reload` → 验证 HTTPS
6. ☐ 两个项目的备份 cron 都装上
7. ☐ 把新项目加进 watchdog 监控列表
