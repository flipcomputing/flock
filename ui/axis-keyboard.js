import { KeyboardDispatcher } from "../main/keyboardDispatcher.js";
import { showStatus, clearStatus } from "./status.js";
import { translate } from "../main/translation.js";

const AXIS_LOCK_KEYS = {
  x: "axis_lock_x",
  y: "axis_lock_y",
  z: "axis_lock_z",
  all: "axis_lock_all",
};

function reportAxis(axis) {
  if (!axis) {
    clearStatus("axis");
    return;
  }
  showStatus(`🔒 ${translate(AXIS_LOCK_KEYS[axis])}`, { duration: 10, owner: "axis" });
}

// A generic handler to be used for axis-constrained
// keyboard movement in various tools (move, scale, etc)
export function createAxisKeyboardHandler({
  onMove,
  onConfirm,
  onCancel,
  stepNormal = 0.1,
  stepFast = 1,
  onAxisChange,
  initialAxis = null,
  allowUniform = false,
}) {
  // "all" (uniform) is only valid when uniform mode is enabled. In non-uniform
  // tools, collapse any inherited/incoming "all" (e.g. carried over from the
  // scale tool) to a single axis so Arrow/Page movement stays axis-constrained.
  const normalizeAxis = (a) => (a === "all" && !allowUniform ? "x" : a);
  let axis = normalizeAxis(initialAxis);

  function handler(event) {
    const t = event.target;
    // Don't capture keys when focus is in the code panel, top menu, or docs
    if (t?.closest?.("#codePanel, header, #info-panel, #shapes-dropdown, .custom-color-picker")) return;
    // Don't interfere with text inputs
    const tag = (t?.tagName || "").toLowerCase();
    if (
      t?.isContentEditable ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "select"
    )
      return;

    const step = event.shiftKey ? stepNormal : stepFast;

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    switch (event.key) {
      case "x":
      case "X":
        axis = axis === "x" ? null : "x";
        reportAxis(axis);
        onAxisChange?.(axis);
        event.preventDefault();
        break;

      case "y":
      case "Y":
        axis = axis === "y" ? null : "y";
        reportAxis(axis);
        onAxisChange?.(axis);
        event.preventDefault();
        break;

      case "z":
      case "Z":
        axis = axis === "z" ? null : "z";
        reportAxis(axis);
        onAxisChange?.(axis);
        event.preventDefault();
        break;

      case "u":
      case "U":
        // Uniform (all-axes) only applies to scale; ignore on move/rotate.
        if (!allowUniform) break;
        axis = axis === "all" ? null : "all";
        reportAxis(axis);
        onAxisChange?.(axis);
        event.preventDefault();
        break;

      case "ArrowRight":
      case "ArrowLeft":
      case "ArrowUp":
      case "ArrowDown": {
        event.preventDefault();
        event.stopPropagation();
        const sign =
          event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
        if (axis === "all") {
          onMove(step * sign, step * sign, step * sign);
        } else if (axis) {
          onMove(
            axis === "x" ? step * sign : 0,
            axis === "y" ? step * sign : 0,
            axis === "z" ? step * sign : 0,
          );
        } else {
          if (event.key === "ArrowRight") { onMove(step, 0, 0); onAxisChange?.("x"); }
          else if (event.key === "ArrowLeft") { onMove(-step, 0, 0); onAxisChange?.("x"); }
          else if (event.key === "ArrowUp") { onMove(0, 0, step); onAxisChange?.("z"); }
          else if (event.key === "ArrowDown") { onMove(0, 0, -step); onAxisChange?.("z"); }
        }
        break;
      }

      case "PageUp":
        event.preventDefault();
        event.stopPropagation();
        if (axis === "all") onMove(step, step, step);
        else if (!axis) { onMove(0, step, 0); onAxisChange?.("y"); }
        break;

      case "PageDown":
        event.preventDefault();
        event.stopPropagation();
        if (axis === "all") onMove(-step, -step, -step);
        else if (!axis) { onMove(0, -step, 0); onAxisChange?.("y"); }
        break;

      case "Enter":
      case " ": {
        event.preventDefault();
        event.stopPropagation();
        try {
          onConfirm();
        } finally {
          stop();
        }
        break;
      }

      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        try {
          onCancel();
        } finally {
          stop();
        }
        break;
    }
  }

  KeyboardDispatcher.pushMode(handler, "axis-keyboard");

  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    axis = null;
    clearStatus("axis");
    KeyboardDispatcher.popMode();
  }
  stop.getAxis = () => axis;
  stop.setAxis = (newAxis) => { axis = normalizeAxis(newAxis); };

  return stop;
}
