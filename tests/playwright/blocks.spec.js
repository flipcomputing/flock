import { test, expect } from '@playwright/test';

test.describe('Create Blockly project and open Events flyout', () => {
  test('starts new project and opens Events category', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	// Step 1: Start a new project
	const projectMenu = page.locator('#exampleSelect');
	await expect(projectMenu).toBeVisible();
	await expect(projectMenu).toBeEnabled();

	const newOption = await page.locator('#project-new');
	const newValue = await newOption.getAttribute('value');
	if (newValue) {
	  await projectMenu.selectOption(newValue);
	} else {
	  throw new Error('Could not find value for #project-new');
	}

	// Step 2: Confirm empty workspace
	await page.waitForFunction(() =>
	  window.mainWorkspace?.getAllBlocks?.().length === 0
	);

	// Step 3: Click the "Events" category
	await page.locator('.blocklyTreeRow.custom-category:has-text("Events")').click();

	// Step 4: Wait for the flyout to contain at least one block
	await page.waitForFunction(() => {
	  const flyout = window.mainWorkspace?.getFlyout?.();
	  return flyout?.getWorkspace?.().getTopBlocks(false).length > 0;
	});

	  const target = await page.locator('.blocklyFlyout .blocklyBlockCanvas g.blocklyDraggable:has-text("start")').boundingBox();

	  if (target) {
		await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
	  } else {
		throw new Error('Could not find the "start" block to click.');
	  }

	  await page.waitForFunction(() =>
		window.mainWorkspace?.getAllBlocks?.().length === 1
	  );

  });
});
