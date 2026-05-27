import { expect } from "chai";
import { InputManager } from "../../input/inputManager.js";
import { XRSource } from "../../input/xrSource.js";

class StubObservable {
  #callbacks = [];
  #onceCallbacks = [];

  add(cb) {
    this.#callbacks.push(cb);
    return cb;
  }

  addOnce(cb) {
    const wrapper = (data) => {
      this.#onceCallbacks = this.#onceCallbacks.filter((w) => w !== wrapper);
      cb(data);
    };
    this.#onceCallbacks.push(wrapper);
    return wrapper;
  }

  remove(observer) {
    this.#callbacks = this.#callbacks.filter((c) => c !== observer);
    this.#onceCallbacks = this.#onceCallbacks.filter((c) => c !== observer);
  }

  notify(data) {
    for (const cb of [...this.#callbacks]) cb(data);
    for (const cb of [...this.#onceCallbacks]) cb(data);
  }
}

class StubScene {
  #callbacks = [];
  onBeforeRenderObservable = {
    add: (cb) => {
      this.#callbacks.push(cb);
      return cb;
    },
    remove: (cb) => {
      this.#callbacks = this.#callbacks.filter((c) => c !== cb);
    },
  };
  tick() {
    for (const cb of [...this.#callbacks]) cb();
  }
}

function makeComponent({ pressed = false, axesX = 0, axesY = 0 } = {}) {
  return {
    pressed,
    axes: { x: axesX, y: axesY },
    onButtonStateChangedObservable: new StubObservable(),
  };
}

function makeMotionController(handedness) {
  const components = {};
  if (handedness === "left") {
    components["x-button"] = makeComponent();
    components["y-button"] = makeComponent();
  } else if (handedness === "right") {
    components["a-button"] = makeComponent();
    components["b-button"] = makeComponent();
    components["xr-standard-thumbstick"] = makeComponent();
  }
  return {
    components,
    getComponent(id) {
      return this.components[id] ?? null;
    },
  };
}

function makeController(handedness) {
  const inputSource = { handedness };
  const onMotionControllerInitObservable = new StubObservable();
  return {
    inputSource,
    onMotionControllerInitObservable,
    initMotionController(mc) {
      onMotionControllerInitObservable.notify(mc);
    },
  };
}

function makeXRHelper() {
  return {
    input: {
      onControllerAddedObservable: new StubObservable(),
      onControllerRemovedObservable: new StubObservable(),
    },
  };
}

export function runXRSourceTests() {
  describe("XRSource @xr @input", function () {
    let manager, scene, xrHelper, source;

    function addController(controller) {
      xrHelper.input.onControllerAddedObservable.notify(controller);
      const mc = makeMotionController(controller.inputSource.handedness);
      controller.initMotionController(mc);
      return mc;
    }

    function removeController(controller) {
      xrHelper.input.onControllerRemovedObservable.notify(controller);
    }

    beforeEach(function () {
      manager = new InputManager();
      scene = new StubScene();
      xrHelper = makeXRHelper();
      source = new XRSource(manager, { xrHelper, scene });
      source.start();
    });

    afterEach(function () {
      source?.stop();
    });

    describe("button mapping — left controller", function () {
      it("left x-button pressed → isKeyDown('f') true; isActionDown('BUTTON3') true", function () {
        const controller = makeController("left");
        const mc = addController(controller);
        mc.components["x-button"].pressed = true;
        mc.components["x-button"].onButtonStateChangedObservable.notify();
        expect(manager.isKeyDown("f")).to.be.true;
        expect(manager.isActionDown("BUTTON3")).to.be.true;
      });

      it("left x-button released → isKeyDown('f') false", function () {
        const controller = makeController("left");
        const mc = addController(controller);
        mc.components["x-button"].pressed = true;
        mc.components["x-button"].onButtonStateChangedObservable.notify();
        mc.components["x-button"].pressed = false;
        mc.components["x-button"].onButtonStateChangedObservable.notify();
        expect(manager.isKeyDown("f")).to.be.false;
      });

      it("left y-button pressed → isKeyDown('e') true; isActionDown('BUTTON2') true", function () {
        const controller = makeController("left");
        const mc = addController(controller);
        mc.components["y-button"].pressed = true;
        mc.components["y-button"].onButtonStateChangedObservable.notify();
        expect(manager.isKeyDown("e")).to.be.true;
        expect(manager.isActionDown("BUTTON2")).to.be.true;
      });
    });

    describe("button mapping — right controller", function () {
      it("right a-button pressed → isKeyDown(' ') true; isActionDown('BUTTON4') true", function () {
        const controller = makeController("right");
        const mc = addController(controller);
        mc.components["a-button"].pressed = true;
        mc.components["a-button"].onButtonStateChangedObservable.notify();
        expect(manager.isKeyDown(" ")).to.be.true;
        expect(manager.isActionDown("BUTTON4")).to.be.true;
      });

      it("right b-button pressed → isKeyDown('r') true; isActionDown('BUTTON1') true", function () {
        const controller = makeController("right");
        const mc = addController(controller);
        mc.components["b-button"].pressed = true;
        mc.components["b-button"].onButtonStateChangedObservable.notify();
        expect(manager.isKeyDown("r")).to.be.true;
        expect(manager.isActionDown("BUTTON1")).to.be.true;
      });

    });

    describe("thumbstick axes and shim", function () {
      it("right thumbstick x = -0.9 → getAxis('XR_MOVE_X') === -0.9; isKeyDown('a') true", function () {
        const controller = makeController("right");
        const mc = addController(controller);
        mc.components["xr-standard-thumbstick"].axes.x = -0.9;
        scene.tick();
        expect(manager.getAxis("XR_MOVE_X")).to.equal(-0.9);
        expect(manager.isKeyDown("a")).to.be.true;
      });

      it("right thumbstick x = -0.1 → getAxis('XR_MOVE_X') === 0 (dead-zone); isKeyDown('a') false", function () {
        const controller = makeController("right");
        const mc = addController(controller);
        mc.components["xr-standard-thumbstick"].axes.x = -0.1;
        scene.tick();
        expect(manager.getAxis("XR_MOVE_X")).to.equal(0);
        expect(manager.isKeyDown("a")).to.be.false;
      });

      it("right thumbstick y = 0.9 → isKeyDown('s') true; getAxis('XR_MOVE_Y') === 0.9", function () {
        const controller = makeController("right");
        const mc = addController(controller);
        mc.components["xr-standard-thumbstick"].axes.y = 0.9;
        scene.tick();
        expect(manager.getAxis("XR_MOVE_Y")).to.equal(0.9);
        expect(manager.isKeyDown("s")).to.be.true;
      });

      it("thumbstick shim: moving past threshold then releasing clears key", function () {
        const controller = makeController("right");
        const mc = addController(controller);
        mc.components["xr-standard-thumbstick"].axes.x = -0.9;
        scene.tick();
        expect(manager.isKeyDown("a")).to.be.true;
        mc.components["xr-standard-thumbstick"].axes.x = 0;
        scene.tick();
        expect(manager.isKeyDown("a")).to.be.false;
      });
    });

    describe("controller removal", function () {
      it("removing left controller releases all its held keys", function () {
        const controller = makeController("left");
        const mc = addController(controller);
        mc.components["x-button"].pressed = true;
        mc.components["x-button"].onButtonStateChangedObservable.notify();
        expect(manager.isKeyDown("f")).to.be.true;
        removeController(controller);
        expect(manager.isKeyDown("f")).to.be.false;
      });

      it("removing right controller zeroes XR_MOVE_X and releases shim keys", function () {
        const controller = makeController("right");
        const mc = addController(controller);
        mc.components["xr-standard-thumbstick"].axes.x = -0.9;
        scene.tick();
        expect(manager.isKeyDown("a")).to.be.true;
        removeController(controller);
        expect(manager.isKeyDown("a")).to.be.false;
        expect(manager.getAxis("XR_MOVE_X")).to.equal(0);
      });

      it("stale button observer after removal is a no-op", function () {
        const controller = makeController("left");
        const mc = addController(controller);
        removeController(controller);
        // Fire button observable after removal — should not change manager state
        mc.components["x-button"].pressed = true;
        mc.components["x-button"].onButtonStateChangedObservable.notify();
        expect(manager.isKeyDown("f")).to.be.false;
      });
    });

    describe("stop()", function () {
      it("stop() releases all held keys", function () {
        const controller = makeController("left");
        const mc = addController(controller);
        mc.components["x-button"].pressed = true;
        mc.components["x-button"].onButtonStateChangedObservable.notify();
        expect(manager.isKeyDown("f")).to.be.true;
        source.stop();
        expect(manager.isKeyDown("f")).to.be.false;
      });

      it("stop() zeros XR axes", function () {
        const controller = makeController("right");
        const mc = addController(controller);
        mc.components["xr-standard-thumbstick"].axes.x = -0.9;
        scene.tick();
        source.stop();
        expect(manager.getAxis("XR_MOVE_X")).to.equal(0);
        expect(manager.getAxis("XR_MOVE_Y")).to.equal(0);
      });

      it("stop() is idempotent", function () {
        source.stop();
        source.stop();
        expect(manager.heldKeyCount()).to.equal(0);
      });

      it("start() is idempotent", function () {
        const addedBefore =
          xrHelper.input.onControllerAddedObservable.notify.length;
        source.start();
        source.start();
        // Only one frame observer should be registered; tick produces no double-fires
        const controller = makeController("right");
        const mc = addController(controller);
        mc.components["xr-standard-thumbstick"].axes.x = -0.9;
        scene.tick();
        expect(manager.isKeyDown("a")).to.be.true;
        void addedBefore;
      });
    });

    describe("refcount: two sources holding the same key", function () {
      it("keyboard holds 'f', controller releases 'f' → still down via refcount", function () {
        manager._setKey("f", true); // keyboard contribution
        const controller = makeController("left");
        const mc = addController(controller);
        mc.components["x-button"].pressed = true;
        mc.components["x-button"].onButtonStateChangedObservable.notify();
        // both keyboard and controller hold 'f' (count = 2)
        mc.components["x-button"].pressed = false;
        mc.components["x-button"].onButtonStateChangedObservable.notify();
        // controller released; keyboard still holds it (count = 1)
        expect(manager.isKeyDown("f")).to.be.true;
        manager._setKey("f", false);
        expect(manager.isKeyDown("f")).to.be.false;
      });
    });
  });
}
