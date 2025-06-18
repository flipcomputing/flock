import { test, expect } from '@playwright/test';

test.describe('Create Basic Blockly Program', () => {
  test('starts new project and confirms empty workspace', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	// Step 1: Wait for the project menu and select "New" by #project-new
	const projectMenu = page.locator('#exampleSelect');
	await expect(projectMenu).toBeVisible();
	await expect(projectMenu).toBeEnabled();

	// Step 2: Select the "New" option using its ID
	const newOption = await page.locator('#project-new');
	const newValue = await newOption.getAttribute('value');
	if (newValue) {
	  await projectMenu.selectOption(newValue);
	} else {
	  throw new Error('Could not find value for #project-new');
	}

	
	  // ✅ Step 3: Wait until the Blockly workspace exists and has 0 blocks
	  await page.waitForFunction(() => {
		const ws = window.mainWorkspace;
		return ws && ws.getAllBlocks().length === 0;
	  });
  });
});
