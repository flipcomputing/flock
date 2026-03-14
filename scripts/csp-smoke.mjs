import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';

const PORT = Number(process.env.CSP_SMOKE_PORT || 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

const devServer = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '0' },
});

let browser;
let context;

try {
  await waitForServer(BASE_URL);

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  const page = await context.newPage();

  const cspViolations = [];
  const requestSources = {
    document: new Set(),
    script: new Set(),
    stylesheet: new Set(),
    image: new Set(),
    font: new Set(),
    media: new Set(),
    fetch: new Set(),
    xhr: new Set(),
    websocket: new Set(),
    frame: new Set(),
    other: new Set(),
  };

  page.on('request', (request) => {
    const type = request.resourceType();
    const origin = originOf(request.url());
    if (requestSources[type]) requestSources[type].add(origin);
    else requestSources.other.add(origin);
  });

  await page.exposeFunction('recordCspViolation', (eventData) => {
    cspViolations.push(eventData);
  });

  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (event) => {
      window.recordCspViolation({
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective,
      });
    });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#renderCanvas', { state: 'attached' });
  await page.waitForSelector('#blocklyDiv', { state: 'attached' });

  await page.waitForSelector('#blocklyDiv [role="treeitem"]', { state: 'attached' });
  await page.locator('#blocklyDiv [role="treeitem"]').nth(1).click({ force: true });

  await page.click('#runCodeButton', { force: true });
  await page.waitForSelector('#flock-iframe', { state: 'attached', timeout: 20_000 });

  await page.click('#exportCodeButton', { force: true });
  await page.waitForTimeout(500);

  await page.setInputFiles('#importFile', {
    name: 'csp-smoke-sample.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"blocks":{"languageVersion":0,"blocks":[]}}', 'utf8'),
  });
  await page.waitForTimeout(1000);

  const analyticsOriginsSeen = new Set();
  for (const origin of [...requestSources.script, ...requestSources.fetch, ...requestSources.xhr, ...requestSources.image]) {
    if (origin.includes('googletagmanager.com') || origin.includes('google-analytics.com') || origin.includes('doubleclick.net')) {
      analyticsOriginsSeen.add(origin);
    }
  }

  const summary = {
    baseUrl: BASE_URL,
    cspViolations,
    runtimeSources: Object.fromEntries(
      Object.entries(requestSources).map(([key, set]) => [key, [...set].sort()]),
    ),
    analyticsOriginsSeen: [...analyticsOriginsSeen].sort(),
  };

  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile('artifacts/csp-smoke-summary.json', JSON.stringify(summary, null, 2));

  if (summary.cspViolations.length > 0) {
    throw new Error(`Detected ${summary.cspViolations.length} CSP violation(s). See artifacts/csp-smoke-summary.json`);
  }

  if (summary.analyticsOriginsSeen.length === 0) {
    throw new Error('No analytics request origin observed during smoke run. See artifacts/csp-smoke-summary.json');
  }

  console.log('CSP smoke summary written to artifacts/csp-smoke-summary.json');
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  devServer.kill('SIGTERM');
}
