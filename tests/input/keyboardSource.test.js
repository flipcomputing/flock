import { expect } from "chai";
import { InputManager } from "../../input/inputManager.js";
import { KeyboardSource } from "../../input/keyboardSource.js";

function keydown(target, key) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
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
    });

    describe("stop", function () {
      it("stop() prevents subsequent keydown from registering", function () {
        source.start();
        source.stop();
        keydown(target, "w");
        expect(manager.isKeyDown("w")).to.be.false;
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
