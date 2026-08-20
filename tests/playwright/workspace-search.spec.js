import { test, expect } from '@playwright/test';

test('workspace search button toggles search and focuses the found block when closing', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.mainWorkspace && window.flockWorkspaceSearch, {
    timeout: 20000,
  });

  const blockId = await page.evaluate(() => {
    const block = window.mainWorkspace.newBlock('math_number');
    block.initSvg();
    block.render();
    block.setFieldValue('42', 'NUM');
    block.moveBy(80, 80);
    return block.id;
  });

  const searchButton = page.locator('#workspaceSearchBtn');
  await page.evaluate(() => {
    document.getElementById('blockHint').hidden = false;
  });
  await expect(page.locator('#blockHint')).toBeVisible();
  await searchButton.click();
  await expect(page.locator('#blocklyDiv')).toHaveClass(/blockly-search-active/);
  await expect(page.locator('#blockHint')).toBeHidden();

  const searchInput = page.locator('.blockly-ws-search input');
  await searchInput.fill('42');
  await expect
    .poll(() =>
      page.evaluate(() => ({
        count: window.flockWorkspaceSearch.blocks.length,
        current:
          window.flockWorkspaceSearch.blocks[window.flockWorkspaceSearch.currentBlockIndex]?.id,
      }))
    )
    .toEqual({ count: 1, current: blockId });

  await searchButton.click();

  await expect(page.locator('#blocklyDiv')).not.toHaveClass(/blockly-search-active/);
  await expect(page.locator('.blockly-ws-search')).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const block = window.mainWorkspace.getBlockById(id);
        return document.activeElement === block?.getFocusableElement?.();
      }, blockId)
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          window.mainWorkspace
            .getBlockById(id)
            ?.getSvgRoot?.()
            ?.classList.contains('blocklySelected') ?? false,
        blockId
      )
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const focusElement = window.mainWorkspace.getBlockById(id)?.getFocusableElement?.();
        return !!focusElement?.closest('.blocklyKeyboardNavigation');
      }, blockId)
    )
    .toBe(false);
  await page.waitForTimeout(500);
  await expect(page.locator('.fc-toolbar-key-badge')).toHaveCount(0);
});
