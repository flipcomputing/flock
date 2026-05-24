import { expect } from "chai";
import { InputManager } from "../../input/inputManager.js";
import { OnScreenSource } from "../../input/onScreenSource.js";

export function runOnScreenSourceTests() {
  describe("OnScreenSource @onscreensource @input", function () {
    let manager, source;

    beforeEach(function () {
      manager = new InputManager();
      source = new OnScreenSource(manager);
    });

    describe("press", function () {
      it("press('w') → manager.isKeyDown('w') true", function () {
        source.press("w");
        expect(manager.isKeyDown("w")).to.be.true;
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
      });

      it("repeated press('w') → onKeyDown fires once (refcounted)", function () {
        const keyDownFired = [];
        manager.onKeyDownObservable.add((k) => keyDownFired.push(k));
        source.press("w");
        source.press("w");
        expect(keyDownFired).to.have.lengthOf(1);
      });
    });

    describe("release", function () {
      it("release('w') after press('w') → manager state clears", function () {
        source.press("w");
        source.release("w");
        expect(manager.isKeyDown("w")).to.be.false;
      });

      it("release('w') after press('w') → manager.onKeyUpObservable fires", function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        source.press("w");
        source.release("w");
        expect(fired).to.deep.equal(["w"]);
      });

      it("release('w') when not pressed → manager onKeyUp does not fire (idempotent)", function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        source.release("w");
        expect(fired).to.have.lengthOf(0);
      });
    });

    describe('releaseAll', function () {
      it('releaseAll() clears all held keys', function () {
        source.press('w');
        source.press('a');
        source.releaseAll();
        expect(manager.heldKeyCount()).to.equal(0);
      });

      it('releaseAll() fires onKeyUpObservable for each held key', function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        source.press('w');
        source.press('a');
        source.releaseAll();
        expect(fired).to.include('w');
        expect(fired).to.include('a');
      });

      it('releaseAll() when nothing held does not throw', function () {
        expect(() => source.releaseAll()).to.not.throw();
      });

      it("repeated press('w') then releaseAll() fires onKeyUpObservable once", function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        source.press('w');
        source.press('w');
        source.releaseAll();
        expect(fired).to.deep.equal(['w']);
        expect(manager.isKeyDown('w')).to.be.false;
      });

      it("multi-source: source.press('w') + source2.press('w') → source.releaseAll() leaves key down", function () {
        const source2 = new OnScreenSource(manager);
        source.press('w');
        source2.press('w');
        source.releaseAll();
        expect(manager.isKeyDown('w')).to.be.true;
      });

      it("multi-source: both sources release 'w' → onKeyUpObservable fires only on final release", function () {
        const source2 = new OnScreenSource(manager);
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        source.press('w');
        source2.press('w');
        source.releaseAll();
        expect(fired).to.have.lengthOf(0);
        source2.releaseAll();
        expect(fired).to.deep.equal(['w']);
        expect(manager.isKeyDown('w')).to.be.false;
      });
    });
  });
}
