import { flock } from '../flock.js';

const fontFamily = 'Atkinson Hyperlegible Next';

// Collapsed/expanded survives tool switches, canvas rebuilds and reloads —
// re-hiding on every tool switch would make the toggle pointless.
// Font Awesome Free 6.7.2 "gears" (solid) by @fontawesome — https://fontawesome.com
// License: https://fontawesome.com/license/free — Copyright 2025 Fonticons, Inc.
// Inlined rather than imported: @fortawesome is only a transitive dependency here,
// and index.html embeds its icons the same way.
const GEARS_PATH =
  'M308.5 135.3c7.1-6.3 9.9-16.2 6.2-25c-2.3-5.3-4.8-10.5-7.6-15.5L304 89.4c-3-5-6.3-9.9-9.8-14.6c-5.7-7.6-15.7-10.1-24.7-7.1l-28.2 9.3c-10.7-8.8-23-16-36.2-20.9L199 27.1c-1.9-9.3-9.1-16.7-18.5-17.8C173.9 8.4 167.2 8 160.4 8l-.7 0c-6.8 0-13.5 .4-20.1 1.2c-9.4 1.1-16.6 8.6-18.5 17.8L115 56.1c-13.3 5-25.5 12.1-36.2 20.9L50.5 67.8c-9-3-19-.5-24.7 7.1c-3.5 4.7-6.8 9.6-9.9 14.6l-3 5.3c-2.8 5-5.3 10.2-7.6 15.6c-3.7 8.7-.9 18.6 6.2 25l22.2 19.8C32.6 161.9 32 168.9 32 176s.6 14.1 1.7 20.9L11.5 216.7c-7.1 6.3-9.9 16.2-6.2 25c2.3 5.3 4.8 10.5 7.6 15.6l3 5.2c3 5.1 6.3 9.9 9.9 14.6c5.7 7.6 15.7 10.1 24.7 7.1l28.2-9.3c10.7 8.8 23 16 36.2 20.9l6.1 29.1c1.9 9.3 9.1 16.7 18.5 17.8c6.7 .8 13.5 1.2 20.4 1.2s13.7-.4 20.4-1.2c9.4-1.1 16.6-8.6 18.5-17.8l6.1-29.1c13.3-5 25.5-12.1 36.2-20.9l28.2 9.3c9 3 19 .5 24.7-7.1c3.5-4.7 6.8-9.5 9.8-14.6l3.1-5.4c2.8-5 5.3-10.2 7.6-15.5c3.7-8.7 .9-18.6-6.2-25l-22.2-19.8c1.1-6.8 1.7-13.8 1.7-20.9s-.6-14.1-1.7-20.9l22.2-19.8zM112 176a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM504.7 500.5c6.3 7.1 16.2 9.9 25 6.2c5.3-2.3 10.5-4.8 15.5-7.6l5.4-3.1c5-3 9.9-6.3 14.6-9.8c7.6-5.7 10.1-15.7 7.1-24.7l-9.3-28.2c8.8-10.7 16-23 20.9-36.2l29.1-6.1c9.3-1.9 16.7-9.1 17.8-18.5c.8-6.7 1.2-13.5 1.2-20.4s-.4-13.7-1.2-20.4c-1.1-9.4-8.6-16.6-17.8-18.5L583.9 307c-5-13.3-12.1-25.5-20.9-36.2l9.3-28.2c3-9 .5-19-7.1-24.7c-4.7-3.5-9.6-6.8-14.6-9.9l-5.3-3c-5-2.8-10.2-5.3-15.6-7.6c-8.7-3.7-18.6-.9-25 6.2l-19.8 22.2c-6.8-1.1-13.8-1.7-20.9-1.7s-14.1 .6-20.9 1.7l-19.8-22.2c-6.3-7.1-16.2-9.9-25-6.2c-5.3 2.3-10.5 4.8-15.6 7.6l-5.2 3c-5.1 3-9.9 6.3-14.6 9.9c-7.6 5.7-10.1 15.7-7.1 24.7l9.3 28.2c-8.8 10.7-16 23-20.9 36.2L315.1 313c-9.3 1.9-16.7 9.1-17.8 18.5c-.8 6.7-1.2 13.5-1.2 20.4s.4 13.7 1.2 20.4c1.1 9.4 8.6 16.6 17.8 18.5l29.1 6.1c5 13.3 12.1 25.5 20.9 36.2l-9.3 28.2c-3 9-.5 19 7.1 24.7c4.7 3.5 9.5 6.8 14.6 9.8l5.4 3.1c5 2.8 10.2 5.3 15.5 7.6c8.7 3.7 18.6 .9 25-6.2l19.8-22.2c6.8 1.1 13.8 1.7 20.9 1.7s14.1-.6 20.9-1.7l19.8 22.2zM464 304a48 48 0 1 1 0 96 48 48 0 1 1 0-96z';
