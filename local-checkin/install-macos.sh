#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(command -v node || true)"

if [[ -z "$NODE_BIN" ]]; then
  echo "未找到 Node.js。请先安装 Node.js 20 或更高版本。"
  exit 1
fi

if [[ ! -d "$SCRIPT_DIR/node_modules/playwright" ]]; then
  echo "正在安装本地浏览器任务依赖……"
  (cd "$SCRIPT_DIR" && npm install)
fi

LABEL="com.hugh980.glados-checkin"
PLIST_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs"
PLIST_PATH="$PLIST_DIR/$LABEL.plist"
SCRIPT_PATH="$SCRIPT_DIR/checkin.mjs"

mkdir -p "$PLIST_DIR" "$LOG_DIR"

xml_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

NODE_XML="$(xml_escape "$NODE_BIN")"
SCRIPT_XML="$(xml_escape "$SCRIPT_PATH")"
LOG_OUT_XML="$(xml_escape "$LOG_DIR/glados-checkin.out.log")"
LOG_ERR_XML="$(xml_escape "$LOG_DIR/glados-checkin.err.log")"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_XML</string>
    <string>$SCRIPT_XML</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$SCRIPT_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>GLADOS_DOMAIN</key>
    <string>glados.vip</string>
    <key>GLADOS_BROWSER_CHANNEL</key>
    <string>chrome</string>
    <key>GLADOS_WAIT_MINUTES</key>
    <string>10</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>0</integer>
    <key>Minute</key>
    <integer>10</integer>
  </dict>
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$LOG_OUT_XML</string>
  <key>StandardErrorPath</key>
  <string>$LOG_ERR_XML</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST_PATH"

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"

echo "已安装每日浏览器签到任务：Mac 本地时间 00:10。"
echo "浏览器首次启动后，请在独立 Chrome 配置中登录 GLaDOS。"
echo "任务会打开签到页并等待你手动验证、点击签到；不会无人值守绕过 Cloudflare。"
echo "日志：$LOG_DIR/glados-checkin.out.log"
echo "卸载：zsh $SCRIPT_DIR/uninstall-macos.sh"
