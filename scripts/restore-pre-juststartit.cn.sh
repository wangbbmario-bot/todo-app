#!/bin/bash
# =============================================================================
# switch-to-juststartit.cn.sh 的回退脚本
# 用法：bash scripts/restore-prejuststartit.cn.sh
# =============================================================================
set -e

ENV_FILE=".env"
DEPLOY_ENV="deploy/.env"
CADDYFILE="deploy/Caddyfile"

red() { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
yellow() { echo -e "\033[33m$*\033[0m"; }
step() { echo -e "\n\033[1;34m▶ $*\033[0m"; }

cd /opt/todo/app

step "1/4 找最新的备份"
ENV_BAK=$(ls -1t ${ENV_FILE}.bak.* 2>/dev/null | head -1)
DEPLOY_BAK=$(ls -1t ${DEPLOY_ENV}.bak.* 2>/dev/null | head -1)
CADDY_BAK=$(ls -1t ${CADDYFILE}.bak.* 2>/dev/null | head -1)

if [ -z "$ENV_BAK" ] || [ -z "$DEPLOY_BAK" ] || [ -z "$CADDY_BAK" ]; then
  red "❌ 找不到备份文件，无法回退"
  echo "需要存在以下文件："
  echo "  ${ENV_FILE}.bak.*"
  echo "  ${DEPLOY_ENV}.bak.*"
  echo "  ${CADDYFILE}.bak.*"
  exit 1
fi

echo "最新备份："
echo "  $ENV_BAK"
echo "  $DEPLOY_BAK"
echo "  $CADDY_BAK"
echo
read -p "确认回退到这些备份？当前的修改会丢失 (y/N) " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  yellow "取消回退"
  exit 0
fi

step "2/4 恢复文件"
cp "$ENV_BAK" "$ENV_FILE"
cp "$DEPLOY_BAK" "$DEPLOY_ENV"
cp "$CADDY_BAK" "$CADDYFILE"
green "✓ 已恢复"

step "3/4 重启服务"
docker compose -p todo -f deploy/docker-compose.prod.yml up -d --force-recreate --no-deps web caddy
sleep 15
echo
green "✓ 容器状态："
docker compose -p todo -f deploy/docker-compose.prod.yml ps

step "4/4 验证"
green "✓ 当前配置："
grep -E "NEXTAUTH_URL|DOMAIN" "$ENV_FILE"
echo
green "🎉 回退完成！"
echo
echo "如果你要继续切到 juststartit.cn，过 5 分钟后再跑一次："
echo "  bash /opt/todo/app/scripts/switch-to-juststartit.cn.sh"