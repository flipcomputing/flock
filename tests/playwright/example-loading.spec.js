import { test, expect } from "@playwright/test";

async function installFetchRecorder(page) {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.__fetchCalls = [];
    window.fetch = (input, init) => {
      const value =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input?.url || String(input);
      window.__fetchCalls.push(value);
      return originalFetch(input, init);
    };
  });
}

async function waitForWorkspace(page) {
  await page.waitForSelector("#exampleSelect", {
    state: "visible",
    timeout: 20000,
  });
  await page.waitForFunction(
    () => {
      const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
      return !!ws;
    },
    { timeout: 20000 },
  );
}

async function fetchCalls(page) {
  return page.evaluate(() => [...(window.__fetchCalls || [])]);
}

test.describe("Example project loading uses relative bundled asset paths", () => {
  test("startup, new, dropdown, and execution fallback all fetch relative example paths", async ({
    page,
  }) => {
    await installFetchRecorder(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForWorkspace(page);

    await page.waitForFunction(
      () => (window.__fetchCalls || []).includes("examples/starter.flock"),
      { timeout: 20000 },
    );

    const projectMenu = page.locator("#exampleSelect");

    await projectMenu.selectOption("examples/new.flock");
    await page.waitForFunction(
      () => (window.__fetchCalls || []).includes("examples/new.flock"),
      { timeout: 20000 },
    );

    await projectMenu.selectOption("examples/snow_globe.flock");
    await page.waitForFunction(
      () => (window.__fetchCalls || []).includes("examples/snow_globe.flock"),
      { timeout: 20000 },
    );

    await page.evaluate(async () => {
      const mod = await import("/flock.js");
      mod.flock.engineReady = true;
      const originalRunCode = mod.flock.runCode.bind(mod.flock);
      let failedOnce = false;
      mod.flock.runCode = async (...args) => {
        if (!failedOnce) {
          failedOnce = true;
          throw new Error("Intentional test execution failure");
        }
        return originalRunCode(...args);
      };
    });

    await page.locator("#runCodeButton").click();
    await page.waitForFunction(
      () =>
        (window.__fetchCalls || []).filter(
          (call) => call === "examples/starter.flock",
        ).length >= 2,
      { timeout: 20000 },
    );

    const calls = await fetchCalls(page);
    const exampleCalls = calls.filter((call) => call.startsWith("examples/"));
    expect(exampleCalls).toEqual(
      expect.arrayContaining([
        "examples/starter.flock",
        "examples/new.flock",
        "examples/snow_globe.flock",
      ]),
    );
    expect(exampleCalls.every((call) => !/^https?:\/\//.test(call))).toBe(true);
  });
});
