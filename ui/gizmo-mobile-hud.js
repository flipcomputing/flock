import { flock } from '../flock.js';

const fontFamily = 'Atkinson Hyperlegible Next';

export function createGizmoMobileHud({
  onMove,
  stepNormal,
  stepFast,
  mode = 'slider',
  showUniform = false,
  stepLabels = ['◁', '▷'],
  onAxisChange = null,
  stepLabelsByAxis = null,
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
  let axis = (initialAxis && AXIS_DEFS.find(d => d.key === initialAxis)) ? initialAxis : firstAxis;
  const numAxes = AXIS_DEFS.length;

  // ── Layout ────────────────────────────────────────────────────────────────
  const GAP = 6 * s;
  const HALF = canvas.width / 2;
  const BOTTOM_PADDING = 24 * s;
  // Cap at the same size as the existing on-screen controls (70 * s),
  // but shrink if there isn't room for all axis buttons in the right half.
  const BTN_SIZE = Math.min(70 * s, (HALF - (numAxes + 1) * GAP) / numAxes);
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

  // ── Axis buttons (right half, single horizontal row) ──────────────────────
  const axisButtons = {};
  AXIS_DEFS.forEach(({ key, label, color }, i) => {
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

  function updateAxisButtons() {
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
    onAxisChange?.(axis);
  }
  updateAxisButtons();

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

    function makeArrowButton(label, sign, idx) {
      const leftPos = arrowOffsetX + GAP + idx * (BTN_SIZE + GAP);
      const btn = flock.GUI.Button.CreateSimpleButton(`gizmo-arrow-${sign}`, label);
      btn.width = `${BTN_SIZE}px`;
      btn.height = `${BTN_SIZE}px`;
      btn.fontSize = `${Math.min(40 * s, Math.floor(BTN_SIZE * 0.55))}px`;
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

      let timeoutId = null;
      let intervalId = null;
      let pressTime = 0;

      function currentStep() {
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
      return btn;
    }

    arrowNegBtn = makeArrowButton(stepLabels[0], -1, 0);
    arrowPosBtn = makeArrowButton(stepLabels[1], +1, 1);
    updateAxisButtons();
  } else {
    // ── Slider (delta-drag) ───────────────────────────────────────────────
    const THUMB_R = Math.floor(BTN_SIZE / 2) - 2 * s;
    const TRACK_H = 8 * s;
    const SLIDER_MARGIN = THUMB_R + GAP;
    const MAX_OFFSET_GUI = HALF / 2 - SLIDER_MARGIN;
    const SPEED_FACTOR = stepFast / 10;
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

    const centerMark = new flock.GUI.Rectangle('gizmoCenterMark');
    centerMark.width = `${4 * s}px`;
    centerMark.height = `${TRACK_H + 10 * s}px`;
    centerMark.background = 'rgba(255,255,255,0.55)';
    centerMark.thickness = 0;
    centerMark.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    centerMark.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    centerMark.left = `${HALF / 2 - 2 * s}px`;
    centerMark.top = `${TRACK_CENTER_Y - (TRACK_H + 10 * s) / 2}px`;
    container.addControl(centerMark);

    const thumb = new flock.GUI.Ellipse('gizmoThumb');
    thumb.width = `${THUMB_R * 2}px`;
    thumb.height = `${THUMB_R * 2}px`;
    thumb.background = 'rgba(255,255,255,0.85)';
    thumb.color = 'transparent';
    thumb.thickness = 0;
    thumb.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    thumb.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    thumb.left = `${HALF / 2 - THUMB_R}px`;
    thumb.top = `${TRACK_CENTER_Y - THUMB_R}px`;
    container.addControl(thumb);

    let thumbOffsetGUI = 0;
    let lastClientX = 0;
    let activePointer = null;
    let activeScale = 1;

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
      if (activePointer !== null) return;
      const b = sliderBounds();
      if (e.clientY < b.top || e.clientY > b.bottom) return;
      if (e.clientX < b.left || e.clientX > b.right) return;
      activePointer = e.pointerId;
      activeScale = b.scale;
      lastClientX = e.clientX;
      const clampedCSS = Math.max(-b.maxOffsetCSS, Math.min(b.maxOffsetCSS, e.clientX - b.centerX));
      thumbOffsetGUI = clampedCSS / b.scale;
      thumb.left = `${HALF / 2 - THUMB_R + thumbOffsetGUI}px`;
      thumb.background = 'rgba(255,220,50,0.95)';
    }

    function onPointerMove(e) {
      if (e.pointerId !== activePointer) return;
      const deltaCSS = e.clientX - lastClientX;
      lastClientX = e.clientX;

      const delta = deltaCSS * SPEED_FACTOR;
      if (axis === 'all') onMove(delta, delta, delta);
      else if (axis === 'x') onMove(delta, 0, 0);
      else if (axis === 'y') onMove(0, delta, 0);
      else if (axis === 'z') onMove(0, 0, delta);

      thumbOffsetGUI = Math.max(
        -MAX_OFFSET_GUI,
        Math.min(MAX_OFFSET_GUI, thumbOffsetGUI + deltaCSS / activeScale)
      );
      thumb.left = `${HALF / 2 - THUMB_R + thumbOffsetGUI}px`;
    }

    function onPointerUp(e) {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      thumb.background = 'rgba(255,255,255,0.85)';
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    // Block camera/scene for slider touches — including the initial pointerdown
    const prePointerObserver = flock.scene.onPrePointerObservable.add((info) => {
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
  stop.setAxis = (newAxis) => {
    if (stopped) return;
    const def = AXIS_DEFS.find(d => d.key === newAxis);
    if (def) { axis = newAxis; updateAxisButtons(); }
  };
  return stop;
}
