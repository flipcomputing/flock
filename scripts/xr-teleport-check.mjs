import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// Exercise teleport through IWER and verify its reference-space offset persists.

const PORT = Number(process.env.XR_CHECK_PORT || 4176);
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

async function runTeleportSession(page) {
  return page.evaluate(async () => {
    // window.flock is a named DOM element, not the module export.
    const url =
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => /\/flock\.js(\?|$)/.test(name)) ?? '/flock.js';
    const flock = (await import(url)).flock;
    if (!flock.scene) throw new Error('Scene was not running before the XR session started');

    await flock.setXRMode('VR');
    const helper = flock.xrHelper;
    const teleportation = helper?.teleportation;
    if (!teleportation) throw new Error('Default XR experience exposed no teleportation feature');

    flock.setXRViewMode('embody');
    flock.setXRCameraMotionMode('teleport');
    await helper.baseExperience.enterXRAsync('immersive-vr', 'local-floor', helper.renderTarget);

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

    const camera = helper.baseExperience.camera;
    const pos = (v) => (v ? { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) } : null);
    const controller = globalThis.__xrDevice.controllers.right;

    await frames(20);
    const result = { floorMeshes: [...teleportation._floorMeshes].map((mesh) => mesh.name) };

    // Aim past the player and down at the ground.
    controller.position.set(0.6, 1.2, 0);
    controller.quaternion.set(-0.259, 0, 0, 0.966);

    const aimAndRelease = async () => {
      const before = pos(camera.position);
      controller.updateAxes('thumbstick', 0, -1);
      await frames(15);
      const target = teleportation._options.teleportationTargetMesh;
      const aiming = teleportation._controllers[teleportation._currentTeleportationControllerId];
      const aim = {
        ringVisible: !!target?.isVisible,
        ring: pos(target?.position),
        blocked: !!aiming?.teleportationState.blocked,
        blockers: (teleportation._options.pickBlockerMeshes ?? []).map((mesh) => mesh.name),
      };
      controller.updateAxes('thumbstick', 0, 0);
      await frames(5);
      const landed = pos(camera.position);
      await frames(20);
      return { before, ...aim, landed, settled: pos(camera.position) };
    };

    result.teleport = await aimAndRelease();

    flock.setXRCameraMotionMode('none');
    await frames(5);
    result.locomotionNone = await aimAndRelease();

    const followTarget = new flock.BABYLON.TransformNode('xr-follow-check', flock.scene);
    flock._xrFollowTarget = followTarget;
    flock.setXRViewMode('watch');
    flock.setXRCameraMotionMode('comfort');
    await frames(5);
    const followStart = pos(camera.position);
    followTarget.position.x += 3;
    await frames(1);
    const followWhileMoving = pos(camera.position);
    await frames(20);
    const followSettled = pos(camera.position);
    const embodiedMesh = flock.BABYLON.MeshBuilder.CreateBox(
      'xr-embody-check',
      { size: 1 },
      flock.scene
    );
    embodiedMesh.parent = followTarget;
    flock.setXRViewMode('embody');
    await frames(2);
    const hiddenWhileEmbodied = !embodiedMesh.isVisible;
    flock.setXRViewMode('watch');
    await frames(2);
    const restoredAfterWatch = embodiedMesh.isVisible;
    embodiedMesh.dispose();
    followTarget.dispose();
    result.follow = { start: followStart, whileMoving: followWhileMoving, settled: followSettled };
    result.embody = { hiddenWhileEmbodied, restoredAfterWatch };

    const collisionPlayer = flock.BABYLON.MeshBuilder.CreateBox(
      'xr-collision-player',
      { size: 1 },
      flock.scene
    );
    collisionPlayer.position.copyFrom(camera.position);
    collisionPlayer.position.y = 0.5;
    const candy = flock.BABYLON.MeshBuilder.CreateSphere(
      'xr-collision-candy',
      { diameter: 0.5 },
      flock.scene
    );
    candy.position.copyFrom(collisionPlayer.position);
    candy.position.x += 3;
    let collected = false;
    await flock.onIntersect(collisionPlayer.name, candy.name, {
      trigger: 'OnIntersectionEnterTrigger',
      callback: async () => {
        collected = true;
      },
    });
    flock._xrFollowTarget = collisionPlayer;
    flock.setXRViewMode('embody');
    await frames(2);
    candy.position.copyFrom(collisionPlayer.position);
    candy.computeWorldMatrix(true);
    await flock.say(collisionPlayer.name, { text: 'Yum!', duration: 0 });
    await frames(3);
    const sayPlane = flock.scene.meshes.find(
      (mesh) => mesh.metadata?.sayTarget === collisionPlayer
    );
    result.embodiedInteraction = {
      collected,
      playerAtCamera:
        Math.hypot(
          collisionPlayer.position.x - camera.position.x,
          collisionPlayer.position.z - camera.position.z
        ) < 0.05,
      sayVisible: !!sayPlane?.isVisible,
      sayHeadLocked: sayPlane?.parent === camera,
    };
    sayPlane?.dispose();
    candy.dispose();
    collisionPlayer.dispose();

    return result;
  });
}

