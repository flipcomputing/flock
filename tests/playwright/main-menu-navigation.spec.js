import { test, expect } from '@playwright/test';

test('hidden Project menu section is skipped by burger-menu navigation', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#menuBtn', { state: 'visible', timeout: 20000 });

  await expect(page.locator('#project-menu-item')).toBeHidden();

  await page.locator('#menuBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#language-menu-item')).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#theme-menu-item')).toBeFocused();
});
