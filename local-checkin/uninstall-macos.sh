#!/bin/zsh
set -euo pipefail

LABEL="com.hugh980.glados-checkin"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "已卸载每日浏览器签到任务。"
echo "浏览器配置文件未删除：$HOME/Library/Application Support/Hugh980/GLaDOSCheckin"
echo "如需退出账号并清除本地登录态，请在确认后自行删除该目录。"
