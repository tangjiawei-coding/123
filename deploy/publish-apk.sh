#!/usr/bin/env bash
# 在开发机执行：把 APK 上传到阿里云服务器，供下载页分发
# 用法： bash deploy/publish-apk.sh [apk路径]
# 环境变量： SERVER（默认 root@120.55.251.74）
set -euo pipefail

SERVER="${SERVER:-root@120.55.251.74}"
APK="${1:-android-app/app/build/outputs/apk/debug/app-debug.apk}"

if [ ! -f "$APK" ]; then
  echo "未找到 APK：$APK" >&2
  echo "获取方式二选一：" >&2
  echo "  1) 本地构建（需 Gradle + Android SDK）：cd android-app && gradle :app:assembleDebug" >&2
  echo "  2) 从 GitHub Actions 下载工件 postcard-debug-apk（推送本分支后自动构建）" >&2
  exit 1
fi

echo "==> 上传 $APK -> $SERVER:/var/www/postcard-download/postcard.apk"
scp "$APK" "$SERVER:/var/www/postcard-download/postcard.apk"
echo "==> 发布完成： http://120.55.251.74/postcard.apk"
