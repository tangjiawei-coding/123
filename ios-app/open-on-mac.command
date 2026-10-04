#!/bin/bash
# Mac 双击本文件打开真机工程；在 Signing & Capabilities 中选择自己的 Team。
set -e
cd "$(dirname "$0")"
open Yizhang.xcodeproj
echo '选择自己的 Apple Team 和连接的 iPhone，然后按 Run。'
echo 'Swift Playgrounds 项目位于同目录 Yizhang.swiftpm。'
