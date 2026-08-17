# Input architecture

All player input — keyboard, gamepad, on-screen buttons, on-screen joystick, XR controllers,
micro:bit — funnels through a single `InputManager` instance (`flock.inputManager`, created in
`flock.js`). Sources push state in; the API, accessibility layer and camera read state out. Nothing
outside `input/` should listen to raw `keydown`/`keyup` for gameplay.

```
KeyboardSource ┐
OnScreenSource ┤
JoystickSource ┼─→ InputManager ─→ keyPressed / actionPressed  (api/sensing.js)
GamepadSource  ┤     keys           whenKeyEvent / whenActionEvent  (api/events.js)
XRSource       ┤     actions        CameraControls, interactIndicator, accessibility
micro:bit      ┘     axes
```

## Files

| File                      | Role                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| `input/inputManager.js`   | The hub: key refcounts, action resolution, axes, observables            |
| `input/bindings.js`       | `ACTIONS` list and `DEFAULT_BINDINGS` (key → action map)                |
| `input/normaliseKey.js`   | Canonical key names (single chars lowercased, `Spacebar` → `' '`)       |
| `input/keyboardSource.js` | Physical keyboard on the canvas; tracks real key state for camera reads |
| `input/onScreenSource.js` | On-screen buttons; also dispatches synthetic DOM key events for Babylon |
| `input/joystickSource.js` | On-screen thumbstick → `MOVE_X`/`MOVE_Y` axes (+ direction keys)        |
| `input/gamepadSource.js`  | Polled Gamepad API: buttons → actions, sticks → axes                    |
| `input/xrSource.js`       | XR controller buttons and thumbsticks → keys and `XR_*` axes            |
| `input/cameraControls.js` | Per-frame camera move/look from axes and physical keys                  |
| `input/xrEmulatorShim.js` | Dev-only IWER emulator workaround                                       |

Wiring lives in `flock.js` (`inputManager`, `_keyboardSource`, `_onScreenSource`, `_gamepadSource`,
`_cameraControls`), `api/ui.js` (`_joystickSource`) and `api/xr.js` (`_xrSource`).

## Keys, actions and axes

- **Keys** are normalised key names (`'w'`, `' '`, `'ArrowUp'`). `InputManager` refcounts them, so a
  key held on the keyboard and the gamepad at once stays down until both release.
- **Actions** are semantic names (`FORWARD`, `BUTTON1`, `A11Y_I`) resolved through `DEFAULT_BINDINGS`.
  Several keys can map to one action (`FORWARD` is `w` and `z` — `z`/`q` are AZERTY aliases), and
  action edges only fire when no other key for that action is still held. `setActionKey()` installs a
  runtime override; `resetActionKeys()` clears overrides (done on each run).
- **Axes** are named analogue values (`MOVE_X`, `LOOK_Y`, `TURN`, `XR_MOVE_X`, …) written with
  `_setAxis()` and read with `getAxis()`. Sticks also "shim" past a threshold into direction keys so
  key-based blocks work on a gamepad.

## Observables

`onKeyDown/UpObservable` and `onActionDown/UpObservable` are **edge only** — they fire once per
press. `onKeyRepeatObservable` / `onActionRepeatObservable` fire repeatedly while held (after a
500 ms delay, at most every 100 ms) and drive the "while pressed" behaviour of the event blocks;
movement, accessibility and interaction stay on the edge observables. `onRawKeyDownObservable`
carries the unfiltered DOM event and feeds the editor's `KeyboardDispatcher` (`main/keyboardDispatcher.js`),
which is UI shortcut handling, not gameplay.

Removal needs the handle returned by `add()`, not the callback:

```js
const observer = flock.inputManager.onKeyDownObservable.add(handler);
flock.inputManager.onKeyDownObservable.remove(observer);
```

## Flying the camera

Babylon's built-in canvas controls drive the camera from the keyboard and pointer only. Flock's job
is to give **every other input device** the same reach: gamepad, on-screen joystick, XR thumbstick.
The camera-driving code is shared, so the fly camera the gizmo button gives you and the camera a
running project gets are the same camera, driven the same way — with no follow camera in play they
are literally the same `FreeCamera` object, and the gizmo's camera swap is a no-op.

