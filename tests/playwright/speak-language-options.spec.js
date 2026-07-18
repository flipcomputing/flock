import { test, expect } from "@playwright/test";

// Saved projects store the raw field value, so these values must not be renamed
// or removed — only added to.
test("speak block language options stay backward compatible", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector("#renderCanvas");
  await page.waitForTimeout(6000);

  const result = await page.evaluate(() => {
    const block = window.mainWorkspace.newBlock("speak");
    const field = block.getField("LANGUAGE");
    const values = field.getOptions().map(([, value]) => value);
    const roundTrip = {};
    for (const v of values) {
      field.setValue(v);
      roundTrip[v] = field.getValue();
    }
    block.dispose();
    return { values, roundTrip };
  });

  expect(result.values).toContain("en-GB");
  expect(result.values).toContain("en-US");
  expect(result.values).toContain("es");
  for (const v of result.values) {
    expect(result.roundTrip[v]).toBe(v);
  }
});
