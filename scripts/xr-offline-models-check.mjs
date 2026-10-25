import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// Run a VR session with the model CDNs unreachable, as a headset offline since install
// would. The session must still work, and the missing models must read as a dismissable
// notice rather than a project crash.

const PORT = Number(process.env.XR_CHECK_PORT || 4177);
const BASE_URL = `http://localhost:${PORT}`;
const require = createRequire(import.meta.url);
const IWER_RUNTIME = readFileSync(require.resolve('iwer/build/iwer.js'), 'utf8');

const MODEL_HOSTS = [
  'https://immersive-web.github.io/**',
  'https://assets.babylonjs.com/**',
  'https://controllers.babylonjs.com/**',
];

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

async function runOfflineSession(page) {
  return page.evaluate(async () => {
    const url =
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => /\/flock\.js(\?|$)/.test(name)) ?? '/flock.js';
    const flock = (await import(url)).flock;
    if (!flock.scene) throw new Error('Scene was not running before the XR session started');

    await flock.setXRMode('VR');
    const helper = flock.xrHelper;
    if (!helper?.baseExperience) throw new Error('Default XR experience was not created');

    await helper.baseExperience.enterXRAsync('immersive-vr', 'local-floor', helper.renderTarget);

    await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error('XR frames stopped arriving')), 15_000);
      let seen = 0;
      const observer = flock.scene.onAfterRenderObservable.add(() => {
        if (++seen < 60) return;
        clearTimeout(deadline);
        flock.scene.onAfterRenderObservable.remove(observer);
        resolve();
      });
    });

    const controllers = helper.input?.controllers ?? [];
    return {
      inXR: helper.baseExperience.state === flock.BABYLON.WebXRState.IN_XR,
      controllers: controllers.length,
      // The mesh is cosmetic; the motion controller carries the buttons.
      motionControllers: controllers.filter((controller) => !!controller.motionController).length,
      banners: [...document.querySelectorAll('.flock-banner')].map((banner) => banner.textContent),
    };
  });
}

const devServer = spawn(
  'npm',
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  { stdio: 'pipe', detached: true, env: { ...process.env, FORCE_COLOR: '0' } }
);

let browser;
let context;

try {
  await waitForServer(BASE_URL);

  browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=old'],
  });
  context = await browser.newContext();
  const page = await context.newPage();

  const blocked = [];
  for (const host of MODEL_HOSTS) {
    await page.route(host, (route) => {
      blocked.push(route.request().url());
      return route.abort('internetdisconnected');
    });
  }

  await page.addInitScript(IWER_RUNTIME);
  await page.addInitScript(() => {
    const device = new globalThis.IWER.XRDevice(globalThis.IWER.metaQuest3);
    device.installRuntime({ forceInstall: true });
    globalThis.__xrDevice = device;
  });

  const poll = async (fn, timeoutMs = 60_000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await page.evaluate(fn).catch(() => false)) return true;
      await sleep(300);
    }
    throw new Error('Timed out waiting for the app to be ready');
  };

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await poll(
    () =>
      !!window.mainWorkspace &&
      document.getElementById('loadingScreen')?.classList.contains('fade-out')
  );
  await poll(() => window.loadingCode === false);
  await sleep(3000);

  const result = await runOfflineSession(page);
  // The rejection lands a frame or so after the load fails.
  await sleep(2000);
  const banners = await page.evaluate(() =>
    [...document.querySelectorAll('.flock-banner')].map((banner) => ({
      text: banner.textContent,
      dismissable: !!banner.querySelector('.flock-banner__close'),
    }))
  );
  const expected = await page.evaluate(async () => {
    const { translate } = await import('/main/translation.js');
    return {
      notice: translate('error_xr_models_offline'),
      crash: translate('error_project_crash'),
    };
  });

  if (!result.inXR) throw new Error('Session did not reach IN_XR with the model CDNs blocked');
  if (!result.motionControllers) {
    throw new Error('No motion controller was initialised, so XR input would be dead offline');
  }
  if (!blocked.length) {
    throw new Error('No model request was made, so this run proved nothing');
  }
  if (banners.some((banner) => banner.text.includes(expected.crash))) {
    throw new Error(`A missing XR model blamed the project: ${JSON.stringify(banners)}`);
  }
  const notice = banners.find((banner) => banner.text.includes(expected.notice));
  if (!notice) {
    throw new Error(`No offline model notice was shown: ${JSON.stringify(banners)}`);
  }
  if (!notice.dismissable) throw new Error('The offline model notice cannot be dismissed');
  if (banners.length !== 1) {
    throw new Error(`Expected one banner, got ${JSON.stringify(banners)}`);
  }

  console.log(
    `XR offline model check passed (${blocked.length} blocked requests, ` +
      `${result.motionControllers}/${result.controllers} motion controllers, ` +
      `one dismissable notice).`
  );
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  try {
    process.kill(-devServer.pid, 'SIGTERM');
  } catch {
    // Already exited.
  }
}
