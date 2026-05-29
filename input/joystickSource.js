const DEAD_ZONE = 0.2;
const SHIM_THRESHOLD = 0.5;

export class JoystickSource {
  #inputManager;
  #onScreenSource;
  #canvas;
  #baseEllipse;
  #thumbEllipse;
  #baseRadius;

  #started = false;
  #paused = false;
  #activePointerId = null;

  #dx = 0;
  #dy = 0;

  #heldForward = false;
  #heldBackward = false;
  #heldLeft = false;
  #heldRight = false;

  #boundPointerDown;
  #boundPointerMove;
  #boundPointerUp;

  constructor(inputManager, onScreenSource, { canvas, baseEllipse, thumbEllipse, baseRadius } = {}) {
    this.#inputManager = inputManager;
    this.#onScreenSource = onScreenSource;
    this.#canvas = canvas;
    this.#baseEllipse = baseEllipse;
    this.#thumbEllipse = thumbEllipse;
    this.#baseRadius = baseRadius;

    this.#boundPointerDown = this.#handlePointerDown.bind(this);
    this.#boundPointerMove = this.#handlePointerMove.bind(this);
    this.#boundPointerUp = this.#handlePointerUp.bind(this);
  }

  start() {
    if (this.#started) return;
    this.#started = true;
    // Capture phase so we run before Babylon's bubble-phase camera listeners
    this.#canvas.addEventListener('pointerdown', this.#boundPointerDown, { capture: true });
    this.#canvas.addEventListener('pointermove', this.#boundPointerMove, { capture: true });
    this.#canvas.addEventListener('pointerup', this.#boundPointerUp, { capture: true });
    this.#canvas.addEventListener('pointercancel', this.#boundPointerUp, { capture: true });
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;
    this.#canvas.removeEventListener('pointerdown', this.#boundPointerDown, { capture: true });
    this.#canvas.removeEventListener('pointermove', this.#boundPointerMove, { capture: true });
    this.#canvas.removeEventListener('pointerup', this.#boundPointerUp, { capture: true });
    this.#canvas.removeEventListener('pointercancel', this.#boundPointerUp, { capture: true });
    this.releaseAll();
  }

  pause() {
    if (this.#paused) return;
    this.#paused = true;
    this.#onScreenSource.pause();
    this.#inputManager._setAxis('MOVE_X', 0);
    this.#inputManager._setAxis('MOVE_Y', 0);
  }

  resume() {
    if (!this.#paused) return;
    this.#paused = false;
    this.#heldForward = false;
    this.#heldBackward = false;
    this.#heldLeft = false;
    this.#heldRight = false;
    this.#onScreenSource.resume();
  }

  releaseAll() {
    this.#heldForward = false;
    this.#heldBackward = false;
    this.#heldLeft = false;
    this.#heldRight = false;
    this.#onScreenSource.releaseAll();
    this.#inputManager._setAxis('MOVE_X', 0);
    this.#inputManager._setAxis('MOVE_Y', 0);
    this.#dx = 0;
    this.#dy = 0;
    this.#resetThumb();
    this.#activePointerId = null;
  }

  #computeBaseCenter() {
    const rect = this.#canvas.getBoundingClientRect();
    return {
      x: rect.left + this.#baseRadius,
      y: rect.bottom - this.#baseRadius,
    };
  }

  #handlePointerDown(event) {
    if (this.#activePointerId !== null) return;

    const center = this.#computeBaseCenter();
    const rawDx = (event.clientX - center.x) / this.#baseRadius;
    const rawDy = (event.clientY - center.y) / this.#baseRadius;
    const mag = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

    if (mag > 1) return;

    event.stopPropagation();
    this.#activePointerId = event.pointerId;
    this.#updateStick(event.clientX, event.clientY);
  }

  #handlePointerMove(event) {
    if (event.pointerId !== this.#activePointerId) return;
    event.stopPropagation();
    this.#updateStick(event.clientX, event.clientY);
  }

  #handlePointerUp(event) {
    if (event.pointerId !== this.#activePointerId) return;
    event.stopPropagation();
    this.#activePointerId = null;
    this.#dx = 0;
    this.#dy = 0;
    this.#resetThumb();
    if (!this.#paused) {
      this.#releaseShimKeys();
      this.#inputManager._setAxis('MOVE_X', 0);
      this.#inputManager._setAxis('MOVE_Y', 0);
    }
  }

  #updateStick(clientX, clientY) {
    const center = this.#computeBaseCenter();
    let dx = (clientX - center.x) / this.#baseRadius;
    let dy = (clientY - center.y) / this.#baseRadius;

    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }

    this.#dx = dx;
    this.#dy = dy;

    this.#updateThumb(dx, dy);

    if (!this.#paused) {
      this.#applyInputs(dx, dy);
    }
  }

  #applyInputs(dx, dy) {
    const mag = Math.sqrt(dx * dx + dy * dy);

    if (mag < DEAD_ZONE) {
      this.#releaseShimKeys();
      this.#inputManager._setAxis('MOVE_X', 0);
      this.#inputManager._setAxis('MOVE_Y', 0);
      return;
    }

    const wantForward = dy < -SHIM_THRESHOLD;
    const wantBackward = dy > SHIM_THRESHOLD;
    const wantLeft = dx < -SHIM_THRESHOLD;
    const wantRight = dx > SHIM_THRESHOLD;

    if (wantForward && !this.#heldForward) {
      this.#onScreenSource.press('w');
      this.#heldForward = true;
    } else if (!wantForward && this.#heldForward) {
      this.#onScreenSource.release('w');
      this.#heldForward = false;
    }

    if (wantBackward && !this.#heldBackward) {
      this.#onScreenSource.press('s');
      this.#heldBackward = true;
    } else if (!wantBackward && this.#heldBackward) {
      this.#onScreenSource.release('s');
      this.#heldBackward = false;
    }

    if (wantLeft && !this.#heldLeft) {
      this.#onScreenSource.press('a');
      this.#heldLeft = true;
    } else if (!wantLeft && this.#heldLeft) {
      this.#onScreenSource.release('a');
      this.#heldLeft = false;
    }

    if (wantRight && !this.#heldRight) {
      this.#onScreenSource.press('d');
      this.#heldRight = true;
    } else if (!wantRight && this.#heldRight) {
      this.#onScreenSource.release('d');
      this.#heldRight = false;
    }

    this.#inputManager._setAxis('MOVE_X', dx);
    this.#inputManager._setAxis('MOVE_Y', dy);
  }

  #releaseShimKeys() {
    if (this.#heldForward) { this.#onScreenSource.release('w'); this.#heldForward = false; }
    if (this.#heldBackward) { this.#onScreenSource.release('s'); this.#heldBackward = false; }
    if (this.#heldLeft) { this.#onScreenSource.release('a'); this.#heldLeft = false; }
    if (this.#heldRight) { this.#onScreenSource.release('d'); this.#heldRight = false; }
  }

  #resetThumb() {
    if (!this.#thumbEllipse) return;
    this.#thumbEllipse.left = '0px';
    this.#thumbEllipse.top = '0px';
  }

  #updateThumb(dx, dy) {
    if (!this.#thumbEllipse) return;
    this.#thumbEllipse.left = `${dx * this.#baseRadius}px`;
    this.#thumbEllipse.top = `${dy * this.#baseRadius}px`;
  }
}
