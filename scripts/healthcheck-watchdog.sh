#!/bin/bash
# =====================================================
# healthcheck-watchdog.sh
#
# 监控 todo-web 容器健康状态，挂了自动 rollback 到 v-stable-stable
#
# 用法（装到 crontab）：
#   * * * * * /opt/todo/app/scripts/healthcheck-watchdog.sh >> /var/log/todo-watchdog.log 2>&1
#
# 设计：
# - 每 1 分钟跑一次
# - 检测 todo-web 的 health status
# - 如果连续 3 次 unhealthy（3 分钟），自动 rollback
# - 任何时刻只有 1 个 rollback 在跑（用 flock 防止重叠）
# - rollback 后给飞书 webhook 发通知（如果配置了）
# =====================================================
set -euo pipefail

LOCK_FILE="/tmp/todo-webdog.lock"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"
WEBHOOK_URL="${FEISHU_WEBHOOK_URL:-}"
PROJECT_NAME="${PROJECT_NAME:-todo}"
COMPOSE_FILE="/opt/todo/app/deploy/docker-compose.prod.yml"
UNHEALTHY_THRESHOLD="${WATCHDOG_THRESHOLD:-3}"
STATE_FILE="/tmp/todo-webdog-state"
MAX_LOG_AGE_DAYS=7

# 防止重叠执行
(
  if ! flock -n 9; then
    echo "$LOG_PREFIX another instance running, skip"
    exit 0
  fi

  # 检查容器是否存在
  if ! docker inspect todo-web >/dev/null 2>&1; then
    echo "$LOG_PREFIX todo-web container not found, skip"
    exit 0
  fi

  # 读 health status
  HEALTH=$(docker inspect --format '{{.State.Health.Status}}' todo-web 2>/dev/null || echo "missing")
  CONTAINER_RUNNING=$(docker inspect --format '{{.State.Running}}' todo-web 2>/dev/null || echo "false")
  CURRENT_IMAGE=$(docker inspect --format '{{.Image}}' todo-web 2>/dev/null | sed 's/sha256://' | cut -c1-12 || echo "unknown")

  echo "$LOG_PREFIX health=$HEALTH running=$CONTAINER_RUNNING image=$CURRENT_IMAGE"

  # 健康：清零失败计数
  if [ "$HEALTH" = "healthy" ]; then
    echo "0" > "$STATE_FILE"
    exit 0
  fi

  # 不健康：累加计数
  CURRENT_FAILS=$(cat "$STATE_FILE" 2>/dev/null || echo "0")
  CURRENT_FAILS=$((CURRENT_FAILS + 1))
  echo "$CURRENT_FAILS" > "$STATE_FILE"
  echo "$LOG_PREFIX fail count: $CURRENT_FAILS / threshold: $UNHEALTHY_THRESHOLD"

  # 没到阈值：只记录
  if [ "$CURRENT_FAILS" -lt "$UNHEALTHY_THRESHOLD" ]; then
    exit 0
  fi

  # 达到阈值：rollback
  echo "$LOG_PREFIX ⚠️  rolling back to v-stable-stable..."

  # 检查 v-stable-stable 镜像存在
  if ! docker images --format '{{.Tag}}' todo-web | grep -q 'v-stable-stable'; then
    echo "$LOG_PREFIX ❌  v-stable-stable image missing, cannot rollback"
    send_feishu "❌ todo-web watchdog: v-stable-stable missing, manual intervention needed"
    exit 1
  fi

  # 记录失败原因
  FAIL_REASON=$(docker inspect --format '{{.State.Error}}' todo-web 2>/dev/null | head -c 200 || echo "unknown")
  echo "$LOG_PREFIX 失败原因: $FAIL_REASON"

  # 切 tag + 重启
  docker tag todo-web:v-stable-stable todo-web:latest

  if docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --no-deps web 2>&1 | tail -5; then
    echo "$LOG_PREFIX ✅  rolled back successfully"
    # 重置失败计数
    echo "0" > "$STATE_FILE"
    # 通知
    send_feishu "✅ todo-web watchdog: 自动 rollback 到 v-stable-stable 完成
- 原镜像: $CURRENT_IMAGE
- 失败原因: $FAIL_REASON
- 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
  else
    echo "$LOG_PREFIX ❌  rollback failed"
    send_feishu "❌ todo-web watchdog: rollback 失败，需立即人工介入！
- 容器一直 unhealthy
- rollback 命令也失败了"
    exit 1
  fi
) 9>"$LOCK_FILE"

# 飞书 webhook 通知
send_feishu() {
  local msg="$1"
  if [ -z "$WEBHOOK_URL" ]; then
    return
  fi
  curl -sS -X POST "$WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"$msg\"}}" \
    --max-time 10 || true
}

# 清理旧日志
find /var/log/todo-watchdog.log* -mtime +${MAX_LOG_AGE_DAYS} -delete 2>/dev/null || true