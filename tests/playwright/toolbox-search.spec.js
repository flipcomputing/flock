import { test, expect } from '@playwright/test';

test('toolbox search retains its term while allowing native text selection', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector(".blocklyToolbox input[type='search']"), {
    timeout: 20000,
  });

  const searchInput = page.locator(".blocklyToolbox input[type='search']");
  await searchInput.fill('alpha beta');
  await page.locator('.blocklyToolboxCategory').filter({ hasText: 'Scene' }).click();
  await searchInput.click();

  await expect(searchInput).toBeFocused();
  await expect(searchInput).toHaveValue('alpha beta');

  const box = await searchInput.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.dblclick(box.x + box.width - 20, box.y + box.height / 2);
  await expect
    .poll(() =>
      searchInput.evaluate((input) => input.value.slice(input.selectionStart, input.selectionEnd))
    )
    .toBe('beta');

  await page.mouse.move(box.x + 5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(() => searchInput.evaluate((input) => input.selectionEnd - input.selectionStart))
    .toBeGreaterThan(0);
});