function assertTeleported({ before, ringVisible, ring, blocked, landed, settled }) {
  if (!ringVisible) {
    throw new Error(
      blocked
        ? 'Teleport ray was blocked before it reached the ground'
        : 'No teleport ring appeared while aiming at the ground'
    );
  }
  const moved = Math.hypot(landed.x - before.x, landed.z - before.z);
  if (moved < 0.5) {
    throw new Error(
      `Release did not move the camera: ${JSON.stringify(before)} -> ${JSON.stringify(landed)}`
    );
  }
  const offTarget = Math.hypot(landed.x - ring.x, landed.z - ring.z);
  if (offTarget > 0.05) {
    throw new Error(
      `Camera landed away from the ring: ring ${JSON.stringify(ring)}, camera ${JSON.stringify(landed)}`
    );
  }
  if (landed.y <= ring.y) {
    throw new Error(`Camera landed at or below the floor: ${JSON.stringify(landed)}`);
  }
  // A bad reference-space offset can undo the move on a later XR frame.
  const drift = Math.hypot(settled.x - landed.x, settled.y - landed.y, settled.z - landed.z);
  if (drift > 0.05) {
    throw new Error(
      `Camera did not stay teleported: ${JSON.stringify(landed)} -> ${JSON.stringify(settled)}`
    );
  }
}

function assertDidNotTeleport({ before, ringVisible, settled }) {
  if (ringVisible) {
    throw new Error('Teleport ring appeared while locomotion mode was none');
  }
  const moved = Math.hypot(settled.x - before.x, settled.y - before.y, settled.z - before.z);
  if (moved > 0.05) {
    throw new Error(
      `Camera moved with locomotion mode none: ${JSON.stringify(before)} -> ${JSON.stringify(settled)}`
    );
  }
}

function assertComfortFollow({ start, whileMoving, settled }) {
  if (Math.hypot(whileMoving.x - start.x, whileMoving.z - start.z) > 0.05) {
    throw new Error(
      `Follow camera moved before the target stopped: ${JSON.stringify({ start, whileMoving })}`
    );
  }
  const moved = Math.hypot(settled.x - start.x, settled.z - start.z);
  if (moved < 2.9) {
    throw new Error(
      `Follow camera did not catch up after the target stopped: ${JSON.stringify({ start, settled })}`
    );
  }
}

function assertEmbodiedInteraction(result) {
  if (!result.playerAtCamera) throw new Error('Embodied player did not follow the XR camera');
  if (!result.collected) throw new Error('Embodied player did not trigger the candy collision');
  if (!result.sayVisible || !result.sayHeadLocked) {
    throw new Error(`Embodied say text was not a visible head-locked HUD: ${JSON.stringify(result)}`);
  }
}

function assertEmbodiedVisibility({ hiddenWhileEmbodied, restoredAfterWatch }) {
  if (!hiddenWhileEmbodied || !restoredAfterWatch) {
    throw new Error(
      `Embodied visibility was not reversible: ${JSON.stringify({ hiddenWhileEmbodied, restoredAfterWatch })}`
    );
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

  const result = await runTeleportSession(page);

  try {
    if (!result.floorMeshes.includes('ground')) {
      throw new Error(`Ground was not registered as a teleport floor: ${result.floorMeshes}`);
    }
    assertTeleported(result.teleport);
    assertDidNotTeleport(result.locomotionNone);
    assertComfortFollow(result.follow);
    assertEmbodiedVisibility(result.embody);
    assertEmbodiedInteraction(result.embodiedInteraction);
  } catch (error) {
    console.error(JSON.stringify(result, null, 2));
    throw error;
  }

  const { before, ring, settled } = result.teleport;
  console.log(
    `XR teleport check passed (camera ${JSON.stringify(before)} -> ${JSON.stringify(settled)}, ring ${JSON.stringify(ring)}).`
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
