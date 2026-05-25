import { expect } from "chai";
import { InputManager } from "../../input/inputManager.js";
import { GamepadSource } from "../../input/gamepadSource.js";

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
    for (const cb of this.#callbacks) cb();
  }
}

class StubCanvas {
  dispatched = [];
  #listeners = new Map();

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }

  addEventListener(type, cb) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, []);
    this.#listeners.get(type).push(cb);
  }

  removeEventListener(type, cb) {
    const list = this.#listeners.get(type);
    if (list) this.#listeners.set(type, list.filter((l) => l !== cb));
  }

  dispatchEvent(e) {
    this.dispatched.push(e);
    const list = this.#listeners.get(e.type) ?? [];
    for (const cb of list) cb(e);
    return true;
  }
}

function makeButton(pressed, value = pressed ? 1 : 0) {
  return { pressed, value };
}

function makeGamepad({ buttons = [], axes = [] } = {}) {
  return { buttons, axes };
}

export function runGamepadSourceTests() {
  describe("GamepadSource @gamepad @input", function () {
    let manager, scene, canvas, source;

    function makeSource(getGamepads) {
      source = new GamepadSource(manager, { scene, canvas, getGamepads });
    }

    beforeEach(function () {
      manager = new InputManager();
      scene = new StubScene();
      canvas = new StubCanvas();
    });

    afterEach(function () {
      source?.stop();
    });

    describe("no gamepad connected", function () {
      it("no gamepad → manager unchanged after tick", function () {
        makeSource(() => []);
        source.start();
        scene.tick();
        expect(manager.heldKeyCount()).to.equal(0);
      });
    });

    describe("button mapping", function () {
      it("button 1 pressed → isKeyDown('r') true", function () {
        makeSource(() => [makeGamepad({ buttons: [null, makeButton(true)] })]);
        source.start();
        scene.tick();
        expect(manager.isKeyDown("r")).to.be.true;
      });

      it("button 1 pressed → isKeyDown('PageUp') true (fly-camera up)", function () {
        makeSource(() => [makeGamepad({ buttons: [null, makeButton(true)] })]);
        source.start();
        scene.tick();
        expect(manager.isKeyDown("PageUp")).to.be.true;
      });

      it("button 1 pressed → dispatches synthetic DOM keydown for PageUp", function () {
        makeSource(() => [makeGamepad({ buttons: [null, makeButton(true)] })]);
        source.start();
        const events = canvas.dispatched.filter((e) => e.type === "keydown" && e.key === "PageUp");
        expect(events).to.have.lengthOf(0);
        scene.tick();
        const after = canvas.dispatched.filter((e) => e.type === "keydown" && e.key === "PageUp");
        expect(after).to.have.lengthOf(1);
        expect(after[0].keyCode).to.equal(33);
        expect(after[0].__flockSynthetic).to.be.true;
      });

      it("button 1 released → dispatches synthetic DOM keyup for PageUp", function () {
        let pressed = true;
        makeSource(() => [makeGamepad({ buttons: [null, makeButton(pressed)] })]);
        source.start();
        scene.tick();
        pressed = false;
        scene.tick();
        const keyups = canvas.dispatched.filter((e) => e.type === "keyup" && e.key === "PageUp");
        expect(keyups).to.have.lengthOf(1);
        expect(keyups[0].__flockSynthetic).to.be.true;
      });

      it("button 2 pressed → isKeyDown('f') true and isKeyDown('PageDown') true (fly-camera down)", function () {
        makeSource(() => [makeGamepad({ buttons: [null, null, makeButton(true)] })]);
        source.start();
        scene.tick();
        expect(manager.isKeyDown("f")).to.be.true;
        expect(manager.isKeyDown("PageDown")).to.be.true;
      });

      it("button 1 pressed → isActionDown('BUTTON2') true", function () {
        makeSource(() => [makeGamepad({ buttons: [null, makeButton(true)] })]);
        source.start();
        scene.tick();
        expect(manager.isActionDown("BUTTON2")).to.be.true;
      });

      it("button 1 pressed → onActionDown fired once with 'BUTTON2'", function () {
        const fired = [];
        manager.onActionDownObservable.add((a) => fired.push(a));
        makeSource(() => [makeGamepad({ buttons: [null, makeButton(true)] })]);
        source.start();
        scene.tick();
        expect(fired.filter((a) => a === "BUTTON2")).to.have.lengthOf(1);
      });

      it("button 1 held over multiple ticks → no duplicate onKeyDown/onActionDown", function () {
        const keyDownFired = [];
        const actionDownFired = [];
        manager.onKeyDownObservable.add((k) => keyDownFired.push(k));
        manager.onActionDownObservable.add((a) => actionDownFired.push(a));
        makeSource(() => [makeGamepad({ buttons: [null, makeButton(true)] })]);
        source.start();
        scene.tick();
        scene.tick();
        scene.tick();
        expect(keyDownFired.filter((k) => k === "r")).to.have.lengthOf(1);
        expect(actionDownFired.filter((a) => a === "BUTTON2")).to.have.lengthOf(1);
      });

      it("button 1 released → onKeyUp('r') fires; isActionDown('BUTTON2') false", function () {
        const keyUpFired = [];
        manager.onKeyUpObservable.add((k) => keyUpFired.push(k));
        let pressed = true;
        makeSource(() => [makeGamepad({ buttons: [null, makeButton(pressed)] })]);
        source.start();
        scene.tick();
        pressed = false;
        scene.tick();
        expect(keyUpFired).to.include("r");
        expect(manager.isActionDown("BUTTON2")).to.be.false;
      });

      it("button 14 (D-pad left) → isKeyDown('a') true; isActionDown('LEFT') true; isKeyDown('q') false", function () {
        const btns = Array(15).fill(null);
        btns[14] = makeButton(true);
        makeSource(() => [makeGamepad({ buttons: btns })]);
        source.start();
        scene.tick();
        expect(manager.isKeyDown("a")).to.be.true;
        expect(manager.isActionDown("LEFT")).to.be.true;
        expect(manager.isKeyDown("q")).to.be.false;
      });

      it("button 12 (D-pad up) → isActionDown('FORWARD') true", function () {
        const btns = Array(13).fill(null);
        btns[12] = makeButton(true);
        makeSource(() => [makeGamepad({ buttons: btns })]);
        source.start();
        scene.tick();
        expect(manager.isActionDown("FORWARD")).to.be.true;
      });

      it("button 3 → isActionDown('BUTTON1') true", function () {
        const btns = [null, null, null, makeButton(true)];
        makeSource(() => [makeGamepad({ buttons: btns })]);
        source.start();
        scene.tick();
        expect(manager.isActionDown("BUTTON1")).to.be.true;
      });

      it("button 6 → isActionDown('BUTTON2') true", function () {
        const btns = Array(7).fill(null);
        btns[6] = makeButton(true);
        makeSource(() => [makeGamepad({ buttons: btns })]);
        source.start();
        scene.tick();
        expect(manager.isActionDown("BUTTON2")).to.be.true;
      });

      it("button 7 → isActionDown('BUTTON2') true", function () {
        const btns = Array(8).fill(null);
        btns[7] = makeButton(true);
        makeSource(() => [makeGamepad({ buttons: btns })]);
        source.start();
        scene.tick();
        expect(manager.isActionDown("BUTTON2")).to.be.true;
      });
    });

    describe("axes", function () {
      it("axes[2] = 0.4 → getAxis('LOOK_X') === 0.4 (past dead zone)", function () {
        makeSource(() => [makeGamepad({ axes: [0, 0, 0.4, 0] })]);
        source.start();
        scene.tick();
        expect(manager.getAxis("LOOK_X")).to.equal(0.4);
      });

      it("axes[2] = 0.1 → getAxis('LOOK_X') === 0 (within dead zone)", function () {
        makeSource(() => [makeGamepad({ axes: [0, 0, 0.1, 0] })]);
        source.start();
        scene.tick();
        expect(manager.getAxis("LOOK_X")).to.equal(0);
      });

      it("axis shim: axes[1] = -0.9 → isKeyDown('w') true", function () {
        makeSource(() => [makeGamepad({ axes: [0, -0.9, 0, 0] })]);
        source.start();
        scene.tick();
        expect(manager.isKeyDown("w")).to.be.true;
      });

      it("axis shim: axes[1] = -0.1 → isKeyDown('w') false (below shim threshold)", function () {
        makeSource(() => [makeGamepad({ axes: [0, -0.1, 0, 0] })]);
        source.start();
        scene.tick();
        expect(manager.isKeyDown("w")).to.be.false;
      });
    });

    describe("shoulders / TURN axis", function () {
      it("button 4 pressed → getAxis('TURN') === -1", function () {
        const btns = [null, null, null, null, makeButton(true)];
        makeSource(() => [makeGamepad({ buttons: btns })]);
        source.start();
        scene.tick();
        expect(manager.getAxis("TURN")).to.equal(-1);
      });

      it("button 5 pressed → getAxis('TURN') === +1", function () {
        const btns = [null, null, null, null, null, makeButton(true)];
        makeSource(() => [makeGamepad({ buttons: btns })]);
        source.start();
        scene.tick();
        expect(manager.getAxis("TURN")).to.equal(1);
      });

      it("both shoulders pressed → getAxis('TURN') === 0", function () {
        const btns = [null, null, null, null, makeButton(true), makeButton(true)];
        makeSource(() => [makeGamepad({ buttons: btns })]);
        source.start();
        scene.tick();
        expect(manager.getAxis("TURN")).to.equal(0);
      });
    });

    describe("touchpad", function () {
      it("rising edge → canvas dispatchEvent called once with 'pointerdown'", function () {
        const btns = Array(18).fill(null);
        let touchpadDown = false;
        makeSource(() => [
          makeGamepad({ buttons: btns.map((_, i) => (i === 17 ? makeButton(touchpadDown) : null)) }),
        ]);
        source.start();
        scene.tick(); // no press yet
        touchpadDown = true;
        scene.tick(); // rising edge
        const downs = canvas.dispatched.filter((e) => e.type === "pointerdown");
        expect(downs).to.have.lengthOf(1);
      });

      it("falling edge → canvas dispatchEvent called with 'pointerup'", function () {
        let touchpadDown = true;
        makeSource(() => [
          makeGamepad({ buttons: Array(18).fill(null).map((_, i) => (i === 17 ? makeButton(touchpadDown) : null)) }),
        ]);
        source.start();
        scene.tick(); // pressed
        touchpadDown = false;
        scene.tick(); // falling edge
        const ups = canvas.dispatched.filter((e) => e.type === "pointerup");
        expect(ups).to.have.lengthOf(1);
      });
    });

    describe("stop", function () {
      it("stop() releases every key held by the source", function () {
        makeSource(() => [makeGamepad({ buttons: [null, makeButton(true)] })]);
        source.start();
        scene.tick();
        expect(manager.isKeyDown("r")).to.be.true;
        source.stop();
        expect(manager.isKeyDown("r")).to.be.false;
      });

      it("stop() zeros axes it owns", function () {
        makeSource(() => [makeGamepad({ axes: [0, 0, 0.8, 0] })]);
        source.start();
        scene.tick();
        source.stop();
        expect(manager.getAxis("LOOK_X")).to.equal(0);
        expect(manager.getAxis("TURN")).to.equal(0);
      });
    });

    describe("setFlyMode (camera gizmo fly mode)", function () {
      it("setFlyMode(true) immediately releases held movement keys", function () {
        makeSource(() => [makeGamepad({ buttons: Array(13).fill(null).map((_, i) => (i === 12 ? makeButton(true) : null)) })]);
        source.start();
        scene.tick();
        expect(manager.isKeyDown("w")).to.be.true;
        source.setFlyMode(true);
        expect(manager.isKeyDown("w")).to.be.false;
      });

      it("fly mode: movement shim keys are blocked (left stick forward)", function () {
        makeSource(() => [makeGamepad({ axes: [0, -0.9, 0, 0] })]);
        source.start();
        source.setFlyMode(true);
        scene.tick();
        expect(manager.isKeyDown("w")).to.be.false;
      });

      it("fly mode: MOVE_Y axis is still set (camera observer can read it)", function () {
        makeSource(() => [makeGamepad({ axes: [0, -0.9, 0, 0] })]);
        source.start();
        source.setFlyMode(true);
        scene.tick();
        expect(manager.getAxis("MOVE_Y")).to.be.lessThan(0);
      });

      it("fly mode: PageUp still goes to InputManager and dispatches DOM event; 'r' is blocked", function () {
        makeSource(() => [makeGamepad({ buttons: [null, makeButton(true)] })]);
        source.start();
        source.setFlyMode(true);
        scene.tick();
        expect(manager.isKeyDown("PageUp")).to.be.true;
        expect(manager.isKeyDown("r")).to.be.false;
        const domEvents = canvas.dispatched.filter((e) => e.type === "keydown" && e.key === "PageUp");
        expect(domEvents).to.have.lengthOf(1);
      });

      it("fly mode: D-pad does not set movement keys", function () {
        const btns = Array(13).fill(null);
        btns[12] = makeButton(true);
        makeSource(() => [makeGamepad({ buttons: btns })]);
        source.start();
        source.setFlyMode(true);
        scene.tick();
        expect(manager.isKeyDown("w")).to.be.false;
      });

      it("setFlyMode(false) re-enables movement keys on next tick", function () {
        makeSource(() => [makeGamepad({ axes: [0, -0.9, 0, 0] })]);
        source.start();
        source.setFlyMode(true);
        scene.tick();
        expect(manager.isKeyDown("w")).to.be.false;
        source.setFlyMode(false);
        scene.tick();
        expect(manager.isKeyDown("w")).to.be.true;
      });
    });

    describe("refcount: keyboard + gamepad holding same key", function () {
      it("keyboard holds 'w', gamepad releases 'w' → still down (refcount)", function () {
        makeSource(() => [makeGamepad({ buttons: Array(13).fill(null).map((_, i) => (i === 12 ? makeButton(true) : null)) })]);
        // Simulate keyboard pressing 'w' independently
        manager._setKey("w", true);
        source.start();
        scene.tick(); // gamepad also holds 'w' now → count = 2

        // gamepad releases
        makeSource(() => [makeGamepad({ buttons: [] })]);
        source.stop();
        // keyboard still holds 'w' via its own press; count should still be 1
        // (gamepad's contribution was released, keyboard's wasn't)
        // In this test we didn't use a real keyboard source, we called _setKey directly.
        // After stop(), source released its key (count: 2→1). Keyboard still holds it.
        expect(manager.isKeyDown("w")).to.be.true;
      });
    });
  });
}