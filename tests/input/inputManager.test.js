import { expect } from 'chai';
import { InputManager } from '../../input/inputManager.js';

export function runInputManagerTests() {
  describe('InputManager @inputmanager @input', function () {
    let manager;

    beforeEach(function () {
      manager = new InputManager();
    });

    describe('_setKey / isKeyDown', function () {
      it('pressing a key makes isKeyDown return true', function () {
        manager._setKey('w', true);
        expect(manager.isKeyDown('w')).to.be.true;
      });

      it('releasing a key makes isKeyDown return false', function () {
        manager._setKey('w', true);
        manager._setKey('w', false);
        expect(manager.isKeyDown('w')).to.be.false;
      });

      it('isKeyDown is case-insensitive for single-char keys', function () {
        manager._setKey('w', true);
        expect(manager.isKeyDown('W')).to.be.true;
      });

      it('pressing the same key twice does not double-register', function () {
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        manager._setKey('w', true);
        manager._setKey('w', true);
        expect(fired).to.have.lengthOf(1);
      });
    });

    describe('heldKeyCount', function () {
      it('returns 0 when no keys held', function () {
        expect(manager.heldKeyCount()).to.equal(0);
      });

      it('increments as keys are pressed', function () {
        manager._setKey('w', true);
        manager._setKey('a', true);
        expect(manager.heldKeyCount()).to.equal(2);
      });

      it('decrements as keys are released', function () {
        manager._setKey('w', true);
        manager._setKey('w', false);
        expect(manager.heldKeyCount()).to.equal(0);
      });
    });

    describe('_clearAllKeys', function () {
      it('clears all held keys', function () {
        manager._setKey('w', true);
        manager._setKey('a', true);
        manager._clearAllKeys();
        expect(manager.heldKeyCount()).to.equal(0);
      });

      it('fires onKeyUpObservable for each held key', function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        manager._setKey('w', true);
        manager._setKey('a', true);
        manager._clearAllKeys();
        expect(fired).to.have.lengthOf(2);
        expect(fired).to.include('w');
        expect(fired).to.include('a');
      });

      it('does not affect heldKeyCount a second time when already empty', function () {
        manager._clearAllKeys();
        expect(manager.heldKeyCount()).to.equal(0);
      });

      it('fires onActionUpObservable for overridden bindings', function () {
        manager.setActionKey('FORWARD', 'x');
        manager._setKey('x', true);
        const fired = [];
        manager.onActionUpObservable.add((a) => fired.push(a));
        manager._clearAllKeys();
        expect(fired).to.include('FORWARD');
      });
    });

    describe('observables', function () {
      it('onKeyDownObservable fires with the canonical key', function () {
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        manager._setKey('w', true);
        expect(fired).to.deep.equal(['w']);
      });

      it('onKeyUpObservable fires when key is released', function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        manager._setKey('w', true);
        manager._setKey('w', false);
        expect(fired).to.deep.equal(['w']);
      });

      it('onKeyUpObservable does not fire when releasing a key that was not down', function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        manager._setKey('w', false);
        expect(fired).to.have.lengthOf(0);
      });
    });

    describe('refcount semantics', function () {
      it('two _setKey(w, true) then one _setKey(w, false) → still down, no onKeyUp', function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        manager._setKey('w', true);
        manager._setKey('w', true);
        manager._setKey('w', false);
        expect(manager.isKeyDown('w')).to.be.true;
        expect(fired).to.have.lengthOf(0);
      });

      it('two presses then two releases → up, onKeyUp fires once', function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        manager._setKey('w', true);
        manager._setKey('w', true);
        manager._setKey('w', false);
        manager._setKey('w', false);
        expect(manager.isKeyDown('w')).to.be.false;
        expect(fired).to.have.lengthOf(1);
      });

      it('_setKey(w, false) when count is 0 → no-op, count stays 0', function () {
        const fired = [];
        manager.onKeyUpObservable.add((k) => fired.push(k));
        manager._setKey('w', false);
        expect(manager.isKeyDown('w')).to.be.false;
        expect(fired).to.have.lengthOf(0);
      });

      it('onKeyDown fires only on 0→1 transition, not 1→2', function () {
        const fired = [];
        manager.onKeyDownObservable.add((k) => fired.push(k));
        manager._setKey('w', true);
        manager._setKey('w', true);
        expect(fired).to.have.lengthOf(1);
      });
    });

    describe('action observables', function () {
      it("pressing 'w' fires onActionDownObservable with 'FORWARD'", function () {
        const fired = [];
        manager.onActionDownObservable.add((a) => fired.push(a));
        manager._setKey('w', true);
        expect(fired).to.include('FORWARD');
      });

      it("pressing 'r' fires onActionDownObservable with 'BUTTON1'", function () {
        const fired = [];
        manager.onActionDownObservable.add((a) => fired.push(a));
        manager._setKey('r', true);
        expect(fired).to.include('BUTTON1');
      });

      it("releasing 'w' fires onActionUpObservable with 'FORWARD'", function () {
        const fired = [];
        manager.onActionUpObservable.add((a) => fired.push(a));
        manager._setKey('w', true);
        manager._setKey('w', false);
        expect(fired).to.include('FORWARD');
      });

      it('onActionDown fires only once when two keys for same action are pressed', function () {
        const fired = [];
        manager.onActionDownObservable.add((a) => fired.push(a));
        manager._setKey('w', true);
        manager._setKey('z', true);
        expect(fired.filter((a) => a === 'FORWARD')).to.have.lengthOf(1);
      });

      it('onActionUp fires only when last key for action is released', function () {
        const fired = [];
        manager.onActionUpObservable.add((a) => fired.push(a));
        manager._setKey('w', true);
        manager._setKey('z', true);
        manager._setKey('w', false);
        expect(fired.filter((a) => a === 'FORWARD')).to.have.lengthOf(0);
        manager._setKey('z', false);
        expect(fired.filter((a) => a === 'FORWARD')).to.have.lengthOf(1);
      });

      it('isActionDown returns true when a key for that action is held', function () {
        manager._setKey('r', true);
        expect(manager.isActionDown('BUTTON1')).to.be.true;
      });

      it('isActionDown returns false when no key for the action is held', function () {
        expect(manager.isActionDown('BUTTON1')).to.be.false;
      });

      it('isActionDown returns false for unknown action', function () {
        expect(manager.isActionDown('UNKNOWN')).to.be.false;
      });
    });

    describe('setActionKey normalisation', function () {
      it("uppercase key is normalised: setActionKey('FORWARD', 'X') → isActionDown true when 'x' pressed", function () {
        manager.setActionKey('FORWARD', 'X');
        manager._setKey('x', true);
        expect(manager.isActionDown('FORWARD')).to.be.true;
      });

      it("'Spacebar' alias is normalised: setActionKey('BUTTON4', 'Spacebar') → isActionDown true when ' ' pressed", function () {
        manager.setActionKey('BUTTON4', 'Spacebar');
        manager._setKey(' ', true);
        expect(manager.isActionDown('BUTTON4')).to.be.true;
      });

      it('ignores old static keys after an action override', function () {
        manager.setActionKey('FORWARD', 'i');
        const fired = [];
        manager.onActionDownObservable.add((a) => fired.push(a));
        manager._setKey('w', true);
        expect(fired).to.not.include('FORWARD');
      });
    });

    describe('hasActionOverride', function () {
      it('returns false initially', function () {
        expect(manager.hasActionOverride('BUTTON2')).to.be.false;
      });

      it('returns true after setActionKey', function () {
        manager.setActionKey('BUTTON2', 'q');
        expect(manager.hasActionOverride('BUTTON2')).to.be.true;
      });

      it('returns false after resetActionKeys', function () {
        manager.setActionKey('BUTTON2', 'q');
        manager.resetActionKeys();
        expect(manager.hasActionOverride('BUTTON2')).to.be.false;
      });
    });

    describe('axes', function () {
      it('_setAxis / getAxis round-trip', function () {
        manager._setAxis('LOOK_X', 0.7);
        expect(manager.getAxis('LOOK_X')).to.equal(0.7);
      });

      it('getAxis returns 0 for unknown axis', function () {
        expect(manager.getAxis('NOPE')).to.equal(0);
      });

      it('_setAxis overwrites previous value', function () {
        manager._setAxis('LOOK_X', 0.5);
        manager._setAxis('LOOK_X', 0);
        expect(manager.getAxis('LOOK_X')).to.equal(0);
      });
    });
  });
}
