import { expect } from "chai";
import { InputManager } from "../../input/inputManager.js";
import { OnScreenSource } from "../../input/onScreenSource.js";

class StubObservable {
  calls = [];
  notifyObservers(data) {
    this.calls.push(data);
  }
}

export function runOnScreenSourceTests() {
  describe("OnScreenSource @onscreensource @input", function () {
    let manager, pressObservable, releaseObservable, source;

    beforeEach(function () {
      manager = new InputManager();
      pressObservable = new StubObservable();
      releaseObservable = new StubObservable();
      source = new OnScreenSource(manager, { pressObservable, releaseObservable });
    });

    describe("press", function () {
      it("press('w') → manager.isKeyDown('w') true", function () {
        source.press("w");
        expect(manager.isKeyDown("w")).to.be.true;
      });

      it("press('w') → pressObservable fired once with 'w'", function () {
        source.press("w");
        expect(pressObservable.calls).to.deep.equal(["w"]);
      });

      it("press('w') → manager.onKeyDownObservable fired once", function () {
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        source.press("w");
        expect(fired).to.deep.equal(["w"]);
      });

      it("press('ArrowUp') → stored as 'ArrowUp' (named key not lowercased)", function () {
        source.press("ArrowUp");
        expect(manager.isKeyDown("ArrowUp")).to.be.true;
      });

      it("press(' ') → manager has ' '", function () {
        source.press(" ");
        expect(manager.isKeyDown(" ")).to.be.true;
      });

      it("press('Spacebar') → normalised to ' '", function () {
        source.press("Spacebar");
        expect(manager.isKeyDown(" ")).to.be.true;
        expect(pressObservable.calls).to.deep.equal([" "]);
      });

      it("repeated press('w') → pressObservable fires twice, onKeyDown fires once", function () {
        const keyDownFired = [];
        manager.onKeyDownObservable.add((k) => keyDownFired.push(k));
        source.press("w");
        source.press("w");
        expect(pressObservable.calls).to.deep.equal(["w", "w"]);
        expect(keyDownFired).to.have.lengthOf(1);
      });
    });

    describe("release", function () {
      it("release('w') after press('w') → manager state clears", function () {
        source.press("w");
        source.release("w");
        expect(manager.isKeyDown("w")).to.be.false;
      });

      it("release('w') after press('w') → releaseObservable fires", function () {
        source.press("w");
        source.release("w");
        expect(releaseObservable.calls).to.deep.equal(["w"]);
      });

      it("release('w') after press('w') → manager.onKeyUpObservable fires", function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        source.press("w");
        source.release("w");
        expect(fired).to.deep.equal(["w"]);
      });

      it("release('w') when not pressed → releaseObservable still fires (back-compat)", function () {
        source.release("w");
        expect(releaseObservable.calls).to.deep.equal(["w"]);
      });

      it("release('w') when not pressed → manager onKeyUp does not fire (idempotent)", function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        source.release("w");
        expect(fired).to.have.lengthOf(0);
      });
    });
  });
}