const GEARS_ASPECT = 512 / 640;
// Babylon GUI images can't be tinted, so bake one data URI per fill.
const gearsIcon = (fill) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    // width/height are required as well as viewBox: without an intrinsic size
    // the browser hands Babylon a zero-sized image and the icon renders cropped.
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="512" viewBox="0 0 640 512"><path fill="${fill}" d="${GEARS_PATH}"/></svg>`
  );
const GEARS_DARK = gearsIcon('#1a1a1a');
const GEARS_LIGHT = gearsIcon('#ffffff');

const COLLAPSED_KEY = 'flock-gizmo-hud-collapsed';
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};
const writeCollapsed = (value) => {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    /* private mode / storage disabled — the session-local flag still works */
  }
};

export function createGizmoMobileHud({
  onMove,
  stepNormal,
  stepFast,
  mode = 'slider',
  showUniform = false,
  stepLabels = ['◁', '▷'],
  onAxisChange = null,
  stepLabelsByAxis = null,
  getValues = null,
  initialAxis = null,
}) {
  if (!flock.scene || !flock.canvas || !flock.GUI) return null;

  const s = flock.displayScale ?? 1;
  const canvas = flock.canvas;

  const savedControls = flock.controlsTexture ?? null;
  if (savedControls) savedControls.rootContainer.isVisible = false;
  if (flock._joystickSource) flock._joystickSource.pause();

  const hudTexture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
    'GizmoHUD',
    true,
    flock.scene
  );

  // ── Axis state ────────────────────────────────────────────────────────────
  const AXIS_DEFS = [
    { key: 'x', label: 'X', color: '#0072B2' },
    { key: 'y', label: 'Y', color: '#009E73' },
    { key: 'z', label: 'Z', color: '#D55E00' },
    ...(showUniform ? [{ key: 'all', label: '★', color: '#aaaaaa' }] : []),
  ];
  const firstAxis = AXIS_DEFS[0]?.key ?? 'x';
  let axis = initialAxis && AXIS_DEFS.find((d) => d.key === initialAxis) ? initialAxis : firstAxis;
  const numAxes = AXIS_DEFS.length;

  // ── Layout ────────────────────────────────────────────────────────────────
  const GAP = 6 * s;
  const HALF = canvas.width / 2;
  const BOTTOM_PADDING = 24 * s;
  // Cap at the same size as the existing on-screen controls (70 * s),
  // but shrink if there isn't room for all axis buttons in the right half.
  const BTN_SIZE = Math.min(70 * s, (HALF - (numAxes + 1) * GAP) / numAxes);
  // Sized against the buttons so it reads as part of the same set, with a floor
  // that keeps it a usable touch target on the narrowest canvases. It lives in
  // the opposite corner from the strip, so it costs the row no width.
  const TOGGLE = Math.max(44 * s, Math.min(56 * s, BTN_SIZE));
  const TOTAL_H = BTN_SIZE + 2 * GAP;

  // ── Transparent container ─────────────────────────────────────────────────
  const container = new flock.GUI.Rectangle('gizmoHudContainer');
  container.width = `${canvas.width}px`;
  container.height = `${TOTAL_H}px`;
  container.background = 'transparent';
  container.thickness = 0;
  container.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  container.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  container.top = `-${BOTTOM_PADDING}px`;
  container.isPointerBlocker = false;
  hudTexture.addControl(container);

  // ── Collapse handle ───────────────────────────────────────────────────────
  // A sibling of the strip rather than a child, so collapsing is just
  // container.isVisible = false — Babylon GUI skips hit-testing hidden
  // controls — while the handle itself stays visible and tappable.
  // Same on/off language as the gizmo toolbar right above the canvas: the icon
  // never changes, the button does. Amber is --color-focus, which is what
  // .gizmo-button.active uses.
  const TOGGLE_ON = '#ffcc33';
  const TOGGLE_OFF = 'rgba(0,0,0,0.4)';

  const handle = new flock.GUI.Rectangle('gizmo-hud-toggle');
  handle.width = `${TOGGLE}px`;
  handle.height = `${TOGGLE}px`;
  handle.cornerRadius = 8 * s;
  handle.color = 'white';
  handle.thickness = 3 * s;
  handle.isPointerBlocker = true;
  handle.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  handle.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
  // Top-left, clear of the strip entirely, so it holds the same spot whether
  // the controls are showing or not.
  handle.left = `${GAP}px`;
  handle.top = `${GAP}px`;
  hudTexture.addControl(handle);

  const gears = new flock.GUI.Image('gizmo-hud-toggle-icon', GEARS_DARK);
  gears.width = `${TOGGLE * 0.62}px`;
  gears.height = `${TOGGLE * 0.62 * GEARS_ASPECT}px`;
  gears.stretch = flock.GUI.Image.STRETCH_UNIFORM;
  gears.isPointerBlocker = false;
  handle.addControl(gears);

  let collapsed = readCollapsed();
  // Cancel anything mid-gesture that would otherwise keep firing against
  // controls the user can no longer see.
  const collapseHooks = [];

  function applyCollapsed() {
    container.isVisible = !collapsed;
    // Lit means the controls are showing.
    handle.background = collapsed ? TOGGLE_OFF : TOGGLE_ON;
    gears.source = collapsed ? GEARS_LIGHT : GEARS_DARK;
    if (collapsed) collapseHooks.forEach((fn) => fn());
    // The mouse gizmo can rotate the mesh while the strip is hidden, so the
    // thumb has to be re-read from the mesh on the way back.
    else refreshThumb?.();
  }

  function setCollapsed(next) {
    collapsed = next;
    writeCollapsed(collapsed);
    applyCollapsed();
  }

  handle.onPointerUpObservable.add(() => setCollapsed(!collapsed));

  // ── Axis buttons (right half, single horizontal row) ──────────────────────
  const axisButtons = {};
  AXIS_DEFS.forEach(({ key, label }, i) => {
    const btn = flock.GUI.Button.CreateSimpleButton(`gizmo-axis-${key}`, label);
    btn.width = `${BTN_SIZE}px`;
    btn.height = `${BTN_SIZE}px`;
    btn.fontSize = `${Math.min(40 * s, Math.floor(BTN_SIZE * 0.55))}px`;
    btn.fontFamily = fontFamily;
    btn.cornerRadius = 8 * s;
    btn.color = 'white';
    btn.thickness = 3 * s;
    btn.isPointerBlocker = true;
    btn.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    btn.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    btn.left = `${HALF + GAP + i * (BTN_SIZE + GAP)}px`;
    btn.top = `${GAP}px`;
    container.addControl(btn);
    axisButtons[key] = btn;
  });

  let arrowNegBtn = null;
  let arrowPosBtn = null;
  let refreshThumb = null;

  function refreshAxisVisuals() {
    for (const { key, color } of AXIS_DEFS) {
      const selected = axis === key || axis === 'all';
      axisButtons[key].background = color;
      axisButtons[key].thickness = selected ? 6 * s : 2 * s;
    }
    if (stepLabelsByAxis && arrowNegBtn && arrowPosBtn) {
      const labels = stepLabelsByAxis[axis] ?? stepLabels;
      arrowNegBtn.textBlock.text = labels[0];
      arrowPosBtn.textBlock.text = labels[1];
    }
  }
  function updateAxisButtons() {
    refreshAxisVisuals();
    onAxisChange?.(axis);
    refreshThumb?.();
  }
  refreshAxisVisuals();

  AXIS_DEFS.forEach(({ key }) => {
    axisButtons[key].onPointerUpObservable.add(() => {
      if (axis !== key) {
        axis = key;
        updateAxisButtons();
      }
    });
  });

  // ── Left half: slider or arrow buttons ───────────────────────────────────
  const cleanups = [];

  if (mode === 'arrows') {
    // ── Arrow buttons (◁ ▷) — square, centred in left half ───────────────
    const arrowTotalW = 2 * BTN_SIZE + 3 * GAP;
    const arrowOffsetX = (HALF - arrowTotalW) / 2;

    // Shift means "fine control" — holding it should keep the step at
    // stepNormal for the whole press, not let the hold-to-accelerate ramp
    // override it.
    let shiftHeld = false;
    const onShiftKeyDown = (e) => {
      if (e.key === 'Shift') shiftHeld = true;
    };
    const onShiftKeyUp = (e) => {
      if (e.key === 'Shift') shiftHeld = false;
    };
    document.addEventListener('keydown', onShiftKeyDown);
    document.addEventListener('keyup', onShiftKeyUp);
    cleanups.push(() => {
      document.removeEventListener('keydown', onShiftKeyDown);
      document.removeEventListener('keyup', onShiftKeyUp);
    });

    function makeArrowButton(label, sign, idx) {
      const leftPos = arrowOffsetX + GAP + idx * (BTN_SIZE + GAP);
      const btn = flock.GUI.Button.CreateSimpleButton(`gizmo-arrow-${sign}`, label);
      btn.width = `${BTN_SIZE}px`;
      btn.height = `${BTN_SIZE}px`;
      btn.fontSize = `${Math.min(56 * s, Math.floor(BTN_SIZE * 0.75))}px`;
      btn.fontFamily = fontFamily;
      btn.cornerRadius = 8 * s;
      btn.background = 'transparent';
      btn.color = 'white';
      btn.thickness = 3 * s;
      btn.isPointerBlocker = true;
      btn.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      btn.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      btn.left = `${leftPos}px`;
      btn.top = `${GAP}px`;
      container.addControl(btn);
      // The +/- glyphs sit low within their line-box in this font; nudge up to
      // visually re-centre them in the button.
      btn.textBlock.top = `${-Math.round(BTN_SIZE * 0.08)}px`;

      let timeoutId = null;
      let intervalId = null;
      let pressTime = 0;

      function currentStep() {
        if (shiftHeld) return stepNormal;
        const elapsed = Date.now() - pressTime;
        if (elapsed < 1000) return stepNormal;
        if (elapsed < 2000) return stepNormal * 5;
        return stepFast;
      }

      function step() {
        const d = sign * currentStep();
        if (axis === 'all') onMove(d, d, d);
        else if (axis === 'x') onMove(d, 0, 0);
        else if (axis === 'y') onMove(0, d, 0);
        else if (axis === 'z') onMove(0, 0, d);
      }

      function startRepeat() {
        if (timeoutId !== null) return;
        pressTime = Date.now();
        step();
        timeoutId = setTimeout(() => {
          intervalId = setInterval(step, 100);
        }, 400);
      }

      function stopRepeat() {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        timeoutId = null;
        intervalId = null;
      }

      btn.onPointerDownObservable.add(startRepeat);
      btn.onPointerUpObservable.add(stopRepeat);
      btn.onPointerOutObservable.add(stopRepeat);

      cleanups.push(stopRepeat);
      collapseHooks.push(stopRepeat);
      return btn;
    }

    arrowNegBtn = makeArrowButton(stepLabels[0], -1, 0);
    arrowPosBtn = makeArrowButton(stepLabels[1], +1, 1);
    refreshAxisVisuals();
  } else {
    // ── Slider (absolute -180…+180) ───────────────────────────────────────
    const THUMB_R = Math.floor(BTN_SIZE / 2) - 2 * s;
    const TRACK_H = 8 * s;
    const SLIDER_MARGIN = THUMB_R + GAP;
    const MAX_OFFSET_GUI = HALF / 2 - SLIDER_MARGIN;
    const MAX_DEG = 180;
    const TRACK_CENTER_Y = TOTAL_H / 2;

    const track = new flock.GUI.Rectangle('gizmoTrack');
    track.width = `${HALF - 2 * SLIDER_MARGIN}px`;
    track.height = `${TRACK_H}px`;
    track.background = 'rgba(255,255,255,0.3)';
    track.thickness = 0;
    track.cornerRadius = TRACK_H / 2;
    track.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    track.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    track.left = `${SLIDER_MARGIN}px`;
    track.top = `${TRACK_CENTER_Y - TRACK_H / 2}px`;
    container.addControl(track);

    const SNAP_DEGS = [-180, -90, 0, 90, 180];
    const SNAP_THRESHOLD_GUI = (8 / MAX_DEG) * MAX_OFFSET_GUI;

    const tickW = 4 * s;
    const tickH = TRACK_H + 10 * s;
    for (const deg of SNAP_DEGS) {
      const guiOffset = (deg / MAX_DEG) * MAX_OFFSET_GUI;
      const tick = new flock.GUI.Rectangle(`gizmoTick${deg}`);
      tick.width = `${tickW}px`;
      tick.height = `${tickH}px`;
      tick.background = 'rgba(255,255,255,0.55)';
      tick.thickness = 0;
      tick.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      tick.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      tick.left = `${HALF / 2 + guiOffset - tickW / 2}px`;
      tick.top = `${TRACK_CENTER_Y - tickH / 2}px`;
      container.addControl(tick);
    }

    const thumb = new flock.GUI.Ellipse('gizmoThumb');
    thumb.width = `${THUMB_R * 2}px`;
    thumb.height = `${THUMB_R * 2}px`;
    thumb.background = 'rgba(255,255,255,0.85)';
    thumb.color = 'transparent';
    thumb.thickness = 0;
    thumb.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    thumb.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    thumb.top = `${TRACK_CENTER_Y - THUMB_R}px`;
    container.addControl(thumb);

    let rawOffsetGUI = 0; // follows finger exactly
    let thumbOffsetGUI = 0; // snapped display position
    let lastClientX = 0;
    let activePointer = null;
    let activeScale = 1;
    let lastSnappedGUI = null; // GUI offset of the snap tick currently locked into, or null

    // Normalize any degree value into (-180, 180]
    function normalizeDeg(deg) {
      const n = (((deg % 360) + 540) % 360) - 180;
      return n === -180 ? 180 : n;
    }
    function degToGUI(deg) {
      return Math.max(
        -MAX_OFFSET_GUI,
        Math.min(MAX_OFFSET_GUI, (normalizeDeg(deg) / MAX_DEG) * MAX_OFFSET_GUI)
      );
    }
    function getAxisDeg() {
      if (!getValues) return 0;
      const vals = getValues();
      return axis === 'all' ? 0 : (vals[axis] ?? 0);
    }
    function snapGUI(offsetGUI) {
      for (const deg of SNAP_DEGS) {
        const sp = (deg / MAX_DEG) * MAX_OFFSET_GUI;
        if (Math.abs(offsetGUI - sp) <= SNAP_THRESHOLD_GUI) return sp;
      }
      return offsetGUI;
    }
    function applyMove(prevGUI, newGUI) {
      const deltaDeg = ((newGUI - prevGUI) / MAX_OFFSET_GUI) * MAX_DEG;
      const delta = flock.BABYLON.Tools.ToRadians(deltaDeg);
      if (axis === 'all') onMove(delta, delta, delta);
      else if (axis === 'x') onMove(delta, 0, 0);
      else if (axis === 'y') onMove(0, delta, 0);
      else if (axis === 'z') onMove(0, 0, delta);
    }

    // Snapping is only obvious as a position change; the thumb is large relative
    // to the track on mobile, so make the held colour itself reflect snap state
    // (white on a tick, yellow while dragging off one) plus a haptic tick the
    // instant a drag locks onto a new one.
    function isSnapPoint(gui) {
      return SNAP_DEGS.some((deg) => Math.abs(gui - (deg / MAX_DEG) * MAX_OFFSET_GUI) < 0.01);
    }
    function updateThumbHeldColour(newGUI) {
      if (isSnapPoint(newGUI)) {
        if (lastSnappedGUI !== newGUI) navigator.vibrate?.(20);
        lastSnappedGUI = newGUI;
        thumb.background = 'rgba(255,255,255,0.95)';
      } else {
        lastSnappedGUI = null;
        thumb.background = 'rgba(255,220,50,0.95)';
      }
    }

    refreshThumb = () => {
      rawOffsetGUI = degToGUI(getAxisDeg());
      thumbOffsetGUI = snapGUI(rawOffsetGUI);
      thumb.left = `${HALF / 2 - THUMB_R + thumbOffsetGUI}px`;
    };
    refreshThumb();

    function sliderBounds() {
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / canvas.width;
      return {
        left: rect.left,
        right: rect.left + rect.width / 2,
        top: rect.bottom - TOTAL_H * scale,
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 4,
        maxOffsetCSS: MAX_OFFSET_GUI * scale,
        scale,
      };
    }

    function onPointerDown(e) {
      // The slider hit-tests geometry on the canvas rather than using GUI
      // hit-testing, so hiding the strip isn't enough to stop it claiming
      // touches in that corner — it has to be switched off explicitly.
      if (collapsed) return;
      if (activePointer !== null) return;
      const b = sliderBounds();
      if (e.clientY < b.top || e.clientY > b.bottom) return;
      if (e.clientX < b.left || e.clientX > b.right) return;
      activePointer = e.pointerId;
      activeScale = b.scale;
      lastClientX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
      const clampedCSS = Math.max(-b.maxOffsetCSS, Math.min(b.maxOffsetCSS, e.clientX - b.centerX));
      rawOffsetGUI = clampedCSS / b.scale;
      const newThumbOffsetGUI = snapGUI(rawOffsetGUI);
      const targetDeg = (newThumbOffsetGUI / MAX_OFFSET_GUI) * MAX_DEG;
      const deltaDeg = targetDeg - getAxisDeg();
      if (deltaDeg !== 0) {
        const delta = flock.BABYLON.Tools.ToRadians(deltaDeg);
        if (axis === 'all') onMove(delta, delta, delta);
        else if (axis === 'x') onMove(delta, 0, 0);
        else if (axis === 'y') onMove(0, delta, 0);
        else if (axis === 'z') onMove(0, 0, delta);
      }
      thumbOffsetGUI = newThumbOffsetGUI;
      thumb.left = `${HALF / 2 - THUMB_R + thumbOffsetGUI}px`;
      updateThumbHeldColour(newThumbOffsetGUI);
    }

    function onPointerMove(e) {
      if (e.pointerId !== activePointer) return;
      const deltaCSS = e.clientX - lastClientX;
      lastClientX = e.clientX;
      if (deltaCSS === 0) return;
      rawOffsetGUI = Math.max(
        -MAX_OFFSET_GUI,
        Math.min(MAX_OFFSET_GUI, rawOffsetGUI + deltaCSS / activeScale)
      );
      const newThumbOffsetGUI = snapGUI(rawOffsetGUI);
      applyMove(thumbOffsetGUI, newThumbOffsetGUI);
      thumbOffsetGUI = newThumbOffsetGUI;
      thumb.left = `${HALF / 2 - THUMB_R + thumbOffsetGUI}px`;
      updateThumbHeldColour(newThumbOffsetGUI);
    }

    function onPointerUp(e) {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      lastSnappedGUI = null;
      thumb.background = 'rgba(255,255,255,0.85)';
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    // Collapsing mid-drag has to release the pointer, or activePointer stays
    // set and the slider ignores the first touch after expanding again.
    collapseHooks.push(() => {
      activePointer = null;
      lastSnappedGUI = null;
      thumb.background = 'rgba(255,255,255,0.85)';
    });

    // Block camera/scene for slider touches — including the initial pointerdown
    const prePointerObserver = flock.scene.onPrePointerObservable.add((info) => {
      if (collapsed) return;
      const e = info.event;
      if (activePointer !== null && e.pointerId === activePointer) {
        info.skipOnPointerObservable = true;
        return;
      }
      if (e.type === 'pointerdown') {
        const b = sliderBounds();
        if (
          e.clientY >= b.top &&
          e.clientY <= b.bottom &&
          e.clientX >= b.left &&
          e.clientX <= b.right
        ) {
          info.skipOnPointerObservable = true;
        }
      }
    });

    cleanups.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      flock.scene.onPrePointerObservable.remove(prePointerObserver);
    });
  }

  applyCollapsed();

  // ── Stop / cleanup ────────────────────────────────────────────────────────
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    cleanups.forEach((fn) => fn());
    hudTexture.dispose();
    if (savedControls) savedControls.rootContainer.isVisible = true;
    if (flock._joystickSource) flock._joystickSource.resume();
  }
  stop.toggleCollapsed = () => {
    if (stopped) return collapsed;
    setCollapsed(!collapsed);
    return collapsed;
  };
  stop.isCollapsed = () => collapsed;
  stop.setAxis = (newAxis) => {
    if (stopped) return;
    const def = AXIS_DEFS.find((d) => d.key === newAxis);
    if (def) {
      axis = newAxis;
      refreshAxisVisuals();
      refreshThumb?.();
    }
  };
  return stop;
}
