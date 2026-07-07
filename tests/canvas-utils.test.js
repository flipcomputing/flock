import { expect } from 'chai';
import {
  getCanvasCircle,
  destroyCanvasCircle,
  createCanvasCircle,
  moveCanvasCircle,
  clickCanvasCircle,
  startCanvasKeyboardMode,
  stopCanvasKeyboardMode,
  setCrosshairCursor,
  setDefaultCursor,
} from '../ui/canvas-utils.js';
import { KeyboardDispatcher } from '../main/keyboardDispatcher.js';
import {
  topHandler,
  makeKeyEvent as keyEvent,
  dispatchKeyup,
} from './utils/keyboardDispatcherTestUtils.js';

export function runCanvasUtilsTests(flock) {
  /* Do NOT assume that the CanvasCircle is in any particular place - set it at the start of each test */
  describe('ui/canvas-utils @canvasutils', function () {
    afterEach(function () {
      // These are module-level singletons shared across the whole test
      // session, so every test must leave them exactly as it found them.
      stopCanvasKeyboardMode();
      destroyCanvasCircle();
      setDefaultCursor();
    });

    describe('createCanvasCircle / destroyCanvasCircle / getCanvasCircle', function () {
      it('creates a single circle element appended to the document', function () {
        createCanvasCircle();
        const circle = getCanvasCircle();
        expect(circle).to.exist;
        expect(circle.classList.contains('canvas-selector-circle')).to.equal(true);
        expect(document.body.contains(circle)).to.equal(true);
      });

      it('does not create a second circle if one already exists', function () {
        createCanvasCircle();
        const first = getCanvasCircle();
        createCanvasCircle();
        expect(getCanvasCircle()).to.equal(first);
        expect(document.querySelectorAll('.canvas-selector-circle').length).to.equal(1);
      });

      it('destroyCanvasCircle removes it from the document and clears the reference', function () {
        createCanvasCircle();
        const circle = getCanvasCircle();
        destroyCanvasCircle();
        expect(getCanvasCircle()).to.equal(null);
        expect(document.body.contains(circle)).to.equal(false);
      });

      it('destroyCanvasCircle is a no-op when nothing exists', function () {
        expect(() => destroyCanvasCircle()).to.not.throw();
        expect(getCanvasCircle()).to.equal(null);
      });
    });

    describe('moveCanvasCircle', function () {
      it('is a no-op (does not throw) when no circle exists', function () {
        expect(() => moveCanvasCircle(10, 10)).to.not.throw();
      });

      it('moves the circle by the given delta', function () {
        createCanvasCircle();
        const canvas = flock.scene.getEngine().getRenderingCanvas();
        const before = canvas.getBoundingClientRect();
        moveCanvasCircle(5, -3);
        const circle = getCanvasCircle();
        const leftBefore = parseFloat(circle.style.left);
        moveCanvasCircle(20, 20);
        const leftAfter = parseFloat(circle.style.left);
        const topAfter = parseFloat(circle.style.top);
        expect(leftAfter - leftBefore).to.be.closeTo(20, 0.01);
        // Sense check: the circle is actually positioned relative to the canvas.
        expect(leftAfter).to.be.at.least(before.left);
        expect(topAfter).to.exist;
      });

      it('clamps position to the canvas bounds on the high side', function () {
        createCanvasCircle();
        const canvas = flock.scene.getEngine().getRenderingCanvas();
        const bounds = canvas.getBoundingClientRect();
        moveCanvasCircle(100000, 100000);
        const circle = getCanvasCircle();
        expect(parseFloat(circle.style.left)).to.be.closeTo(bounds.left + bounds.width - 10, 0.5);
      });

      it('clamps position to the canvas bounds on the low side', function () {
        createCanvasCircle();
        const canvas = flock.scene.getEngine().getRenderingCanvas();
        const bounds = canvas.getBoundingClientRect();
        moveCanvasCircle(-100000, -100000);
        const circle = getCanvasCircle();
        expect(parseFloat(circle.style.left)).to.be.closeTo(bounds.left + 10, 0.5);
      });
    });

    describe('clickCanvasCircle', function () {
      it('invokes the callback with the actual current circle position', function () {
        createCanvasCircle();
        // canvasCirclePosition is a module-level singleton that persists across
        // tests, so anchor to a known-safe interior position first — otherwise
        // leftover position from an earlier clamping test could sit right at
        // a boundary and silently absorb this test's delta.
        moveCanvasCircle(100000, 100000);
        moveCanvasCircle(-310, -175);

        let before = null;
        clickCanvasCircle((x, y) => (before = [x, y]));

        moveCanvasCircle(15, -7);

        let after = null;
        clickCanvasCircle((x, y) => (after = [x, y]));

        expect(after[0] - before[0]).to.be.closeTo(15, 0.01);
        expect(after[1] - before[1]).to.be.closeTo(-7, 0.01);
      });

      it('does not invoke the callback when no circle exists', function () {
        let called = false;
        clickCanvasCircle(() => (called = true));
        expect(called).to.equal(false);
      });
    });

    describe('setCrosshairCursor / setDefaultCursor', function () {
      it('setCrosshairCursor sets body and canvas cursor to crosshair', function () {
        setCrosshairCursor();
        expect(document.body.style.cursor).to.equal('crosshair');
        expect(flock.scene.defaultCursor).to.equal('crosshair');
      });

      it('setDefaultCursor restores the default cursor', function () {
        setCrosshairCursor();
        setDefaultCursor();
        expect(document.body.style.cursor).to.equal('default');
        expect(flock.scene.hoverCursor).to.equal('pointer');
      });
    });

    describe('startCanvasKeyboardMode / stopCanvasKeyboardMode', function () {
      it('pushes a KeyboardDispatcher mode while active', function () {
        const before = KeyboardDispatcher._modeStack.length;
        startCanvasKeyboardMode(() => {});
        expect(KeyboardDispatcher._modeStack.length).to.equal(before + 1);
      });

      it('stopCanvasKeyboardMode pops the mode back off', function () {
        const before = KeyboardDispatcher._modeStack.length;
        startCanvasKeyboardMode(() => {});
        stopCanvasKeyboardMode();
        expect(KeyboardDispatcher._modeStack.length).to.equal(before);
      });

      it('stopCanvasKeyboardMode is a no-op when not active', function () {
        expect(() => stopCanvasKeyboardMode()).to.not.throw();
      });

      it('does not create the circle immediately by default', function () {
        startCanvasKeyboardMode(() => {});
        expect(getCanvasCircle()).to.equal(null);
      });

      it('creates and shows the circle immediately when showCircleImmediately is true', function () {
        startCanvasKeyboardMode(() => {}, true);
        expect(getCanvasCircle()).to.exist;
        expect(document.body.style.cursor).to.equal('none');
      });

      it('starting a second time while active does not leak an extra mode', function () {
        const before = KeyboardDispatcher._modeStack.length;
        startCanvasKeyboardMode(() => {});
        startCanvasKeyboardMode(() => {});
        expect(KeyboardDispatcher._modeStack.length).to.equal(before + 1);
      });

      it('restores the default cursor after stopping', function () {
        startCanvasKeyboardMode(() => {}, true);
        stopCanvasKeyboardMode();
        expect(document.body.style.cursor).to.equal('default');
      });
    });

    describe('keyboard-mode arrow key movement', function () {
      afterEach(function () {
        // Clear any keys left "held" by a test that didn't release them.
        dispatchKeyup('ArrowRight');
        dispatchKeyup('ArrowLeft');
        dispatchKeyup('ArrowUp');
        dispatchKeyup('ArrowDown');
      });

      it('ArrowRight creates the circle on demand and moves it +x', function () {
        startCanvasKeyboardMode(() => {});
        expect(getCanvasCircle()).to.equal(null);
        topHandler()(keyEvent({ key: 'ArrowRight' }));
        expect(getCanvasCircle()).to.exist;
        dispatchKeyup('ArrowRight');
      });

      it('ArrowDown moves +y (screen-space down), not -y', function () {
        startCanvasKeyboardMode(() => {}, true);
        const before = parseFloat(getCanvasCircle().style.top);
        topHandler()(keyEvent({ key: 'ArrowDown' }));
        const after = parseFloat(getCanvasCircle().style.top);
        expect(after - before).to.be.closeTo(10, 0.01);
        dispatchKeyup('ArrowDown');
      });

      it('shiftKey uses the finer 2px step instead of the normal 10px', function () {
        startCanvasKeyboardMode(() => {}, true);
        const before = parseFloat(getCanvasCircle().style.left);
        topHandler()(keyEvent({ key: 'ArrowRight', shiftKey: true }));
        const after = parseFloat(getCanvasCircle().style.left);
        expect(after - before).to.be.closeTo(2, 0.01);
        dispatchKeyup('ArrowRight');
      });

      it('combines two simultaneously held arrow keys', function () {
        // Each keydown re-applies moveDistance for every currently-held arrow
        // key (this is what makes OS key-repeat continue moving the circle),
        // so pressing Right then Up while Right is still held moves x twice.
        startCanvasKeyboardMode(() => {}, true);
        const before = {
          x: parseFloat(getCanvasCircle().style.left),
          y: parseFloat(getCanvasCircle().style.top),
        };
        topHandler()(keyEvent({ key: 'ArrowRight' }));
        topHandler()(keyEvent({ key: 'ArrowUp' }));
        const after = {
          x: parseFloat(getCanvasCircle().style.left),
          y: parseFloat(getCanvasCircle().style.top),
        };
        expect(after.x - before.x).to.be.closeTo(20, 0.01);
        expect(after.y - before.y).to.be.closeTo(-10, 0.01);
      });

      it('releasing one held key via keyup stops it contributing to movement', function () {
        startCanvasKeyboardMode(() => {}, true);
        topHandler()(keyEvent({ key: 'ArrowRight' }));
        dispatchKeyup('ArrowRight');
        const before = parseFloat(getCanvasCircle().style.left);
        topHandler()(keyEvent({ key: 'ArrowUp' }));
        const after = parseFloat(getCanvasCircle().style.left);
        // ArrowRight was released, so a fresh ArrowUp press should not move x.
        expect(after).to.be.closeTo(before, 0.01);
      });
    });

    describe('Tab / Escape exit the mode', function () {
      it('Tab stops keyboard mode', function () {
        startCanvasKeyboardMode(() => {});
        const event = keyEvent({ key: 'Tab' });
        topHandler()(event);
        expect(KeyboardDispatcher._modeStack.some((m) => m.name === 'canvas-cursor')).to.equal(
          false
        );
      });

      it('Escape stops keyboard mode', function () {
        startCanvasKeyboardMode(() => {});
        topHandler()(keyEvent({ key: 'Escape' }));
        expect(KeyboardDispatcher._modeStack.some((m) => m.name === 'canvas-cursor')).to.equal(
          false
        );
      });
    });

    describe('Enter / Space click behaviour', function () {
      it('clicks through to the callback when there is no hit checker', function () {
        let called = false;
        startCanvasKeyboardMode(() => (called = true), true);
        topHandler()(keyEvent({ key: 'Enter' }));
        expect(called).to.equal(true);
      });

      it('clicks through when the hit checker approves the position', function () {
        let called = false;
        startCanvasKeyboardMode(
          () => (called = true),
          true,
          () => true
        );
        topHandler()(keyEvent({ key: ' ' }));
        expect(called).to.equal(true);
      });

      it('does not click and flags an invalid press when the hit checker rejects the position', function () {
        let called = false;
        startCanvasKeyboardMode(
          () => (called = true),
          true,
          () => false
        );
        topHandler()(keyEvent({ key: 'Enter' }));
        expect(called).to.equal(false);
        expect(
          getCanvasCircle().classList.contains('canvas-selector-circle--invalid-press')
        ).to.equal(true);
      });

      it('ignores Enter when focus is on a real button, letting the button handle it', function () {
        startCanvasKeyboardMode(() => {}, true);
        const button = document.createElement('button');
        document.body.appendChild(button);
        try {
          let prevented = false;
          topHandler()(
            keyEvent({
              key: 'Enter',
              target: button,
              preventDefault: () => (prevented = true),
            })
          );
          expect(prevented).to.equal(false);
        } finally {
          button.remove();
        }
      });
    });
  });
}
