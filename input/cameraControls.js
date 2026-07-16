// Drives the active camera each frame from gamepad look input and movement
// input (gamepad stick, on-screen joystick, or WASD). Joystick and keyboard
// are read directly from their sources: fly mode hides them from
// InputManager, and gamepad polling rewrites the shared MOVE axes anyway.

const YAW_SPEED = 2.5;
const PITCH_SPEED = 2.0;
const FLY_SPEED = 3.0;

export class CameraControls {
  #flock;
  #scene = null;
  #observer = null;

  constructor(flock) {
    this.#flock = flock;
  }

  start() {
    if (this.#observer) return;
    this.#scene = this.#flock.scene;
    this.#observer = this.#scene.onBeforeRenderObservable.add(() => this.#update());
  }

  stop() {
    if (!this.#observer) return;
    this.#scene.onBeforeRenderObservable.remove(this.#observer);
    this.#observer = null;
    this.#scene = null;
  }

  // Movement precedence: gamepad axis, then joystick, then physical keys.
  #resolveMoveAxis(axis, joyValue, negKey, posKey) {
    const kb = this.#flock._keyboardSource;
    return (
      this.#flock.inputManager.getAxis(axis) ||
      joyValue ||
      (kb?.isKeyDown(posKey) ? 1 : kb?.isKeyDown(negKey) ? -1 : 0)
    );
  }

  #update() {
    const flock = this.#flock;
    const rightX = flock.inputManager.getAxis('LOOK_X');
    const rightY = flock.inputManager.getAxis('LOOK_Y');
    const shoulderTurn = flock.inputManager.getAxis('TURN');
    const yawInput = rightX + shoulderTurn;

    const joy = flock._joystickSource?.getMove();
    const moveX = this.#resolveMoveAxis('MOVE_X', joy?.x ?? 0, 'a', 'd');
    const moveY = this.#resolveMoveAxis('MOVE_Y', joy?.y ?? 0, 'w', 's');

    if (!yawInput && !rightY && !moveX && !moveY) {
      return;
    }

    if (flock._canvasControlsEnabled === false) {
      return;
    }

    const camera = this.#scene.activeCamera;

    if (!camera) {
      return;
    }

    const deltaTime = (flock.engine?.getDeltaTime?.() ?? 16) / 1000;
    const yawDelta = yawInput * YAW_SPEED * deltaTime;
    const pitchDelta = rightY * PITCH_SPEED * deltaTime;

    if (camera.getClassName?.() === 'ArcRotateCamera') {
      camera.alpha -= yawDelta;
      camera.beta -= pitchDelta;

      const lowerBeta = camera.lowerBetaLimit ?? 0.01;
      const upperBeta = camera.upperBetaLimit ?? Math.PI - 0.01;

      camera.beta = Math.min(upperBeta, Math.max(lowerBeta, camera.beta));
    } else {
      camera.rotation.y += yawDelta;
      camera.rotation.x += pitchDelta;

      const minPitch = -Math.PI / 2 + 0.01;
      const maxPitch = Math.PI / 2 - 0.01;

      camera.rotation.x = Math.min(maxPitch, Math.max(minPitch, camera.rotation.x));

      if (moveX || moveY) {
        const forward = camera.getDirection(new flock.BABYLON.Vector3(0, 0, 1));
        const right = camera.getDirection(new flock.BABYLON.Vector3(1, 0, 0));
        camera.position.addInPlace(forward.scale(-moveY * FLY_SPEED * deltaTime));
        camera.position.addInPlace(right.scale(moveX * FLY_SPEED * deltaTime));
      }
    }
  }
}
