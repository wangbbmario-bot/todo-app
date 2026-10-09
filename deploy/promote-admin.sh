#!/bin/bash
# =====================================================
# promote-admin.sh - 把某个手机号的用户升级为 ADMIN
# 用法：./promote-admin.sh 13800001234
# 兼容 2026-10-08 删 email 字段后的版本（用 phone 定位）
# =====================================================
set -e

PHONE="${1:-}"

if [ -z "$PHONE" ]; then
  echo "用法: $0 <phone>"
  echo "示例: $0 13800001234"
  exit 1
fi

docker exec todo-db psql -U todo -d todo_prod -c \
  "UPDATE \"User\" SET role='ADMIN', \"updatedAt\" = CURRENT_TIMESTAMP WHERE phone = '$PHONE';"

echo ""
echo "查询结果："
docker exec todo-db psql -U todo -d todo_prod -c \
  "SELECT phone, role, \"updatedAt\" FROM \"User\" WHERE phone = '$PHONE';"

echo ""
echo "降级（取消 ADMIN）：把 'ADMIN' 改成 'MEMBER' 即可"