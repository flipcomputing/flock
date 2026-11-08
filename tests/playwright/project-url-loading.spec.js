import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import en from '../../locale/en.js';

const TRUSTED_PROJECT_URL =
  'https://raw.githubusercontent.com/flipcomputing/flockxr-projects/main/framed-test.flock';
const UNTRUSTED_PROJECT_URL = 'https://example.com/someone/project.flock';
const HOST_PAGE = 'https://example.test/host.html';
const BIG_PROJECT_URL = 'https://big.test/huge.flock';
const OVER_LIMIT_BYTES = 20 * 1024 * 1024;

// The dev server refuses to be framed by other sites; GitHub Pages sends no such
// headers, so strip them to test the deployed behaviour.
async function allowFramingByOtherSites(page, baseURL) {
  await page.route(`${baseURL}/?**`, async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers() };
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    await route.fulfill({ response, headers });
  });
}

async function openFramedProjectLink(page, baseURL, projectUrl) {
  const requested = [];
  page.on('request', (request) => {
    if (request.url().startsWith(projectUrl)) requested.push(request.url());
  });
  await allowFramingByOtherSites(page, baseURL);
  const src = `${baseURL}/?project=${encodeURIComponent(projectUrl)}`;
  await page.route(HOST_PAGE, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html><body><iframe id="flock" width="900" height="700" src="${src}"></iframe></body></html>`,
    })
  );
  await page.goto(HOST_PAGE);
  const frame = page.frameLocator('#flock');
  await expect(frame.locator('.framed-refusal')).toBeVisible({ timeout: 30000 });
  return { frame, requested, src };
}

test.describe('Flock framed by another site', () => {
  for (const [label, projectUrl] of [
    ['a trusted', TRUSTED_PROJECT_URL],
    ['an untrusted', UNTRUSTED_PROJECT_URL],
  ]) {
    test(`refuses to start with ${label} project link, and offers a new tab`, async ({
      page,
      baseURL,
    }) => {
      const { frame, requested, src } = await openFramedProjectLink(page, baseURL, projectUrl);

      await expect(frame.locator('.framed-refusal p')).toHaveText(en.framed_editor_message);
      const link = frame.locator('.framed-refusal a');
      await expect(link).toHaveText(en.framed_editor_open_link);
      await expect(link).toHaveAttribute('href', src);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(frame.locator('#blocklyDiv')).toHaveCount(0);
      expect(requested).toEqual([]);
    });
  }
});

test.describe('project= links to files that are too large', () => {
  async function openBigProject(page) {
    const alerts = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });
    await page.goto(`/?project=${encodeURIComponent(BIG_PROJECT_URL)}`);
    await expect(page.locator('#untrustedProjectUrlModal')).not.toHaveClass(/hidden/, {
      timeout: 30000,
    });
    await page.locator('#untrustedProjectUrlOpenButton').click();
    await expect.poll(() => alerts, { timeout: 20000 }).toContain(en.file_too_large_alert);
  }

  test('rejects a file whose declared size is over the limit', async ({ page }) => {
    await page.route(`${BIG_PROJECT_URL}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: `{"blocks":{"blocks":[]},"pad":"${'x'.repeat(OVER_LIMIT_BYTES)}"}`,
      })
    );
    await openBigProject(page);
  });

  test('stops reading a file with no declared size once it passes the limit', async ({ page }) => {
    await page.addInitScript(
      ({ bigUrl, chunkCount }) => {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const requested = typeof input === 'string' ? input : (input?.url ?? String(input));
          if (requested !== bigUrl) return originalFetch(input, init);
          window.__bigChunksSent = 0;
          const chunk = new Uint8Array(1024 * 1024).fill(32);
          const body = new ReadableStream({
            pull(controller) {
              if (window.__bigChunksSent < chunkCount) {
                window.__bigChunksSent++;
                controller.enqueue(chunk);
              } else {
                controller.close();
              }
            },
          });
          const response = new Response(body, {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
          Object.defineProperty(response, 'url', { value: bigUrl });
          return response;
        };
      },
      { bigUrl: BIG_PROJECT_URL, chunkCount: OVER_LIMIT_BYTES / (1024 * 1024) }
    );
    await openBigProject(page);
    const sent = await page.evaluate(() => window.__bigChunksSent);
    expect(sent).toBeLessThan(OVER_LIMIT_BYTES / (1024 * 1024));
  });
});

test.describe('project= links to saved web pages', () => {
  test('reads a page that starts with an uppercase DOCTYPE and is served as plain text', async ({
    page,
  }) => {
    const project = JSON.parse(fs.readFileSync(path.resolve('examples/starter.flock'), 'utf8'));
    const json = JSON.stringify(project).replace(/</g, `${String.fromCharCode(92)}u003c`);
    const pageUrl = 'https://pages.test/my-project.html';
    await page.route(pageUrl, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        headers: { 'access-control-allow-origin': '*' },
        body: `<!DOCTYPE HTML>\n<HTML><BODY><script id="flock" type="application/flock+json">${json}</script></BODY></HTML>`,
      })
    );
    const alerts = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    await page.goto(`/?project=${encodeURIComponent(pageUrl)}`);
    await expect(page.locator('#untrustedProjectUrlModal')).not.toHaveClass(/hidden/, {
      timeout: 30000,
    });
    await page.locator('#untrustedProjectUrlOpenButton').click();

    await expect
      .poll(() => page.evaluate(() => window.mainWorkspace?.getTopBlocks(false).length), {
        timeout: 20000,
      })
      .toBe(project.blocks.blocks.length);
    expect(alerts).toEqual([]);
  });
});
