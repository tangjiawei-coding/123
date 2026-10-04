#!/usr/bin/env bash
# Postcard 服务端一键部署脚本
# 适用：阿里云 ECS（Ubuntu / Debian / Alibaba Cloud Linux / CentOS）
# 用法（在 ECS 上以 root 执行）：
#   curl -fsSL https://raw.githubusercontent.com/tangjiawei-coding/123/feat/ios-app/postcard-studio/deploy.sh -o /root/deploy.sh
#   bash /root/deploy.sh
set -euo pipefail

APP_DIR="/opt/postcard"
BRANCH="${POSTCARD_BRANCH:-feat/ios-app}"
REPO="https://github.com/tangjiawei-coding/123.git"
PORT=5123

echo "================ Postcard 服务端部署 ================"

# 1. 安装 Node.js 20 LTS + git
if command -v apt-get >/dev/null 2>&1; then
  echo "[1/6] 安装 Node.js（apt）..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs git
elif command -v dnf >/dev/null 2>&1; then
  echo "[1/6] 安装 Node.js（dnf）..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs git
else
  echo "不支持的系统：找不到 apt-get 或 dnf"; exit 1
fi
echo "node $(node -v) / npm $(npm -v)"

# 2. 拉取/更新代码
echo "[2/6] 拉取代码..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  git clone --depth 1 -b "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi
cd postcard-studio

# 3. 输入上游 API Key（不回显；也支持预先 export POSTCARD_API_KEY 免交互）
echo "[3/6] 设置上游 API Key..."
if [ -n "${POSTCARD_API_KEY:-}" ]; then
  API_KEY="$POSTCARD_API_KEY"
  echo "已从环境变量 POSTCARD_API_KEY 读取"
else
  read -s -p "请输入 POSTCARD_API_KEY（sk-...，输入时不显示）: " API_KEY
  echo
  if [ -z "$API_KEY" ]; then
    echo "未输入 key，终止"; exit 1
  fi
fi

# 4. 安装 pm2
echo "[4/6] 安装 pm2..."
npm install -g pm2

# 5. 生成 ecosystem 配置并启动 + 开机自启
echo "[5/6] 启动服务 + 开机自启..."
pm2 delete postcard 2>/dev/null || true
cat > ecosystem.config.cjs <<EOF
module.exports = {
  apps: [{
    name: 'postcard',
    script: 'server.js',
    env: { POSTCARD_API_KEY: '$API_KEY' }
  }]
};
EOF
chmod 600 ecosystem.config.cjs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -y >/dev/null 2>&1 || true

# 6. 验证
echo "[6/6] 验证..."
sleep 2
if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
  echo "OK: 服务已启动，本机 http://127.0.0.1:$PORT/ 可访问"
else
  echo "FAIL: 本机访问失败，查看日志：pm2 logs postcard"; exit 1
fi

echo
echo "================ 部署完成 ================"
echo "外网访问： http://<ECS公网IP>:$PORT/"
echo "请确认阿里云安全组已放行 TCP $PORT"
echo "日志：     pm2 logs postcard"
echo "重启：     pm2 restart postcard"
