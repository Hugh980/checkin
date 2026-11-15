import { chromium } from "playwright";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

const domain = (process.env.GLADOS_DOMAIN || "glados.vip")
  .trim()
  .replace(/^https?:\/\//i, "")
  .replace(/\/+$/, "");
const channel = process.env.GLADOS_BROWSER_CHANNEL || "chrome";
const waitMinutes = Math.max(1, Number(process.env.GLADOS_WAIT_MINUTES || "10"));
const timeoutMs = waitMinutes * 60 * 1000;
const checkinUrl = "https://" + domain + "/console/checkin";
const profileDir = join(
  homedir(),
  "Library",
  "Application Support",
  "Hugh980",
  "GLaDOSCheckin"
);

await mkdir(profileDir, { recursive: true });

let context;
try {
  context = await chromium.launchPersistentContext(profileDir, {
    channel,
    headless: false
  });
} catch (error) {
  console.error("无法启动浏览器通道：" + channel);
  console.error("请确认已安装 Google Chrome；如果只安装了 Edge，可在 LaunchAgent 中把 GLADOS_BROWSER_CHANNEL 改为 msedge。");
  console.error(error?.message || String(error));
  process.exitCode = 1;
}

if (context) {
  const pages = context.pages();
  const page = pages[0] || await context.newPage();

  let resolveResult;
  let captured = false;
  const resultPromise = new Promise((resolve) => {
    resolveResult = resolve;
  });

  page.on("response", async (response) => {
    let pathname = "";
    try {
      pathname = new URL(response.url()).pathname;
    } catch {
      return;
    }

    if (pathname !== "/api/user/checkin" || response.request().method() !== "POST" || captured) {
      return;
    }

    captured = true;
    let data = null;
    try {
      data = await response.json();
    } catch {
      // Do not print raw response bodies; they may contain account-related information.
    }
    resolveResult({ httpStatus: response.status(), data });
  });

  try {
    await page.goto(checkinUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });
    await page.bringToFront();

    console.log("已打开：" + checkinUrl);
    console.log("请核对页面登录的是你自己的账号。");
    console.log("如出现 Cloudflare 验证，请在浏览器中正常完成验证。");
    console.log("然后手动点击网页上的签到按钮。");
    console.log("本程序只监听签到结果，不自动点击、不重试、不绕过验证。");

    let timer;
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });

    const result = await Promise.race([resultPromise, timeoutPromise]);
    clearTimeout(timer);

    if (!result) {
      console.error("等待 " + waitMinutes + " 分钟仍未检测到签到请求；没有自动提交或重试。");
      process.exitCode = 2;
    } else {
      const data = result.data || {};
      const code = data.code;

      if (Number(code) === 0) {
        console.log("服务端返回签到成功（code=0）。请再到官网积分流水确认当天记录。");
        if (data.points !== undefined) {
          console.log("接口返回积分：" + String(data.points));
        }
      } else if (Number(code) === 1) {
        console.log("服务端返回今日已签到（code=1）。");
      } else if (Number(code) === 5 && String(data.reason || "").toLowerCase() === "turnstile") {
        console.error("Cloudflare Turnstile 验证未通过（code=5）。本次不自动重试。");
        process.exitCode = 1;
      } else {
        console.error(
          "签到接口返回异常。HTTP " + result.httpStatus +
          "，code=" + (code === undefined ? "unknown" : String(code)) +
          "，reason=" + (data.reason || "none") +
          "，message=" + String(data.message || "").slice(0, 180)
        );
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error("本机浏览器任务失败：" + (error?.message || String(error)));
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}
