#!/bin/bash
# =====================================================
# rebuild-and-deploy.sh
#
# 服务器端一键 rebuild + 重启 web 容器的脚本。
# 解决：build 链路脆弱 + compose project 错位 + OOM 三类问题。
#
# 用法（在 server 上）：
#   bash scripts/rebuild-and-deploy.sh
#
# 关键参数：
#   - PROJECT_NAME 必须跟历史一致（todo），否则会创建新的空 volumes
#   - 用 npmmirror + BuildKit 内联 cache
#   - 重启前会自动跑 prisma migrate deploy（应用未应用的 schema 迁移）
# =====================================================
set -e

PROJECT_NAME="${PROJECT_NAME:-todo}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/todo/app/deploy/docker-compose.prod.yml}"
TAG="${TAG:-v-$(date +%Y%m%d-%H%M%S)}"
LOG="/tmp/build-${TAG}.log"

# DB 凭据必须从 .env 读，跟 docker-compose 用同一份
# 2026-10-24：docker compose 命令也补上 --env-file
#   compose 默认只在【当前工作目录】找 .env，而我们的 .env 在 deploy/ 下，
#   脚本 cd 到 /opt/todo/app 后 compose 找不到它 → ${NEXTAUTH_URL} / ${GUEST_*} 会解析成空
#   （症状：容器里 NEXTAUTH_URL 正常但新加的 GUEST_PHONE 丢失）
ENV_FILE="${ENV_FILE:-/opt/todo/app/deploy/.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 找不到 .env: $ENV_FILE"
  exit 1
fi
DB_USER=$(grep '^DB_USER=' "$ENV_FILE" | cut -d= -f2)
DB_PASSWORD=$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2)
DB_NAME=$(grep '^DB_NAME=' "$ENV_FILE" | cut -d= -f2)
# NEXT_PUBLIC_* 会在构建时被内联进前端 bundle → 必须在 docker build 之前读出来当 build-arg 传
# 不传的话页脚备案号会是空的（上次改配置时踩过：compose 读 .env，build 也得读同一份）
ICP_NUMBER=$(grep '^NEXT_PUBLIC_ICP_NUMBER=' "$ENV_FILE" | cut -d= -f2- || true)
POLICE_NUMBER=$(grep '^NEXT_PUBLIC_POLICE_NUMBER=' "$ENV_FILE" | cut -d= -f2- || true)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}"

echo "=== 内存检查（防 OOM kill dockerd） ==="
FREE_MB=$(free -m | awk '/^Mem:/ {print $7}')
echo "  可用内存: ${FREE_MB} MB"
if [ "$FREE_MB" -lt 600 ]; then
  echo "⚠️  内存不够（<600MB），先 sync && echo 3 > /proc/sys/vm/drop_caches"
  sync && echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
fi

echo "=== 启动 build ==="
# 2026-10-26：写版本文件，让前端能显示当前跑的到底是哪一版
#   起因：用户浏览器缓存了旧 chunk，反馈"改了但没生效"，
#   排查发现代码是对的、线上也是新代码，只有他那个域名的浏览器缓存是旧的。
#   public/ 会被 Dockerfile COPY 进镜像，所以这里写一次就够，不用改 Dockerfile。
mkdir -p /opt/todo/app/apps/web/public
printf '{"tag":"%s","builtAt":"%s","image":"todo-web:%s"}\n' \
  "$TAG" "$(date -Iseconds)" "$TAG" > /opt/todo/app/apps/web/public/version.json
cat /opt/todo/app/apps/web/public/version.json

cd /opt/todo/app/deploy
docker build \
  --progress=plain \
  --build-arg NEXT_PUBLIC_ICP_NUMBER="$ICP_NUMBER" \
  --build-arg NEXT_PUBLIC_POLICE_NUMBER="$POLICE_NUMBER" \
  -f ../apps/web/Dockerfile.prod \
  -t "todo-web:${TAG}" \
  .. 2>&1 | tee "$LOG"

if [ -z "$(docker images -q "todo-web:${TAG}")" ]; then
  echo "❌ BUILD FAILED，看 $LOG"
  exit 1
