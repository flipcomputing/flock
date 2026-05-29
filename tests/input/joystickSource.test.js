import { expect } from "chai";
import { InputManager } from "../../input/inputManager.js";
import { OnScreenSource } from "../../input/onScreenSource.js";
import { JoystickSource } from "../../input/joystickSource.js";

const BASE_RADIUS = 55;

class StubCanvas {
  #listeners = new Map();
  clientWidth = 800;
  clientHeight = 600;
  width = 800;   // same as clientWidth → DPR ratio = 1 in tests
  height = 600;

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
  }

  addEventListener(type, cb) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, []);
    this.#listeners.get(type).push(cb);
  }

  removeEventListener(type, cb) {
    const list = this.#listeners.get(type);
    if (list) this.#listeners.set(type, list.filter((l) => l !== cb));
  }

  dispatchPointer(type, pointerId, clientX, clientY) {
    const e = { type, pointerId, clientX, clientY };
    for (const cb of this.#listeners.get(type) ?? []) cb(e);
  }
}

class StubEllipse {
  left = '0px';
  top = '0px';
}

function makeSource(manager, onScreen, canvas) {
  const base = new StubEllipse();
  const thumb = new StubEllipse();
  const source = new JoystickSource(manager, onScreen, {
    canvas,
    baseEllipse: base,
    thumbEllipse: thumb,
    baseRadius: BASE_RADIUS,
  });
  return { source, base, thumb };
}

// Base center when canvas is 800×600: left + baseRadius = 80, bottom - baseRadius = 600 - 80 = 520
const BASE_CX = BASE_RADIUS;          // 80
const BASE_CY = 600 - BASE_RADIUS;   // 520

