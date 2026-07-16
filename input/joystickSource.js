const DEAD_ZONE = 0.2;
const SHIM_THRESHOLD = 0.3;

export class JoystickSource {
  #inputManager;
  #onScreenSource;
  #canvas;
  #baseEllipse;
  #thumbEllipse;
  #baseRadius;
  #thumbRadius;
  #scene;

  #started = false;
  #paused = false;
  #activePointerId = null;
  #prePointerObserver = null;

  #dx = 0;
  #dy = 0;

  #heldForward = false;
  #heldBackward = false;
  #heldLeft = false;
  #heldRight = false;

  #boundPointerDown;
  #boundPointerMove;
  #boundPointerUp;

  constructor(inputManager, onScreenSource, { canvas, baseEllipse, thumbEllipse, baseRadius, thumbRadius = 0, scene } = {}) {
    this.#inputManager = inputManager;
    this.#onScreenSource = onScreenSource;
    this.#canvas = canvas;
    this.#baseEllipse = baseEllipse;
    this.#thumbEllipse = thumbEllipse;
    this.#baseRadius = baseRadius;
    this.#thumbRadius = thumbRadius;
    this.#scene = scene ?? null;

    this.#boundPointerDown = this.#handlePointerDown.bind(this);
    this.#boundPointerMove = this.#handlePointerMove.bind(this);
    this.#boundPointerUp = this.#handlePointerUp.bind(this);
  }

  start() {
    if (this.#started) return;
    this.#started = true;

    // Suppress Babylon camera rotation for touches on or tracked by the joystick.
    if (this.#scene) {
      this.#prePointerObserver = this.#scene.onPrePointerObservable.add((info) => {
        const pid = info.event.pointerId;
        if (this.#activePointerId !== null && pid === this.#activePointerId) {
          info.skipOnPointerObservable = true;
          return;
        }
        if (info.event.type === 'pointerdown') {
          const { cx, cy, r } = this.#computeBaseLayout();
          const dx = (info.event.clientX - cx) / r;
          const dy = (info.event.clientY - cy) / r;
          if (Math.sqrt(dx * dx + dy * dy) <= 1) {
            info.skipOnPointerObservable = true;
          }
        }
      });
    }

    this.#canvas.addEventListener('pointerdown', this.#boundPointerDown);
    this.#canvas.addEventListener('pointermove', this.#boundPointerMove);
    this.#canvas.addEventListener('pointerup', this.#boundPointerUp);
    this.#canvas.addEventListener('pointercancel', this.#boundPointerUp);
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;

    if (this.#scene && this.#prePointerObserver) {
      this.#scene.onPrePointerObservable.remove(this.#prePointerObserver);
      this.#prePointerObserver = null;
    }

    this.#canvas.removeEventListener('pointerdown', this.#boundPointerDown);
    this.#canvas.removeEventListener('pointermove', this.#boundPointerMove);
    this.#canvas.removeEventListener('pointerup', this.#boundPointerUp);
    this.#canvas.removeEventListener('pointercancel', this.#boundPointerUp);
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

  // Raw stick state for engine reads; zero while paused or in the dead zone.
  getMove() {
    if (this.#paused) return { x: 0, y: 0 };
    const mag = Math.sqrt(this.#dx * this.#dx + this.#dy * this.#dy);
    if (mag < DEAD_ZONE) return { x: 0, y: 0 };
    return { x: this.#dx, y: this.#dy };
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

  // Base centre and radius in CSS pixels; #baseRadius is in device-pixel units.
  #computeBaseLayout() {
    const rect = this.#canvas.getBoundingClientRect();
    const r = this.#baseRadius * (rect.width / this.#canvas.width);
    return { cx: rect.left + r, cy: rect.bottom - r, r };
  }

  #handlePointerDown(event) {
    if (this.#activePointerId !== null) return;

    const { cx, cy, r } = this.#computeBaseLayout();
    const rawDx = (event.clientX - cx) / r;
    const rawDy = (event.clientY - cy) / r;
    const mag = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

    if (mag > 1) return;

    this.#activePointerId = event.pointerId;
    this.#updateStick(event.clientX, event.clientY);
  }

  #handlePointerMove(event) {
    if (event.pointerId !== this.#activePointerId) return;
    this.#updateStick(event.clientX, event.clientY);
  }

  #handlePointerUp(event) {
    if (event.pointerId !== this.#activePointerId) return;
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
    const { cx, cy, r } = this.#computeBaseLayout();
    let dx = (clientX - cx) / r;
    let dy = (clientY - cy) / r;

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
    const maxOffset = this.#baseRadius - this.#thumbRadius;
    this.#thumbEllipse.left = `${dx * maxOffset}px`;
    this.#thumbEllipse.top = `${dy * maxOffset}px`;
  }
}
