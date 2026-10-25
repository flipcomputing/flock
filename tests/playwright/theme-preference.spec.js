import { test, expect } from '@playwright/test';

for (const colorScheme of ['light', 'dark']) {
  test(`selecting the OS-derived ${colorScheme} theme stores an explicit preference`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.addInitScript(() => localStorage.removeItem('blocklyTheme'));
    await page.goto('/');
    await page.waitForFunction(() => !document.body.classList.contains('loading'));

    const appBody = page.locator('body[data-theme]');
    await expect(appBody).toHaveAttribute('data-theme', colorScheme);
    expect(await page.evaluate(() => localStorage.getItem('blocklyTheme'))).toBeNull();

    await page
      .locator(`[data-theme-target="${colorScheme}"]`)
      .evaluate((themeLink) => themeLink.click());

    expect(await page.evaluate(() => localStorage.getItem('blocklyTheme'))).toBe(colorScheme);

    await page.emulateMedia({ colorScheme: colorScheme === 'light' ? 'dark' : 'light' });
    await expect(appBody).toHaveAttribute('data-theme', colorScheme);
  });
}
