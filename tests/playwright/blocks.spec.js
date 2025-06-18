import { test, expect } from '@playwright/test';

test.describe('Create Blockly project and open Events flyout', () => {
  test('starts new project and opens Events category', async ({ page }) => {
	  page.on('console', msg => {
		console.log(`📥 [console.${msg.type()}]`, msg.text());
	  });

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

	  // Step 1: Click the "Scene" category
	  await page.locator('.blocklyTreeRow.custom-category:has-text("Scene")').click();

	  // Step 2: Wait for flyout to populate
	  await page.waitForFunction(() =>
		window.mainWorkspace?.getFlyout?.()?.getWorkspace?.()?.getTopBlocks(false)?.length > 0
	  );

	  // Step 3: Find the "sky" block and click it
	  const skyBlock = await page
		.locator('.blocklyFlyout .blocklyBlockCanvas g.blocklyDraggable:has-text("sky")')
		.boundingBox();

	  if (skyBlock) {
		await page.mouse.click(skyBlock.x + skyBlock.width / 2, skyBlock.y + skyBlock.height / 2);
	  } else {
		throw new Error('Could not find the "sky" block to click.');
	  }

	  const debug = await page.evaluate(() => {
		const ws = window.mainWorkspace;
		const blocks = ws.getAllBlocks();

		const start = blocks.find(b => b.type === 'start');
		const sky = blocks.find(b => b.type === 'set_sky_color');

		const debugInfo = {
		  foundStart: !!start,
		  foundSky: !!sky,
		  inputList: [],
		  connected: false,
		  error: null,
		};

		try {
		  if (!start || !sky) return debugInfo;

		  const inputs = start.inputList || [];
		  const inputConn = inputs.find(i => i.name === 'DO' && i.connection)?.connection;
		  const skyPrev = sky.previousConnection;

		  debugInfo.inputList = inputs.map(i => ({
			name: i.name,
			hasConnection: !!i.connection,
			connectionType: i.connection?.type ?? null,
			isConnected: i.connection?.isConnected() ?? null
		  }));

		  if (inputConn && skyPrev && !inputConn.isConnected() && !skyPrev.isConnected()) {
			inputConn.connect(skyPrev); // don’t use canConnectWithReason
			debugInfo.connected = true;
		  }
		} catch (e) {
		  debugInfo.error = e.message || String(e);
		}

		return debugInfo;
	  });

	  //console.log("🔍 Blockly connection debug:", debug);

	  await page.evaluate(() => {
		console.log('BLOCK COUNT:', window.mainWorkspace?.getAllBlocks?.().length);
		console.log('BLOCK TYPES:', window.mainWorkspace?.getAllBlocks?.().map(b => b.type));
	  });

	  await page.waitForFunction(() =>
		window.mainWorkspace?.getAllBlocks?.().length === 3
	  );

	  await page.locator('#runCodeButton').click(); // Adjust selector if your play button has a different ID/class

	  await page.waitForTimeout(1000); // 1 second; adjust if needed

	  const renderCanvas = page.locator('#renderCanvas');
	  await expect(renderCanvas).toBeVisible();
	  //await renderCanvas.screenshot({ path: 'tests/playwright/screenshots/canvas-output.png' });

	  await expect(renderCanvas).toHaveScreenshot('canvas-baseline.png');

  });
});
