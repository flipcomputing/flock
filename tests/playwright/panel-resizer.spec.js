import { test, expect } from '@playwright/test';

async function loadResizableLayout(page) {
  await page.setViewportSize({ width: 1800, height: 700 });
  await page.goto('/');
  await page.waitForFunction(() => !document.body.classList.contains('loading'));
  await expect(page.locator('#resizer')).toBeVisible();
}

async function dragResizer(page, targetX) {
  const resizer = page.locator('#resizer');
  const box = await resizer.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetX, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function panelSizes(page) {
  return page.evaluate(() => {
    const canvasArea = document.getElementById('canvasArea').getBoundingClientRect();
    const canvas = document.getElementById('renderCanvas').getBoundingClientRect();
    const codePanel = document.getElementById('codePanel').getBoundingClientRect();
    const gizmos = document.getElementById('gizmoButtons');
    const gizmoRect = gizmos.getBoundingClientRect();
    const infoPanelTabs = document.getElementById('info-panel-tabs').getBoundingClientRect();
    return {
      canvasAreaWidth: canvasArea.width,
      canvasWidth: canvas.width,
      codeWidth: codePanel.width,
      canvasAreaBottom: canvasArea.bottom,
      gizmoContentBottom: gizmoRect.top + gizmos.scrollHeight,
      infoPanelTabsBottom: infoPanelTabs.bottom,
      viewportBottom: window.innerHeight,
    };
  });
}

test.describe('panel resizer', () => {
  test('stops when the canvas reaches its maximum useful width', async ({ page }) => {
    await loadResizableLayout(page);
    await dragResizer(page, 1750);

    const sizes = await panelSizes(page);
    expect(Math.abs(sizes.canvasAreaWidth - sizes.canvasWidth)).toBeLessThanOrEqual(2);
    expect(sizes.codeWidth).toBeGreaterThan(300);
    expect(sizes.gizmoContentBottom).toBeLessThanOrEqual(sizes.canvasAreaBottom + 1);
    expect(sizes.infoPanelTabsBottom).toBeLessThanOrEqual(sizes.canvasAreaBottom + 1);
    expect(sizes.infoPanelTabsBottom).toBeLessThanOrEqual(sizes.viewportBottom);
  });

  test('retains both panel minimum widths', async ({ page }) => {
    await loadResizableLayout(page);
    await dragResizer(page, 0);
    expect((await panelSizes(page)).canvasAreaWidth).toBeGreaterThanOrEqual(300);

    await page.reload();
    await page.waitForFunction(() => !document.body.classList.contains('loading'));
    await dragResizer(page, 1750);
    expect((await panelSizes(page)).codeWidth).toBeGreaterThanOrEqual(300);
  });

  test('applies the maximum to keyboard resizing and recalculates it after resize', async ({
    page,
  }) => {
    await loadResizableLayout(page);
    const resizer = page.locator('#resizer');
    await resizer.focus();
    for (let i = 0; i < 50; i += 1) await page.keyboard.press('ArrowRight');

    const atMaximum = await panelSizes(page);
    expect(Math.abs(atMaximum.canvasAreaWidth - atMaximum.canvasWidth)).toBeLessThanOrEqual(2);
    await page.keyboard.press('ArrowRight');
    expect((await panelSizes(page)).canvasAreaWidth).toBe(atMaximum.canvasAreaWidth);

    await page.setViewportSize({ width: 1800, height: 800 });
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowRight');
    expect((await panelSizes(page)).canvasAreaWidth).toBeGreaterThan(atMaximum.canvasAreaWidth);
  });
});
