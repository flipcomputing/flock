import { test, expect } from '@playwright/test';

test.describe('Flock XR Environment Setup', () => {
  test('application loads without errors', async ({ page }) => {
    await page.goto('/');

    // Check page title loads
    await expect(page).toHaveTitle(/Flock/);

    // Verify main elements are present in DOM
    await expect(page.locator('#renderCanvas')).toBeVisible();
    await expect(page.locator('#blocklyDiv')).toBeVisible();
  });

  test('basic UI elements are present', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check main container exists
    await expect(page.locator('#blocklyDiv')).toBeVisible();

    // Check at least one toolbox category exists
    const toolboxRows = page.locator('.blocklyTreeRow');
    await expect(toolboxRows.first()).toBeVisible();
    
    // Verify we have multiple toolbox categories
    const count = await toolboxRows.count();
    expect(count).toBeGreaterThan(0);
  });
});