import { test, expect } from "@playwright/test";

test.describe("Create Blockly project and open Events flyout", () => {
  test("starts new project and opens Events category", async ({ page }) => {
    page.on("console", (msg) => {
      console.log(`📥 [console.${msg.type()}]`, msg.text());
    });

    // ✅ Load page and wait for DOM readiness instead of networkidle
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // ✅ Wait until the project select dropdown is visible
    await page.waitForSelector("#exampleSelect", {
      state: "visible",
      timeout: 20000,
    });

    // ✅ Also wait until Blockly is fully initialised
    await page.waitForFunction(
      () => {
        const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
        return !!ws;
      },
      { timeout: 20000 },
    );

    // Step 1: Start a new project
    const projectMenu = page.locator("#exampleSelect");
    await expect(projectMenu).toBeVisible();
    await expect(projectMenu).toBeEnabled();

    const newOption = await page.locator("#new");
    const newValue = await newOption.getAttribute("value");
    if (newValue) {
      await projectMenu.selectOption(newValue);
    } else {
      throw new Error("Could not find value for #new");
    }

    // Step 2: Wait for Blockly ready & empty workspace
    await page.waitForFunction(() => {
      const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
      if (!ws) return false;
      return (
        (ws.getToolbox?.() || ws.getFlyout?.()) &&
        ws.getAllBlocks?.().length === 0
      );
    });

    // Helper to open a category via Blockly API (robust against UI/DOM changes)
    async function openCategoryByName(namePart) {
      const result = await page.evaluate((namePart) => {
        const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
        if (!ws) return { ok: false, reason: "no workspace" };
        const tb = ws.getToolbox?.();
        if (!tb) return { ok: false, reason: "no toolbox" };

        const items = tb.getToolboxItems?.() || [];
        const wanted =
          items.find((i) =>
            (i.getName?.() || "")
              .toLowerCase()
              .includes(namePart.toLowerCase()),
          ) || null;

        const names = items.map((i) => i.getName?.()).filter(Boolean);

        if (!wanted) {
          return {
            ok: false,
            reason: `category "${namePart}" not found`,
            names,
          };
        }

        tb.setSelectedItem?.(wanted);
        wanted.setExpanded?.(true);

        const fly = tb.getFlyout?.() || ws.getFlyout?.();
        const count = fly ? fly.workspace_.getTopBlocks(false).length : 0;
        return { ok: count >= 0, count, names: [wanted.getName?.()] };
      }, namePart);

      if (!result.ok) {
        throw new Error(
          `Could not open "${namePart}" category (${result.reason || "unknown"}). Available: ${
            result.names?.join(", ") || "(none)"
          }`,
        );
      }
    }

    // Step 3: Open “Events” category
    await page.waitForFunction(
      () => {
        const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
        const tb = ws?.getToolbox?.();
        return !!(tb && (tb.getToolboxItems?.()?.length ?? 0) > 0);
      },
      { timeout: 20000 },
    );
    await openCategoryByName("events");

    // Step 4: Create a `start` block programmatically
    const createdStart = await page.evaluate(() => {
      const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
      if (!ws) return false;
      let start = ws.getAllBlocks().find((b) => b.type === "start");
      if (!start) {
        start = ws.newBlock("start");
        start.initSvg?.();
        start.render?.();
        start.moveBy(80, 80);
      }
      return !!start;
    });
    if (!createdStart) throw new Error("Failed to create start block");

    // Wait until workspace reflects the single block (start)
    await page.waitForFunction(() => {
      const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
      return (ws?.getAllBlocks?.().length ?? 0) >= 1;
    });

    // Step 5: Open “Scene” category
    await openCategoryByName("scene");

    // Step 6: Create a `set_sky_color` block programmatically
    const createdSky = await page.evaluate(() => {
      const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
      if (!ws) return false;
      let sky = ws.getAllBlocks().find((b) => b.type === "set_sky_color");
      if (!sky) {
        sky = ws.newBlock("set_sky_color");
        sky.initSvg?.();
        sky.render?.();
        sky.moveBy(80, 160);
      }
      return !!sky;
    });
    if (!createdSky) throw new Error("Failed to create set_sky_color block");

    // Step 7: Connect sky under start programmatically
    const connected = await page.evaluate(() => {
      const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
      if (!ws) return { ok: false, msg: "no workspace" };

      const blocks = ws.getAllBlocks();
      const start = blocks.find((b) => b.type === "start");
      const sky = blocks.find((b) => b.type === "set_sky_color");
      if (!start || !sky) return { ok: false, msg: "missing blocks" };

      const inputConn = (start.inputList || []).find(
        (i) => i.name === "DO" && i.connection,
      )?.connection;
      const skyPrev = sky.previousConnection;
      if (!inputConn || !skyPrev) return { ok: false, msg: "no connections" };

      if (!inputConn.isConnected() && !skyPrev.isConnected()) {
        inputConn.connect(skyPrev);
      }

      return {
        ok: inputConn.isConnected() && skyPrev.isConnected(),
        count: ws.getAllBlocks().length,
        types: ws.getAllBlocks().map((b) => b.type),
      };
    });

    if (!connected.ok) {
      throw new Error(
        `Failed to connect blocks: ${connected.msg || "unknown"}`,
      );
    }

    // Step 8: Ensure at least the 2 required blocks exist (start + sky)
    await page.waitForFunction(() => {
      const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
      return (ws?.getAllBlocks?.().length ?? 0) >= 2;
    });

    // Run the code
    await page.locator("#runCodeButton").click();
    await page.waitForTimeout(1000);

    // Verify canvas renders and matches baseline
    const renderCanvas = page.locator("#renderCanvas");
    await expect(renderCanvas).toBeVisible();
    await expect(renderCanvas).toHaveScreenshot("canvas-baseline.png");
  });

  test("supports persistent toolbox category prefix typing without timeout", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.waitForFunction(
      () => {
        const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
        const tb = ws?.getToolbox?.();
        return !!(ws && tb && (tb.getToolboxItems?.()?.length ?? 0) > 0);
      },
      { timeout: 20000 },
    );

    const selectedAfterTyping = await page.evaluate(async () => {
      const ws = window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.();
      const tb = ws?.getToolbox?.();
      if (!ws || !tb) return null;

      const toolboxDiv =
        tb.HtmlDiv ||
        document.querySelector(".blocklyToolboxDiv, .blocklyToolbox");
      if (!(toolboxDiv instanceof HTMLElement)) return null;

      const keydown = (key, extra = {}) => {
        toolboxDiv.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
            bubbles: true,
            cancelable: true,
            ...extra,
          }),
        );
      };
      const selectedName = () => tb.getSelectedItem?.()?.getName?.() || "";
      const waitFor = async (predicate, timeoutMs = 2000) => {
        const start = performance.now();
        while (performance.now() - start < timeoutMs) {
          if (predicate()) return true;
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return false;
      };

      window.Blockly?.getFocusManager?.()?.focusTree?.(tb);
      toolboxDiv.focus();

      keydown("c");
      keydown("o");
      keydown("n");
      await waitFor(
        () => selectedName().toLowerCase().startsWith("con"),
        2000,
      );
      keydown("d");
      const condition = selectedName().toLowerCase();

      keydown("Escape");
      keydown("c");
      keydown("o");
      keydown("n");
      const connect = selectedName().toLowerCase();
      const focusedTree = window.Blockly?.getFocusManager?.()?.getFocusedTree?.();
      const toolboxStillFocused = focusedTree === tb;
      const activeInToolbox = !!document.activeElement?.closest?.(
        ".blocklyToolboxDiv, .blocklyToolbox",
      );

      const selectedItem = tb.getSelectedItem?.();
      const selectedExpanded =
        typeof selectedItem?.isExpanded === "function"
          ? selectedItem.isExpanded()
          : null;
      const parent =
        selectedItem?.getParent?.() ||
        selectedItem?.parentToolboxItem_ ||
        selectedItem?.parentItem_ ||
        selectedItem?.parent_;
      const parentExpanded =
        typeof parent?.isExpanded === "function" ? parent.isExpanded() : null;

      keydown("Escape");
      keydown("s");
      keydown("t");
      keydown("r");
      const strings = selectedName().toLowerCase();

      const stringsItem = tb.getSelectedItem?.();
      const stringsParent =
        stringsItem?.getParent?.() ||
        stringsItem?.parentToolboxItem_ ||
        stringsItem?.parentItem_ ||
        stringsItem?.parent_;
      const stringsParentExpanded =
        typeof stringsParent?.isExpanded === "function"
          ? stringsParent.isExpanded()
          : null;

      keydown("Escape");
      keydown("s");
      keydown("c");
      keydown("e");
      const scene = selectedName().toLowerCase();

      keydown("f", { ctrlKey: true });
      await waitFor(() => {
        const active = document.activeElement;
        return active instanceof HTMLInputElement && active.type === "search";
      }, 2000);
      const focused = document.activeElement;
      const searchFocused =
        focused instanceof HTMLInputElement && focused.type === "search";

      toolboxDiv.focus();
      keydown("c");
      const control = selectedName().toLowerCase();

      return {
        condition,
        connect,
        toolboxStillFocused,
        activeInToolbox,
        strings,
        scene,
        control,
        searchFocused,
        selectedExpanded,
        parentExpanded,
        stringsParentExpanded,
      };
    });

    expect(selectedAfterTyping).not.toBeNull();
    expect(selectedAfterTyping.searchFocused).toBe(true);
    expect(selectedAfterTyping.condition).toContain("condition");
    expect(selectedAfterTyping.connect).toContain("connect");
    expect(selectedAfterTyping.toolboxStillFocused).toBe(true);
    expect(selectedAfterTyping.activeInToolbox).toBe(true);
    expect(selectedAfterTyping.strings).toContain("string");
    expect(selectedAfterTyping.scene).toContain("scene");
    expect(selectedAfterTyping.control).toContain("control");
    expect(selectedAfterTyping.selectedExpanded).toBe(true);
    expect(selectedAfterTyping.parentExpanded).toBe(true);
    expect(selectedAfterTyping.stringsParentExpanded).toBe(true);
  });
});
