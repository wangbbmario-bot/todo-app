#!/bin/bash
# =====================================================
# 通用备份脚本：给同一个服务器上的多个项目用
#
# 用法：
#   ./backup.sh <project> [keep_days]
# 例：
#   ./backup.sh todo 30          # 备份 todo 项目，保留 30 天
#   ./backup.sh doorapp 14
#
# 做什么：
#   1. pg_dump 整个库 → /opt/<project>/.backup/db-<时间戳>.sql.gz
#   2. 上传目录（图片等）打包 → /opt/<project>/.backup/files-<时间戳>.tar.gz
#   3. 清理超过 keep_days 的旧备份
#
# 定时任务写法（/etc/cron.d/xxx-backup）：
#   17 4 * * * root /opt/todo/app/scripts/backup.sh todo >> /var/log/todo-backup.log 2>&1
# =====================================================
set -euo pipefail

PROJECT="${1:-}"
KEEP_DAYS="${2:-30}"

if [ -z "$PROJECT" ]; then
  echo "用法: $0 <project> [keep_days]"
  exit 2
fi

BACKUP_ROOT="/opt/${PROJECT}/.backup"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_PREFIX="[backup:${PROJECT}]"

# ---------- 定位项目目录与数据库容器 ----------
# 项目根目录有两种布局（todo 就是历史遗留的那种）：
#   /opt/<project>/            ← 新项目建议用这个
#   /opt/<project>/app/        ← todo 现在的样子
PROJECT_ROOT=""
for cand in "/opt/${PROJECT}" "/opt/${PROJECT}/app"; do
  if [ -f "${cand}/deploy/.env" ]; then PROJECT_ROOT="$cand"; break; fi
done
if [ -z "$PROJECT_ROOT" ]; then
  echo "${LOG_PREFIX} 找不到 ${PROJECT} 的 deploy/.env（试过 /opt/${PROJECT}/deploy/.env 和 /opt/${PROJECT}/app/deploy/.env）" >&2
  exit 1
fi
ENV_FILE="${PROJECT_ROOT}/deploy/.env"

# 数据库容器名默认 <project>-db，可用环境变量覆盖
DB_CONTAINER="${DB_CONTAINER:-${PROJECT}-db}"
if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "${LOG_PREFIX} 数据库容器 ${DB_CONTAINER} 不存在（可用 DB_CONTAINER=xxx 指定）" >&2
  exit 1
fi
DB_USER=$(grep '^DB_USER=' "$ENV_FILE" | cut -d= -f2)
DB_PASSWORD=$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2)
DB_NAME=$(grep '^DB_NAME=' "$ENV_FILE" | cut -d= -f2)

mkdir -p "$BACKUP_ROOT"

# ---------- 1. 数据库 ----------
# 注意：pg_dump 在 todo-db 容器里跑，产物落回宿主机
echo "${LOG_PREFIX} 备份数据库 ${DB_NAME} …"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
  | gzip > "${BACKUP_ROOT}/db-${STAMP}.sql.gz"
echo "${LOG_PREFIX}   → db-${STAMP}.sql.gz ($(du -h "${BACKUP_ROOT}/db-${STAMP}.sql.gz" | cut -f1))"

# ---------- 2. 上传文件 ----------
UPLOAD_VOLUME="${PROJECT}_uploads"
if docker volume inspect "$UPLOAD_VOLUME" >/dev/null 2>&1; then
  echo "${LOG_PREFIX} 打包上传目录 ${UPLOAD_VOLUME} …"
  docker run --rm -v "${UPLOAD_VOLUME}:/src:ro" -v "${BACKUP_ROOT}:/dst" alpine \
    tar czf "/dst/files-${STAMP}.tar.gz" -C /src . 2>/dev/null
  echo "${LOG_PREFIX}   → files-${STAMP}.tar.gz ($(du -h "${BACKUP_ROOT}/files-${STAMP}.tar.gz" | cut -f1))"
else
  echo "${LOG_PREFIX} 没有上传卷 ${UPLOAD_VOLUME}，跳过"
fi

# ---------- 3. 清理过期备份 ----------
echo "${LOG_PREFIX} 清理 ${KEEP_DAYS} 天前的旧备份 …"
find "$BACKUP_ROOT" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'files-*.tar.gz' \) \
  -mtime "+${KEEP_DAYS}" -print -delete

# ---------- 4. 结果 ----------
echo "${LOG_PREFIX} 完成，当前备份："
ls -lh "$BACKUP_ROOT" | tail -5
