#!/bin/bash
# 编译之后在真正的 iOS 模拟器启动，保留截图便于检查页面。
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build/screenshots
device=$(xcrun simctl list devices available -j | python3 -c 'import json,sys; d=json.load(sys.stdin); print(next(x["udid"] for k,v in d["devices"].items() if "iOS" in k for x in v if "iPhone" in x["name"]))')
xcrun simctl boot "$device" || true
xcrun simctl bootstatus "$device" -b
xcrun simctl install "$device" build/Build/Products/Debug-iphonesimulator/Yizhang.app
xcrun simctl launch "$device" com.tangjiawei.yizhang
sleep 8
xcrun simctl io "$device" screenshot build/screenshots/iphone-home.png
xcrun simctl spawn "$device" launchctl list | python3 -c 'import sys; rows=[s.split() for s in sys.stdin if "com.tangjiawei.yizhang" in s]; print(rows); assert rows and rows[0][0].isdigit(), "App exited after launch"; print("PASS: iPhone app remains running")'
xcodebuild -project Yizhang.xcodeproj -scheme Yizhang -configuration Debug \
  -destination "platform=iOS Simulator,id=$device" -derivedDataPath build \
  -resultBundlePath build/screenshots/CreatorFlow.xcresult CODE_SIGNING_ALLOWED=NO test