export function runJoystickSourceTests() {
  describe("JoystickSource @joystick @input", function () {
    let manager, onScreen, canvas;

    beforeEach(function () {
      manager = new InputManager();
      onScreen = new OnScreenSource(manager);
      canvas = new StubCanvas();
    });

    afterEach(function () {
      manager._clearAllKeys();
    });

    describe("lifecycle", function () {
      it("start() + stop() do not throw", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        expect(() => { source.start(); source.stop(); }).to.not.throw();
      });

      it("stop() releases all held keys", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        // Push fully up (dy = -1, past shim threshold)
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - BASE_RADIUS);
        expect(manager.isKeyDown("w")).to.be.true;
        source.stop();
        expect(manager.isKeyDown("w")).to.be.false;
      });

      it("stop() zeros MOVE_X and MOVE_Y axes", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX + BASE_RADIUS, BASE_CY);
        expect(manager.getAxis("MOVE_X")).to.be.greaterThan(0);
        source.stop();
        expect(manager.getAxis("MOVE_X")).to.equal(0);
        expect(manager.getAxis("MOVE_Y")).to.equal(0);
      });

      it("double start() is safe", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        expect(() => { source.start(); source.start(); source.stop(); }).to.not.throw();
      });

      it("double stop() is safe", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        expect(() => { source.stop(); source.stop(); }).to.not.throw();
      });
    });

    describe("pointer capture", function () {
      it("pointerdown inside base circle starts tracking", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        // Press at center — magnitude 0, within dead zone but inside base
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY);
        // No movement — axes should be 0 (dead zone)
        expect(manager.getAxis("MOVE_X")).to.equal(0);
        expect(manager.getAxis("MOVE_Y")).to.equal(0);
        source.stop();
      });

      it("pointerdown outside base circle is ignored", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        // Outside base: mag > 1
        canvas.dispatchPointer('pointerdown', 1, BASE_CX + BASE_RADIUS + 10, BASE_CY);
        canvas.dispatchPointer('pointermove', 1, BASE_CX, BASE_CY - BASE_RADIUS);
        expect(manager.isKeyDown("w")).to.be.false;
        source.stop();
      });

      it("second pointer while one is tracked is ignored", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - BASE_RADIUS);
        expect(manager.isKeyDown("w")).to.be.true;

        // Second pointer tries to go right
        canvas.dispatchPointer('pointerdown', 2, BASE_CX + BASE_RADIUS, BASE_CY);
        // Right key should still not be pressed (second pointer ignored)
        expect(manager.isKeyDown("d")).to.be.false;
        source.stop();
      });

      it("pointerup from untracked pointer id does nothing", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - BASE_RADIUS);
        expect(manager.isKeyDown("w")).to.be.true;

        canvas.dispatchPointer('pointerup', 99, BASE_CX, BASE_CY);
        expect(manager.isKeyDown("w")).to.be.true;
        source.stop();
      });
    });

    describe("dead zone", function () {
      it("magnitude < 0.2 → axes are 0 and no keys pressed", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        // Move by less than 20% of radius upward
        const offset = Math.round(BASE_RADIUS * 0.15);
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - offset);
        expect(manager.getAxis("MOVE_X")).to.equal(0);
        expect(manager.getAxis("MOVE_Y")).to.equal(0);
        expect(manager.isKeyDown("w")).to.be.false;
        source.stop();
      });

      it("magnitude > 0.2 → MOVE_Y axis is non-zero", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        const offset = Math.round(BASE_RADIUS * 0.5);
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - offset);
        expect(manager.getAxis("MOVE_Y")).to.be.lessThan(0);
        source.stop();
      });
    });

    describe("axis output", function () {
      it("full right → MOVE_X ≈ 1", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX + BASE_RADIUS, BASE_CY);
        const ax = manager.getAxis("MOVE_X");
        expect(ax).to.be.closeTo(1, 0.01);
        source.stop();
      });

      it("full left → MOVE_X ≈ -1", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX - BASE_RADIUS, BASE_CY);
        const ax = manager.getAxis("MOVE_X");
        expect(ax).to.be.closeTo(-1, 0.01);
        source.stop();
      });

      it("full up → MOVE_Y ≈ -1 (forward = negative)", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - BASE_RADIUS);
        const ay = manager.getAxis("MOVE_Y");
        expect(ay).to.be.closeTo(-1, 0.01);
        source.stop();
      });

      it("full down → MOVE_Y ≈ +1", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY + BASE_RADIUS);
        const ay = manager.getAxis("MOVE_Y");
        expect(ay).to.be.closeTo(1, 0.01);
        source.stop();
      });

      it("overshoot clamped to unit circle", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        // Start inside the base, then drag 2× radius right — should clamp to 1
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY);
        canvas.dispatchPointer('pointermove', 1, BASE_CX + BASE_RADIUS * 2, BASE_CY);
        const ax = manager.getAxis("MOVE_X");
        expect(ax).to.be.closeTo(1, 0.01);
        source.stop();
      });

      it("axes reset to 0 on pointerup", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX + BASE_RADIUS, BASE_CY);
        canvas.dispatchPointer('pointerup', 1, BASE_CX + BASE_RADIUS, BASE_CY);
        expect(manager.getAxis("MOVE_X")).to.equal(0);
        expect(manager.getAxis("MOVE_Y")).to.equal(0);
        source.stop();
      });

      it("axes update on pointermove", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY);
        canvas.dispatchPointer('pointermove', 1, BASE_CX + BASE_RADIUS, BASE_CY);
        expect(manager.getAxis("MOVE_X")).to.be.closeTo(1, 0.01);
        source.stop();
      });
    });

    describe("shimmed key presses", function () {
      it("dy < -0.5 → w pressed (FORWARD)", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - Math.round(BASE_RADIUS * 0.7));
        expect(manager.isKeyDown("w")).to.be.true;
        source.stop();
      });

      it("dy > +0.5 → s pressed (BACKWARD)", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY + Math.round(BASE_RADIUS * 0.7));
        expect(manager.isKeyDown("s")).to.be.true;
        source.stop();
      });

      it("dx < -0.5 → a pressed (LEFT)", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX - Math.round(BASE_RADIUS * 0.7), BASE_CY);
        expect(manager.isKeyDown("a")).to.be.true;
        source.stop();
      });

      it("dx > +0.5 → d pressed (RIGHT)", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX + Math.round(BASE_RADIUS * 0.7), BASE_CY);
        expect(manager.isKeyDown("d")).to.be.true;
        source.stop();
      });

      it("w released when stick moves back within threshold", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - Math.round(BASE_RADIUS * 0.7));
        expect(manager.isKeyDown("w")).to.be.true;
        canvas.dispatchPointer('pointermove', 1, BASE_CX, BASE_CY - Math.round(BASE_RADIUS * 0.3));
        expect(manager.isKeyDown("w")).to.be.false;
        source.stop();
      });

      it("all shim keys released on pointerup", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - Math.round(BASE_RADIUS * 0.7));
        canvas.dispatchPointer('pointerup', 1, BASE_CX, BASE_CY);
        expect(manager.isKeyDown("w")).to.be.false;
        source.stop();
      });
    });

    describe("thumb visual", function () {
      it("thumb left/top update on move", function () {
        const { source, thumb } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX + BASE_RADIUS, BASE_CY);
        expect(thumb.left).to.not.equal('0px');
        source.stop();
      });

      it("thumb resets to centre on pointerup", function () {
        const { source, thumb } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX + BASE_RADIUS, BASE_CY);
        canvas.dispatchPointer('pointerup', 1, BASE_CX + BASE_RADIUS, BASE_CY);
        expect(thumb.left).to.equal('0px');
        expect(thumb.top).to.equal('0px');
        source.stop();
      });
    });

    describe("pause / resume", function () {
      it("pause() stops InputManager updates while pointer is held", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - Math.round(BASE_RADIUS * 0.7));
        expect(manager.isKeyDown("w")).to.be.true;
        source.pause();
        expect(manager.isKeyDown("w")).to.be.false;
        expect(manager.getAxis("MOVE_Y")).to.equal(0);
        source.stop();
      });

      it("thumb still updates during pause", function () {
        const { source, thumb } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY);
        source.pause();
        canvas.dispatchPointer('pointermove', 1, BASE_CX + BASE_RADIUS, BASE_CY);
        expect(thumb.left).to.not.equal('0px');
        source.stop();
      });

      it("resume() calls releaseAll and clears axes", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - Math.round(BASE_RADIUS * 0.7));
        source.pause();
        source.resume();
        expect(manager.isKeyDown("w")).to.be.false;
        expect(manager.getAxis("MOVE_Y")).to.equal(0);
        source.stop();
      });
    });

    describe("releaseAll", function () {
      it("releaseAll() clears all axes and shim keys", function () {
        const { source } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX, BASE_CY - Math.round(BASE_RADIUS * 0.7));
        source.releaseAll();
        expect(manager.isKeyDown("w")).to.be.false;
        expect(manager.getAxis("MOVE_X")).to.equal(0);
        expect(manager.getAxis("MOVE_Y")).to.equal(0);
      });

      it("releaseAll() resets thumb to centre", function () {
        const { source, thumb } = makeSource(manager, onScreen, canvas);
        source.start();
        canvas.dispatchPointer('pointerdown', 1, BASE_CX + BASE_RADIUS, BASE_CY);
        source.releaseAll();
        expect(thumb.left).to.equal('0px');
        expect(thumb.top).to.equal('0px');
      });
    });
  });
}
