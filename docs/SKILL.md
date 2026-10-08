# AI 避坑 Skill：Todo App / Next.js / Prisma / Docker 全栈项目必读

> 适用：所有用 Next.js 15+ App Router + Prisma 5+ + Docker Compose + Caddy/Nginx 的全栈项目
> 来源：个人 Todo App 项目（2026-10 部署 14 个坑总结）
> 用法：每接到新项目，第一步加载本 skill 检查清单

---

## 🚨 必检清单（项目第一天）

- [ ] **Dockerfile.build context**：build context 必须是 repo 根，所有 COPY 路径相对 context，不要用 `..`
- [ ] **.dockerignore** 必备：排除 `node_modules/ .next/ pnpm-lock.yaml .git/ .DS_Store`
- [ ] **docker compose project name 固定**：`docker compose -p <固定名> -f compose.yml up -d`，永远不用默认（默认按目录名变化）
- [ ] **服务器代码第一天 git init + 首次 commit**（不然后期回滚无门）
- [ ] **Mac 本地镜像一份 server 源码**（`rsync` 或 `sftp get` + 本地 git）

## 🚨 改任何代码前必查

- [ ] **改 Prisma entity 字段**：先 `grep -A20 "^model XXX" schema.prisma` 确认字段存在；新字段要加 migration
- [ ] **改 auth 路由**：去 `middleware.ts` 检查 `PUBLIC_PATHS` 白名单是否包含新路由
- [ ] **改 sync / bulk 路由**：用 `upsert` 替代 `createMany` + 软删（否则 client 端 id 一致会撞 unique 约束）
- [ ] **改 Dockerfile / Caddyfile**：先用 `docker build --no-cache .` 或 `caddy validate` 验一遍，别直接 restart 看效果

## 🚨 部署上线必做

- [ ] **bcrypt / password hash 必须在同一语言/库**（Python 写 Python 验，Node 写 Node 验）
- [ ] **HTTPS**：备案+证书未到位前，先用 HTTP 但加 `auto_https off`；Caddy 启动看 `acme-v02.api.letsencrypt.org` DNS 是否解析（容器 DNS 经常坏，加 `nameserver 223.5.5.5` 到 `/etc/resolv.conf`）
- [ ] **图片/文件/视频 → 写对象存储或挂载 volume**，**绝对不要 base64 存 DB**
- [ ] **用户内容端点要鉴权 + 大小限制 + mime 校验**（例：上传限制 5MB + 仅 png/jpg/gif/webp）
- [ ] **必须有 build watchdog**：crontab 每分钟跑 `healthcheck-watchdog.sh`，连续 3 次 unhealthy 自动 `docker tag v-stable-stable:latest + up -d --no-deps web`
- [ ] **watchdog 脚本必须把函数定义放在调用前**（Bash 函数定义和调用顺序敏感）

## 🚨 排错加速

- [ ] **ssh 命令超过 3 层引号嵌套就停手**：落盘到 server 再执行，或直接用 Python `paramiko`（不要 expect）
- [ ] **agent 跑 server 命令优先用 paramiko/python 而不是 shell 嵌套引号**
- [ ] **DB 排错先看 `_prisma_migrations` 表**：确认迁移是否真的应用了
- [ ] **image 排错先 `docker images ls`**：当前跑的是哪个 image id
- [ ] **container 排错先 `docker ps --format "{{.Names}} {{.Status}} {{.Image}}"`**：image 跟 latest 是否一致

## 🚨 编码规范

- [ ] **Prisma 数据模型改动 = schema.prisma + migration + sync 路由 type 联合**（三处一起改，缺一就漏字段）
- [ ] **NextAuth 中间件是白名单模式**：每个新 auth 路由都要检查 `PUBLIC_PATHS`
- [ ] **前端用硬编码虚拟 ID（如 list-done / list-trash）的**：selectors 必须同时查 store 和虚拟常量表
- [ ] **server 写文件到 OS 临时目录**：用 `cat > /tmp/x.sql <<EOF` 在 server 端落盘再执行，避 shell 嵌套引号
- [ ] **Prisma sync 静默丢字段**（已知坑）：不要相信 `data: { foo: 'bar' }` 里 foo 一定写入 DB，必须 `grep -A20 "^model" schema.prisma` 确认字段存在

## 🚨 必装工具

```bash
# Mac 端：3 个 ssh 工具
/Users/qi/Desktop/todo/scripts/ssh-tools/srun.py     # 跑命令
/Users/qi/Desktop/todo/scripts/ssh-tools/spush.py    # 推文件
/Users/qi/Desktop/todo/scripts/ssh-tools/pull_server.py  # 拉源码

# Server 端：1 个 deploy 脚本 + 1 个 watchdog
/opt/todo/app/scripts/rebuild-and-deploy.sh   # build + migrate + restart
/opt/todo/app/scripts/healthcheck-watchdog.sh  # 挂掉自动回滚
```

## 🚨 决策矩阵

| 场景 | 不要做 | 要做 |
|---|---|---|
| Dockerfile COPY `..` | ✅ BuildKit 拒绝，必踩 | context = repo 根，所有路径写绝对 |
| 改 schema 字段不 grep | 静默丢字段，1 小时查不到 | 改前必 grep，改后必 schema + migration + 路由 type 联合 |
| sync 用 `createMany` | 撞 unique 约束 | 用 `upsert` |
| 部署时换目录 | 数据全丢 | 固定 project name (`-p`) |
| 密码 hash 跨语言 | 验证失败 | 同一语言同一库 |
| 图片存 base64 在 DB | 1 张图 350KB | 写文件 + 静态托管 + URL 路径 |
| Caddy 改完直接 restart | 死循环无日志 | `caddy validate` + `caddy reload` |
| 改完代码不 commit | 找不到回滚点 | 改一份 commit 一份 |

## 🚨 一次性检查（项目完成时）

- [ ] **不**修改 `latest` tag：每次 build 出新 image（`v-YYYYMMDD-HHMMSS`），latest 才回滚到上一个好的
- [ ] **必须** `v-stable-stable` tag 永远指向"上次好用的 image"
- [ ] **必须** watchdog 测过一次：故意 stop 容器，等 3 分钟看是否自动回滚

## 🚨 关键文件路径（参考这个项目）

- 数据库 schema: `packages/db/prisma/schema.prisma`
- 同步 API: `apps/web/src/app/api/sync/bulk/route.ts`（upsert 模式）
- 上传 API: `apps/web/src/app/api/upload/route.ts`（5MB + mime 校验）
- 静态托管: `deploy/Caddyfile`（`@uploads` matcher + `file_server { root / }`）
- 中间件: `apps/web/middleware.ts`（`PUBLIC_PATHS` 白名单）
- store: `apps/web/src/lib/stores/todo-store.ts`（硬编码 SYSTEM_LISTS 虚拟 ID 时 selector 要双查）
- auth: `apps/web/src/lib/auth/config.ts`（bcryptjs 验证，trustHost: true）
