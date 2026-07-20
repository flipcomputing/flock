---
name: verify
description: Build/launch/drive recipe for verifying Flock XR changes in a real browser.
---

# Verifying Flock XR changes at the app surface

The surface is the Blockly editor + Babylon canvas served by `npm run dev`
(vite, port 5173). Drive it with Playwright from the repo's own dependency
(import `/home/tracy/projects/flock/node_modules/playwright/index.mjs` when
the script lives outside the repo).

## Launch

- Chromium needs `headless: false` plus args `--no-sandbox
  --disable-setuid-sandbox --headless=old`. This is not a contradiction:
  `headless: false` stops Playwright adding its own headless flags (its
  headless mode uses the new headless shell, which drops WebGL), and
  `--headless=old` then puts Chromium itself in legacy headless mode,
  which keeps WebGL. The browser runs headless. Same pattern as
  scripts/run-api-tests.mjs.
- Spawn `npm run dev` with `detached: true` and kill the process group on
  exit; a crashed script otherwise orphans vite holding port 5173.

## Readiness and gotchas

- `page.waitForFunction` is blocked by the app; poll with `page.evaluate`
  in a loop instead.
- Workspace global is `window.mainWorkspace` (there is no `window.Blockly`).
  `window.flock` on the top page is NOT the flock module (named DOM element);
  flock internals are not reachable from page JS — verify via observable
  output instead.
- Ready when `window.mainWorkspace` exists and `#loadingScreen` has class
  `fade-out`. Then wait for `window.loadingCode === false` plus ~3s settle
  before touching the workspace, or startup can race your program and the
  run silently does nothing (block errors are swallowed by design).

## Build and run a program

- Build headlessly: `ws.newBlock(type)` + `initSvg()`/`render()`, connect via
  `getInput(name).connection.connect(child.previousConnection|outputConnection)`.
  A `start` block has statement input `DO`.
- Run with `window.executeCode()` — this exercises the real pipeline
  including the createWhitelist endowments (direct `flock.foo()` calls
  would mask missing whitelist registrations).
- Cheap observable output: `print_text` (value input `TEXT`, accepts
  Number) does `console.log(text)` — capture page console. The print can
  lag `executeCode()` by seconds (scene setup), so poll for its arrival
  rather than using fixed waits.

## Simulating tab visibility

flock.js listens on the top document. Stub and dispatch:

```js
Object.defineProperty(document, "visibilityState",
  { configurable: true, get: () => document.__fakeVis || "visible" });
document.__fakeVis = "hidden"; // or "visible"
document.dispatchEvent(new Event("visibilitychange"));
```
