# Todo App — Server Snapshot

> 这是 `/opt/todo/app` 的本地 git 镜像。让任何 agent 能直接 `read` 服务器代码，
> 不再每次 `ssh + cat`。

## 服务器连接

- Host: `root@47.107.46.78`
- 密码: 见 Keychain `todo-ecs-root` (or environment)
- 项目根: `/opt/todo/app`
- DB: PostgreSQL 16 (`todo-db` 容器)
- DB 密码: env `POSTGRES_PASSWORD`（在 `todo-db` 容器内；同 `DB_PASSWORD`）
- 主域名: `juststartit.cn` + `www.juststartit.cn` + `47.107.46.78.nip.io`
- Caddy 自动 HTTPS (Let's Encrypt)

## 镜像与版本

| Tag | Image ID | 说明 |
|---|---|---|
| `todo-web:latest` | `bf36ee91dbcc` (261MB) | 当前生产镜像（pnpm + npmmirror + libssl1.1） |
| `todo-web:v-stable-stable` | `bf36ee91dbcc` | 回滚锚点 |
| `todo-web:v-20261008-113830` | `bf36ee91dbcc` | 首次成功 build 出的可重现 tag |

历史 image（被替换）：
- `4295c240513b` — 旧 login-broken 镜像（**保留作为历史证据**）
- `91aaa7a40999` — 旧 build 失败留下的部分产物
- `faa7cee3a862` — Oct 6 的产物

## 本地工具链

- `scripts/ssh-tools/srun.py` — 跑远程命令（用 paramiko，无 expect 转义问题）
- `scripts/ssh-tools/spush.py` — 推文件到 server
- `scripts/ssh-tools/sshrun.exp` — 老的 expect fallback
- `scripts/ssh-tools/pull_server.py` — 重新拉 server 源码到本地

## 一键 build + restart（在 server 跑）

```
PROJECT_NAME=todo bash /opt/todo/app/scripts/rebuild-and-deploy.sh
```

会自动：
1. 检查内存（防 OOM）
2. docker build 出 `todo-web:v-<timestamp>` tag
3. tag 成 `latest` + `v-stable-stable`
4. `docker compose -p todo up -d`（**用 -p todo** 复用旧数据 volumes）
6. 等 30s 看 healthcheck

## Docker Compose 关键点（防踩坑）

- **必须用 `-p todo`**：compose 默认按文件夹名给 volume 加前缀，换目录跑会创建空卷。
- **build context = `/opt/todo/app`**（repo 根），不是 `apps/web`。Dockerfile.prod 路径不能有 `..`。
- **`AUTH_TRUST_HOST=true`** env 已配，写在 docker-compose.prod.yml 里。
- DB 容器用 `prisma migrate deploy`（自动跑迁移）。首次启动要执行：
  ```
  docker compose -p todo -f /opt/todo/app/deploy/docker-compose.prod.yml exec web sh -c "cd /repo/packages/db && pnpm db:deploy"
  ```

## 已知数据

> 脱敏说明：真实账号、手机号、user id 与具体清单名已从仓库移除，
> 需要时从服务器上的数据库查（`scripts/cleanup-test-data.sh` 已把限定条件固化）。

- 1 个管理员账号（手机号只在服务器 `.env` / 数据库里，仓库内不记录）
- 若干用户清单（名称因人而异，不在仓库中列举）

## 备份

- `scripts/rebuild-and-deploy.sh` — 部署脚本
- `/opt/todo/.backup/snapshot-20261007-212037.tar.gz` — server 端的旧快照（重要资源）
- 旧 image `4295c240513b` — server 端 docker image（回滚用）

## 改动历史（commit）

1. `e0c4cab` snapshot: server source at 2026-10-08 (post-login-fix)
2. `a7dceb7` infra: fix Dockerfile build hang + compose build: config
3. `c6a360c` scripts: add rebuild-and-deploy.sh