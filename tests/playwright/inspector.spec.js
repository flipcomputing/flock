import { test, expect } from '@playwright/test';

const inspectorSelector = '#babylon-inspector-container';
const collapseButtonSelector = `${inspectorSelector} button[id^="splitButton-"][id$="__primaryActionButton"]`;

async function openInspector(page) {
  await page.goto('/');
  await page.waitForFunction(() => !document.body.classList.contains('loading'));
  await page.click('#menuBtn');
  await page.click('#tools-menu-item');
  await page.click('#inspector-menu-item');
  await page.waitForSelector(inspectorSelector);
  await expect(page.locator(collapseButtonSelector).last()).toBeVisible();
}

async function runProjectAndWaitForInspector(page) {
  const previousInspector = await page.locator(inspectorSelector).elementHandle();
  await page.click('#runCodeButton');
  await page.waitForFunction((inspector) => !inspector.isConnected, previousInspector);
  await page.waitForSelector(inspectorSelector);
}

test.describe('Inspector state', () => {
  test('keeps its expanded state when a project runs', async ({ page }) => {
    await openInspector(page);
    await runProjectAndWaitForInspector(page);
    await page.waitForTimeout(1000);

    await expect(page.locator(collapseButtonSelector).last()).toBeVisible();
  });

  test('keeps its collapsed state when a project runs', async ({ page }) => {
    await openInspector(page);
    await page.locator(collapseButtonSelector).last().click();
    await expect(page.locator(`${inspectorSelector} button:visible`)).toHaveCount(1);
    await page.evaluate(() => {
      window.visibleExpandedInspectorDuringRun = false;
      window.inspectInspectorFrame = () => {
        const inspector = document.getElementById('babylon-inspector-container');
        const visibleButtons = inspector
          ? [...inspector.querySelectorAll('button')].filter((button) => {
              const rect = button.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            })
          : [];
        if (
          inspector &&
          getComputedStyle(inspector).visibility !== 'hidden' &&
          visibleButtons.length > 1
        ) {
          window.visibleExpandedInspectorDuringRun = true;
        }
        window.inspectorFrame = requestAnimationFrame(window.inspectInspectorFrame);
      };
      window.inspectInspectorFrame();
    });
    const delayedCollapseStyle = await page.addStyleTag({
      content:
        '#babylon-inspector-container button[id^="splitButton-"][id$="__primaryActionButton"] { display: none !important; }',
    });
    await delayedCollapseStyle.evaluate((style) => {
      setTimeout(() => style.remove(), 1100);
    });

    await runProjectAndWaitForInspector(page);
    await page.waitForTimeout(1000);

    await expect(page.locator(`${inspectorSelector} button:visible`)).toHaveCount(1);
    expect(
      await page.evaluate(() => {
        cancelAnimationFrame(window.inspectorFrame);
        return window.visibleExpandedInspectorDuringRun;
      })
    ).toBe(false);
  });
});
