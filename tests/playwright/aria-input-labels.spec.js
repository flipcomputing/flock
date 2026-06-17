import { test, expect } from '@playwright/test';

// Per-input ARIA labels for value reporters in Flock:
// - Auto-derived from the input's localized field-row text (connector/unit words
//   like "for"/"seconds" are skipped) — so x/y/z and hair/skin/eyes get labels
//   but print_text's duration/colour don't.
// - The slot label is prepended to the reporter's *announced element* only (in
//   recomputeAriaContext), NOT its computeAriaLabel, so the parent block's
//   readout says the slot once (its field-row label) instead of twice.
// - Single value-input blocks are left to their own readout (no echo).

async function setup(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.mainWorkspace ?? window.Blockly?.getMainWorkspace?.(), {
    timeout: 20000,
  });
  await page.waitForTimeout(500); // let initializeBlockHandling attach listeners
}

test('coordinate + colour reporters announce their slot once', async ({ page }) => {
  await setup(page);

  const out = await page.evaluate(async () => {
    const Blockly = window.Blockly;
    const ws = window.mainWorkspace ?? Blockly.getMainWorkspace();
    const sleep = () => new Promise((r) => setTimeout(r, 150));
    const read = (f) => f?.getFocusableElement?.()?.getAttribute?.('aria-label');
    const res = {};

    // scale X (number reporter)
    const scale = ws.newBlock('scale');
    scale.initSvg();
    scale.render();
    const num = ws.newBlock('math_number');
    num.initSvg();
    num.render();
    scale.getInput('X').connection.connect(num.outputConnection);
    await sleep();
    res.scaleXReporter = read(num.getField('NUM'));

    // load_character HAIR_COLOR (colour reporter) + block readout
    const ch = ws.newBlock('load_character');
    ch.initSvg();
    ch.render();
    const cp = ws.newBlock('colour_picker');
    cp.initSvg();
    cp.render();
    ch.getInput('HAIR_COLOR').connection.connect(cp.outputConnection);
    await sleep();
    res.hairReporter = read(cp.getField('COLOUR'));
    res.hairMentionsInBlock = (ch.getAriaLabel(1).match(/hair/gi) || []).length;

    // print_text DURATION carries an explicit "seconds" override (the message's
    // bare "for"/"seconds" aren't auto-derived as labels).
    const pt = ws.newBlock('print_text');
    pt.initSvg();
    pt.render();
    const dn = ws.newBlock('math_number');
    dn.initSvg();
    dn.render();
    pt.getInput('DURATION').connection.connect(dn.outputConnection);
    await sleep();
    res.printDurationReporter = read(dn.getField('NUM'));
    res.printDurationProvider = pt.getInput('DURATION').getAriaLabelText?.();
    res.printTextAutoLabel = pt.getInput('TEXT').getAriaLabelText?.();

    [scale, ch, pt].forEach((b) => {
      try {
        b.dispose(false);
      } catch (e) {}
    });
    return res;
  });

  // coordinate + colour reporters get their slot prepended
  expect(out.scaleXReporter).toContain('x');
  expect(out.scaleXReporter).toContain('number');
  expect(out.hairReporter).toContain('hair');
  // block readout mentions the slot once, not twice
  expect(out.hairMentionsInBlock).toBe(1);
  // explicit override is applied; "for"/"seconds" are not auto-derived
  expect(out.printDurationProvider).toBe('seconds');
  expect(out.printDurationReporter).toContain('seconds');
  expect(out.printTextAutoLabel).not.toBe('for');
});

test("decorative block-type icons are silent (no 'empty' in block label)", async ({ page }) => {
  await setup(page);

  const blockAria = await page.evaluate(() => {
    const Blockly = window.Blockly;
    const ws = window.mainWorkspace ?? Blockly.getMainWorkspace();
    const start = ws.newBlock('start');
    start.initSvg();
    start.render();
    const aria = start.getAriaLabel?.(1);
    start.dispose(false);
    return aria;
  });

  expect(blockAria).toContain('start');
  expect(blockAria).not.toContain('empty');
});
