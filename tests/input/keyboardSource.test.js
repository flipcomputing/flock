import { expect } from "chai";
import { InputManager } from "../../input/inputManager.js";
import { KeyboardSource } from "../../input/keyboardSource.js";

function keydown(target, key) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function keydown_repeat(target, key) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, repeat: true, bubbles: true }));
}

function keyup(target, key) {
  target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
}

export function runKeyboardSourceTests() {
  describe("KeyboardSource @keyboardsource @input", function () {
    let manager, target, source;

    beforeEach(function () {
      manager = new InputManager();
      target = new EventTarget();
      source = new KeyboardSource(manager, { target });
    });

    afterEach(function () {
      source.stop();
    });

    describe("start / keydown / keyup", function () {
      it("keydown 'w' → isKeyDown('w') true", function () {
        source.start();
        keydown(target, "w");
        expect(manager.isKeyDown("w")).to.be.true;
      });

      it("onKeyDownObservable fires once with 'w'", function () {
        source.start();
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        keydown(target, "w");
        expect(fired).to.deep.equal(["w"]);
      });

      it("keydown 'W' (Shift) → stored as canonical 'w'", function () {
        source.start();
        keydown(target, "W");
        expect(manager.isKeyDown("w")).to.be.true;
      });

      it("keydown ' ' → isKeyDown(' ') true", function () {
        source.start();
        keydown(target, " ");
        expect(manager.isKeyDown(" ")).to.be.true;
      });

      it("keydown 'Spacebar' → isKeyDown(' ') true", function () {
        source.start();
        keydown(target, "Spacebar");
        expect(manager.isKeyDown(" ")).to.be.true;
      });

      it("keydown 'ArrowUp' → isKeyDown('ArrowUp') true (named key passes through)", function () {
        source.start();
        keydown(target, "ArrowUp");
        expect(manager.isKeyDown("ArrowUp")).to.be.true;
      });

      it("keyup releases the key", function () {
        source.start();
        keydown(target, "w");
        keyup(target, "w");
        expect(manager.isKeyDown("w")).to.be.false;
      });
    });

    describe("blur handling", function () {
      it("blur on target clears all keys", function () {
        source.start();
        keydown(target, "w");
        target.dispatchEvent(new Event("blur"));
        expect(manager.heldKeyCount()).to.equal(0);
      });

      it("blur on target fires onKeyUpObservable for each held key", function () {
        source.start();
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        keydown(target, "w");
        target.dispatchEvent(new Event("blur"));
        expect(fired).to.include("w");
      });

      it("blur on target calls the onBlur callback", function () {
        let called = false;
        source.stop();
        source = new KeyboardSource(manager, {
          target,
          onBlur: () => { called = true; },
        });
        source.start();
        target.dispatchEvent(new Event("blur"));
        expect(called).to.be.true;
      });

      it("blur on window clears all keys", function () {
        source.start();
        keydown(target, "w");
        window.dispatchEvent(new Event("blur"));
        expect(manager.heldKeyCount()).to.equal(0);
      });

      it("blur on target releases only keyboard-owned keys, leaving keys from other sources intact", function () {
        source.start();
        keydown(target, "w");
        manager._setKey("e", true); // simulate another source (e.g. gamepad)
        target.dispatchEvent(new Event("blur"));
        expect(manager.isKeyDown("w")).to.be.false;
        expect(manager.isKeyDown("e")).to.be.true;
        manager._setKey("e", false); // cleanup
      });
    });

    describe("key repeat", function () {
      it("repeated keydown events do not increment refcount beyond 1", function () {
        source.start();
        keydown(target, "w");
        keydown_repeat(target, "w");
        keydown_repeat(target, "w");
        keyup(target, "w");
        expect(manager.isKeyDown("w")).to.be.false;
      });

      it("repeated keydown does not re-fire onKeyDownObservable", function () {
        source.start();
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        keydown(target, "w");
        keydown_repeat(target, "w");
        keydown_repeat(target, "w");
        expect(fired).to.have.lengthOf(1);
      });
    });

    describe("stop", function () {
      it("stop() prevents subsequent keydown from registering", function () {
        source.start();
        source.stop();
        keydown(target, "w");
        expect(manager.isKeyDown("w")).to.be.false;
      });

      it("stop() before start() does not throw", function () {
        expect(() => source.stop()).to.not.throw();
      });

      it("stop() twice does not throw", function () {
        source.start();
        source.stop();
        expect(() => source.stop()).to.not.throw();
      });
    });

    describe("idempotent start", function () {
      it("calling start() twice does not double-register — one keydown fires observable once", function () {
        source.start();
        source.start();
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        keydown(target, "w");
        expect(fired).to.have.lengthOf(1);
      });
    });
  });
}
