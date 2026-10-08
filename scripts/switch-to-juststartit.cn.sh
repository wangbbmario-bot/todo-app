#!/bin/bash
# =============================================================================
# 备案完成后切换到 juststartit.cn 的脚本
# Run from /opt/todo/app on the server AFTER ICP备案通过且GFW不再拦截时
# 用法：bash scripts/switch-to-juststartit.cn.sh
# =============================================================================
set -e

ENV_FILE=".env"
DEPLOY_ENV="deploy/.env"
COMPOSE="deploy/docker-compose.prod.yml"
CADDYFILE="deploy/Caddyfile"

red() { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
yellow() { echo -e "\033[33m$*\033[0m"; }
step() { echo -e "\n\033[1;34m▶ $*\033[0m"; }

cd /opt/todo/app

step "1/6 备份当前配置"
TS=$(date +%Y%m%d_%H%M%S)
cp "$ENV_FILE" "${ENV_FILE}.bak.$TS"
cp "$DEPLOY_ENV" "${DEPLOY_ENV}.bak.$TS"
cp "$CADDYFILE" "${CADDYFILE}.bak.$TS"
green "✓ 备份完成：${ENV_FILE}.bak.$TS / ${DEPLOY_ENV}.bak.$TS / ${CADDYFILE}.bak.$TS"

step "2/6 改环境变量 NEXTAUTH_URL + DOMAIN"
sed -i \
  -e 's|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://juststartit.cn|' \
  -e 's|^DOMAIN=.*|DOMAIN=juststartit.cn|' \
  "$ENV_FILE" "$DEPLOY_ENV"
green "✓ .env:"
grep -E "NEXTAUTH_URL|DOMAIN" "$ENV_FILE"
echo
green "✓ deploy/.env:"
grep -E "NEXTAUTH_URL|DOMAIN" "$DEPLOY_ENV"

step "3/6 数据库名 todo_prod → todo（可选）"
echo "你当前用 DB_NAME=todo_prod。"
echo "切到 juststartit.cn 时建议改成 todo 保持一致。"
read -p "是否把数据库改名 todo_prod → todo? (y/N) " -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
  docker exec todo-db psql -U todo -d postgres -c "ALTER DATABASE todo_prod RENAME TO todo;"
  sed -i 's|^DB_NAME=.*|DB_NAME=todo|' "$ENV_FILE" "$DEPLOY_ENV"
  green "✓ 数据库已改名 + .env 已更新"
else
  yellow "跳过数据库改名（继续用 todo_prod）"
fi

step "4/6 Caddyfile：删掉 HTTP 临时块"
python3 <<'PYEOF'
import re
path = "/opt/todo/app/deploy/Caddyfile"
with open(path) as f:
    content = f.read()
# 匹配 "http://47.107.46.78.nip.io, http://47.107.46.78 {" 开头的整段块
pattern = re.compile(
    r'\nhttp://47\.107\.46\.78\.nip\.io,\s*http://47\.107\.46\.78\s*\{[\s\S]*?\n\}\n',
    re.MULTILINE
)
new_content, count = pattern.subn('\n', content)
if count > 0:
    with open(path, 'w') as f:
        f.write(new_content)
    print(f"✓ HTTP 临时块已删除（{count} 个匹配）")
else:
    print("⚠ 未匹配到 HTTP 块（可能已删过或格式不同），跳过")
PYEOF
echo
green "✓ Caddyfile 现在内容："
echo "---"
cat "$CADDYFILE"
echo "---"

step "5/6 重启服务"
echo "重启 web + caddy..."
docker compose -p todo -f "$COMPOSE" up -d --force-recreate --no-deps web caddy
sleep 15
echo
green "✓ 容器状态："
docker compose -p todo -f "$COMPOSE" ps

step "6/6 验证 https://juststartit.cn"
echo
curl -sS -m 10 -o /dev/null -w "  GET /             HTTP %{http_code} | %{time_total}s\n" https://just-start.com/ 2>/dev/null || true
curl -sS -m 10 -o /dev/null -w "  GET /             HTTP %{http_code} | %{time_total}s\n" https://juststartit.cn/
curl -sS -m 10 -o /dev/null -w "  GET /login        HTTP %{http_code} | %{time_total}s\n" https://juststartit.cn/login
curl -sS -m 10 -o /dev/null -w "  GET /api/register HTTP %{http_code} | %{time_total}s\n" https://juststartit.cn/api/register
curl -sS -m 10 -o /dev/null -w "  GET /admin/logs   HTTP %{http_code} | %{time_total}s\n" https://juststartit.cn/admin/logs
echo
green "🎉 切换完成！"
echo
echo "记住这几件事："
echo "  1. 你需要重新登录一次（cookie domain 从 .nip.io 变成 juststartit.cn）"
echo "  2. 如果用了 Google/GitHub OAuth，OAuth provider 的 callback URL 要加"
echo "     https://juststartit.cn/api/auth/callback/<provider>"
echo "  3. 老账号（在 .nip.io 注册的）依然能用，因为数据库没动"
echo
echo "想回退（rollback）的话："
echo "  bash /opt/todo/app/scripts/restore-pre-juststartit.cn.sh"
echo "  （脚本会自动用回 ${ENV_FILE}.bak.* / ${DEPLOY_ENV}.bak.* / ${CADDYFILE}.bak.*）"