#!/bin/bash
# =====================================================
# 服务器一键初始化脚本（Alibaba Cloud Linux 3 / Ubuntu）
# =====================================================
# 用法：
#   chmod +x init.sh
#   ./init.sh
# =====================================================

set -e

echo "🚀 Todo App 服务器初始化开始"
echo ""

# ---------- 1. 加 2GB Swap（防 OOM 救命） ----------
echo "📦 [1/5] 配置 Swap（2GB）..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    sysctl -p
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "✅ Swap 2GB 已启用"
else
    echo "⏭️  Swap 已存在，跳过"
fi
echo ""

# ---------- 2. 装 Docker ----------
echo "🐳 [2/5] 安装 Docker..."
if ! command -v docker &> /dev/null; then
    # 用国内镜像加速
    curl -fsSL https://get.docker.com | sh -s -- --mirror Aliyun
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker 安装完成"
else
    echo "⏭️  Docker 已安装: $(docker --version)"
fi
echo ""

# ---------- 3. 装 Docker Compose（v2 内置已含） ----------
echo "🔧 [3/5] 检查 Docker Compose..."
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose: $(docker compose version)"
else
    echo "❌ Docker Compose 不可用，请检查 Docker 安装"
    exit 1
fi
echo ""

# ---------- 4. 配置防火墙 ----------
echo "🔥 [4/5] 配置防火墙（开放 80/443）..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    echo "✅ 防火墙配置完成"
elif command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw reload
    echo "✅ ufw 防火墙配置完成"
else
    echo "⏭️  未检测到 firewall，跳过（阿里云默认安全组控制）"
fi
echo ""

# ---------- 5. 创建项目目录 ----------
echo "📁 [5/5] 创建项目目录..."
mkdir -p /opt/todo/{deploy,uploads,backups}
echo "✅ 项目目录: /opt/todo"
echo ""

echo "🎉 初始化完成！接下来："
echo ""
echo "1. 上传代码到服务器（任选其一）："
echo "   - git clone https://github.com/your/repo.git /opt/todo/app"
echo "   - scp -r ./ root@your-ip:/opt/todo/app"
echo ""
echo "2. 配置环境变量："
echo "   cd /opt/todo/app/deploy"
echo "   cp .env.example .env"
echo "   nano .env  # 改 DB_PASSWORD / NEXTAUTH_SECRET / DOMAIN"
echo ""
echo "3. 启动："
echo "   cd /opt/todo/app"
echo "   docker compose -f deploy/docker-compose.prod.yml up -d"
echo ""
echo "4. 跑数据库迁移（首次启动）："
echo "   docker compose -f deploy/docker-compose.prod.yml exec web pnpm --filter @todo/db db:deploy"
echo ""
echo "5. 查看日志："
echo "   docker compose -f deploy/docker-compose.prod.yml logs -f"