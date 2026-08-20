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
  await page.evaluate(async () => {
    const { showBlockHint } = await import('/ui/blockHint.js');
    showBlockHint('Remembered block hint');
  });
  await expect(page.locator('#blockHint')).toBeVisible();
  await searchButton.click();
  await expect(page.locator('#blocklyDiv')).toHaveClass(/blockly-search-active/);
  await expect(page.locator('#blockHint')).toBeHidden();

  const searchBar = page.locator('.ws-search-mobile-bar');
  const searchInput = searchBar.locator('.ws-search-mobile-input');
  await expect(searchBar).toBeVisible();
  await expect(searchBar.locator('.ws-search-mobile-btn')).toHaveCount(3);
  const searchBarLayout = await searchBar.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const closeButton = element.querySelector('.ws-search-mobile-close');
    return {
      width: bounds.width,
      right: bounds.right,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      paddingTop: Number.parseFloat(getComputedStyle(element).paddingTop),
      paddingRight: Number.parseFloat(getComputedStyle(element).paddingRight),
      paddingBottom: Number.parseFloat(getComputedStyle(element).paddingBottom),
      paddingLeft: Number.parseFloat(getComputedStyle(element).paddingLeft),
      beforeContent: getComputedStyle(element, '::before').content,
      closeButtonWidth: closeButton?.getBoundingClientRect().width,
    };
  });
  expect(searchBarLayout.width).toBeLessThanOrEqual(searchBarLayout.fontSize * 23 + 1);
  expect(searchBarLayout.right).toBeCloseTo(await page.evaluate(() => window.innerWidth), 0);
  expect(searchBarLayout.paddingTop).toBeCloseTo(searchBarLayout.fontSize * 0.5, 0);
  expect(searchBarLayout.paddingRight).toBeCloseTo(searchBarLayout.fontSize * 0.5, 0);
  expect(searchBarLayout.paddingBottom).toBeCloseTo(searchBarLayout.fontSize * 0.5, 0);
  expect(searchBarLayout.paddingLeft).toBeCloseTo(searchBarLayout.fontSize * 0.5, 0);
  expect(searchBarLayout.beforeContent).toBe('none');
  expect(searchBarLayout.closeButtonWidth).toBe(28);
  await searchInput.fill('42');
  await expect(searchBar.locator('.ws-search-mobile-count')).toHaveText('1/1');
  await expect
    .poll(() =>
      page.evaluate(() => ({
        count: window.flockWorkspaceSearch.blocks.length,
        current:
          window.flockWorkspaceSearch.blocks[window.flockWorkspaceSearch.currentBlockIndex]?.id,
      }))
    )
    .toEqual({ count: 1, current: blockId });
  await expect(page.locator('#blockHint')).toBeHidden();

  await searchButton.click();

  await expect(page.locator('#blocklyDiv')).not.toHaveClass(/blockly-search-active/);
  await expect(searchBar).toHaveCount(0);
  await expect(page.locator('.blockly-ws-search')).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const block = window.mainWorkspace.getBlockById(id);
        return document.activeElement === block?.getFocusableElement?.();
      }, blockId)
    )
    .toBe(true);
  await expect(page.locator('#blockHint')).toBeVisible();
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

test('workspace search supports keyboard navigation throughout the shared search bar', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.mainWorkspace && window.flockWorkspaceSearch, {
    timeout: 20000,
  });

  await page.evaluate(() => {
    for (const x of [80, 280]) {
      const block = window.mainWorkspace.newBlock('text');
      block.initSvg();
      block.render();
      block.setFieldValue('keyboard match', 'TEXT');
      block.moveBy(x, 80);
    }
  });

  await page.locator('#workspaceSearchBtn').click();
  const searchBar = page.locator('.ws-search-mobile-bar');
  const searchInput = searchBar.locator('.ws-search-mobile-input');
  const previousButton = searchBar.locator('.ws-search-mobile-btn').nth(0);
  const nextButton = searchBar.locator('.ws-search-mobile-btn').nth(1);
  const closeButton = searchBar.locator('.ws-search-mobile-btn').nth(2);
  const count = searchBar.locator('.ws-search-mobile-count');

  await expect(searchInput).toBeFocused();
  await searchInput.fill('keyboard match');
  await expect(count).toHaveText('1/2');

  await searchInput.press('Enter');
  await expect(count).toHaveText('2/2');
  await searchInput.press('Shift+Enter');
  await expect(count).toHaveText('1/2');
  await searchInput.press('ArrowDown');
  await expect(count).toHaveText('2/2');
  await searchInput.press('ArrowUp');
  await expect(count).toHaveText('1/2');

  await searchInput.press('Tab');
  await expect(previousButton).toBeFocused();
  await previousButton.press('Enter');
  await expect(count).toHaveText('2/2');
  await previousButton.press('Tab');
  await expect(nextButton).toBeFocused();
  await nextButton.press('Space');
  await expect(count).toHaveText('1/2');
  await nextButton.press('Tab');
  await expect(closeButton).toBeFocused();
  await closeButton.press('Shift+Tab');
  await expect(nextButton).toBeFocused();

  await nextButton.press('Escape');
  await expect(searchBar).toHaveCount(0);
  await expect(page.locator('#blocklyDiv')).not.toHaveClass(/blockly-search-active/);
});
