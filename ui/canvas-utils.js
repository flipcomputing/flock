import { flock } from "../flock.js";

// Create yellow circle for canvas position indicator
// One circle selector can be active on the canvas at once
let canvasCircle = null;
let canvasCirclePosition = { x: 0, y: 0 };

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
  document.body.appendChild(canvasCircle);

  // Initialize position to canvas center
  const canvas = flock.scene.getEngine().getRenderingCanvas();
  const canvasBounds = canvas.getBoundingClientRect();
  canvasCirclePosition.x = canvasBounds.width / 2;
  canvasCirclePosition.y = canvasBounds.height / 2;

  updateCanvasCirclePosition();
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
