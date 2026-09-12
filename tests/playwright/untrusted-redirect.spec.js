import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// A trusted project= URL can still redirect to an untrusted origin; fetch()
// follows redirects transparently, so the trust check has to be re-applied
// to the response's final URL, not just the one the user typed/clicked. This
// stubs fetch to hand back a response whose `.url` reports a different,
// untrusted origin — exactly what a real HTTP redirect produces — since
// simulating an actual cross-origin redirect chain through Playwright's
// network mocking is unreliable for fetch() requests.
const TRUSTED_REQUEST_URL = 'https://github.com/flipcomputing/flockxr-projects/redirect-test.flock';
const UNTRUSTED_FINAL_URL = 'https://evil.example.com/payload.flock';
const UNTRUSTED_FINAL_ORIGIN = 'https://evil.example.com';

const PROJECT_FIXTURE_BODY = fs.readFileSync(path.resolve('examples/new.flock'), 'utf8');

async function installRedirectingFetchStub(page) {
  await page.addInitScript(
    ({ trustedUrl, finalUrl, body }) => {
      const originalFetch = window.fetch.bind(window);
      window.__fetchCalls = [];
      window.fetch = async (input, init) => {
        const requested =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : (input?.url ?? String(input));
        window.__fetchCalls.push(requested);

        if (requested === trustedUrl) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            url: finalUrl,
            headers: {
              get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
            },
            text: async () => body,
          };
        }

        return originalFetch(input, init);
      };
    },
    { trustedUrl: TRUSTED_REQUEST_URL, finalUrl: UNTRUSTED_FINAL_URL, body: PROJECT_FIXTURE_BODY }
  );
}

test.describe('project= URL that redirects cross-origin after passing the trust check', () => {
  test.beforeEach(async ({ page }) => {
    await installRedirectingFetchStub(page);
  });

  test('confirmation names the final redirected origin, not the trusted one it started from', async ({
    page,
  }) => {
    await page.goto(`/?project=${encodeURIComponent(TRUSTED_REQUEST_URL)}`, {
      waitUntil: 'domcontentloaded',
    });

    const modal = page.locator('#untrustedProjectUrlModal');
    await expect(modal).not.toHaveClass(/hidden/, { timeout: 20000 });
    await expect(page.locator('#untrustedProjectUrlOrigin')).toHaveText(UNTRUSTED_FINAL_ORIGIN);
  });

  test('cancelling the redirected origin falls back to the starter project', async ({ page }) => {
    await page.goto(`/?project=${encodeURIComponent(TRUSTED_REQUEST_URL)}`, {
      waitUntil: 'domcontentloaded',
    });

    await page.locator('#untrustedProjectUrlCancelButton').click();

    await page.waitForFunction(
      () => (window.__fetchCalls || []).includes('examples/starter.flock'),
      { timeout: 20000 }
    );
  });

  test('approving the redirected origin loads it instead of falling back', async ({ page }) => {
    await page.goto(`/?project=${encodeURIComponent(TRUSTED_REQUEST_URL)}`, {
      waitUntil: 'domcontentloaded',
    });

    const modal = page.locator('#untrustedProjectUrlModal');
    await expect(modal).not.toHaveClass(/hidden/, { timeout: 20000 });
    await page.locator('#untrustedProjectUrlOpenButton').click();

    await page.waitForTimeout(1000);

    const calls = await page.evaluate(() => [...(window.__fetchCalls || [])]);
    expect(calls).not.toContain('examples/starter.flock');
  });
});
