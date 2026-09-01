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
  // A point on a top block's own body — not a field or a socket, which no
  // longer open the toolbar.
  const blockBodyPoint = () =>
    page.evaluate(() => {
      const b = window.mainWorkspace.getTopBlocks(true).find((x) => !x.isShadow());
      const path = b?.getSvgRoot().querySelector(':scope > .blocklyPath');
      if (!path) return null;
      const r = path.getBoundingClientRect();
      return { x: Math.round(r.left + 12), y: Math.round(r.top + 14) };
    });

  const toolbarVisible = () =>
    page.evaluate(
      () =>
        !![...document.querySelectorAll('.fc-block-toolbar')].pop()?.classList.contains('visible')
    );
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

  // The floating block toolbar opens on Enter, not on focus alone.
  await fresh();
  await page.keyboard.press('Control+b');
  await sleep(250);
  await page.keyboard.press('8');
  await sleep(400);
  await page.keyboard.press('ArrowDown');
  await sleep(500);
  const openedOnFocus = await toolbarVisible();
  await page.keyboard.press('Enter');
  await sleep(500);
  const openedOnEnter = await toolbarVisible();
  await page.keyboard.press('Enter');
  await sleep(500);
  const closedOnEnter = !(await toolbarVisible());
  check(!openedOnFocus, 'Arrowing onto a block does not open the block toolbar');
  check(openedOnEnter, 'Enter opens the block toolbar for the focused block');
  check(closedOnEnter, 'Enter again closes the block toolbar');

  // Moving focus to another block takes the toolbar away with it.
  await page.keyboard.press('Enter');
  await sleep(400);
  await page.keyboard.press('ArrowDown');
  await sleep(500);
  check(!(await toolbarVisible()), 'Moving focus to another block closes the block toolbar');

  await fresh();
  const wideBody = await blockBodyPoint();
  await page.mouse.click(wideBody.x, wideBody.y);
  await sleep(900);
  check(await toolbarVisible(), 'Clicking a block opens the block toolbar');

  // With one open, clicking another block moves it there — no need to close it.
  await fresh();
  const pair = await page.evaluate(() => {
    const pts = [];
    for (const b of window.mainWorkspace.getAllBlocks(false)) {
      if (b.isShadow()) continue;
      const path = b.getSvgRoot().querySelector(':scope > .blocklyPath');
      if (!path) continue;
      const r = path.getBoundingClientRect();
      if (r.width < 40 || r.height < 14) continue;
      pts.push({ x: Math.round(r.left + 12), y: Math.round(r.top + 14) });
      if (pts.length === 2) break;
    }
    return pts;
  });
  const barPos = () =>
    page.evaluate(() => {
      const r = [...document.querySelectorAll('.fc-block-toolbar')].pop().getBoundingClientRect();
      return `${Math.round(r.left)},${Math.round(r.top)}`;
    });
  if (pair.length === 2) {
    await page.mouse.click(pair[0].x, pair[0].y);
    await sleep(700);
    const firstOpen = await toolbarVisible();
    const firstPos = await barPos();
    await page.mouse.click(pair[1].x, pair[1].y);
    await sleep(700);
    const movedPos = await barPos();
    check(
      firstOpen && (await toolbarVisible()) && movedPos !== firstPos,
      'Clicking another block moves the open toolbar to it'
    );
  } else {
    check(false, 'Found two block bodies to click for the relocation check');
  }

  // The block's own body opens it; its fields and the sockets plugged into it
  // belong to the input being aimed at, so they leave it shut.
  await fresh();
  const parts = await page.evaluate(() => {
    const box = (el) => {
      const r = el?.getBoundingClientRect();
      return r && r.width > 2 && r.height > 2 ? r : null;
    };
    const mid = (r) => ({
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
    });
    for (const b of window.mainWorkspace.getAllBlocks(false)) {
      if (b.isShadow()) continue;
      const body = box(b.getSvgRoot().querySelector(':scope > .blocklyPath'));
      const field = b.inputList
        .flatMap((i) => i.fieldRow)
        .find((f) => f.isClickable?.() && box(f.getSvgRoot?.()));
      const socket = b
        .getChildren(false)
        .find((c) => c.isShadow() && box(c.getSvgRoot().querySelector(':scope > .blocklyPath')));
      if (!body || !field || !socket) continue;
      return {
        body: { x: Math.round(body.left + 12), y: Math.round(body.top + 14) },
        field: mid(box(field.getSvgRoot())),
        socket: mid(box(socket.getSvgRoot().querySelector(':scope > .blocklyPath'))),
      };
    }
    return null;
  });
  check(!!parts, 'Found a block with both a field and a filled socket to click');
  if (parts) {
    await page.mouse.click(parts.field.x, parts.field.y);
    await sleep(700);
    const afterField = await toolbarVisible();
    await page.keyboard.press('Escape');
    await sleep(300);
    await page.mouse.click(parts.socket.x, parts.socket.y);
    await sleep(700);
    const afterSocket = await toolbarVisible();
    await page.keyboard.press('Escape');
    await sleep(300);
    await page.mouse.click(parts.body.x, parts.body.y);
    await sleep(700);
    check(!afterField, "Clicking a block's field leaves the toolbar closed");
    check(!afterSocket, 'Clicking a value socket leaves the toolbar closed');
    check(await toolbarVisible(), "Clicking the same block's body opens it");
  }

  // Leaving the code view takes it away with it. Only a narrow layout actually
  // swaps panels — a wide one shows the canvas and code side by side.
  const wideViewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 800 });
  await fresh();
  await page.evaluate(() => document.getElementById('codeToggleBtn')?.click());
  await sleep(800);
  const narrowBody = await blockBodyPoint();
  await page.mouse.click(narrowBody.x, narrowBody.y);
  await sleep(900);
  const openedNarrow = await toolbarVisible();
  await page.evaluate(() => document.getElementById('canvasToggleBtn')?.click());
  await sleep(800);
  const hiddenInPlayMode = !(await toolbarVisible());
  await page.setViewportSize(wideViewport);
  await fresh();
  check(openedNarrow, 'Clicking a block opens the block toolbar on a narrow layout');
  check(hiddenInPlayMode, 'Switching to the canvas view dismisses the block toolbar');

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

  // Closing the trash with Escape returns to the block you came from, not the
  // workspace surface (same tracking as Shift+Tab).
  await fresh();
  const blockPoint = () =>
    page.evaluate(() => {
      const g = [...document.querySelectorAll('g.blocklyDraggable')].find((el) =>
        el.querySelector('path.blocklyPath')
      );
      if (!g) return null;
      const r = g.querySelector('path.blocklyPath').getBoundingClientRect();
      return { x: r.x + 20, y: r.y + 10 };
    });
  const focusedBlockId = () =>
    page.evaluate(
      () => document.activeElement?.closest?.('g.blocklyDraggable')?.getAttribute('data-id') || null
    );
  let escReturnedToBlock = false;
  const del = await blockPoint();
  if (del) {
    await page.mouse.click(del.x, del.y);
    await sleep(300);
    await page.keyboard.press('Delete');
    await sleep(400);
    const bpt = await blockPoint();
    await page.mouse.click(bpt.x, bpt.y);
    await sleep(300);
    const blockId = await focusedBlockId();
    let onIcon = false;
    for (let i = 0; i < 3 && !onIcon; i++) {
      await page.keyboard.press('Tab');
      await sleep(250);
      onIcon = await page.evaluate(() => !!document.activeElement?.closest?.('g.blocklyTrash'));
    }
    if (onIcon) {
      await page.keyboard.press('Enter');
      await sleep(600);
      await page.keyboard.press('Escape');
      await sleep(400);
      escReturnedToBlock = !!blockId && (await focusedBlockId()) === blockId;
    }
  }
  check(escReturnedToBlock, 'Escape from the trashcan returns focus to the block you came from');

  // With the trash flyout open, Escape from another overlay must reach that
  // overlay — the trash handler is scoped to the injection div, not global.
  await fresh();
  let overlayGotEscape = false;
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
    await page.keyboard.press('Control+b');
    await sleep(400);
    const overlayOpen = () =>
      page.evaluate(
        () => !document.getElementById('area-menu-overlay')?.classList.contains('hidden')
      );
    const opened = (await overlayOpen()) && (await trashOpen());
    await page.keyboard.press('Escape');
    await sleep(400);
    overlayGotEscape = opened && !(await overlayOpen());
  }
  check(
    overlayGotEscape,
    'Escape reaches the area-menu overlay when the trash flyout is also open'
  );

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
