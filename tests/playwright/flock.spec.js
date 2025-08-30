import { test, expect } from "@playwright/test";

test.describe("Flock XR Environment Setup", () => {
  test("application loads without errors", async ({ page }) => {
    await page.goto("/");

    // Check page title loads
    await expect(page).toHaveTitle(/Flock/);

    // Verify main elements are present in DOM
    await expect(page.locator("#renderCanvas")).toBeVisible();
    await expect(page.locator("#blocklyDiv")).toBeVisible();
  });

  test("basic UI elements are present", async ({ page }) => {
    await page.goto("/");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Check main container exists
    await expect(page.locator("#blocklyDiv")).toBeVisible();

    // Wait for the toolbox to exist
    await page.waitForSelector('#blocklyDiv [role="tree"]');

    // Categories are treeitems inside the toolbox
    const categories = page.locator('#blocklyDiv [role="treeitem"]');
    await expect(categories.first()).toBeVisible();

    // Optionally assert there are several
    expect(await categories.count()).toBeGreaterThan(3);
  });
});
