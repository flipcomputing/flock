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

  // Movement precedence: gamepad axis, then joystick, then keys.
  #resolveMoveAxis(axis, joyValue, negKey, posKey, includeOnScreen = false) {
    const kb = this.#flock._keyboardSource;
    const os = includeOnScreen ? this.#flock._onScreenSource : null;
    const isDown = (k) => kb?.isKeyDown(k) || os?.isKeyDown?.(k);
    return (
      this.#flock.inputManager.getAxis(axis) ||
      joyValue ||
      (isDown(posKey) ? 1 : isDown(negKey) ? -1 : 0)
    );
  }

  #flyKeyYaw(camera) {
    const kb = this.#flock._keyboardSource;
    const bound = [
      ...(camera.keysLeft ?? []),
      ...(camera.keysRight ?? []),
      ...(camera.keysRotateLeft ?? []),
      ...(camera.keysRotateRight ?? []),
    ];
    const held = (key, code) => !bound.includes(code) && kb?.isKeyDown(key);
    return (held('ArrowRight', 39) ? 1 : 0) - (held('ArrowLeft', 37) ? 1 : 0);
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

  // The editor's orbit view leaves the arrows to the canvas keyboard cursor,
  // even when the project has bound an action to one.
  #orbitKeys(action, fallback, arrow, useArrows) {
    const keys = this.#flock.inputManager?._getActionKeys?.(action) ?? fallback;
    return useArrows ? [...keys, arrow] : keys.filter((k) => !k.startsWith('Arrow'));
  }

  // Native ArcRotate directions: Left/Up decrease alpha/beta.
  #orbitKeyYaw(useArrows) {
    const left = this.#orbitKeys('LEFT', ['a', 'q'], 'ArrowLeft', useArrows);
    const right = this.#orbitKeys('RIGHT', ['d'], 'ArrowRight', useArrows);
    return (this.#isKeyDownAny(left) ? 1 : 0) - (this.#isKeyDownAny(right) ? 1 : 0);
  }

  #orbitKeyPitch(useArrows) {
    const up = this.#orbitKeys('FORWARD', ['w', 'z'], 'ArrowUp', useArrows);
    const down = this.#orbitKeys('BACKWARD', ['s'], 'ArrowDown', useArrows);
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
    const moveX = this.#resolveMoveAxis('MOVE_X', joy?.x ?? 0, 'a', 'd', true);
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

    // Orbit arrows/WASD via the InputManager: one path for physical keys,
    // on-screen buttons and gamepad; the joystick turns the orbit too. Covers
    // the editor's orbit view and the project's own orbit cameras.
    const isArcRotate = camera.getClassName?.() === 'ArcRotateCamera';
    const orbits =
      isArcRotate &&
      (camera.metadata?.orbitView ||
        (camera.metadata?.cameraRig && camera.metadata.cameraType === 'orbit'));
    const orbitArrows = !camera.metadata?.orbitView;
    const keyYaw = orbits
      ? this.#orbitKeyYaw(orbitArrows) - (joy?.x ?? 0)
      : isArcRotate
        ? 0
        : this.#flyKeyYaw(camera);
    const keyPitch = orbits ? this.#orbitKeyPitch(orbitArrows) - (joy?.y ?? 0) : 0;
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

      if (orbits) {
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
