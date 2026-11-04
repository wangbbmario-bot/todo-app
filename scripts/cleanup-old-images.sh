#!/bin/bash
# =====================================================
# cleanup-old-images.sh - 清理历次部署留下的历史镜像
#
# 背景：部署脚本每次都打一个新 tag（v-YYYYMMDD-HHMMSS），从不清旧的。
#       镜像堆到几十个后有两个后果：
#         1) 磁盘被吃光
#         2) dockerd 的元数据内存暴涨（上个月实测冲到 1.27GB → OOM 把网站搞挂）
#
# 用法：
#   ./cleanup-old-images.sh              # 保留 latest + v-stable-stable + 当前运行的
#   ./cleanup-old-images.sh --keep 3    # 额外保留最近 3 个版本
#   ./cleanup-old-images.sh --dry-run    # 只列出来要删的，不真删
# =====================================================
set -euo pipefail

KEEP=1
DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --keep) KEEP="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "未知参数: $1"; exit 2 ;;
  esac
done

echo "===== 清理前 ====="
docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}' | head -5
echo "镜像总数: $(docker images -q | wc -l)"

# 找出所有 todo-web 的版本 tag（排除要保留的）
RUNNING_IMAGE=$(docker inspect todo-web --format '{{.Config.Image}}' 2>/dev/null || echo "")
echo "当前运行镜像: ${RUNNING_IMAGE:-未知}"

CANDIDATES=$(docker images todo-web --format '{{.Tag}}' \
  | grep -v '^latest$' \
  | grep -v '^v-stable-stable$' \
  | grep -v "^${RUNNING_IMAGE#todo-web:}$" \
  | sort -r | tail -n "+$((KEEP+1))")

if [ -z "$CANDIDATES" ]; then
  echo "没有需要清理的镜像"
  exit 0
fi

COUNT=$(echo "$CANDIDATES" | wc -l)
echo ""
echo "===== 待删除 $COUNT 个 todo-web 镜像 ====="
echo "$CANDIDATES" | sed 's/^/  todo-web:/'

if [ "$DRY_RUN" = "1" ]; then
  echo ""
  echo "--dry-run：没有真的删除"
  exit 0
fi

echo ""
for tag in $CANDIDATES; do
  docker rmi "todo-web:${tag}" >/dev/null 2>&1 && echo "  ✓ 删除 todo-web:${tag}" || echo "  ✗ 失败 todo-web:${tag}"
done

# 清理悬空层（无 tag 的中间层）
docker image prune -f >/dev/null 2>&1 && echo "  ✓ 清理悬空镜像层"

echo ""
echo "===== 清理后 ====="
echo "镜像总数: $(docker images -q | wc -l)"
df -h / | tail -1
