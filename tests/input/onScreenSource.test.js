import { expect } from 'chai';
import { InputManager } from '../../input/inputManager.js';
import { OnScreenSource } from '../../input/onScreenSource.js';

export function runOnScreenSourceTests() {
  describe('OnScreenSource @onscreensource @input', function () {
    let manager, source;

    beforeEach(function () {
      manager = new InputManager();
      source = new OnScreenSource(manager);
    });

    describe('DOM bridge', function () {
      let target, bridgeSource;

      beforeEach(function () {
        target = new EventTarget();
        bridgeSource = new OnScreenSource(manager, { target });
      });

      it("press('w') dispatches keydown on target with key='w'", function () {
        const events = [];
        target.addEventListener('keydown', (e) => events.push(e));
        bridgeSource.press('w');
        expect(events).to.have.lengthOf(1);
        expect(events[0].key).to.equal('w');
      });

      it("press('ArrowUp') dispatches keydown with key='ArrowUp', code='ArrowUp', keyCode=38", function () {
        const events = [];
        target.addEventListener('keydown', (e) => events.push(e));
        bridgeSource.press('ArrowUp');
        expect(events).to.have.lengthOf(1);
        expect(events[0].key).to.equal('ArrowUp');
        expect(events[0].code).to.equal('ArrowUp');
        expect(events[0].keyCode).to.equal(38);
      });

      it("press('PageUp') dispatches keydown with key='PageUp', code='PageUp', keyCode=33", function () {
        const events = [];
        target.addEventListener('keydown', (e) => events.push(e));
        bridgeSource.press('PageUp');
        expect(events[0].key).to.equal('PageUp');
        expect(events[0].code).to.equal('PageUp');
        expect(events[0].keyCode).to.equal(33);
      });

      it("press('w') dispatches keydown with code='KeyW' and keyCode=87", function () {
        const events = [];
        target.addEventListener('keydown', (e) => events.push(e));
        bridgeSource.press('w');
        expect(events[0].code).to.equal('KeyW');
        expect(events[0].keyCode).to.equal(87);
      });

      it("press('q') dispatches keydown with code='KeyQ' and keyCode=81 (AZERTY LEFT alias)", function () {
        const events = [];
        target.addEventListener('keydown', (e) => events.push(e));
        bridgeSource.press('q');
        expect(events[0].code).to.equal('KeyQ');
        expect(events[0].keyCode).to.equal(81);
      });

      it("press('z') dispatches keydown with code='KeyZ' and keyCode=90 (AZERTY FORWARD alias)", function () {
        const events = [];
        target.addEventListener('keydown', (e) => events.push(e));
        bridgeSource.press('z');
        expect(events[0].code).to.equal('KeyZ');
        expect(events[0].keyCode).to.equal(90);
      });

      it('dispatched keydown event is tagged __flockSynthetic=true', function () {
        const events = [];
        target.addEventListener('keydown', (e) => events.push(e));
        bridgeSource.press('w');
        expect(events[0].__flockSynthetic).to.be.true;
      });

      it('release dispatches keyup on target', function () {
        const events = [];
        target.addEventListener('keyup', (e) => events.push(e));
        bridgeSource.press('w');
        bridgeSource.release('w');
        expect(events).to.have.lengthOf(1);
        expect(events[0].key).to.equal('w');
        expect(events[0].__flockSynthetic).to.be.true;
      });

      it('repeated press does not dispatch a second keydown (0→1 only)', function () {
        const events = [];
        target.addEventListener('keydown', (e) => events.push(e));
        bridgeSource.press('w');
        bridgeSource.press('w');
        expect(events).to.have.lengthOf(1);
      });

      it('keyup is dispatched only on final release (refcount 2→1 fires no keyup)', function () {
        const events = [];
        target.addEventListener('keyup', (e) => events.push(e));
        bridgeSource.press('w');
        bridgeSource.press('w');
        bridgeSource.release('w');
        expect(events).to.have.lengthOf(0);
        bridgeSource.release('w');
        expect(events).to.have.lengthOf(1);
      });

      it('releaseAll dispatches keyup for each held key', function () {
        const events = [];
        target.addEventListener('keyup', (e) => events.push(e));
        bridgeSource.press('w');
        bridgeSource.press('ArrowUp');
        bridgeSource.releaseAll();
        const keys = events.map((e) => e.key);
        expect(keys).to.include('w');
        expect(keys).to.include('ArrowUp');
      });

      it('releaseAll dispatches keyup only once per key even when pressed twice', function () {
        const events = [];
        target.addEventListener('keyup', (e) => events.push(e));
        bridgeSource.press('w');
        bridgeSource.press('w');
        bridgeSource.releaseAll();
        expect(events.filter((e) => e.key === 'w')).to.have.lengthOf(1);
      });

      it('refcount integrity: press △ keys then release △ leaves isKeyDown false and heldKeyCount 0', function () {
        bridgeSource.press('w');
        bridgeSource.press('ArrowUp');
        bridgeSource.release('w');
        bridgeSource.release('ArrowUp');
        expect(manager.isKeyDown('w')).to.be.false;
        expect(manager.isKeyDown('ArrowUp')).to.be.false;
        expect(manager.heldKeyCount()).to.equal(0);
      });
    });

    describe('press', function () {
      it("press('w') → manager.isKeyDown('w') true", function () {
        source.press('w');
        expect(manager.isKeyDown('w')).to.be.true;
      });

      it("press('w') → manager.onKeyDownObservable fired once", function () {
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        source.press('w');
        expect(fired).to.deep.equal(['w']);
      });

      it("press('ArrowUp') → stored as 'ArrowUp' (named key not lowercased)", function () {
        source.press('ArrowUp');
        expect(manager.isKeyDown('ArrowUp')).to.be.true;
      });

      it("press(' ') → manager has ' '", function () {
        source.press(' ');
        expect(manager.isKeyDown(' ')).to.be.true;
      });

      it("press('Spacebar') → normalised to ' '", function () {
        source.press('Spacebar');
        expect(manager.isKeyDown(' ')).to.be.true;
      });

      it("repeated press('w') → onKeyDown fires once (refcounted)", function () {
        const keyDownFired = [];
        manager.onKeyDownObservable.add((k) => keyDownFired.push(k));
        source.press('w');
        source.press('w');
        expect(keyDownFired).to.have.lengthOf(1);
      });
    });

    describe('release', function () {
      it("release('w') after press('w') → manager state clears", function () {
        source.press('w');
        source.release('w');
        expect(manager.isKeyDown('w')).to.be.false;
      });

      it("release('w') after press('w') → manager.onKeyUpObservable fires", function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        source.press('w');
        source.release('w');
        expect(fired).to.deep.equal(['w']);
      });

      it("release('w') when not pressed → manager onKeyUp does not fire (idempotent)", function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        source.release('w');
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

      it('press → releaseAll → press again fires onKeyDownObservable (scene-restart clean state)', function () {
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        source.press('w');
        source.releaseAll();
        source.press('w');
        expect(fired).to.deep.equal(['w', 'w']);
        expect(manager.isKeyDown('w')).to.be.true;
      });
    });

    describe('pause / resume (fly camera mode)', function () {
      it('pause() releases held keys from InputManager', function () {
        source.press('w');
        expect(manager.isKeyDown('w')).to.be.true;
        source.pause();
        expect(manager.isKeyDown('w')).to.be.false;
      });

      it('press while paused does not set key in InputManager', function () {
        source.pause();
        source.press('w');
        expect(manager.isKeyDown('w')).to.be.false;
      });

      it('press while paused still dispatches DOM keydown', function () {
        const target = new EventTarget();
        const paused = new OnScreenSource(manager, { target });
        const events = [];
        target.addEventListener('keydown', (e) => events.push(e));
        paused.pause();
        paused.press('w');
        expect(events).to.have.lengthOf(1);
        expect(events[0].key).to.equal('w');
      });

      it('release while paused does not call _setKey but dispatches DOM keyup', function () {
        const target = new EventTarget();
        const paused = new OnScreenSource(manager, { target });
        paused.press('w');
        paused.pause();
        const keyups = [];
        target.addEventListener('keyup', (e) => keyups.push(e));
        paused.release('w');
        expect(manager.isKeyDown('w')).to.be.false;
        expect(keyups).to.have.lengthOf(1);
      });

      it('resume() clears keys pressed while paused and restores InputManager updates', function () {
        source.pause();
        source.press('w');
        source.resume();
        expect(manager.isKeyDown('w')).to.be.false;
        source.press('a');
        expect(manager.isKeyDown('a')).to.be.true;
      });

      it('pause() is idempotent', function () {
        source.press('w');
        source.pause();
        source.pause();
        expect(manager.isKeyDown('w')).to.be.false;
        expect(manager.heldKeyCount()).to.equal(0);
      });

      it('resume() is idempotent', function () {
        source.pause();
        source.resume();
        expect(() => source.resume()).to.not.throw();
        source.press('w');
        expect(manager.isKeyDown('w')).to.be.true;
      });
    });
  });
}
