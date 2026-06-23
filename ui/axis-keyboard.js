import { flock } from "../flock.js";
import { KeyboardDispatcher } from "../main/keyboardDispatcher.js";
import { translate } from "../main/translation.js";

// A generic handler to be used for axis-constrained
// keyboard movement in various tools (move, scale, etc)
export function createAxisKeyboardHandler({
  onMove,
  onConfirm,
  onCancel,
  stepNormal = 0.1,
  stepFast = 1,
  onAxisChange,
}) {
  let axis = null;

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
        flock.printText({
          text: axis ? translate("axis_x") : translate("axis_free"),
          duration: 10,
          color: "black",
        });
        onAxisChange?.(axis);
        event.preventDefault();
        break;

      case "y":
      case "Y":
        axis = axis === "y" ? null : "y";
        flock.printText({
          text: axis ? translate("axis_y") : translate("axis_free"),
          duration: 10,
          color: "black",
        });
        onAxisChange?.(axis);
        event.preventDefault();
        break;

      case "z":
      case "Z":
        axis = axis === "z" ? null : "z";
        flock.printText({
          text: axis ? translate("axis_z") : translate("axis_free"),
          duration: 10,
          color: "black",
        });
        onAxisChange?.(axis);
        event.preventDefault();
        break;

      case "u":
      case "U":
        axis = axis === "all" ? null : "all";
        flock.printText({
          text: axis ? `★ ${translate("axis_all")}` : translate("axis_free"),
          duration: 10,
          color: "black",
        });
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
    KeyboardDispatcher.popMode();
  }

  return stop;
}
