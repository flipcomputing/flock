import { expect } from "chai";
import { InputManager } from "../../input/inputManager.js";

export function runInputManagerTests() {
  describe("InputManager @inputmanager @input", function () {
    let manager;

    beforeEach(function () {
      manager = new InputManager();
    });

    describe("_setKey / isKeyDown", function () {
      it("pressing a key makes isKeyDown return true", function () {
        manager._setKey("w", true);
        expect(manager.isKeyDown("w")).to.be.true;
      });

      it("releasing a key makes isKeyDown return false", function () {
        manager._setKey("w", true);
        manager._setKey("w", false);
        expect(manager.isKeyDown("w")).to.be.false;
      });

      it("isKeyDown is case-insensitive for single-char keys", function () {
        manager._setKey("w", true);
        expect(manager.isKeyDown("W")).to.be.true;
      });

      it("pressing the same key twice does not double-register", function () {
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        manager._setKey("w", true);
        manager._setKey("w", true);
        expect(fired).to.have.lengthOf(1);
      });
    });

    describe("heldKeyCount", function () {
      it("returns 0 when no keys held", function () {
        expect(manager.heldKeyCount()).to.equal(0);
      });

      it("increments as keys are pressed", function () {
        manager._setKey("w", true);
        manager._setKey("a", true);
        expect(manager.heldKeyCount()).to.equal(2);
      });

      it("decrements as keys are released", function () {
        manager._setKey("w", true);
        manager._setKey("w", false);
        expect(manager.heldKeyCount()).to.equal(0);
      });
    });

    describe("_clearAllKeys", function () {
      it("clears all held keys", function () {
        manager._setKey("w", true);
        manager._setKey("a", true);
        manager._clearAllKeys();
        expect(manager.heldKeyCount()).to.equal(0);
      });

      it("fires onKeyUpObservable for each held key", function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        manager._setKey("w", true);
        manager._setKey("a", true);
        manager._clearAllKeys();
        expect(fired).to.have.lengthOf(2);
        expect(fired).to.include("w");
        expect(fired).to.include("a");
      });

      it("does not affect heldKeyCount a second time when already empty", function () {
        manager._clearAllKeys();
        expect(manager.heldKeyCount()).to.equal(0);
      });
    });

    describe("observables", function () {
      it("onKeyDownObservable fires with the canonical key", function () {
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        manager._setKey("w", true);
        expect(fired).to.deep.equal(["w"]);
      });

      it("onKeyUpObservable fires when key is released", function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        manager._setKey("w", true);
        manager._setKey("w", false);
        expect(fired).to.deep.equal(["w"]);
      });

      it("onKeyUpObservable does not fire when releasing a key that was not down", function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        manager._setKey("w", false);
        expect(fired).to.have.lengthOf(0);
      });
    });
  });
}
