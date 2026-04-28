import { flock } from "../flock.js";

// A generic handler to be used for axis-constrained
// keyboard movement in various tools (move, scale, etc)
export function createAxisKeyboardHandler({
  onMove,
  onConfirm,
  onCancel,
  stepNormal = 0.1,
  stepFast = 1,
}) {
  let axis = null;

  function handler(event) {
    
    const t = event.target;
    // Don't capture keys when focus is in the code panel, top menu, or docs
    if (t?.closest?.("#codePanel, header, #info-details")) return;
     // Don't interfere with text inputs
    const tag = (t?.tagName || "").toLowerCase();
    if (t?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select") return;
    
    const step = event.shiftKey ? stepFast : stepNormal;

    switch (event.key) {
      case "x":
      case "X":
        axis = axis === "x" ? null : "x";
        flock.printText({
          text: axis ? "X axis" : "Free",
          duration: 10,
          color: "black",
        });
        event.preventDefault();
        break;

      case "y":
      case "Y":
        axis = axis === "y" ? null : "y";
        flock.printText({
          text: axis ? "Y axis" : "Free",
          duration: 10,
          color: "black",
        });
        event.preventDefault();
        break;

      case "z":
      case "Z":
        axis = axis === "z" ? null : "z";
        flock.printText({
          text: axis ? "Z axis" : "Free",
          duration: 10,
          color: "black",
        });
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
        if (axis) {
          onMove(
            axis === "x" ? step * sign : 0,
            axis === "y" ? step * sign : 0,
            axis === "z" ? step * sign : 0,
          );
        } else {
          if (event.key === "ArrowRight") onMove(step, 0, 0);
          else if (event.key === "ArrowLeft") onMove(-step, 0, 0);
          else if (event.key === "ArrowUp") onMove(0, 0, step);
          else if (event.key === "ArrowDown") onMove(0, 0, -step);
        }
        break;
      }

      case "PageUp":
        event.preventDefault();
        event.stopPropagation(); 
        if (!axis) onMove(0, step, 0);
        break;

      case "PageDown":
        event.preventDefault();
        event.stopPropagation(); 
        if (!axis) onMove(0, -step, 0);
        break;

      case "Enter":
      case " ": {
        event.preventDefault();
        try {
          onConfirm();
        } finally {
          stop();
        }
        break;
      }

      case "Escape":
        event.preventDefault();
        try {
          onCancel();
        } finally {
          stop();
        }
        break;
    }
  }

  document.addEventListener("keydown", handler, true);

  function stop() {
    axis = null;
    document.removeEventListener("keydown", handler, true);
  }

  return stop;
}
