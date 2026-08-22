#!/usr/bin/env bash
# 阿里云 ECS（Ubuntu 22.04）一键部署脚本
# 用法：把整个仓库上传/克隆到服务器后，在仓库根目录执行：
#   sudo bash deploy/setup-server.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 sudo 运行本脚本" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> 安装基础软件（nginx / curl）"
apt-get update
apt-get install -y curl ca-certificates nginx

echo "==> 安装 Node.js 20 LTS"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> 部署后端代码到 /opt/postcard-studio"
rm -rf /opt/postcard-studio
mkdir -p /opt/postcard-studio
cp -r "$REPO_ROOT/postcard-studio/." /opt/postcard-studio/

echo "==> 部署 APK 下载落地页"
mkdir -p /var/www/postcard-download
cp -f "$REPO_ROOT/deploy/download-page/index.html" /var/www/postcard-download/index.html

echo "==> 注册 systemd 服务 postcard-studio"
cp -f "$REPO_ROOT/deploy/postcard-studio.service" /etc/systemd/system/postcard-studio.service
systemctl daemon-reload
systemctl enable postcard-studio
systemctl restart postcard-studio

echo "==> 配置 nginx 站点"
cp -f "$REPO_ROOT/deploy/nginx-postcard.conf" /etc/nginx/sites-available/postcard
ln -sf /etc/nginx/sites-available/postcard /etc/nginx/sites-enabled/postcard
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> 放行防火墙 80/443 端口（若 ufw 已启用）"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

echo
echo "=================================================="
echo " 部署完成！"
echo "  下载页：   http://<公网IP>/"
echo "  网页版：   http://<公网IP>/studio/"
echo "  健康检查： http://<公网IP>/api/health"
echo
echo " 还差一步：发布 APK（二选一）"
echo "  1) 在本机执行 bash deploy/publish-apk.sh 上传 APK"
echo "  2) 或手动 scp 任意 APK 到服务器 /var/www/postcard-download/postcard.apk"
echo
echo " 注意：请在阿里云控制台「网络与安全组」放行 TCP 80 端口！"
echo " 日志： journalctl -u postcard-studio -f  或  tail -f /var/log/postcard-studio.log"
echo "=================================================="
