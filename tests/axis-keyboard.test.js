import { expect } from 'chai';
import { createAxisKeyboardHandler } from '../ui/axis-keyboard.js';
import { KeyboardDispatcher } from '../main/keyboardDispatcher.js';
import { topHandler, makeKeyEvent as makeEvent } from './utils/keyboardDispatcherTestUtils.js';

export function runAxisKeyboardTests(flock) {
  describe('ui/axis-keyboard @axiskeyboard', function () {
    let stop;
    let moves;
    let axisChanges;
    let confirmed;
    let cancelled;

    function make(overrides = {}) {
      moves = [];
      axisChanges = [];
      confirmed = 0;
      cancelled = 0;
      stop = createAxisKeyboardHandler({
        onMove: (x, y, z) => moves.push([x, y, z]),
        onConfirm: () => confirmed++,
        onCancel: () => cancelled++,
        onAxisChange: (a) => axisChanges.push(a),
        stepNormal: 0.1,
        stepFast: 1,
        ...overrides,
      });
      return stop;
    }

    afterEach(function () {
      // Enter/Escape already pop the mode; calling stop() again is a no-op,
      // so this is safe whether or not the test already stopped it.
      stop?.();
      stop = null;
    });

    describe('mode registration', function () {
      it('pushes exactly one mode onto the KeyboardDispatcher stack', function () {
        const before = KeyboardDispatcher._modeStack.length;
        make();
        expect(KeyboardDispatcher._modeStack.length).to.equal(before + 1);
      });

      it('stop() pops the mode back off the stack', function () {
        const before = KeyboardDispatcher._modeStack.length;
        make();
        stop();
        expect(KeyboardDispatcher._modeStack.length).to.equal(before);
      });

      it('stop() is idempotent (a second call does not pop an extra mode)', function () {
        const before = KeyboardDispatcher._modeStack.length;
        make();
        stop();
        stop();
        expect(KeyboardDispatcher._modeStack.length).to.equal(before);
      });
    });

    describe('axis toggling (x/y/z)', function () {
      it("'x' locks to the x axis and reports it via onAxisChange", function () {
        make();
        topHandler()(makeEvent({ key: 'x' }));
        expect(stop.getAxis()).to.equal('x');
        expect(axisChanges).to.deep.equal(['x']);
      });

      it("pressing 'x' again unlocks back to free movement", function () {
        make();
        topHandler()(makeEvent({ key: 'x' }));
        topHandler()(makeEvent({ key: 'x' }));
        expect(stop.getAxis()).to.equal(null);
        expect(axisChanges).to.deep.equal(['x', null]);
      });

      it("'Y' (uppercase) locks to the y axis", function () {
        make();
        topHandler()(makeEvent({ key: 'Y' }));
        expect(stop.getAxis()).to.equal('y');
      });

      it("'z' locks to the z axis", function () {
        make();
        topHandler()(makeEvent({ key: 'z' }));
        expect(stop.getAxis()).to.equal('z');
      });

      it('switching from x to y replaces the lock rather than combining', function () {
        make();
        topHandler()(makeEvent({ key: 'x' }));
        topHandler()(makeEvent({ key: 'y' }));
        expect(stop.getAxis()).to.equal('y');
      });
    });

    describe("uniform axis ('u') gated by allowUniform", function () {
      it('is ignored when allowUniform is false (default)', function () {
        make();
        topHandler()(makeEvent({ key: 'u' }));
        expect(stop.getAxis()).to.equal(null);
        expect(axisChanges).to.deep.equal([]);
      });

      it('does not call preventDefault when ignored', function () {
        make();
        const event = makeEvent({ key: 'u' });
        topHandler()(event);
        expect(event.defaultPrevented).to.equal(false);
      });

      it("locks to 'all' when allowUniform is true", function () {
        make({ allowUniform: true });
        topHandler()(makeEvent({ key: 'u' }));
        expect(stop.getAxis()).to.equal('all');
        expect(axisChanges).to.deep.equal(['all']);
      });

      it("toggles 'all' back off on a second 'u' press", function () {
        make({ allowUniform: true });
        topHandler()(makeEvent({ key: 'u' }));
        topHandler()(makeEvent({ key: 'u' }));
        expect(stop.getAxis()).to.equal(null);
      });
    });

    describe('initialAxis / normalizeAxis', function () {
      it("collapses an initial 'all' to 'x' when allowUniform is false", function () {
        make({ initialAxis: 'all', allowUniform: false });
        expect(stop.getAxis()).to.equal('x');
      });

      it("keeps an initial 'all' when allowUniform is true", function () {
        make({ initialAxis: 'all', allowUniform: true });
        expect(stop.getAxis()).to.equal('all');
      });

      it('respects a single-axis initialAxis regardless of allowUniform', function () {
        make({ initialAxis: 'z' });
        expect(stop.getAxis()).to.equal('z');
      });
    });

    describe('stop.setAxis', function () {
      it('updates the current axis', function () {
        make();
        stop.setAxis('y');
        expect(stop.getAxis()).to.equal('y');
      });

      it("normalizes 'all' to 'x' when allowUniform is false", function () {
        make({ allowUniform: false });
        stop.setAxis('all');
        expect(stop.getAxis()).to.equal('x');
      });
    });

    describe('arrow keys — free movement (no axis locked)', function () {
      it("ArrowRight moves +x and reports axis 'x'", function () {
        make();
        topHandler()(makeEvent({ key: 'ArrowRight' }));
        expect(moves).to.deep.equal([[1, 0, 0]]);
        expect(axisChanges).to.deep.equal(['x']);
      });

      it("ArrowLeft moves -x and reports axis 'x'", function () {
        make();
        topHandler()(makeEvent({ key: 'ArrowLeft' }));
        expect(moves).to.deep.equal([[-1, 0, 0]]);
        expect(axisChanges).to.deep.equal(['x']);
      });

      it("ArrowUp moves +z (depth) and reports axis 'z', not y", function () {
        make();
        topHandler()(makeEvent({ key: 'ArrowUp' }));
        expect(moves).to.deep.equal([[0, 0, 1]]);
        expect(axisChanges).to.deep.equal(['z']);
      });

      it("ArrowDown moves -z and reports axis 'z'", function () {
        make();
        topHandler()(makeEvent({ key: 'ArrowDown' }));
        expect(moves).to.deep.equal([[0, 0, -1]]);
        expect(axisChanges).to.deep.equal(['z']);
      });
    });

    describe('arrow keys — axis locked', function () {
      it("moves only along the locked axis, ignoring the arrow's own direction axis", function () {
        make();
        stop.setAxis('y');
        topHandler()(makeEvent({ key: 'ArrowRight' }));
        expect(moves).to.deep.equal([[0, 1, 0]]);
      });

      it('ArrowLeft/Down still apply the negative sign on the locked axis', function () {
        make();
        stop.setAxis('y');
        topHandler()(makeEvent({ key: 'ArrowLeft' }));
        expect(moves).to.deep.equal([[0, -1, 0]]);
      });

      it("locking to 'all' moves every axis together", function () {
        make({ allowUniform: true });
        stop.setAxis('all');
        topHandler()(makeEvent({ key: 'ArrowRight' }));
        expect(moves).to.deep.equal([[1, 1, 1]]);
      });

      it('does not fire onAxisChange again while already locked', function () {
        make();
        stop.setAxis('y');
        axisChanges.length = 0;
        topHandler()(makeEvent({ key: 'ArrowRight' }));
        expect(axisChanges).to.deep.equal([]);
      });
    });

    describe('step size (shiftKey)', function () {
      it('uses stepFast by default (no shift)', function () {
        make({ stepNormal: 0.1, stepFast: 5 });
        topHandler()(makeEvent({ key: 'ArrowRight' }));
        expect(moves).to.deep.equal([[5, 0, 0]]);
      });

      it('uses stepNormal (finer) when shiftKey is held', function () {
        make({ stepNormal: 0.1, stepFast: 5 });
        topHandler()(makeEvent({ key: 'ArrowRight', shiftKey: true }));
        expect(moves).to.deep.equal([[0.1, 0, 0]]);
      });
    });

    describe('PageUp / PageDown', function () {
      it('PageUp moves +y when no axis is locked', function () {
        make();
        topHandler()(makeEvent({ key: 'PageUp' }));
        expect(moves).to.deep.equal([[0, 1, 0]]);
        expect(axisChanges).to.deep.equal(['y']);
      });

      it('PageDown moves -y when no axis is locked', function () {
        make();
        topHandler()(makeEvent({ key: 'PageDown' }));
        expect(moves).to.deep.equal([[0, -1, 0]]);
      });

      it("PageUp moves all axes together when locked to 'all'", function () {
        make({ allowUniform: true });
        stop.setAxis('all');
        topHandler()(makeEvent({ key: 'PageUp' }));
        expect(moves).to.deep.equal([[1, 1, 1]]);
      });

      it('is a no-op when locked to a single specific axis (x/y/z)', function () {
        make();
        stop.setAxis('x');
        topHandler()(makeEvent({ key: 'PageUp' }));
        expect(moves).to.deep.equal([]);
      });
    });

    describe('Enter / Space (confirm)', function () {
      it('Enter calls onConfirm and stops (pops the mode)', function () {
        const before = KeyboardDispatcher._modeStack.length;
        make();
        topHandler()(makeEvent({ key: 'Enter' }));
        expect(confirmed).to.equal(1);
        expect(KeyboardDispatcher._modeStack.length).to.equal(before);
      });

      it('Space also confirms', function () {
        make();
        topHandler()(makeEvent({ key: ' ' }));
        expect(confirmed).to.equal(1);
      });

      it('getAxis() reads null after stop via confirm', function () {
        make();
        topHandler()(makeEvent({ key: 'x' }));
        topHandler()(makeEvent({ key: 'Enter' }));
        expect(stop.getAxis()).to.equal(null);
      });
    });

    describe('Escape (cancel)', function () {
      it('calls onCancel and stops without calling onConfirm', function () {
        make();
        topHandler()(makeEvent({ key: 'Escape' }));
        expect(cancelled).to.equal(1);
        expect(confirmed).to.equal(0);
      });
    });

    describe('ignored input', function () {
      it('ignores the event when ctrlKey is held', function () {
        make();
        topHandler()(makeEvent({ key: 'x', ctrlKey: true }));
        expect(stop.getAxis()).to.equal(null);
      });

      it('ignores the event when metaKey is held', function () {
        make();
        topHandler()(makeEvent({ key: 'ArrowRight', metaKey: true }));
        expect(moves).to.deep.equal([]);
      });

      it('ignores the event when altKey is held', function () {
        make();
        topHandler()(makeEvent({ key: 'x', altKey: true }));
        expect(stop.getAxis()).to.equal(null);
      });

      it('ignores keys typed into an <input> element', function () {
        make();
        const input = document.createElement('input');
        topHandler()(makeEvent({ key: 'ArrowRight', target: input }));
        expect(moves).to.deep.equal([]);
      });

      it('ignores keys while focus is inside #codePanel', function () {
        make();
        const panel = document.createElement('div');
        panel.id = 'codePanel';
        const child = document.createElement('span');
        panel.appendChild(child);
        document.body.appendChild(panel);
        try {
          topHandler()(makeEvent({ key: 'ArrowRight', target: child }));
          expect(moves).to.deep.equal([]);
        } finally {
          panel.remove();
        }
      });
    });
  });
}
