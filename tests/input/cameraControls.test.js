import { expect } from "chai";
import { InputManager } from "../../input/inputManager.js";
import { CameraControls } from "../../input/cameraControls.js";

class StubVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  scale(s) {
    return new StubVector3(this.x * s, this.y * s, this.z * s);
  }
  addInPlace(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
}

class StubObservable {
  #listeners = [];
  add(cb) {
    this.#listeners.push(cb);
    return { _callback: cb };
  }
  remove(observer) {
    this.#listeners = this.#listeners.filter((l) => l !== observer._callback);
  }
  fire() {
    for (const l of [...this.#listeners]) l();
  }
  count() {
    return this.#listeners.length;
  }
}

// Identity-rotation free camera: local directions map straight to world.
function makeFreeCamera() {
  return {
    rotation: { x: 0, y: 0 },
    position: new StubVector3(0, 0, 0),
    getDirection: (v) => new StubVector3(v.x, v.y, v.z),
    getClassName: () => "FreeCamera",
  };
}

function makeArcRotateCamera() {
  return {
    alpha: 1,
    beta: 1,
    position: new StubVector3(0, 0, 0),
    getClassName: () => "ArcRotateCamera",
  };
}

function makeFlock() {
  const camera = makeFreeCamera();
  return {
    inputManager: new InputManager(),
    scene: {
      onBeforeRenderObservable: new StubObservable(),
      activeCamera: camera,
    },
    engine: { getDeltaTime: () => 16 },
    BABYLON: { Vector3: StubVector3 },
    _keyboardSource: null,
    _joystickSource: null,
    _canvasControlsEnabled: undefined,
  };
}

export function runCameraControlsTests() {
  describe("CameraControls @camera @input", function () {
    let flock, controls;

    beforeEach(function () {
      flock = makeFlock();
      controls = new CameraControls(flock);
      controls.start();
    });

    afterEach(function () {
      controls.stop();
    });

    describe("lifecycle", function () {
      it("start() adds one observer, stop() removes it", function () {
        expect(flock.scene.onBeforeRenderObservable.count()).to.equal(1);
        controls.stop();
        expect(flock.scene.onBeforeRenderObservable.count()).to.equal(0);
      });

      it("double start() does not add a second observer", function () {
        controls.start();
        expect(flock.scene.onBeforeRenderObservable.count()).to.equal(1);
      });
    });

    describe("movement sources", function () {
      it("MOVE axes fly a free camera", function () {
        flock.inputManager._setAxis("MOVE_Y", -1);
        flock.scene.onBeforeRenderObservable.fire();
        expect(flock.scene.activeCamera.position.z).to.be.greaterThan(0);
      });

      it("joystick getMove() flies the camera when MOVE axes are zero", function () {
        flock._joystickSource = { getMove: () => ({ x: 0, y: -1 }) };
        flock.scene.onBeforeRenderObservable.fire();
        expect(flock.scene.activeCamera.position.z).to.be.greaterThan(0);
      });

      it("joystick x strafes the camera", function () {
        flock._joystickSource = { getMove: () => ({ x: 1, y: 0 }) };
        flock.scene.onBeforeRenderObservable.fire();
        expect(flock.scene.activeCamera.position.x).to.be.greaterThan(0);
        expect(flock.scene.activeCamera.position.z).to.equal(0);
      });

      it("MOVE axes take precedence over the joystick", function () {
        flock.inputManager._setAxis("MOVE_Y", 1);
        flock._joystickSource = { getMove: () => ({ x: 0, y: -1 }) };
        flock.scene.onBeforeRenderObservable.fire();
        expect(flock.scene.activeCamera.position.z).to.be.lessThan(0);
      });

      it("physical WASD flies the camera when axes and joystick are idle", function () {
        flock._joystickSource = { getMove: () => ({ x: 0, y: 0 }) };
        flock._keyboardSource = { isKeyDown: (k) => k === "w" };
        flock.scene.onBeforeRenderObservable.fire();
        expect(flock.scene.activeCamera.position.z).to.be.greaterThan(0);
      });

      it("no input → camera untouched", function () {
        flock.scene.onBeforeRenderObservable.fire();
        expect(flock.scene.activeCamera.position.z).to.equal(0);
        expect(flock.scene.activeCamera.rotation.y).to.equal(0);
      });

      it("blocked when canvas controls are disabled", function () {
        flock._canvasControlsEnabled = false;
        flock._joystickSource = { getMove: () => ({ x: 0, y: -1 }) };
        flock.scene.onBeforeRenderObservable.fire();
        expect(flock.scene.activeCamera.position.z).to.equal(0);
      });
    });

    describe("look input", function () {
      it("LOOK_X yaws a free camera", function () {
        flock.inputManager._setAxis("LOOK_X", 1);
        flock.scene.onBeforeRenderObservable.fire();
        expect(flock.scene.activeCamera.rotation.y).to.be.greaterThan(0);
      });

      it("LOOK axes adjust ArcRotateCamera alpha/beta without moving it", function () {
        flock.scene.activeCamera = makeArcRotateCamera();
        flock.inputManager._setAxis("LOOK_X", 1);
        flock.inputManager._setAxis("LOOK_Y", 1);
        flock.scene.onBeforeRenderObservable.fire();
        expect(flock.scene.activeCamera.alpha).to.be.lessThan(1);
        expect(flock.scene.activeCamera.beta).to.be.lessThan(1);
        expect(flock.scene.activeCamera.position.z).to.equal(0);
      });

      it("joystick does not move an ArcRotateCamera", function () {
        flock.scene.activeCamera = makeArcRotateCamera();
        flock._joystickSource = { getMove: () => ({ x: 0, y: -1 }) };
        flock.scene.onBeforeRenderObservable.fire();
        expect(flock.scene.activeCamera.position.z).to.equal(0);
      });
    });
  });
}
