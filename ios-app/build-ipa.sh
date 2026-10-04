#!/bin/bash
# 为 Windows 的 Sideloadly 准备真机包；签名由用户在本机使用 Apple ID 完成。
set -euo pipefail
cd "$(dirname "$0")"
xcodebuild -project Yizhang.xcodeproj -scheme Yizhang -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build-device CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
app="$PWD/build-device/Build/Products/Release-iphoneos/Yizhang.app"
test -f "$app/Yizhang"
xcrun lipo "$app/Yizhang" -verify_arch arm64
test "$(/usr/libexec/PlistBuddy -c 'Print :DTPlatformName' "$app/Info.plist")" = 'iphoneos'
mkdir -p release
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
mkdir "$stage/Payload"
ditto "$app" "$stage/Payload/Yizhang.app"
output="$PWD/release/Yizhang-iPhone-unsigned.ipa"
(cd "$stage" && /usr/bin/zip -qry Yizhang.ipa Payload)
mv "$stage/Yizhang.ipa" "$output"
unzip -t "$output"
echo "真机 IPA 已生成：$output（尚未签名，请交给 Sideloadly 签名安装）"
