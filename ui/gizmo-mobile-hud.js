import { flock } from "../flock.js";
import { translate } from "../main/translation.js";

const fontFamily = "Atkinson Hyperlegible Next";

function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function createGizmoMobileHud({
  onMove,
  stepNormal,
  stepFast,
  mode = "slider",
  showUniform = false,
  stepLabels = ["◁", "▷"],
}) {
  if (!isTouchDevice()) return null;
  if (!flock.scene || !flock.canvas || !flock.GUI) return null;

  const s = flock.displayScale ?? 1;
  const canvas = flock.canvas;

  const savedControls = flock.controlsTexture ?? null;
  if (savedControls) savedControls.rootContainer.isVisible = false;
  if (flock._joystickSource) flock._joystickSource.pause();

  const hudTexture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
    "GizmoHUD",
    true,
    flock.scene,
  );

  // ── Axis state ────────────────────────────────────────────────────────────
  let axis = "x";

  const AXIS_DEFS = [
    { key: "x", label: "X", color: "#0072B2" },
    { key: "y", label: "Y", color: "#009E73" },
    { key: "z", label: "Z", color: "#D55E00" },
    ...(showUniform ? [{ key: "all", label: "*", color: "#aaaaaa" }] : []),
  ];
  const numAxes = AXIS_DEFS.length;

  // ── Layout ────────────────────────────────────────────────────────────────
  const GAP = 6 * s;
  const HALF = canvas.width / 2;
  const BTN_H = 44 * s;
  const TOTAL_H = BTN_H + 2 * GAP;

  // ── Transparent container ─────────────────────────────────────────────────
  const container = new flock.GUI.Rectangle("gizmoHudContainer");
  container.width = `${canvas.width}px`;
  container.height = `${TOTAL_H}px`;
  container.background = "transparent";
  container.thickness = 0;
  container.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  container.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  container.isPointerBlocker = false;
  hudTexture.addControl(container);

  // ── Axis buttons (right half, single horizontal row) ──────────────────────
  const BTN_W = (HALF - (numAxes + 1) * GAP) / numAxes;

  const axisButtons = {};
  AXIS_DEFS.forEach(({ key, label, color }, i) => {
    const btn = flock.GUI.Button.CreateSimpleButton(`gizmo-axis-${key}`, label);
    btn.width = `${BTN_W}px`;
    btn.height = `${BTN_H}px`;
    btn.fontSize = `${24 * s}px`;
    btn.fontFamily = fontFamily;
    btn.cornerRadius = 8 * s;
    btn.thickness = 3 * s;
    btn.isPointerBlocker = true;
    btn.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    btn.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    btn.left = `${HALF + GAP + i * (BTN_W + GAP)}px`;
    btn.top = `${GAP}px`;
    container.addControl(btn);
    axisButtons[key] = btn;
  });

  function updateAxisButtons() {
    for (const { key, color } of AXIS_DEFS) {
      const active = axis === key;
      axisButtons[key].background = active ? color : "rgba(0,0,0,0.45)";
      axisButtons[key].color = active ? "white" : color;
    }
  }
  updateAxisButtons();

  AXIS_DEFS.forEach(({ key }) => {
    axisButtons[key].onPointerUpObservable.add(() => {
      if (axis !== key) {
        axis = key;
        flock.printText({
          text: translate(key === "all" ? "axis_all" : `axis_${key}`),
          duration: 10,
          color: "black",
        });
        updateAxisButtons();
      }
    });
  });

  // ── Left half: slider or arrow buttons ───────────────────────────────────
  const cleanups = [];

  if (mode === "arrows") {
    // ── Arrow buttons (◁ ▷) with tap-and-hold repeat ─────────────────────
    const ARROW_W = HALF / 2 - GAP * 1.5;

    function makeArrowButton(label, sign, leftPos) {
      const btn = flock.GUI.Button.CreateSimpleButton(`gizmo-arrow-${sign}`, label);
      btn.width = `${ARROW_W}px`;
      btn.height = `${BTN_H}px`;
      btn.fontSize = `${30 * s}px`;
      btn.fontFamily = fontFamily;
      btn.cornerRadius = 8 * s;
      btn.background = "rgba(0,0,0,0.45)";
      btn.color = "rgba(255,255,255,0.9)";
      btn.thickness = 0;
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
        if (axis === "all") onMove(d, d, d);
        else if (axis === "x") onMove(d, 0, 0);
        else if (axis === "y") onMove(0, d, 0);
        else if (axis === "z") onMove(0, 0, d);
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
    }

    makeArrowButton(stepLabels[0], -1, GAP);
    makeArrowButton(stepLabels[1], +1, GAP + ARROW_W + GAP);

  } else {
    // ── Slider (delta-drag) ───────────────────────────────────────────────
    const THUMB_R = Math.floor(BTN_H / 2) - 2 * s;
    const TRACK_H = 8 * s;
    const SLIDER_MARGIN = THUMB_R + GAP;
    const MAX_OFFSET_GUI = HALF / 2 - SLIDER_MARGIN;
    const SPEED_FACTOR = stepFast / 10;
    const TRACK_CENTER_Y = TOTAL_H / 2;

    const track = new flock.GUI.Rectangle("gizmoTrack");
    track.width = `${HALF - 2 * SLIDER_MARGIN}px`;
    track.height = `${TRACK_H}px`;
    track.background = "rgba(255,255,255,0.3)";
    track.thickness = 0;
    track.cornerRadius = TRACK_H / 2;
    track.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    track.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    track.left = `${SLIDER_MARGIN}px`;
    track.top = `${TRACK_CENTER_Y - TRACK_H / 2}px`;
    container.addControl(track);

    const centerMark = new flock.GUI.Rectangle("gizmoCenterMark");
    centerMark.width = `${4 * s}px`;
    centerMark.height = `${TRACK_H + 10 * s}px`;
    centerMark.background = "rgba(255,255,255,0.55)";
    centerMark.thickness = 0;
    centerMark.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    centerMark.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    centerMark.left = `${HALF / 2 - 2 * s}px`;
    centerMark.top = `${TRACK_CENTER_Y - (TRACK_H + 10 * s) / 2}px`;
    container.addControl(centerMark);

    const thumb = new flock.GUI.Ellipse("gizmoThumb");
    thumb.width = `${THUMB_R * 2}px`;
    thumb.height = `${THUMB_R * 2}px`;
    thumb.background = "rgba(255,255,255,0.85)";
    thumb.color = "transparent";
    thumb.thickness = 0;
    thumb.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    thumb.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    thumb.left = `${HALF / 2 - THUMB_R}px`;
    thumb.top = `${TRACK_CENTER_Y - THUMB_R}px`;
    container.addControl(thumb);

    let thumbOffsetGUI = 0;
    let lastClientX = 0;
    let activePointer = null;

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
      lastClientX = e.clientX;
      const clampedCSS = Math.max(-b.maxOffsetCSS, Math.min(b.maxOffsetCSS, e.clientX - b.centerX));
      thumbOffsetGUI = clampedCSS / b.scale;
      thumb.left = `${HALF / 2 - THUMB_R + thumbOffsetGUI}px`;
      thumb.background = "rgba(255,220,50,0.95)";
    }

    function onPointerMove(e) {
      if (e.pointerId !== activePointer) return;
      const deltaCSS = e.clientX - lastClientX;
      lastClientX = e.clientX;

      const delta = deltaCSS * SPEED_FACTOR;
      if (axis === "all") onMove(delta, delta, delta);
      else if (axis === "x") onMove(delta, 0, 0);
      else if (axis === "y") onMove(0, delta, 0);
      else if (axis === "z") onMove(0, 0, delta);

      const b = sliderBounds();
      thumbOffsetGUI = Math.max(
        -MAX_OFFSET_GUI,
        Math.min(MAX_OFFSET_GUI, thumbOffsetGUI + deltaCSS / b.scale),
      );
      thumb.left = `${HALF / 2 - THUMB_R + thumbOffsetGUI}px`;
    }

    function onPointerUp(e) {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      thumb.background = "rgba(255,255,255,0.85)";
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // Block camera/scene for slider touches — including the initial pointerdown
    const prePointerObserver = flock.scene.onPrePointerObservable.add((info) => {
      const e = info.event;
      if (activePointer !== null && e.pointerId === activePointer) {
        info.skipOnPointerObservable = true;
        return;
      }
      if (e.type === "pointerdown") {
        const b = sliderBounds();
        if (e.clientY >= b.top && e.clientY <= b.bottom &&
            e.clientX >= b.left && e.clientX <= b.right) {
          info.skipOnPointerObservable = true;
        }
      }
    });

    cleanups.push(() => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      flock.scene.onPrePointerObservable.remove(prePointerObserver);
    });
  }

  // ── Stop / cleanup ────────────────────────────────────────────────────────
  let stopped = false;
  return function stop() {
    if (stopped) return;
    stopped = true;
    cleanups.forEach((fn) => fn());
    hudTexture.dispose();
    if (savedControls) savedControls.rootContainer.isVisible = true;
    if (flock._joystickSource) flock._joystickSource.resume();
  };
}
