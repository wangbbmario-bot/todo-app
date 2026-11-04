# 第二个项目部署（Next.js · 无数据库 · IP+端口）

> 已确认的选择：**Next.js 常驻进程 / 不要数据库 / 先用 IP+端口访问不配 HTTPS / 前置清理由我自己来**
> 目标服务器：47.107.46.78（2 核 / 1.87GB 内存 / 41G 可用磁盘）

---

## 0. 先看一眼资源账

| 项 | 数值 | 说明 |
|---|---|---|
| 现在占用 | web 83MB + caddy 34MB + db 28MB = **145MB** | 很轻 |
| 可用内存 | **1351MB**（另有 4G swap） | 加一个 Next.js（约 100~300MB）完全够 |
| 磁盘 | 41G 可用 | 一个镜像 ~263MB，够用 |
| 端口 | 3000 被 todo 占用，**3001+ 全空** | 新项目用 3001 |

**唯一要注意的**：这台机器只有 1.87GB，两个 Next.js + dockerd + 容器一定要**设 mem_limit**，
否则一个项目吃满会把另一个挤到 OOM（8 月就是这么挂的）。

---

## 1. 项目端要准备的东西

### ① `next.config.js` 必须开 standalone
```js
// next.config.js
const nextConfig = { output: 'standalone' };   // ← 没有这行 Dockerfile 会 COPY 失败
module.exports = nextConfig;
```

### ② `package.json` 要有 build 脚本
```json
{ "scripts": { "build": "next build" } }
```

### ③ `deploy/.env`（密钥只放这里，**不进仓库**）
```bash
# 本地：建文件 → chmod 600 → 再传到服务器
MY_API_KEY=xxx
```
> 服务器上要给这个文件 `chmod 600`。

### ④ 三个文件（照抄同目录的模板）
```
deploy/Dockerfile.prod
deploy/docker-compose.prod.yml
scripts/deploy.sh
```
并把模板里的 `newapp` 全换成你的项目名（**必须和 todo 不同**）。

---

## 2. 代码怎么送上去（服务器没装 git）

服务器上 `which git` → **没装**。两条路：

### 方案 A：装 git（推荐，后面每次改代码就是一条 pull）
```bash
# 在服务器上执行
apt-get update && apt-get install -y git
```
然后：
```bash
# 服务器上
cd /opt && git clone <你的仓库地址> newapp
cd newapp && chmod +x scripts/deploy.sh && ./scripts/deploy.sh
```
以后更新：
```bash
cd /opt/newapp && git pull && ./scripts/deploy.sh --clean
```

### 方案 B：打包传（不想在服务器装 git 时用）
```bash
# 本地
tar czf newapp.tar.gz --exclude=node_modules --exclude=.next --exclude=.git newapp/
scp newapp.tar.gz root@47.107.46.78:/opt/
# 服务器
cd /opt && tar xzf newapp.tar.gz && cd newapp && ./scripts/deploy.sh
```

---

## 3. 部署命令（`scripts/deploy.sh` 已封装）

```bash
cd /opt/newapp
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

它做的事：构建镜像（打时间戳 tag + latest）→ `docker compose -p newapp ... up -d --no-deps web` → 等健康检查 → 打印访问地址。

**手动版（等价）**：
```bash
cd /opt/newapp
docker build -f deploy/Dockerfile.prod -t newapp-web:$(date +%Y%m%d-%H%M%S) .
docker compose -p newapp -f deploy/docker-compose.prod.yml \
  --env-file deploy/.env up -d --no-deps web
```

---

## 4. 验证

```bash
# 容器健康
docker ps --filter name=newapp-web --format '{{.Names}} | {{.Status}} | {{.Ports}}'
# 页面能通
curl -sI http://127.0.0.1:3001 | head -1
# 外部能通（IP + 端口）
curl -sI http://47.107.46.78:3001 | head -1
```

---

## 5. ⚠️ 五个要注意的点

| # | 事项 | 原因 |
|---|---|---|
| 1 | **project 名必须不同**（`newapp` vs `todo`） | 撞名 → 两个项目共用同一个卷 → 一方重建把另一方数据冲掉 |
| 2 | **端口 3001 现在绑 0.0.0.0** | IP 访问必须这样。但端口暴露在公网会被扫描器扫到，**将来配了域名就改成 `127.0.0.1:3001:3000`**，只走 Caddy 的 80/443 |
| 3 | **mem_limit: 512m 一定要留着** | 1.87GB 的机器，两个 Next.js 不设上限，一个吃满就 OOM 连坐 |
| 4 | **每次部署后清旧镜像**（`./scripts/deploy.sh --clean`） | todo 项目已经堆了 72 个镜像，dockerd 元数据内存暴涨导致过 OOM |
| 5 | **不做 ICP 备案就不能用域名对外** | 国内规则：域名对外提供服务必须备案。现在 IP+端口属于「不面向公众提供信息服务」，自查/内测可以；**要推广/给用户用之前必须走备案** |

---

## 6. 将来要备案 / 上线时补的 3 件事

1. **域名解析**：阿里云 DNS 加 A 记录 → 47.107.46.78
2. **Caddy 反代**：Caddyfile 加站点块，`reverse_proxy newapp-web:3000`
   ```bash
   docker exec todo-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   docker exec todo-caddy caddy reload  --config /etc/caddy/Caddyfile --adapter caddyfile
   ```
   然后把 compose 的端口改成 `127.0.0.1:3001:3000`（不再对外暴露业务端口）
3. **页脚加备案号**（国内审核要求页面底部标示备案编号）：
   照 todo 项目的做法——`lib/site-meta.ts` 放号码，`components/layout/site-footer.tsx` 渲染，
   每个对外页面底部都挂上。公安备案号拿到后也加进去（并加公安备案图标）。

---

## 7. 备份（别忘了）

todo 项目今天刚补上通用备份脚本 `scripts/backup.sh`（pg_dump + 上传目录打包 + 过期清理）。
新项目没有数据库的话，至少要备份**上传的文件目录**；有用户数据（localStorage 之外的服务端数据）
就照样要 dump。

```bash
# 定时：/etc/cron.d/newapp-backup
17 4 * * * root /opt/newapp/scripts/backup.sh newapp >> /var/log/newapp-backup.log 2>&1
```
