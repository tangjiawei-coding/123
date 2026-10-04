#!/bin/bash
# 在 Mac 上进行不需要签名的模拟器构建，输出到 ios-app/build。
set -euo pipefail
cd "$(dirname "$0")"
xcodebuild -project Yizhang.xcodeproj -scheme Yizhang -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
