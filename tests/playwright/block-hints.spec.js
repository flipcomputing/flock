import { test, expect } from '@playwright/test';

test('the info button shows and hides the hint for the selected block', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('flock-block-hints-expanded', '0'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.mainWorkspace, { timeout: 20000 });
  // The starter project loads into the workspace after startup, so let it settle
  // before picking a block to select.
  await page.waitForFunction(() => window.loadingCode === false, { timeout: 20000 });
  await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 20000 });
  await expect
    .poll(() => page.evaluate(() => window.mainWorkspace.getAllBlocks(false).length > 0))
    .toBe(true);

  const target = await page.evaluate(() => {
    const resolveTooltip = (block) =>
      typeof block.tooltip === 'function' ? block.tooltip() : block.tooltip;
    // Blocks can sit under the menu bar or the flyout, so take the first one
    // whose top-left corner is really the topmost element at that point.
    for (const block of window.mainWorkspace.getAllBlocks(false)) {
      const tooltip = resolveTooltip(block);
      if (typeof tooltip !== 'string' || !tooltip) continue;
      const bounds = block.getSvgRoot().getBoundingClientRect();
      const x = bounds.left + 12;
      const y = bounds.top + 10;
      if (block.getSvgRoot().contains(document.elementFromPoint(x, y))) {
        return { tooltip, x, y };
      }
    }
    return null;
  });
  expect(target).not.toBeNull();

  const hint = page.locator('#blockHint');
  const hintsButton = page.locator('#blockHintsBtn');

  await page.mouse.click(target.x, target.y);
  await expect(hint).toBeHidden();

  // Clicking the button must not steal focus from the block, or there would be
  // no selection left to describe.
  await hintsButton.click();
  await expect(hint).toBeVisible();
  await expect(page.locator('#blockHintText')).toHaveText(target.tooltip.split('\n')[0].trim());

  await hintsButton.click();
  await expect(hint).toBeHidden();
});
