#!/usr/bin/env bash
#
# cleanup-test-data.sh —— 安全清理测试数据
#
# 2026-10-29：因为之前手写 SQL 漏了 userId 限定，误删过用户真实子任务。
# 这个脚本把「限定条件」固化下来，别再手写 DELETE 了。
#
# 用法：
#   bash scripts/cleanup-test-data.sh                    # 预览（只 SELECT）
#   bash scripts/cleanup-test-data.sh --apply            # 真删
#   PHONE=18982817293 bash scripts/cleanup-test-data.sh --apply
#
# 安全设计：
#   1. 每条 DELETE 的 WHERE 都必须带 userId 限定
#   2. 默认只预览，必须显式 --apply 才执行
#   3. 删除范围限定在「标题带 E2E- 前缀」的测试数据 —— 造测试数据时用这个前缀
#   4. 删完立刻打印剩余数量，便于核对
#
set -euo pipefail

PHONE="${PHONE:-18552279527}"          # 默认只清理游客/测试账号
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

read -r -d '' SQL <<EOF
\\echo '=== 命中（将被删除）的任务 ==='
SELECT t.id, t.title, u.phone FROM "Task" t JOIN "User" u ON u.id=t."userId"
 WHERE t."deletedAt" IS NULL AND t.title LIKE 'E2E-%' AND u.phone = '${PHONE}';
\\echo '=== 命中（将被删除）的子任务 ==='
SELECT s.id, s.title, t.title AS parent, u.phone FROM "SubTask" s
  JOIN "Task" t ON t.id=s."taskId" JOIN "User" u ON u.id=t."userId"
 WHERE s."deletedAt" IS NULL AND s.title LIKE 'E2E-%' AND u.phone = '${PHONE}';
\\echo '=== 命中（将被删除）的便利贴 ==='
SELECT f.id, f.title, u.phone FROM "FloatingNode" f JOIN "User" u ON u.id=f."userId"
 WHERE f."deletedAt" IS NULL AND f.title LIKE 'E2E-%' AND u.phone = '${PHONE}';
EOF

if [ "$APPLY" = "1" ]; then
  read -r -d '' DEL_SQL <<EOF
DELETE FROM "SubTask" WHERE "deletedAt" IS NULL AND title LIKE 'E2E-%'
  AND "taskId" IN (SELECT id FROM "Task" WHERE title LIKE 'E2E-%'
                    AND "userId" = (SELECT id FROM "User" WHERE phone='${PHONE}'));
DELETE FROM "FloatingNode" WHERE "deletedAt" IS NULL AND title LIKE 'E2E-%'
  AND "userId" = (SELECT id FROM "User" WHERE phone='${PHONE}');
DELETE FROM "Task" WHERE "deletedAt" IS NULL AND title LIKE 'E2E-%'
  AND "userId" = (SELECT id FROM "User" WHERE phone='${PHONE}');
EOF
  printf '%s\n%s\n' "$SQL" "$DEL_SQL" | ssh -o StrictHostKeyChecking=no root@47.107.46.78 \
    "docker exec -i todo-db psql -U todo -d todo_prod -t -A -F'|'"
  echo ""
  echo "✅ 已删除（仅限 phone=${PHONE} 且标题以 E2E- 开头的记录）"
else
  printf '%s\n' "$SQL" | ssh -o StrictHostKeyChecking=no root@47.107.46.78 \
    "docker exec -i todo-db psql -U todo -d todo_prod -t -A -F'|'"
  echo ""
  echo "ℹ️  以上是预览。确认无误后加 --apply 执行删除。"
fi
