// Guards keyboard access to the Blockly workspace: Ctrl+Enter opens the
// workspace context menu, Ctrl+B,8 focuses the workspace (highlighted, not the
// trashcan), and comments stay reachable via stack nav with Blockly's ARIA.
// Runs in a real browser because it needs the live shortcut registry and
// FocusManager; --headless=old keeps WebGL (as in scripts/run-api-tests.mjs).

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const BASE_URL = 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const devServer = spawn('npm', ['run', 'dev'], {
  cwd: process.cwd(),
  detached: true,
  stdio: 'ignore',
});
const cleanup = () => {
  try {
    process.kill(-devServer.pid);
  } catch {
    // Server already gone; nothing to kill.
  }
};
process.on('exit', cleanup);

let browser;
const failures = [];
const pass = (msg) => console.log(`  ✓ ${msg}`);
const check = (cond, msg) => (cond ? pass(msg) : failures.push(msg));

try {
  browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=old'],
  });
  const page = await browser.newPage();

  for (let i = 0; i < 60; i++) {
    try {
      await page.goto(BASE_URL, { timeout: 2000 });
      break;
    } catch {
      await sleep(1000);
    }
  }

  const ready = async () => {
    for (let i = 0; i < 60; i++) {
      const ok = await page
        .evaluate(
          () =>
            !!window.mainWorkspace &&
            document.getElementById('loadingScreen')?.classList.contains('fade-out') &&
            window.loadingCode === false
        )
        .catch(() => false);
      if (ok) break;
      await sleep(1000);
    }
    // Startup can race a freshly loaded workspace; let it settle.
    await sleep(3000);
  };
  const fresh = async () => {
    await page.reload();
    await ready();
  };

  const menuVisible = () =>
    page.evaluate(() => {
      const menu = document.querySelector('.blocklyContextMenu, .blocklyWidgetDiv .blocklyMenu');
      const items = document.querySelectorAll('[role="menuitem"], .blocklyMenuItem').length;
      return !!(menu && menu.getBoundingClientRect().width > 0) && items > 0;
    });
  const svgBox = () =>
    page.evaluate(() => {
      const b = document.querySelector('svg.blocklySvg').getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });

  await ready();

  // Ctrl+B,8 focuses the workspace; Ctrl+Enter then opens its context menu.
  await fresh();
  await page.keyboard.press('Control+b');
  await sleep(350);
  await page.keyboard.press('8');
  await sleep(400);
  const focusedOnTrash = await page.evaluate(
    () => !!document.activeElement?.closest?.('.blocklyTrash')
  );
  check(!focusedOnTrash, 'Ctrl+B,8 focuses the workspace, not the trashcan');
  // Focus highlight: the active selection ring is painted only while keyboard
  // nav is active (.blocklyKeyboardNavigation).
  const highlighted = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a?.classList?.contains('blocklyWorkspaceSelectionRing')) return false;
    const kbnav = [...document.querySelectorAll('*')].some((e) =>
      e.classList?.contains('blocklyKeyboardNavigation')
    );
    const cs = getComputedStyle(a);
    const r = a.getBoundingClientRect();
    return kbnav && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 1 && r.width > 50;
  });
  check(highlighted, 'Ctrl+B,8 shows the workspace focus highlight (keyboard nav active)');
  await page.keyboard.press('Control+Enter');
  await sleep(450);
  check(
    await menuVisible(),
    'Ctrl+Enter opens the context menu from the keyboard-focused workspace'
  );

  // A focused block still gets its own context menu (fallback must not hijack).
  await fresh();
  const box = await svgBox();
  await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.35);
  await sleep(300);
  const onBlock = await page.evaluate(() =>
    document.activeElement?.getAttribute?.('class')?.includes('blocklyPath')
  );
  await page.keyboard.press('Control+Enter');
  await sleep(450);
  check(
    onBlock && (await menuVisible()),
    'Ctrl+Enter still opens a focused block’s own context menu'
  );

  // A workspace comment is reachable via stack nav (N) and keeps Blockly's ARIA.
  await fresh();
  const b3 = await svgBox();
  await page.mouse.click(b3.x + b3.w * 0.8, b3.y + b3.h * 0.25, { button: 'right' });
  await sleep(400);
  await page.evaluate(() => {
    const it = [...document.querySelectorAll('[role="menuitem"], .blocklyMenuItem')].find((e) =>
      /comment/i.test(e.textContent || '')
    );
    it?.click();
  });
  await sleep(600);
  const commentMade = await page.evaluate(
    () => document.querySelectorAll('g.blocklyComment').length > 0
  );
  const blockPt = await page.evaluate(() => {
    const g = [...document.querySelectorAll('g.blocklyDraggable')].find((el) =>
      el.querySelector('path.blocklyPath')
    );
    if (!g) return null;
    const r = g.querySelector('path.blocklyPath').getBoundingClientRect();
    return { x: r.x + 20, y: r.y + 10 };
  });
  if (blockPt) {
    await page.mouse.click(blockPt.x, blockPt.y);
    await sleep(300);
  }
  let onComment = false;
  for (let i = 0; i < 14 && !onComment; i++) {
    await page.keyboard.press('n');
    await sleep(220);
    onComment = await page.evaluate(() => !!document.activeElement?.closest?.('g.blocklyComment'));
  }
  check(commentMade && onComment, 'Workspace comment is reachable via N (stack navigation)');
  const aria = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a?.closest?.('g.blocklyComment')) return null;
    return {
      roledescription: a.getAttribute('aria-roledescription'),
      hasLabelledby: !!a.getAttribute('aria-labelledby'),
      genericFlockLabel: a.getAttribute('aria-label') === 'Workspace comment',
    };
  });
  check(
    !!aria && aria.roledescription === 'Comment' && aria.hasLabelledby && !aria.genericFlockLabel,
    'Focused comment keeps Blockly’s native ARIA (no generic "Workspace comment" override)'
  );

  // Shift+Tab off the trashcan returns to the block you left, not the workspace
  // surface (the trashcan shares the workspace focus tree, so we track it).
  await fresh();
  const bp = await page.evaluate(() => {
    const g = [...document.querySelectorAll('g.blocklyDraggable')].find((el) =>
      el.querySelector('path.blocklyPath')
    );
    if (!g) return null;
    const r = g.querySelector('path.blocklyPath').getBoundingClientRect();
    return { x: r.x + 20, y: r.y + 10 };
  });
  let returnedToBlock = false;
  if (bp) {
    await page.mouse.click(bp.x, bp.y);
    await sleep(300);
    await page.keyboard.press('Tab');
    await sleep(250);
    const onTrash = await page.evaluate(
      () => !!document.activeElement?.closest?.('g.blocklyTrash')
    );
    if (onTrash) {
      await page.keyboard.press('Shift+Tab');
      await sleep(300);
      returnedToBlock = await page.evaluate(
        () => !!document.activeElement?.closest?.('g.blocklyDraggable')
      );
    }
  }
  check(
    returnedToBlock,
    'Shift+Tab off the trashcan returns to the block, not the workspace surface'
  );

  // Escape closes the trashcan flyout — Blockly's own Escape can't, since the
  // focused flyout is read-only.
  await fresh();
  const trashOpen = () => page.evaluate(() => !!window.mainWorkspace?.trashcan?.contentsIsOpen?.());
  const dp = await page.evaluate(() => {
    const g = [...document.querySelectorAll('g.blocklyDraggable')].find((el) =>
      el.querySelector('path.blocklyPath')
    );
    if (!g) return null;
    const r = g.querySelector('path.blocklyPath').getBoundingClientRect();
    return { x: r.x + 20, y: r.y + 10 };
  });
  let escClosed = false;
  if (dp) {
    await page.mouse.click(dp.x, dp.y);
    await sleep(300);
    await page.keyboard.press('Delete');
    await sleep(400);
    const tb = await page.evaluate(() => {
      const t = document.querySelector('g.blocklyTrash');
      const r = t.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(tb.x, tb.y);
    await sleep(500);
    const opened = await trashOpen();
    await page.keyboard.press('Escape');
    await sleep(400);
    escClosed = opened && !(await trashOpen());
  }
  check(escClosed, 'Escape closes the trashcan flyout');

  console.log('');
  if (failures.length) {
    console.error(`❌ ${failures.length} check(s) failed:`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exitCode = 1;
  } else {
    console.log('✅ Keyboard context-menu checks passed.');
  }
} catch (err) {
  console.error('❌ context-menu-keyboard-check crashed:', err);
  process.exitCode = 1;
} finally {
  await browser?.close();
  cleanup();
}