- **Look and horizontal movement** — `input/cameraControls.js`, per frame. Gamepad stick and
  shoulder buttons look and turn; gamepad/joystick/WASD move. Precedence is gamepad axis, then
  on-screen joystick, then physical keys (read from `KeyboardSource`, not `InputManager`).
- **Height** — Babylon's own `FreeCameraKeyboardMoveInput`, whose `keysUpward`/`keysDownward` are
  remapped in `flock.js` to BUTTON1 keys + `PageUp` and BUTTON3 keys + `PageDown`. `GamepadSource`
  reaches it by _synthesising_ `PageUp`/`PageDown` DOM events — the only DOM keys it synthesises.
- **XR** — `_updateXRView()` in `api/xr.js`, sharing only the `FLY_SPEED` constant.

All of it is gated by the `canvasControls` block (`flock._canvasControlsEnabled`), which detaches
camera control entirely so a project can own all movement.

## Who is input delivered to?

The camera and the project normally both respond to the same press. Two situations change that, and
they work differently:

**The editor camera takes over** — `inputManager.setInputOwner('editor')`, from the gizmo camera
button in `ui/gizmos.js`.

One state, on `InputManager`, that every source reads:

```js
inputManager.setInputOwner('editor'); // or 'project'
inputManager.inputOwner;
inputManager.onInputOwnerChangedObservable; // sources release held keys on the handover
```

While the editor owns input, sources keep feeding **every camera-facing channel** and stop feeding
`InputManager`, so a running project can't react. Each source cuts a different wire, which is why
the mechanism stays per-source: `KeyboardSource` keeps tracking real keys for `isKeyDown()` (that's
why the camera still moves) but reports nothing; `GamepadSource` keeps publishing axes and
synthesising `PageUp`/`PageDown` DOM events, but reports no keys at all — including those two, or a
project could see them through `keyPressed('ANY')`; `OnScreenSource` keeps dispatching its synthetic
DOM events while withholding them.

The gizmo camera button is a **mode, not a tool**: picking position/rotate/scale leaves the fly
camera on and its button lit. Orbit view (the eye gizmo) does exit it, from `attachOrbitView()` so
that both the eye button and `viewMeshWithCamera()` are covered.

**XR locomotion** — `XRSource.setInputMode()`, driven by `_applyXRInputState()` in `api/xr.js`.

Separate machinery with its own three states: `'fly'` keeps publishing the `XR_MOVE_*` axes but
turns the thumbstick→direction-key shims **off** and remaps the left X/Y buttons to an
`XR_MOVE_VERTICAL` axis; `'project'` turns shims on so the project drives movement; `'disabled'`
stands movement down. Note `'fly'` here is unrelated to the editor state above — same word, no
shared code.

## Notes

- **Modifier chords are ignored.** `KeyboardSource` drops keydowns with Ctrl/Meta/Alt so Ctrl+Z
  doesn't walk the player, and releases everything on `Meta` keyup (macOS suppresses those keyups).
- **Synthetic events** dispatched by `OnScreenSource` are tagged `__flockSynthetic` and skipped by
  `KeyboardSource`, so a single press isn't counted twice. `flock.js` also stops them reaching an
  `ArcRotateCamera`, so a follow camera ignores on-screen and gamepad key events.
- **`OnScreenSource` has two independent reasons to suspend**: the editor owning input, and
  `pause(owner)` / `resume(owner)`, used by the mobile gizmo HUD via `JoystickSource` (the joystick
  has no key channel of its own — it presses `w`/`a`/`s`/`d` through `OnScreenSource`). Neither
  clears the other, and its owner-change subscription lives in the constructor because the instance
  outlives `stop()`.
- Focus and window blur release all held keys; `_clearAllKeys()` is test-only.

## Tests

`tests/input/` covers each source plus the consumer APIs, all registered through
`tests/input/index.test.js`:

```bash
npm run test:api input
```
