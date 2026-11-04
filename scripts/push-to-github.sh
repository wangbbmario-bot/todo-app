#!/bin/bash
# =====================================================
# push-to-github.sh —— 创建公开仓库并推送全部提交
#
# 前置：gh 已登录（gh auth status 能看到账号）
# 用法：
#   bash scripts/push-to-github.sh                # 仓库名默认 todo-app
#   REPO_NAME=my-todo bash scripts/push-to-github.sh
# =====================================================
set -euo pipefail

GH="${GH:-$HOME/.local/bin/gh}"
REPO_NAME="${REPO_NAME:-todo-app}"
REPO_DESC="${REPO_DESC:-待办 + 思维导图二合一的自建 Web 应用 · Next.js + React Flow + PostgreSQL}"
PROJ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJ_DIR"

echo "=== 1/4 检查登录 ==="
if ! "$GH" auth status >/dev/null 2>&1; then
  echo "❌ gh 未登录。先跑： gh auth login --hostname github.com --git-protocol https --web"
  exit 1
fi
LOGIN=$("$GH" api user --jq .login)
echo "  账号: $LOGIN"

echo "=== 2/4 确认工作区干净 ==="
if [ -n "$(git status --porcelain)" ]; then
  echo "  ⚠️  有未提交的改动，先提交再推："
  git status --short
  exit 1
fi

echo "=== 3/4 创建仓库 ${LOGIN}/${REPO_NAME}（公开）==="
if "$GH" repo view "${LOGIN}/${REPO_NAME}" >/dev/null 2>&1; then
  echo "  仓库已存在，跳过创建"
else
  "$GH" repo create "$REPO_NAME" \
    --public \
    --description "$REPO_DESC" \
    --source=. \
    --remote=origin
  echo "  ✅ 已创建"
fi

echo "=== 4/4 推送 ==="
git push -u origin main

echo
echo "✅ 完成"
echo "   https://github.com/${LOGIN}/${REPO_NAME}"
