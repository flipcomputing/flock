import { test, expect } from '@playwright/test';

const layouts = [
  { name: 'wide', viewport: { width: 1440, height: 900 } },
  { name: 'narrow portrait', viewport: { width: 390, height: 844 } },
  { name: 'narrow landscape', viewport: { width: 844, height: 390 } },
];

for (const layout of layouts) {
  test(`play mode keeps the top bar visible in the ${layout.name} layout`, async ({ page }) => {
    await page.setViewportSize(layout.viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#exampleButton:not([disabled])', { timeout: 20000 });

    await page.locator('#togglePlay').click();

    await expect(page.locator('html > body')).toHaveClass(/play-mode/);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('#exitPlayMode')).toHaveCount(0);

    const positions = await page.evaluate(() => {
      const header = document.querySelector('header').getBoundingClientRect();
      const main = document.querySelector('#maincontent').getBoundingClientRect();
      return { headerBottom: header.bottom, mainTop: main.top };
    });
    expect(positions.mainTop).toBeGreaterThanOrEqual(positions.headerBottom);
  });
}

test('short landscape prioritises the canvas and wraps the design tools', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#exampleButton:not([disabled])', { timeout: 20000 });

  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('#renderCanvas').getBoundingClientRect();
    const toolbar = document.querySelector('.gizmo-buttons-inner').getBoundingClientRect();
    const groups = [...document.querySelectorAll('.gizmo-buttons-inner > .gizmo-group')].map(
      (group) => group.getBoundingClientRect()
    );
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      canvasRight: canvas.right,
      toolbarLeft: toolbar.left,
      toolbarWidth: toolbar.width,
      groupRows: new Set(groups.map((group) => Math.round(group.top))).size,
    };
  });

  expect(layout.canvasWidth).toBeGreaterThanOrEqual(500);
  expect(layout.toolbarWidth).toBeLessThanOrEqual(228);
  expect(layout.groupRows).toBeGreaterThan(1);
  expect(layout.toolbarLeft).toBeGreaterThanOrEqual(layout.canvasRight);
});

test('iPhone SE landscape stacks the four design-tool groups', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#exampleButton:not([disabled])', { timeout: 20000 });

  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('#renderCanvas').getBoundingClientRect();
    const toolbar = document.querySelector('.gizmo-buttons-inner').getBoundingClientRect();
    const bottomBar = document.querySelector('#bottomBar').getBoundingClientRect();
    const infoTabs = document.querySelector('#info-panel-tabs').getBoundingClientRect();
    const infoTablist = document.querySelector('#info-panel-tablist').getBoundingClientRect();
    const groups = [...document.querySelectorAll('.gizmo-buttons-inner > .gizmo-group')].map(
      (group) => group.getBoundingClientRect()
    );
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      canvasBottom: canvas.bottom,
      canvasRight: canvas.right,
      toolbarLeft: toolbar.left,
      toolbarWidth: toolbar.width,
      groupRows: new Set(groups.map((group) => Math.round(group.top))).size,
      bottomBarTop: bottomBar.top,
      bottomBarHeight: bottomBar.height,
      bottomBarWidth: bottomBar.width,
      infoTabsLeft: infoTabs.left,
      infoTablistLeft: infoTablist.left,
    };
  });

  expect(layout.canvasWidth).toBeGreaterThanOrEqual(480);
  expect(layout.canvasHeight).toBeGreaterThanOrEqual(270);
  expect(Math.abs(layout.canvasBottom - layout.bottomBarTop)).toBeLessThanOrEqual(1);
  expect(layout.toolbarWidth).toBeLessThanOrEqual(132);
  expect(layout.groupRows).toBe(4);
  expect(layout.toolbarLeft).toBeGreaterThanOrEqual(layout.canvasRight);
  expect(layout.bottomBarHeight).toBeGreaterThanOrEqual(52);
  expect(layout.bottomBarWidth).toBe(667);
  expect(layout.infoTablistLeft - layout.infoTabsLeft).toBeLessThanOrEqual(10);
});
