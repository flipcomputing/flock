import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// Run an immersive-ar session through IWER and verify the scene is scaled, placed and
// grounded the way the AR scene size block asks for.

const PORT = Number(process.env.XR_CHECK_PORT || 4177);
const BASE_URL = `http://localhost:${PORT}`;
const require = createRequire(import.meta.url);
const IWER_RUNTIME = readFileSync(require.resolve('iwer/build/iwer.js'), 'utf8');

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

async function runDioramaSession(page) {
  return page.evaluate(async () => {
    // window.flock is a named DOM element, not the module export.
    const url =
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => /\/flock\.js(\?|$)/.test(name)) ?? '/flock.js';
    const flock = (await import(url)).flock;
    if (!flock.scene) throw new Error('Scene was not running before the XR session started');

    const frames = (count) =>
      new Promise((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error('XR frames stopped arriving')), 15_000);
        let seen = 0;
        const observer = flock.scene.onAfterRenderObservable.add(() => {
          if (++seen < count) return;
          clearTimeout(deadline);
          flock.scene.onAfterRenderObservable.remove(observer);
          resolve();
        });
      });

    const tower = flock.BABYLON.MeshBuilder.CreateBox('diorama-tower', { size: 20 }, flock.scene);
    tower.position.set(0, 10, 0);
    tower.computeWorldMatrix(true);

    await flock.setXRMode('AR');
    const helper = flock.xrHelper;
    if (!helper?.baseExperience) throw new Error('AR mode created no XR experience');

    flock.setARSceneSize(80);
    await helper.baseExperience.enterXRAsync('immersive-ar', 'local-floor', helper.renderTarget);
    await frames(20);

    const camera = helper.baseExperience.camera;
    const sessionManager = helper.baseExperience.sessionManager;
    const pos = (v) => (v ? { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) } : null);
    const groundVisibility = () => ({
      isVisible: flock.ground?.isVisible ?? null,
      material: flock.ground?.material?.getClassName?.() ?? null,
    });

    const result = {
      terrain: {
        scale: sessionManager.worldScalingFactor,
        placed: pos(camera.position),
        ground: groundVisibility(),
        groundWidth: flock.ground
          ? +(
              flock.ground.getBoundingInfo().boundingBox.maximumWorld.x -
              flock.ground.getBoundingInfo().boundingBox.minimumWorld.x
            ).toFixed(2)
          : null,
      },
    };

    // The starter project's ground is a heightmap; a flat one is the other half of the rule.
    flock.ground.metadata.heightMapImage = 'NONE';
    flock.setARSceneSize(80);
    await frames(10);
    result.flat = { scale: sessionManager.worldScalingFactor, ground: groundVisibility() };

    flock.enableShadows({ enabled: true });
    await frames(3);
    result.groundWithShadows = groundVisibility();
    flock.enableShadows({ enabled: false });
    await frames(3);
    result.groundAfterShadowsOff = groundVisibility();

    flock.setARSceneSize(0);
    await frames(10);
    result.lifeSize = {
      scale: sessionManager.worldScalingFactor,
      ground: groundVisibility(),
    };

    await helper.baseExperience.exitXRAsync();
    await frames(5);
    result.afterExit = {
      scale: sessionManager.worldScalingFactor,
      ground: groundVisibility(),
    };

    tower.dispose();
    return result;
  });
}

function assertDiorama(result) {
  // The terrain is scenery, so it is measured with the scene and stays visible.
  const expectedTerrainScale = result.terrain.groundWidth / 0.8;
  if (Math.abs(result.terrain.scale - expectedTerrainScale) > 0.5) {
    throw new Error(
      `Terrain scene scaled to ${result.terrain.scale}, expected ${expectedTerrainScale}`
    );
  }
  if (result.terrain.ground.isVisible !== true) {
    throw new Error('Heightmap ground was hidden in the diorama');
  }
  // Measured from the near edge, so the gap does not grow with the footprint.
  const distance = Math.hypot(result.terrain.placed.x, result.terrain.placed.z);
  const clearanceMetres = (distance - result.terrain.groundWidth / 2) / result.terrain.scale;
  if (Math.abs(clearanceMetres - 0.3) > 0.01) {
    throw new Error(`Viewer stands ${clearanceMetres.toFixed(2)} m clear of the diorama`);
  }
  if (result.flat.ground.isVisible !== false) {
    throw new Error(`Flat ground stayed visible under the diorama: ${JSON.stringify(result.flat)}`);
  }
  if (result.groundWithShadows.material !== 'ShadowOnlyMaterial') {
    throw new Error(
      `Ground did not become a shadow catcher with shadows on: ${JSON.stringify(result.groundWithShadows)}`
    );
  }
  if (result.groundAfterShadowsOff.isVisible !== false) {
    throw new Error('Ground stayed as a catcher after shadows were switched off');
  }
  if (result.lifeSize.scale !== 1 || result.lifeSize.ground.isVisible !== true) {
    throw new Error(`Life size did not restore the scene: ${JSON.stringify(result.lifeSize)}`);
  }
  if (result.afterExit.scale !== 1 || result.afterExit.ground.isVisible !== true) {
    throw new Error(`Exiting XR left the scene scaled: ${JSON.stringify(result.afterExit)}`);
  }
}

const devServer = spawn(
  'npm',
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  // Kill npm and its Vite child together.
  { stdio: 'pipe', detached: true, env: { ...process.env, FORCE_COLOR: '0' } }
);

let browser;
let context;

try {
  await waitForServer(BASE_URL);

  // Headless Chromium's new headless shell drops WebGL, so run legacy headless.
  browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=old'],
  });
  context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(IWER_RUNTIME);
  await page.addInitScript(() => {
    const device = new globalThis.IWER.XRDevice(globalThis.IWER.metaQuest3);
    device.installRuntime({ forceInstall: true });
    globalThis.__xrDevice = device;
  });

  // waitForFunction is blocked by the app, so poll.
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

  const result = await runDioramaSession(page);

  try {
    assertDiorama(result);
  } catch (error) {
    console.error(JSON.stringify(result, null, 2));
    throw error;
  }

  console.log(
    `AR diorama check passed (terrain scale ${result.terrain.scale}, viewer at ${JSON.stringify(result.terrain.placed)}).`
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
