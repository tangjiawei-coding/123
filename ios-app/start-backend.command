#!/bin/bash
# 可选：Mac 本地运行随项目保留的后端；已有 ECS 服务器时无需启动第二套。
set -euo pipefail
cd "$(dirname "$0")/../postcard-studio"
if ! command -v node >/dev/null; then
  echo '请先安装 Node.js 20 或更新版本，然后重新运行。'; read -r; exit 1
fi
if [ -f .env ]; then set -a; source .env; set +a; fi
export POSTCARD_OPEN_BROWSER=0
echo '本机访问 http://127.0.0.1:5123/v2.html'
echo 'iPhone 请连接同一 Wi-Fi，并在 App 连接设置中填写本 Mac 的局域网 IP:5123。'
exec node server.js
