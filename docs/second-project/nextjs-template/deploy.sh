#!/bin/bash
# =====================================================
# 新项目一键部署脚本（Next.js，无数据库）
#
# 放在新项目仓库的 scripts/deploy.sh
#
# 用法：
#   ./scripts/deploy.sh              # 构建 + 启动
#   ./scripts/deploy.sh --clean      # 部署前先清历史镜像
#
# 设计要点（都来自 todo 项目的踩坑）：
#   1. 部署必须带 -p <project> 和 --env-file（否则 project 名冲突 / 变量全空）
#   2. 每次打时间戳 tag + 保留 latest；旧镜像不清理会堆到几十个，
#      把 dockerd 元数据内存撑爆 → OOM 掉网站
#   3. 不用裸 `up -d`（会试图重建不属于本 compose 的容器 → 中断 → 站点挂）
# =====================================================
set -euo pipefail

APP_NAME="${APP_NAME:-newapp}"        # ← 改成你的项目名（要和另一个项目不同！）
APP_DIR="${APP_DIR:-/opt/${APP_NAME}}"
COMPOSE_FILE="${APP_DIR}/deploy/docker-compose.prod.yml"
ENV_FILE="${APP_DIR}/deploy/.env"
TAG="v-$(date +%Y%m%d-%H%M%S)"

echo "=== 清理旧镜像 ==="
if [ "${1:-}" = "--clean" ]; then
  docker images "${APP_NAME}-web" --format '{{.Tag}}' \
    | grep -v -E '^latest$|^v-stable-stable$' \
    | sort -r | tail -n +2 \
    | while read -r t; do docker rmi "${APP_NAME}-web:${t}" >/dev/null 2>&1 && echo "  ✓ 删除 ${APP_NAME}-web:${t}"; done
  docker image prune -f >/dev/null 2>&1
fi

echo "=== 构建镜像 ${APP_NAME}-web:${TAG} ==="
cd "$APP_DIR"
docker build \
  --progress=plain \
  -f deploy/Dockerfile.prod \
  -t "${APP_NAME}-web:${TAG}" \
  .

docker tag "${APP_NAME}-web:${TAG}" "${APP_NAME}-web:latest"
docker tag "${APP_NAME}-web:${TAG}" "${APP_NAME}-web:v-stable-stable"

echo "=== 启动容器 ==="
# ★ --no-deps web：只动自己的 web 服务，不碰别的容器
docker compose -p "$APP_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  up -d --no-deps web

echo "=== 等健康检查 ==="
for i in $(seq 1 30); do
  STATUS=$(docker inspect "${APP_NAME}-web" --format '{{.State.Health.Status}}' 2>/dev/null || echo "starting")
  echo "  [$i] health=$STATUS"
  [ "$STATUS" = "healthy" ] && break
  sleep 4
done

echo ""
docker ps --filter "name=${APP_NAME}-web" --format '{{.Names}} | {{.Status}} | {{.Ports}}'
echo "✅ 部署完成：${APP_NAME}-web:${TAG}"
echo "   访问：http://47.107.46.78:3001"
