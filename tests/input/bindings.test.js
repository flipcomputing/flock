import { expect } from 'chai';
import { ACTIONS, DEFAULT_BINDINGS, getBoundKeys, isKnownAction } from '../../input/bindings.js';

const EXPECTED_ACTIONS = [
  'FORWARD',
  'BACKWARD',
  'LEFT',
  'RIGHT',
  'BUTTON1',
  'BUTTON2',
  'BUTTON3',
  'BUTTON4',
  'A11Y_I',
  'A11Y_J',
  'A11Y_K',
  'A11Y_L',
];

export function runBindingsTests() {
  describe('input/bindings @bindings @input', function () {
    describe('ACTIONS', function () {
      it('contains exactly the 12 expected names in expected order', function () {
        expect(ACTIONS).to.deep.equal(EXPECTED_ACTIONS);
      });

      it('is frozen', function () {
        expect(Object.isFrozen(ACTIONS)).to.be.true;
      });
    });

    describe('DEFAULT_BINDINGS', function () {
      it('has an entry for every action in ACTIONS', function () {
        for (const action of ACTIONS) {
          expect(DEFAULT_BINDINGS).to.have.property(action);
        }
      });

      it('has no extra entries beyond ACTIONS', function () {
        expect(Object.keys(DEFAULT_BINDINGS)).to.have.lengthOf(ACTIONS.length);
      });

      it('is frozen', function () {
        expect(Object.isFrozen(DEFAULT_BINDINGS)).to.be.true;
      });
    });

    describe('getBoundKeys', function () {
      it('returns defaults when no overrides supplied', function () {
        expect(getBoundKeys('FORWARD', {})).to.deep.equal(DEFAULT_BINDINGS.FORWARD);
      });

      it('returns defaults when overrides is undefined', function () {
        expect(getBoundKeys('FORWARD', undefined)).to.deep.equal(DEFAULT_BINDINGS.FORWARD);
      });

      it('returns the override when one is set for that action', function () {
        expect(getBoundKeys('FORWARD', { FORWARD: ['x'] })).to.deep.equal(['x']);
      });

      it('falls back to defaults for an action not in overrides', function () {
        expect(getBoundKeys('BACKWARD', { FORWARD: ['x'] })).to.deep.equal(
          DEFAULT_BINDINGS.BACKWARD
        );
      });

      it('returns undefined for an unknown action', function () {
        expect(getBoundKeys('UNKNOWN', {})).to.be.undefined;
      });
    });

    describe('isKnownAction', function () {
      it('returns true for each action in ACTIONS', function () {
        for (const action of ACTIONS) {
          expect(isKnownAction(action)).to.be.true;
        }
      });

      it('returns false for an unknown action', function () {
        expect(isKnownAction('UNKNOWN')).to.be.false;
      });

      it('returns false for empty string', function () {
        expect(isKnownAction('')).to.be.false;
      });
    });
  });
}
