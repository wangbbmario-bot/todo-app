#!/bin/bash
# =====================================================
# promote-admin.sh - 把某个用户升级为 ADMIN
# 用法：./promote-admin.sh user@example.com
# =====================================================
set -e

EMAIL="${1:-}"

if [ -z "$EMAIL" ]; then
  echo "用法: $0 <email>"
  echo "示例: $0 admin@yourdomain.com"
  exit 1
fi

# 在 server 上跑（需要 docker compose 权限）
docker exec todo-db psql -U todo -d todo_prod -c \
  "UPDATE \"User\" SET role='ADMIN', \"updatedAt\" = CURRENT_TIMESTAMP WHERE email = '$EMAIL';"

echo ""
echo "✅ 已将 $EMAIL 升级为 ADMIN"
echo "用户需重新登录才能生效（清 cookie 或点退出登录）"