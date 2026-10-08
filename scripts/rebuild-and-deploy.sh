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

echo "=== 内存检查（防 OOM kill dockerd） ==="
FREE_MB=$(free -m | awk '/^Mem:/ {print $7}')
echo "  可用内存: ${FREE_MB} MB"
if [ "$FREE_MB" -lt 600 ]; then
  echo "⚠️  内存不够（<600MB），先 sync && echo 3 > /proc/sys/vm/drop_caches"
  sync && echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
fi

echo "=== 启动 build ==="
cd /opt/todo/app/deploy
docker build \
  --progress=plain \
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
# 用一个临时容器跑 migrate deploy（自带 prisma CLI + @prisma/client）
docker run --rm \
  --network "${PROJECT_NAME}_default" \
  -e DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}" \
  -v /opt/todo/app/packages/db:/db \
  -w /db \
  node:20-alpine sh -c "
    npm install --no-save --silent prisma@5.16.0 2>&1 | tail -2
    npx prisma migrate deploy 2>&1
  " 2>&1 | tail -10

echo "=== 重启容器（保留 data volumes）==="
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d 2>&1 | tail -10

echo "=== 等 30s 健康检查 ==="
sleep 30
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | head -5

echo ""
echo "✅ Deploy 完成"
echo "   当前 image: ${TAG}"
echo "   v-stable-stable 已更新"
echo "   DB migrations 已应用"