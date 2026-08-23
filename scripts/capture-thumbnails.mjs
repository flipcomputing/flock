import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Captures the projects-menu tile thumbnails: loads each bundled example, lets
// it run, then downscales the canvas to a 16:9 webp in images/thumbnails.
// Pass example keys (e.g. `npm run thumbnails -- candy_dash`) to redo just those,
// and THUMBNAIL_SETTLE_MS to give a slow-building project longer before the grab.

const PORT = Number(process.env.THUMBNAIL_PORT || 4176);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../images/thumbnails');
// Long enough for models, materials and the first animations to settle.
const SETTLE_MS = Number(process.env.THUMBNAIL_SETTLE_MS || 2000);
const only = new Set(process.argv.slice(2));
// The project the app loads on boot, already on screen before any tile is used.
const STARTUP_EXAMPLE = 'examples/starter.flock';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs in the page: downscales the live canvas and reports whether the frame is
// a single flat colour (nothing rendered yet).
function grabFrame({ w, h }) {
  const canvas = document.getElementById('renderCanvas');
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const value = data[i + channel];
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  return { dataUrl: out.toDataURL('image/webp', 0.85), flat: max - min < 8 };
}

// Runs in the page: print output and say bubbles are passing chat, not part of
// how the project looks. Print stays hidden either way; `restoreSay` puts the
// bubbles back for a project that draws nothing else (see the capture loop).
async function setProjectText(restoreSay) {
  const { flock } = await import('/flock.js');
  if (flock.stackPanel) flock.stackPanel.isVisible = false;

  if (restoreSay) {
    for (const mesh of window.__hiddenProjectText ?? []) mesh.isVisible = true;
    window.__hiddenProjectText = [];
    return;
  }

  window.__hiddenProjectText = window.__hiddenProjectText ?? [];
  for (const mesh of flock.scene?.meshes ?? []) {
    const isText =
      mesh.name === 'textPlane' || mesh.metadata?.isTextPlane || mesh.metadata?.hasSayTexture;
    if (isText && mesh.isVisible) {
      mesh.isVisible = false;
      window.__hiddenProjectText.push(mesh);
    }
  }
}

async function waitForServer(url, timeoutMs = 60_000) {
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

const devServer = spawn(
  'npm',
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  // Its own process group: npm outlives a plain kill and leaves vite holding
  // the port.
  { stdio: 'pipe', detached: true, env: { ...process.env, FORCE_COLOR: '0' } }
);

let browser;
let context;

try {
  await mkdir(OUT_DIR, { recursive: true });
  await waitForServer(BASE_URL);

  // Headless Chromium's new headless shell drops WebGL, so run legacy headless.
  browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=old', '--mute-audio'],
  });
  context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    // Renders the canvas at ~2x the thumbnail width, so the downscale is clean.
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const ready = () =>
    !!window.mainWorkspace &&
    document.getElementById('loadingScreen')?.classList.contains('fade-out');

  // waitForFunction is blocked by the app, so poll.
  const poll = async (fn, arg, timeoutMs = 90_000, what = 'the app') => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await page.evaluate(fn, arg).catch(() => false)) return true;
      await sleep(300);
    }
    throw new Error(`Timed out waiting for ${what}`);
  };

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await poll(ready);
  const { examples, width, height } = await page.evaluate(async () => {
    const mod = await import('/main/examples.js');
    return {
      examples: mod.EXAMPLES.map((ex) => ({ key: ex.i18nKey, file: ex.file })),
      width: mod.THUMBNAIL_WIDTH,
      height: mod.THUMBNAIL_HEIGHT,
    };
  });

  const targets = only.size ? examples.filter((ex) => only.has(ex.key)) : examples;
  const unknown = [...only].filter((key) => !examples.some((ex) => ex.key === key));
  if (unknown.length) {
    throw new Error(`Unknown example key(s): ${unknown.join(', ')}`);
  }

  const meshNames = async () => {
    const mod = await import('/flock.js');
    return (mod.flock?.scene?.meshes ?? []).map((mesh) => mesh.name).join('|');
  };

  for (const [index, example] of targets.entries()) {
    process.stdout.write(`[${index + 1}/${targets.length}] ${example.key} … `);

    // Fresh page per project: loading one project over another leaves the
    // camera where the previous project put it.
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await poll(ready, null, 90_000, 'the app');
    await poll(() => window.loadingCode === false, null, 90_000, 'the startup project');
    // The startup project keeps loading after that flag clears, and would land
    // on top of the project we ask for next.
    await sleep(2000);

    if (example.file !== STARTUP_EXAMPLE) {
      const startupScene = await page.evaluate(meshNames);
      await page.evaluate((file) => window.loadExample(file), example.file);
      await sleep(500);
      await poll(() => window.loadingCode === false, null, 90_000, `${example.key} to load`);
      await poll(
        async (before) => {
          const mod = await import('/flock.js');
          return (mod.flock?.scene?.meshes ?? []).map((mesh) => mesh.name).join('|') !== before;
        },
        startupScene,
        90_000,
        `${example.key} to replace the startup scene`
      );
    }

    // Models stream in after the code has run, so wait for the scene to stop
    // growing before the settle.
    let previous = '';
    let stableFor = 0;
    const started = Date.now();
    while (stableFor < 1000 && Date.now() - started < 60_000) {
      const current = await page.evaluate(meshNames);
      stableFor = current === previous ? stableFor + 300 : 0;
      previous = current;
      await sleep(300);
    }

    // A project that hasn't drawn yet is one flat colour: keep waiting rather
    // than saving a blank tile.
    let dataUrl = '';
    let flat = true;
    for (let attempt = 0; attempt < 4 && flat; attempt++) {
      await sleep(SETTLE_MS);
      await page.evaluate(setProjectText, false);
      await sleep(250);
      ({ dataUrl, flat } = await page.evaluate(grabFrame, { w: width, h: height }));
    }

    // Some projects are nothing but their say bubbles, so put those back rather
    // than saving an empty tile.
    if (flat) {
      await page.evaluate(setProjectText, true);
      await sleep(250);
      ({ dataUrl, flat } = await page.evaluate(grabFrame, { w: width, h: height }));
      process.stdout.write('(kept say text) ');
    }

    if (!dataUrl.startsWith('data:image/webp')) {
      throw new Error(`${example.key}: browser did not encode webp`);
    }
    if (flat) {
      throw new Error(`${example.key}: canvas never rendered anything`);
    }
    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
    await writeFile(path.join(OUT_DIR, `${example.key}.webp`), buffer);
    console.log(`${(buffer.length / 1024).toFixed(1)} KB`);
  }

  console.log(`\nCaptured ${targets.length} thumbnail(s) into images/thumbnails.`);
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  try {
    process.kill(-devServer.pid, 'SIGTERM');
  } catch {
    // Already exited.
  }
}