fi

echo "=== BUILD OK ==="
docker tag "todo-web:${TAG}" todo-web:latest
docker tag "todo-web:${TAG}" todo-web:v-stable-stable

echo "=== 应用 prisma migrations（在重启前） ==="
# 2026-11-03：先比对「本地迁移目录数」与「库里已应用数」，
#   没有待应用迁移就直接跳过 —— 原来每次部署都要现装一次 prisma CLI
#   （npm install prisma@5.16.0，国内 npmmirror 要 3~8 分钟，纯属浪费）。
# 判定：本地 > 已应用 → 有新迁移，跑 migrate deploy；相等 → 跳过。
#   迁移失败时 finished_at 为 NULL，不计入已应用数 → 仍会重跑，符合预期。
MIGRATIONS_DIR="/opt/todo/app/packages/db/prisma/migrations"
LOCAL_MIGRATIONS=$(ls -1 "$MIGRATIONS_DIR" 2>/dev/null | grep -c '^[0-9]' || echo 0)
APPLIED_MIGRATIONS=$(docker exec todo-db psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
  "SELECT count(*) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL" 2>/dev/null | tr -d ' \r\n' || echo 0)
[ -z "$APPLIED_MIGRATIONS" ] && APPLIED_MIGRATIONS=0

if [ "${LOCAL_MIGRATIONS:-0}" -gt "${APPLIED_MIGRATIONS:-0}" ]; then
  echo "  有待应用迁移（本地 ${LOCAL_MIGRATIONS} / 已应用 ${APPLIED_MIGRATIONS}），执行 migrate deploy"
  # 用一个临时容器跑 migrate deploy（自带 prisma CLI + @prisma/client）
  # 先设 npm registry 到 npmmirror（中国 server 必须）
  docker run --rm \
    --network "${PROJECT_NAME}_default" \
    -e DATABASE_URL="$DATABASE_URL" \
    -v /opt/todo/app/packages/db:/db \
    -w /db \
    node:20-alpine sh -c "
      set -e
      apk add --no-cache openssl 2>&1 | tail -1
      npm config set registry https://registry.npmmirror.com
      npm install --no-save --silent prisma@5.16.0 @prisma/client@5.16.0 2>&1 | tail -2
      npx prisma migrate deploy 2>&1
    " 2>&1 | tail -10
else
  echo "  ✅ 无待应用迁移（本地 ${LOCAL_MIGRATIONS} / 已应用 ${APPLIED_MIGRATIONS}），跳过"
fi

echo "=== 重启容器（保留 data volumes）==="
# 2026-10-20：只重建 web，不能用裸 `up -d`
#   todo-caddy 没有 compose 标签（project/service 都是空）——它是用 docker run 手动起的，
#   根本不在 compose project "todo" 的管理范围内。
#   裸 `up -d` 会试图"新建" todo-caddy → 报 name already in use 中断整个 up
#   → todo-web 被 recreate 了但没人去 start，停在 Created 状态 → 站点 502。
#   db 归 compose 管但状态正常，不需要动；web 用 --no-deps 单独重建。
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps web 2>&1 | tail -10

# Caddy 配置变更后单独 reload（它不受 compose 管理）
if docker exec todo-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  docker exec todo-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
    && echo "✅ Caddy 配置已 reload"
else
  echo "⚠️  Caddy 配置校验失败，保持当前运行配置不变"
fi

echo "=== 等 30s 健康检查 ==="
sleep 30
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | head -5

# fail fast：别在 web 没起来的情况下报"Deploy 完成"
if [ "$(docker inspect todo-web --format '{{.State.Running}}' 2>/dev/null)" != "true" ]; then
  echo ""
  echo "❌ Deploy 失败：todo-web 没有运行中，站点会 502"
  docker logs --tail 30 todo-web 2>&1
  exit 1
fi

echo ""
echo "✅ Deploy 完成"
echo "   当前 image: ${TAG}"
echo "   v-stable-stable 已更新"
echo "   DB migrations 已应用"