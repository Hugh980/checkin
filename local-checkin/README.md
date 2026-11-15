# 本机真实浏览器签到（交互式）

## 当前方案边界

Cloudflare Turnstile 需要由官网页面和真实浏览器完成验证。当前没有经过充分验证的无人值守绕过方案。

本目录采用本机可见 Chrome + 独立持久化浏览器配置：

- 不把 Cookie 写入仓库、脚本、日志或 GitHub Secrets。
- 不注入或伪造 Cookie，不提取 Turnstile token，不使用 stealth 参数。
- 每天打开 GLaDOS 签到页，等待你核对账号、完成可能出现的 Cloudflare 验证，并手动点击签到。
- 程序只监听签到接口结果；不会自动点击、自动重试或兑换积分。
- 第一次运行需要在新开的独立 Chrome 配置中登录 GLaDOS。之后登录态保存在 macOS 用户目录。

因此这是一个定时打开并监测的人工确认流程，不是保证无人值守成功的自动签到。

## 第一次运行

在仓库根目录进入 local-checkin：

    cd local-checkin
    npm install
    npm run checkin

程序会打开独立 Chrome 配置并访问 glados.vip 的签到页面。首次请登录你的 GLaDOS 账号，确认账号正确；如出现 Cloudflare 验证，请在网页中正常完成，然后手动点击签到按钮。

接口返回 code=0 表示服务端声称本次签到成功；仍应到官网积分流水确认当天记录。code=1 表示今天已经签到。code=5 / reason=turnstile 表示验证未通过，程序不会自动重试。

## 安装每日打开任务

完成首次登录后，在 local-checkin 目录执行：

    zsh install-macos.sh

默认每天 Mac 本地时间 00:10 打开浏览器并等待最多 10 分钟。若 Mac 的系统时区为 Asia/Shanghai，对应北京时间 00:10；如果系统时区不同，请修改安装脚本生成的 LaunchAgent 中 Hour / Minute。

Mac 需要处于已登录的图形桌面会话。关机、注销或长时间睡眠期间无法保证准时打开；错过时间时可能要等到系统唤醒后再运行。

## 卸载

    zsh uninstall-macos.sh

卸载不会删除独立 Chrome 配置中的登录态。确认不再使用后，可自行删除：

    ~/Library/Application Support/Hugh980/GLaDOSCheckin

## 更换域名或浏览器

默认域名为 glados.vip，默认浏览器为 Google Chrome。若只安装 Microsoft Edge，安装后编辑：

    ~/Library/LaunchAgents/com.hugh980.glados-checkin.plist

将 GLADOS_BROWSER_CHANNEL 的值改为 msedge，再重新加载该任务。

## GitHub Actions

仓库中的 run workflow 已改为仅手动触发，不再由 push 或 schedule 自动执行。GitHub-hosted runner 仍可用于诊断旧 HTTP 脚本，但不能代替本机可见浏览器完成 Cloudflare 验证。
