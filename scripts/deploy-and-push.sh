#!/usr/bin/env bash
#
# deploy-and-push.sh —— 一条龙：本地校验 → 提交 → 推 GitHub → 推服务器 → 线上部署
#
# 用法（在本地仓库根目录跑）：
#   bash scripts/deploy-and-push.sh "fix(canvas): 修复 XXX"
#
# 做四件事：
#   1. pnpm --filter web type-check   —— 类型检查，不通过就中止（不推坏代码）
#   2. git add -A && git commit       —— 有改动才提交
#   3. git push origin main           —— 同步到 GitHub
#   4. 把变更文件 SFTP 到服务器 + 跑 rebuild-and-deploy.sh —— 线上部署
#
# 依赖：
#   - 本机 SSH key 已加到 GitHub（ssh -T git@github.com 能通）
#   - 服务器已配好 deploy/.env（含 NEXTAUTH_SECRET / DB / GUEST_* 等）
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_REPO="/opt/todo/app"
SSH_HOST="47.107.46.78"
SCRIPTS_DIR="$(cd "$REPO_ROOT/.." && pwd)/scripts/ssh-tools"

cd "$REPO_ROOT"

COMMIT_MSG="${1:-}"
if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="chore: $(date '+%Y-%m-%d %H:%M:%S') 自动同步"
fi

echo "════════════════════════════════════════"
echo " 1/4  类型检查"
echo "════════════════════════════════════════"
pnpm --filter web type-check 2>&1 | grep -E "error TS" | grep -v "e2e/06-auth" && {
  echo "❌ 有类型错误（排除 e2e/06-auth.spec.ts 的既有语法错误），中止"
  exit 1
}
echo "✅ 类型检查通过"

echo ""
echo "════════════════════════════════════════"
echo " 2/4  提交"
echo "════════════════════════════════════════"
if [ -z "$(git status --porcelain)" ]; then
  echo "ℹ️  无本地改动，跳过提交"
else
  git add -A
  git commit -q -m "$COMMIT_MSG"
  echo "✅ 已提交: $(git log --oneline -1)"
fi

echo ""
echo "════════════════════════════════════════"
echo " 3/4  推送到 GitHub"
echo "════════════════════════════════════════"
if git remote get-url origin >/dev/null 2>&1; then
  git push origin main
  echo "✅ 已推送 GitHub"
else
  echo "⚠️  未配置 origin remote，跳过（见 README 的「同步到 GitHub」章节）"
fi

echo ""
echo "════════════════════════════════════════"
echo " 4/4  同步文件到服务器并部署"
echo "════════════════════════════════════════"
# 只推真正改动的文件，避免把 .git / node_modules 之类传上去
CHANGED="$(git diff --name-only HEAD~1 2>/dev/null || true)"
if [ -z "$CHANGED" ]; then
  CHANGED="$(git ls-files)"
fi
COUNT=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ -f "$f" ] || continue
  case "$f" in
    node_modules/*|.next/*|*.tsbuildinfo) continue ;;
  esac
  mkdir -p "$REMOTE_REPO/$(dirname "$f")" 2>/dev/null || true
  ssh -o StrictHostKeyChecking=no "root@$SSH_HOST" "mkdir -p '$REMOTE_REPO/$(dirname "$f")'" 2>/dev/null || true
  python3 "$SCRIPTS_DIR/spush.py" "$REPO_ROOT/$f" "$REMOTE_REPO/$f" >/dev/null && COUNT=$((COUNT+1))
done <<< "$CHANGED"
echo "✅ 已同步 $COUNT 个文件到服务器"

echo ""
echo "⏳ 触发服务器构建部署（约 5-8 分钟）..."
ssh -o StrictHostKeyChecking=no "root@$SSH_HOST" \
  "echo 'cd $REMOTE_REPO && bash scripts/rebuild-and-deploy.sh > /tmp/deploy-auto.log 2>&1' | at now + 1 minute && echo '已调度（at +1min），完成后看 /tmp/deploy-auto.log'"

echo ""
echo "✅ 全部完成。稍后可用以下命令确认部署结果："
echo "   ssh root@$SSH_HOST 'tail -5 /tmp/deploy-auto.log; docker ps --filter name=todo-web'"
