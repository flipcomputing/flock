import { chromium } from "playwright";
import { spawn } from "node:child_process";

// A render buffer left at 1x draws GUI controls dpr times too big (issue #705).

const PORT = Number(process.env.CANVAS_CHECK_PORT || 4174);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Ignore during startup.
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for dev server at ${url}`);
}

const probe = () => {
  const canvas = document.getElementById("renderCanvas");
  return {
    css: `${canvas.clientWidth}x${canvas.clientHeight}`,
    buf: `${canvas.width}x${canvas.height}`,
    ratio: canvas.clientWidth ? canvas.width / canvas.clientWidth : 0,
  };
};

const devServer = spawn(
  "npm",
  ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
  // Its own process group: npm outlives a plain kill and leaves vite holding
  // the port.
  { stdio: "pipe", detached: true, env: { ...process.env, FORCE_COLOR: "0" } },
);

let browser;
let context;

try {
  await waitForServer(BASE_URL);

  // Headless Chromium's new headless shell drops WebGL, so run legacy headless.
  browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--headless=old"],
  });
  context = await browser.newContext({
    viewport: { width: 318, height: 595 },
    deviceScaleFactor: 3.89,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36",
  });
  const page = await context.newPage();

  // waitForFunction is blocked by the app, so poll.
  const poll = async (fn, timeoutMs = 60_000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await page.evaluate(fn).catch(() => false)) return true;
      await sleep(300);
    }
    throw new Error("Timed out waiting for the app to be ready");
  };

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await poll(
    () =>
      !!window.mainWorkspace &&
      document.getElementById("loadingScreen")?.classList.contains("fade-out"),
  );
  await poll(() => window.loadingCode === false);
  await sleep(3000);
  await page.evaluate(() => window.executeCode());
  await sleep(6000);

  const healthy = await page.evaluate(probe);
  if (healthy.ratio < 3) {
    throw new Error(
      `Buffer was not device-scaled on a plain run: ${JSON.stringify(healthy)}`,
    );
  }

  // The state a resize pass against a hidden canvas leaves behind.
  await page.evaluate(() => {
    const canvas = document.getElementById("renderCanvas");
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  });

  // Box lost and regained with no window resize event, so nothing calls
  // onResize and only the canvas's own size observer can repair the buffer.
  await page.evaluate(() => (document.getElementById("canvasArea").style.display = "none"));
  await sleep(500);
  await page.evaluate(() => (document.getElementById("canvasArea").style.display = ""));
  await sleep(1500);

  const repaired = await page.evaluate(probe);
  if (repaired.ratio < 3) {
    throw new Error(
      `Stale render buffer was not repaired after the canvas regained its box: ${JSON.stringify(repaired)}`,
    );
  }

  console.log(
    `Canvas buffer check passed (healthy ${healthy.buf}, repaired ${repaired.buf}).`,
  );
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  try {
    process.kill(-devServer.pid, "SIGTERM");
  } catch {
    // Already exited.
  }
}
