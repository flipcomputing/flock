import { test, expect } from '@playwright/test';

test('Projects panel supports arrow navigation between actions, tabs, and examples', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#exampleButton:not([disabled])', { timeout: 20000 });

  await page.locator('#exampleButton').click();
  await expect(page.locator('#exportCodeButton')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#openButton')).toBeFocused();

  await page.keyboard.press('ArrowDown');
  const selectedTab = page.locator('.example-tab[aria-selected="true"]');
  await expect(selectedTab).toBeFocused();

  await page.keyboard.press('ArrowDown');
  const firstVisibleTile = page.locator('.example-panel:not([hidden]) .example-tile').first();
  await expect(firstVisibleTile).toBeFocused();

  await page.keyboard.press('ArrowUp');
  await expect(selectedTab).toBeFocused();

  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#openButton')).toBeFocused();
});

test('The main menu comes first in tab order and is the Ctrl+M target', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#exampleButton:not([disabled])', { timeout: 20000 });

  const toolbarOrder = await page
    .locator('#menu')
    .evaluate((menu) =>
      [...menu.querySelectorAll('#menuBtn, #exampleButton, #togglePlay, #fullscreenToggle')].map(
        (el) => el.id
      )
    );
  expect(toolbarOrder).toEqual(['menuBtn', 'exampleButton', 'togglePlay', 'fullscreenToggle']);

  await page.locator('#menuBtn').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#exampleButton')).toBeFocused();

  await page.locator('#renderCanvas').focus();
  await page.keyboard.press('Control+KeyM');
  await expect(page.locator('#menuBtn')).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.locator('#language-menu-item')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#menuBtn')).toBeFocused();
});

test('Projects opens from its button and returns focus on Escape', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#exampleButton:not([disabled])', { timeout: 20000 });

  await page.locator('#exampleButton').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#newProjectButton')).toBeVisible();
  await expect(page.locator('#exportCodeButton')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#exampleButton')).toBeFocused();
});

test('Help precedes the other info panel buttons in the custom tab order', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#info-tab-btn-help', { timeout: 20000 });

  await page.locator('#info-tab-btn-help').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#info-tab-btn-shortcuts')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#info-tab-btn-player')).toBeFocused();
});
