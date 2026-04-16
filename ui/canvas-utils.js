import { flock } from "../flock.js";

// Create yellow circle for canvas position indicator
// One circle selector can be active on the canvas at once
let canvasCircle = null;
let canvasCirclePosition = { x: 0, y: 0 };
let keyboardCursorActive = false;
let keyboardCursorCallback = null;
let hitChecker = null;
let previouslyFocusedElement = null; // Save previous focus to return to later

const heldKeys = new Set(); // Track held down keys

// Returns a reference to the canvasCircle
export function getCanvasCircle() {
  return canvasCircle;
}

// Destroys the canvasCircle if it exists
export function destroyCanvasCircle() {
  if (canvasCircle) {
    canvasCircle.remove();
    canvasCircle = null;
  }
}

// Creates a canvasCircle if it doesn't exist - one can be active at a time
export function createCanvasCircle() {
  if (canvasCircle) return;

  // Create the visual indicator circle
  canvasCircle = document.createElement("div");
  canvasCircle.className = "canvas-selector-circle"; // Set style
  canvasCircle.tabIndex = -1;
  document.body.appendChild(canvasCircle);

  // Initialize position to canvas center
  const canvas = flock.scene.getEngine().getRenderingCanvas();
  const canvasBounds = canvas.getBoundingClientRect();
  canvasCirclePosition.x = canvasBounds.width / 2;
  canvasCirclePosition.y = canvasBounds.height / 2;

  updateCanvasCirclePosition();
}

// Check whether current position is on a pickable mesh
function updateCanvasCircleHitState() {
  if (!canvasCircle || !hitChecker) return;
  const valid = hitChecker(canvasCirclePosition.x, canvasCirclePosition.y);
  canvasCircle.classList.toggle("canvas-selector-circle--no-hit", !valid);
}

// Update the circle position and constrain it to the canvas
export function updateCanvasCirclePosition() {
  if (!canvasCircle) return;

  const canvas = flock.scene.getEngine().getRenderingCanvas();
  const canvasBounds = canvas.getBoundingClientRect();

  // Constrain position to canvas bounds
  canvasCirclePosition.x = Math.max(
    10,
    Math.min(canvasBounds.width - 10, canvasCirclePosition.x),
  );
  canvasCirclePosition.y = Math.max(
    10,
    Math.min(canvasBounds.height - 10, canvasCirclePosition.y),
  );

  // Position relative to canvas
  canvasCircle.style.left = canvasBounds.left + canvasCirclePosition.x + "px";
  canvasCircle.style.top = canvasBounds.top + canvasCirclePosition.y + "px";
  updateCanvasCircleHitState();
}

// Changes the coordinates of the canvasCircle
// Specify minus numbers to move left/up
// Auto updates the rendered position to keep in sync
export function moveCanvasCircle(dx, dy) {
  canvasCirclePosition.x += dx;
  canvasCirclePosition.y += dy;
  updateCanvasCirclePosition();
}

// Calls the callback with the current canvasCircle coordinates if it exists
export function clickCanvasCircle(callback) {
  if (canvasCircle) {
    callback(canvasCirclePosition.x, canvasCirclePosition.y);
  }
}

// Start keyboard mode on the canvas
export function startCanvasKeyboardMode(
  callback,
  showCircleImmediately = false,
  isValidPosition = null,
) {
  stopCanvasKeyboardMode(); // Ensure any existing mode is cleared
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyup);
  previouslyFocusedElement = document.activeElement; // Save current focus
  keyboardCursorActive = true;
  keyboardCursorCallback = callback;
  hitChecker = isValidPosition;
  document.addEventListener("keydown", handleKeydown);
  if (showCircleImmediately) {
    createCanvasCircle();

    canvasCircle.focus({ preventScroll: true }); // Focus the circle
    document.body.style.cursor = "none"; // Hide cursor when circle is active
  } else {
    document.body.style.cursor = "default";
  }
}

// Stop using keyboard mode on the canvas
export function stopCanvasKeyboardMode() {
  keyboardCursorActive = false;
  keyboardCursorCallback = null;
  hitChecker = null;
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("keyup", handleKeyup);
  heldKeys.clear();
  destroyCanvasCircle();
  // Reinstate mouse cursor when exiting keyboard mode
  const canvas = flock.scene?.getEngine?.()?.getRenderingCanvas?.();
  if (canvas) canvas.style.cursor = "";
  document.body.style.cursor = "default";
  // Reinstate focus to element in focus prior to entering
  // canvas cursor mode (otherwise this is annoying for kb users)
  previouslyFocusedElement?.focus({ preventScroll: true });
  previouslyFocusedElement = null;
}

// Make sure there actually is a circle
function ensureCircle() {
  if (!getCanvasCircle()) {
    createCanvasCircle();
    canvasCircle.focus({ preventScroll: true }); // Focus the circle
    // Remove cursor otherwise you get both which is confusing
    const canvas = flock.scene.getEngine().getRenderingCanvas();
    canvas.style.cursor = "none";
    document.body.style.cursor = "none";
  }
}

// Deal with key down events for canvas keyboard mode
function handleKeydown(event) {
  if (!keyboardCursorActive) return;

  // If a button was focused and they pressed enter/space, don't
  // move the circle, interact with the button
  const tag = (event.target?.tagName || "").toLowerCase();
  if (
    (tag === "button" ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      event.target?.isContentEditable) &&
    (event.key === "Enter" || event.key === " " || event.key === "Spacebar")
  ) {
    console.log("Button interaction, not moving canvas circle");
    return;
  }
  const moveDistance = event.shiftKey ? 10 : 2;
  switch (event.key) {
    case "ArrowRight":
    case "ArrowLeft":
    case "ArrowDown":
    case "ArrowUp":
      event.preventDefault();
      heldKeys.add(event.key);
      ensureCircle();
      // Calculate where to move
      const dx =
        (heldKeys.has("ArrowRight") ? moveDistance : 0) -
        (heldKeys.has("ArrowLeft") ? moveDistance : 0);
      const dy =
        (heldKeys.has("ArrowDown") ? moveDistance : 0) -
        (heldKeys.has("ArrowUp") ? moveDistance : 0);
      moveCanvasCircle(dx, dy);
      break;

    // Tab is assumed to restart keyboard nav mode
    case "Tab":
      event.preventDefault(); // don't actually tab!
      stopCanvasKeyboardMode();
      break;

    case "Enter":
    case " ":
    case "Spacebar":
    case "Space":
      event.preventDefault();
      ensureCircle(); // It must exist to click it
      // If there's a hitChecker and it returns false
      // show invalid press animation instead of clicking
      if (
        hitChecker &&
        !hitChecker(canvasCirclePosition.x, canvasCirclePosition.y)
      ) {
        canvasCircle.classList.add("canvas-selector-circle--invalid-press");
        canvasCircle.addEventListener(
          "animationend",
          () => {
            canvasCircle.classList.remove(
              "canvas-selector-circle--invalid-press",
            );
          },
          { once: true },
        );
      } else {
        // The location was valid, do the click
        clickCanvasCircle(keyboardCursorCallback);
      }
      break;

    case "Escape":
      event.preventDefault();
      stopCanvasKeyboardMode();
      break;

    default:
      break;
  }
}

// Remove from heldKeys when key is released
function handleKeyup(event) {
  heldKeys.delete(event.key);
}
