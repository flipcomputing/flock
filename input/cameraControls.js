// Drives the active camera each frame: gamepad look, movement (stick,
// joystick, WASD), and orbit-view rotation/zoom from the InputManager.

const YAW_SPEED = 2.5;
const PITCH_SPEED = 2.0;
export const FLY_SPEED = 3.0;
// Orbit-view zoom: fraction of radius per second while held (~49%/s).
const ORBIT_ZOOM_RATE = 0.4;

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

  // InputManager plus KeyboardSource and OnScreenSource (physical keys and
  // on-screen buttons both stay live while the editor owns input).
  #isKeyDownAny(keys) {
    const im = this.#flock.inputManager;
    const kb = this.#flock._keyboardSource;
    const os = this.#flock._onScreenSource;
    return keys.some(
      (k) => im?.isKeyDown?.(k) || kb?.isKeyDown?.(k) || os?.isKeyDown?.(k) || false
    );
  }

  // Native ArcRotate directions: Left/Up decrease alpha/beta.
  #orbitKeyYaw() {
    const im = this.#flock.inputManager;
    const left = [...(im?._getActionKeys?.('LEFT') ?? ['a', 'q']), 'ArrowLeft'];
    const right = [...(im?._getActionKeys?.('RIGHT') ?? ['d']), 'ArrowRight'];
    return (this.#isKeyDownAny(left) ? 1 : 0) - (this.#isKeyDownAny(right) ? 1 : 0);
  }

  #orbitKeyPitch() {
    const im = this.#flock.inputManager;
    const up = [...(im?._getActionKeys?.('FORWARD') ?? ['w', 'z']), 'ArrowUp'];
    const down = [...(im?._getActionKeys?.('BACKWARD') ?? ['s']), 'ArrowDown'];
    return (this.#isKeyDownAny(up) ? 1 : 0) - (this.#isKeyDownAny(down) ? 1 : 0);
  }

  // Orbit zoom mirrors free-camera height: BUTTON1 in, BUTTON3 out.
  #zoomDirection() {
    const im = this.#flock.inputManager;
    const zoomInKeys = [...(im?._getActionKeys?.('BUTTON1') ?? ['r', '1']), 'PageUp'];
    const zoomOutKeys = [...(im?._getActionKeys?.('BUTTON3') ?? ['f', '3']), 'PageDown'];
    return (this.#isKeyDownAny(zoomInKeys) ? 1 : 0) - (this.#isKeyDownAny(zoomOutKeys) ? 1 : 0);
  }

  #update() {
    const flock = this.#flock;
    const rightX = flock.inputManager.getAxis('LOOK_X');
    const rightY = flock.inputManager.getAxis('LOOK_Y');
    const shoulderTurn = flock.inputManager.getAxis('TURN');

    const joy = flock._joystickSource?.getMove();
    const moveX = this.#resolveMoveAxis('MOVE_X', joy?.x ?? 0, 'a', 'd');
    const moveY = this.#resolveMoveAxis('MOVE_Y', joy?.y ?? 0, 'w', 's');

    const camera = this.#scene.activeCamera;

    if (!camera) {
      return;
    }

    if (flock._canvasControlsEnabled === false) {
      return;
    }

    // The XR camera is never an ArcRotateCamera, so the type test below needs the project's answer.
    if (flock._xrSessionActive && flock._xrProjectCameraOrbits) {
      return;
    }

    // Orbit-view arrows/WASD via the InputManager: one path for physical keys,
    // on-screen buttons and gamepad.
    const orbitView = camera.getClassName?.() === 'ArcRotateCamera' && camera.metadata?.orbitView;
    const keyYaw = orbitView ? this.#orbitKeyYaw() : 0;
    const keyPitch = orbitView ? this.#orbitKeyPitch() : 0;
    const yawInput = rightX + shoulderTurn + keyYaw;
    const pitchInput = rightY + keyPitch;

    if (!yawInput && !pitchInput && !moveX && !moveY && !this.#zoomDirection()) {
      return;
    }

    const deltaTime = (flock.engine?.getDeltaTime?.() ?? 16) / 1000;
    const yawDelta = yawInput * YAW_SPEED * deltaTime;
    const pitchDelta = pitchInput * PITCH_SPEED * deltaTime;

    if (camera.getClassName?.() === 'ArcRotateCamera') {
      camera.alpha -= yawDelta;
      camera.beta -= pitchDelta;

      const lowerBeta = camera.lowerBetaLimit ?? 0.01;
      const upperBeta = camera.upperBetaLimit ?? Math.PI - 0.01;

      camera.beta = Math.min(upperBeta, Math.max(lowerBeta, camera.beta));

      if (camera.metadata?.orbitView) {
        const zoom = this.#zoomDirection();
        if (zoom !== 0) {
          let radius = camera.radius * Math.exp(-zoom * ORBIT_ZOOM_RATE * deltaTime);
          if (Number.isFinite(camera.lowerRadiusLimit)) {
            radius = Math.max(camera.lowerRadiusLimit, radius);
          }
          if (Number.isFinite(camera.upperRadiusLimit)) {
            radius = Math.min(camera.upperRadiusLimit, radius);
          }
          camera.radius = radius;
        }
      }
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
