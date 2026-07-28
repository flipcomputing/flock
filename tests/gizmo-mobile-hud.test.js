import { expect } from 'chai';
import { createGizmoMobileHud } from '../ui/gizmo-mobile-hud.js';

function findHud(flock) {
  return flock.scene.textures.find((t) => t.name === 'GizmoHUD');
}

function findControl(flock, name) {
  const hud = findHud(flock);
  return hud?.getDescendants(false, (c) => c.name === name)[0] ?? null;
}

const COLLAPSED_KEY = 'flock-gizmo-hud-collapsed';

// A dispatched PointerEvent has no active pointer behind it, so the slider's
// canvas.setPointerCapture() throws NotFoundError here even though it is fine
// in a real browser. Stub it for the dispatch — it is incidental to what these
// tests assert.
function withoutPointerCapture(canvas, fn) {
  const real = canvas.setPointerCapture;
  canvas.setPointerCapture = () => {};
  try {
    fn();
  } finally {
    canvas.setPointerCapture = real;
  }
}

export function runGizmoMobileHudTests(flock) {
  describe('ui/gizmo-mobile-hud @gizmomobilehud', function () {
    let stop;
    let moves;
    let axisChanges;

    // The collapsed preference persists in localStorage, so without this a
    // single collapse test would silently invalidate every later assertion.
    beforeEach(function () {
      localStorage.removeItem(COLLAPSED_KEY);
    });

    function make(overrides = {}) {
      moves = [];
      axisChanges = [];
      stop = createGizmoMobileHud({
        onMove: (x, y, z) => moves.push([x, y, z]),
        onAxisChange: (a) => axisChanges.push(a),
        stepNormal: 0.1,
        stepFast: 1,
        ...overrides,
      });
      return stop;
    }

    afterEach(function () {
      stop?.();
      stop = null;
      flock.controlsTexture = undefined;
      flock._joystickSource = undefined;
      localStorage.removeItem(COLLAPSED_KEY);
    });

    describe('guard clause', function () {
      it('returns null when flock.GUI is unavailable', function () {
        const savedGUI = flock.GUI;
        flock.GUI = undefined;
        try {
          const result = createGizmoMobileHud({ onMove: () => {} });
          expect(result).to.equal(null);
        } finally {
          flock.GUI = savedGUI;
        }
      });
    });

    describe('lifecycle', function () {
      it("creates a fullscreen 'GizmoHUD' texture on the scene", function () {
        make();
        expect(findHud(flock)).to.exist;
      });

      it('stop() disposes the HUD texture', function () {
        make();
        stop();
        expect(findHud(flock)).to.not.exist;
        stop = null;
      });

      it('stop() is idempotent', function () {
        make();
        expect(() => {
          stop();
          stop();
        }).to.not.throw();
        stop = null;
      });

      it('hides existing on-screen controls while active and restores them on stop', function () {
        flock.controlsTexture = { rootContainer: { isVisible: true } };
        make();
        expect(flock.controlsTexture.rootContainer.isVisible).to.equal(false);
        stop();
        expect(flock.controlsTexture.rootContainer.isVisible).to.equal(true);
        stop = null;
      });

      it('pauses the joystick source while active and resumes it on stop', function () {
        let paused = false;
        flock._joystickSource = {
          pause: () => (paused = true),
          resume: () => (paused = false),
        };
        make();
        expect(paused).to.equal(true);
        stop();
        expect(paused).to.equal(false);
        stop = null;
      });
    });

    describe('axis buttons', function () {
      it('creates exactly x/y/z buttons by default (no uniform)', function () {
        make();
        expect(findControl(flock, 'gizmo-axis-x')).to.exist;
        expect(findControl(flock, 'gizmo-axis-y')).to.exist;
        expect(findControl(flock, 'gizmo-axis-z')).to.exist;
        expect(findControl(flock, 'gizmo-axis-all')).to.not.exist;
      });

      it("also creates the uniform 'all' button when showUniform is true", function () {
        make({ showUniform: true });
        expect(findControl(flock, 'gizmo-axis-all')).to.exist;
      });

      it('clicking an axis button fires onAxisChange with that axis', function () {
        make();
        findControl(flock, 'gizmo-axis-y').onPointerUpObservable.notifyObservers();
        expect(axisChanges).to.deep.equal(['y']);
      });

      it('clicking the already-selected axis button does not re-fire onAxisChange', function () {
        make({ initialAxis: 'x' });
        findControl(flock, 'gizmo-axis-x').onPointerUpObservable.notifyObservers();
        expect(axisChanges).to.deep.equal([]);
      });

      it('stop.setAxis switches the active axis without throwing', function () {
        make();
        expect(() => stop.setAxis('z')).to.not.throw();
      });

      it('stop.setAxis ignores an unknown axis key', function () {
        make({ initialAxis: 'x' });
        stop.setAxis('bogus');
        // Selecting y afterwards should still work normally if the bogus
        // setAxis call was safely ignored rather than corrupting state.
        findControl(flock, 'gizmo-axis-y').onPointerUpObservable.notifyObservers();
        expect(axisChanges).to.deep.equal(['y']);
      });
    });

    describe("mode: 'arrows'", function () {
      it('creates a negative and positive arrow button', function () {
        make({ mode: 'arrows' });
        expect(findControl(flock, 'gizmo-arrow--1')).to.exist;
        expect(findControl(flock, 'gizmo-arrow-1')).to.exist;
      });

      it('pressing the positive arrow immediately moves +stepNormal on the current axis', function () {
        make({ mode: 'arrows', initialAxis: 'x', stepNormal: 0.1, stepFast: 1 });
        findControl(flock, 'gizmo-arrow-1').onPointerDownObservable.notifyObservers();
        expect(moves).to.deep.equal([[0.1, 0, 0]]);
      });

      it('pressing the negative arrow immediately moves -stepNormal', function () {
        make({ mode: 'arrows', initialAxis: 'y', stepNormal: 0.1, stepFast: 1 });
        findControl(flock, 'gizmo-arrow--1').onPointerDownObservable.notifyObservers();
        expect(moves).to.deep.equal([[0, -0.1, 0]]);
      });

      it('releasing the arrow stops the repeat without throwing', function () {
        make({ mode: 'arrows' });
        const btn = findControl(flock, 'gizmo-arrow-1');
        btn.onPointerDownObservable.notifyObservers();
        expect(() => btn.onPointerUpObservable.notifyObservers()).to.not.throw();
      });

      it("moves all three axes together when locked to 'all'", function () {
        make({
          mode: 'arrows',
          showUniform: true,
          initialAxis: 'all',
          stepNormal: 0.1,
          stepFast: 1,
        });
        findControl(flock, 'gizmo-arrow-1').onPointerDownObservable.notifyObservers();
        expect(moves).to.deep.equal([[0.1, 0.1, 0.1]]);
      });
    });

    describe("mode: 'slider' (default)", function () {
      it('creates the track and thumb controls', function () {
        make();
        expect(findControl(flock, 'gizmoTrack')).to.exist;
        expect(findControl(flock, 'gizmoThumb')).to.exist;
      });

      it('does not throw when dragged via real pointer events on the canvas', function () {
        make({ initialAxis: 'x' });
        const canvas = flock.canvas;
        const rect = canvas.getBoundingClientRect();
        const down = new PointerEvent('pointerdown', {
          pointerId: 1,
          clientX: rect.left + rect.width / 4 + 20,
          clientY: rect.bottom - 10,
        });
        const move = new PointerEvent('pointermove', {
          pointerId: 1,
          clientX: rect.left + rect.width / 4 + 40,
          clientY: rect.bottom - 10,
        });
        const up = new PointerEvent('pointerup', { pointerId: 1 });
        expect(() => {
          canvas.dispatchEvent(down);
          canvas.dispatchEvent(move);
          canvas.dispatchEvent(up);
        }).to.not.throw();
      });

      it('a pointerdown right of center moves the axis in the positive direction', function () {
        make({ initialAxis: 'x', getValues: () => ({ x: 0, y: 0, z: 0 }) });
        const canvas = flock.canvas;
        const rect = canvas.getBoundingClientRect();
        withoutPointerCapture(canvas, () => {
          canvas.dispatchEvent(
            new PointerEvent('pointerdown', {
              pointerId: 2,
              clientX: rect.left + rect.width / 4 + 30,
              clientY: rect.bottom - 10,
            })
          );
          canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }));
        });
        expect(moves.length).to.equal(1);
        expect(moves[0][0]).to.be.above(0);
      });

      it('a pointerdown left of center moves the axis in the negative direction', function () {
        make({ initialAxis: 'x', getValues: () => ({ x: 0, y: 0, z: 0 }) });
        const canvas = flock.canvas;
        const rect = canvas.getBoundingClientRect();
        withoutPointerCapture(canvas, () => {
          canvas.dispatchEvent(
            new PointerEvent('pointerdown', {
              pointerId: 3,
              clientX: rect.left + rect.width / 4 - 30,
              clientY: rect.bottom - 10,
            })
          );
          canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3 }));
        });
        expect(moves.length).to.equal(1);
        expect(moves[0][0]).to.be.below(0);
      });

      it("ignores pointerdown outside the slider's bounding box", function () {
        make({ initialAxis: 'x' });
        const canvas = flock.canvas;
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerId: 4,
            clientX: rect.left + rect.width - 5,
            clientY: rect.top + 5,
          })
        );
        expect(moves).to.deep.equal([]);
      });
    });

    describe('collapse handle', function () {
      it('creates the handle in slider mode', function () {
        make();
        expect(findControl(flock, 'gizmo-hud-toggle')).to.exist;
      });

      it('creates the handle in arrows mode', function () {
        make({ mode: 'arrows' });
        expect(findControl(flock, 'gizmo-hud-toggle')).to.exist;
      });

      it('starts expanded by default', function () {
        make();
        expect(stop.isCollapsed()).to.equal(false);
        expect(findControl(flock, 'gizmoHudContainer').isVisible).to.equal(true);
      });

      it('tapping the handle hides the strip but keeps the handle visible', function () {
        make();
        const handle = findControl(flock, 'gizmo-hud-toggle');
        handle.onPointerUpObservable.notifyObservers();
        expect(findControl(flock, 'gizmoHudContainer').isVisible).to.equal(false);
        expect(handle.isVisible).to.equal(true);
      });

      it('tapping the handle again restores the strip', function () {
        make();
        const handle = findControl(flock, 'gizmo-hud-toggle');
        handle.onPointerUpObservable.notifyObservers();
        handle.onPointerUpObservable.notifyObservers();
        expect(findControl(flock, 'gizmoHudContainer').isVisible).to.equal(true);
      });

      it('stop.toggleCollapsed() reports and applies the new state', function () {
        make();
        expect(stop.toggleCollapsed()).to.equal(true);
        expect(stop.isCollapsed()).to.equal(true);
        expect(stop.toggleCollapsed()).to.equal(false);
      });

      it('persists the collapsed state to localStorage', function () {
        make();
        stop.toggleCollapsed();
        expect(localStorage.getItem(COLLAPSED_KEY)).to.equal('1');
      });

      it('a HUD built while the preference is set starts collapsed', function () {
        localStorage.setItem(COLLAPSED_KEY, '1');
        make();
        expect(stop.isCollapsed()).to.equal(true);
        expect(findControl(flock, 'gizmoHudContainer').isVisible).to.equal(false);
      });

      it('does not claim slider touches while collapsed', function () {
        // The slider hit-tests canvas geometry rather than using GUI
        // hit-testing, so hiding the strip alone would still swallow the
        // camera drag in that corner.
        make({ initialAxis: 'x', getValues: () => ({ x: 0, y: 0, z: 0 }) });
        stop.toggleCollapsed();
        const canvas = flock.canvas;
        const rect = canvas.getBoundingClientRect();
        withoutPointerCapture(canvas, () => {
          canvas.dispatchEvent(
            new PointerEvent('pointerdown', {
              pointerId: 5,
              clientX: rect.left + rect.width / 4 + 30,
              clientY: rect.bottom - 10,
            })
          );
          canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5 }));
        });
        expect(moves).to.deep.equal([]);
      });

      it('claims slider touches again after expanding', function () {
        make({ initialAxis: 'x', getValues: () => ({ x: 0, y: 0, z: 0 }) });
        stop.toggleCollapsed();
        stop.toggleCollapsed();
        const canvas = flock.canvas;
        const rect = canvas.getBoundingClientRect();
        withoutPointerCapture(canvas, () => {
          canvas.dispatchEvent(
            new PointerEvent('pointerdown', {
              pointerId: 6,
              clientX: rect.left + rect.width / 4 + 30,
              clientY: rect.bottom - 10,
            })
          );
          canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 6 }));
        });
        expect(moves.length).to.equal(1);
      });

      it('toggleCollapsed after stop() does not throw', function () {
        make();
        stop();
        expect(() => stop.toggleCollapsed()).to.not.throw();
        stop = null;
      });
    });
  });
}
