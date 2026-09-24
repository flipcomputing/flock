import { expect } from 'chai';
import * as Blockly from 'blockly';
import {
  gizmoManager,
  setGizmoManager,
  disposeGizmoManager,
  disableGizmos,
  exitGizmoState,
  configurePositionGizmo,
  configureRotationGizmo,
  configureScaleGizmo,
  viewMeshWithCamera,
  focusOnMesh,
  toggleGizmo,
  enableGizmos,
  updateRotationBlock,
  updateScaleBlock,
} from '../ui/gizmos.js';
import { showStatus, clearStatus } from '../ui/status.js';
import { meshMap } from '../generators/generators.js';

export function runGizmoTests(flock) {
  const BABYLON = flock.BABYLON;

  describe('Gizmo Tests @gizmos', function () {
    this.timeout(10000);

    let mgr; // the GizmoManager handed to setGizmoManager() each test
    let createdMeshes;
    let workspace; // headless Blockly workspace (see before())

    before(function () {
      // When the gizmo manager switches or clears its attached mesh it calls
      // Blockly.getMainWorkspace().getBlockById(...). The test harness loads
      // flock but never injects a Blockly UI, so getMainWorkspace() would be
      // null and that call would throw. Provide a headless main workspace so
      // the detach/dispose code paths can run.
      if (Blockly.common?.setMainWorkspace && !Blockly.getMainWorkspace()) {
        workspace = new Blockly.Workspace();
        Blockly.common.setMainWorkspace(workspace);
      }
    });

    after(function () {
      if (workspace) {
        workspace.dispose();
        workspace = null;
      }
    });

    beforeEach(function () {
      createdMeshes = [];
      mgr = new BABYLON.GizmoManager(flock.scene, 8);
      setGizmoManager(mgr);
    });

    afterEach(function () {
      createdMeshes.forEach((m) => {
        if (m && !m.isDisposed()) m.dispose();
      });
      createdMeshes = [];
      // Tears down the manager and clears the module-level reference. Safe to
      // call even if a test already disposed it (it null-guards internally).
      disposeGizmoManager();
    });

    function makeBox(name = 'gizmoTestBox') {
      const box = BABYLON.MeshBuilder.CreateBox(name, { size: 1 }, flock.scene);
      createdMeshes.push(box);
      return box;
    }

    // A minimal stand-in for the DOM event PointerInfo wraps — Babylon's own
    // internal pointer-input observers (e.g. the active camera's) also react
    // to notifyObservers() and call preventDefault()/stopPropagation() on it.
    function fakeMouseEvent(button = 0) {
      return { button, preventDefault() {}, stopPropagation() {} };
    }

    // ─── setGizmoManager / attachToMesh wrapper ──────────────────────────────

    describe('setGizmoManager', function () {
      it('exposes the manager through the gizmoManager binding', function () {
        expect(gizmoManager).to.equal(mgr);
      });

      it('attaches a top-level mesh', function () {
        const box = makeBox();
        mgr.attachToMesh(box);
        expect(gizmoManager.attachedMesh).to.equal(box);
      });

      it('detaches when passed null', function () {
        const box = makeBox();
        mgr.attachToMesh(box);
        expect(gizmoManager.attachedMesh).to.equal(box);
        mgr.attachToMesh(null);
        expect(gizmoManager.attachedMesh).to.be.null;
      });

      it('never attaches the ground mesh and turns gizmos off', function () {
        mgr.positionGizmoEnabled = true;
        const ground = makeBox('ground');
        mgr.attachToMesh(ground);
        expect(gizmoManager.attachedMesh).to.be.null;
        expect(mgr.positionGizmoEnabled).to.be.false;
      });

      it('attaches the root mesh when a child is picked', function () {
        const parent = makeBox('parentBox');
        const child = makeBox('childBox');
        child.parent = parent;
        mgr.attachToMesh(child);
        expect(gizmoManager.attachedMesh).to.equal(parent);
      });

      it('re-attaching the same mesh is a no-op', function () {
        const box = makeBox();
        mgr.attachToMesh(box);
        expect(() => mgr.attachToMesh(box)).to.not.throw();
        expect(gizmoManager.attachedMesh).to.equal(box);
      });

      it('re-enables prestep on a mesh that has physics', function () {
        const box = makeBox();
        box.physics = { disablePreStep: true };
        mgr.attachToMesh(box);
        expect(box.physics.disablePreStep).to.be.false;
      });

      it('turns gizmos off when the attached mesh is disposed', function () {
        mgr.positionGizmoEnabled = true;
        const box = makeBox();
        mgr.attachToMesh(box);
        expect(gizmoManager.attachedMesh).to.equal(box);

        box.dispose();

        expect(gizmoManager.attachedMesh).to.be.null;
        expect(mgr.positionGizmoEnabled).to.be.false;
      });
    });

    // ─── configurePositionGizmo ──────────────────────────────────────────────

    describe('configurePositionGizmo', function () {
      it('does nothing (no throw) when the manager is null', function () {
        expect(() => configurePositionGizmo(null)).to.not.throw();
      });

      it('enables the position gizmo by default', function () {
        configurePositionGizmo(mgr);
        expect(mgr.positionGizmoEnabled).to.be.true;
      });

      it('can disable the position gizmo', function () {
        configurePositionGizmo(mgr, { enable: false });
        expect(mgr.positionGizmoEnabled).to.be.false;
      });

      it('applies the snap distance', function () {
        configurePositionGizmo(mgr, { snapDistance: 0.5 });
        expect(mgr.gizmos.positionGizmo.snapDistance).to.equal(0.5);
      });

      it('applies custom axis colours', function () {
        const xColor = BABYLON.Color3.Red();
        configurePositionGizmo(mgr, { xColor });
        const mat = mgr.gizmos.positionGizmo.xGizmo._coloredMaterial;
        expect(mat).to.exist;
        expect(mat.diffuseColor.equals(xColor)).to.be.true;
      });

      it('tracks the attached mesh position but not its rotation', function () {
        configurePositionGizmo(mgr, { updateToMatchAttachedMesh: true });
        const pg = mgr.gizmos.positionGizmo;
        expect(pg.updateGizmoPositionToMatchAttachedMesh).to.be.true;
        expect(pg.updateGizmoRotationToMatchAttachedMesh).to.be.false;
      });
    });

    // ─── configureRotationGizmo ──────────────────────────────────────────────

    describe('configureRotationGizmo', function () {
      it('does nothing (no throw) when the manager is null', function () {
        expect(() => configureRotationGizmo(null)).to.not.throw();
      });

      it('enables the rotation gizmo by default', function () {
        configureRotationGizmo(mgr);
        expect(mgr.rotationGizmoEnabled).to.be.true;
      });

      it('applies custom axis colours', function () {
        const yColor = BABYLON.Color3.Green();
        configureRotationGizmo(mgr, { yColor });
        const mat = mgr.gizmos.rotationGizmo.yGizmo._coloredMaterial;
        expect(mat).to.exist;
        expect(mat.diffuseColor.equals(yColor)).to.be.true;
      });

      it('sets updateGizmoRotationToMatchAttachedMesh from the option', function () {
        configureRotationGizmo(mgr, { updateToMatchAttachedMesh: true });
        expect(mgr.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh).to.be.true;
      });
    });

    // ─── configureScaleGizmo ─────────────────────────────────────────────────

    describe('configureScaleGizmo', function () {
      it('does nothing (no throw) when the manager is null', function () {
        expect(() => configureScaleGizmo(null)).to.not.throw();
      });

      it('enables the scale gizmo by default', function () {
        configureScaleGizmo(mgr);
        expect(mgr.scaleGizmoEnabled).to.be.true;
      });

      it('applies PreserveScaling and sensitivity', function () {
        configureScaleGizmo(mgr, { preserveScaling: false, sensitivity: 9 });
        const sg = mgr.gizmos.scaleGizmo;
        expect(sg.PreserveScaling).to.be.false;
        expect(sg.sensitivity).to.equal(9);
      });

      it('applies the uniform scale ratio', function () {
        configureScaleGizmo(mgr, { uniformScaleRatio: 3.5 });
        const sg = mgr.gizmos.scaleGizmo;
        if (sg.uniformScaleGizmo) {
          expect(sg.uniformScaleGizmo.scaleRatio).to.equal(3.5);
        }
      });

      it('applies custom axis colours', function () {
        const zColor = BABYLON.Color3.Blue();
        configureScaleGizmo(mgr, { zColor });
        const mat = mgr.gizmos.scaleGizmo.zGizmo._coloredMaterial;
        expect(mat).to.exist;
        expect(mat.diffuseColor.equals(zColor)).to.be.true;
      });
    });

    // ─── disableGizmos / exitGizmoState ──────────────────────────────────────

    describe('disableGizmos', function () {
      it('turns every gizmo off', function () {
        mgr.positionGizmoEnabled = true;
        mgr.rotationGizmoEnabled = true;
        mgr.scaleGizmoEnabled = true;
        mgr.boundingBoxGizmoEnabled = true;

        disableGizmos();

        expect(mgr.positionGizmoEnabled).to.be.false;
        expect(mgr.rotationGizmoEnabled).to.be.false;
        expect(mgr.scaleGizmoEnabled).to.be.false;
        expect(mgr.boundingBoxGizmoEnabled).to.be.false;
      });
    });

    describe('exitGizmoState', function () {
      it('disables the active gizmo', function () {
        mgr.positionGizmoEnabled = true;
        exitGizmoState();
        expect(mgr.positionGizmoEnabled).to.be.false;
      });

      it('clears the position readout, which the next tool would not update', function () {
        const status = document.createElement('p');
        status.id = 'gizmoStatus';
        document.body.appendChild(status);
        try {
          showStatus('Position: x: 0.6 y: 1.2 z: 0', { owner: 'position-readout' });
          exitGizmoState();
          expect(status.textContent).to.equal('');
        } finally {
          clearStatus();
          status.remove();
        }
      });
    });

    // ─── toggleGizmo ─────────────────────────────────────────────────────────

    describe('toggleGizmo', function () {
      let buttons;

      function addButton(id, { active = false } = {}) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = active ? 'gizmo-button active' : 'gizmo-button';
        document.body.appendChild(btn);
        buttons.push(btn);
        return btn;
      }

      beforeEach(function () {
        buttons = [];
      });

      afterEach(function () {
        buttons.forEach((b) => b.remove());
        buttons = [];
      });

      it('activates the position gizmo and highlights its button', function () {
        addButton('positionButton');
        toggleGizmo('position');
        expect(document.getElementById('positionButton').classList.contains('active')).to.be.true;
        expect(mgr.positionGizmoEnabled).to.be.true;
      });

      it('pressing the same gizmo again toggles it off', function () {
        addButton('positionButton');
        toggleGizmo('position');
        expect(document.getElementById('positionButton').classList.contains('active')).to.be.true;
        expect(mgr.positionGizmoEnabled).to.be.true;
        toggleGizmo('position');
        expect(document.getElementById('positionButton').classList.contains('active')).to.be.false;
        expect(mgr.positionGizmoEnabled).to.be.false;
      });

      it('switching to a different gizmo un-highlights the previous button', function () {
        addButton('positionButton');
        addButton('rotationButton');
        toggleGizmo('position');
        expect(document.getElementById('positionButton').classList.contains('active')).to.be.true;
        expect(document.getElementById('rotationButton').classList.contains('active')).to.be.false;
        toggleGizmo('rotation');
        expect(document.getElementById('positionButton').classList.contains('active')).to.be.false;
        expect(document.getElementById('rotationButton').classList.contains('active')).to.be.true;
      });

      it('turning a gizmo off disables every gizmo flag, not just its own', function () {
        addButton('positionButton');
        toggleGizmo('position');
        expect(mgr.positionGizmoEnabled).to.be.true;
        // Force the other flags on first, so asserting they're off afterward
        // actually demonstrates the toggle-off reset them, rather than
        // trivially passing because they were already false.
        mgr.rotationGizmoEnabled = true;
        mgr.scaleGizmoEnabled = true;
        toggleGizmo('position');
        expect(mgr.positionGizmoEnabled).to.be.false;
        expect(mgr.rotationGizmoEnabled).to.be.false;
        expect(mgr.scaleGizmoEnabled).to.be.false;
      });
    });

    // ─── click away from the canvas ──────────────────────────────────────

    describe('click away from canvas', function () {
      let buttons;

      function addButton(id) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = 'gizmo-button';
        document.body.appendChild(btn);
        buttons.push(btn);
        return btn;
      }

      function canvasCenter() {
        const canvas =
          flock.scene?.getEngine?.().getRenderingCanvas?.() ??
          document.getElementById('renderCanvas');
        const rect = canvas.getBoundingClientRect();
        return {
          canvas,
          x: (rect.left + rect.right) / 2,
          y: (rect.top + rect.bottom) / 2,
        };
      }

      function clickAt(x, y) {
        window.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y })
        );
      }

      const waitForWatcher = () => new Promise((r) => setTimeout(r, 120));

      beforeEach(function () {
        buttons = [];
      });

      afterEach(function () {
        buttons.forEach((b) => b.remove());
        buttons = [];
      });

      it('a click outside the canvas exits the active gizmo', async function () {
        addButton('positionButton');
        toggleGizmo('position');
        expect(mgr.positionGizmoEnabled).to.be.true;
        await waitForWatcher();
        clickAt(-1000, -1000);
        expect(document.getElementById('positionButton').classList.contains('active')).to.be.false;
        expect(mgr.positionGizmoEnabled).to.be.false;
      });

      it('a click outside the canvas with a mesh attached exits and deselects', async function () {
        addButton('positionButton');
        const box = makeBox();
        mgr.attachToMesh(box);
        toggleGizmo('position');
        expect(mgr.positionGizmoEnabled).to.be.true;
        await waitForWatcher();
        clickAt(-1000, -1000);
        expect(mgr.positionGizmoEnabled).to.be.false;
        expect(mgr.attachedMesh).to.be.null;
      });

      it('a click inside the canvas keeps the active gizmo', async function () {
        addButton('positionButton');
        toggleGizmo('position');
        expect(mgr.positionGizmoEnabled).to.be.true;
        await waitForWatcher();
        const { x, y } = canvasCenter();
        clickAt(x, y);
        expect(document.getElementById('positionButton').classList.contains('active')).to.be.true;
        expect(mgr.positionGizmoEnabled).to.be.true;
      });

      it('leaves fly-camera mode alone when it is the only active button', async function () {
        addButton('positionButton');
        addButton('cameraButton');
        toggleGizmo('position');
        expect(mgr.positionGizmoEnabled).to.be.true;
        await waitForWatcher();
        document.getElementById('positionButton').classList.remove('active');
        document.getElementById('cameraButton').classList.add('active');
        clickAt(-1000, -1000);
        expect(document.getElementById('cameraButton').classList.contains('active')).to.be.true;
        expect(mgr.positionGizmoEnabled).to.be.true;
        document.getElementById('positionButton').classList.add('active');
        clickAt(-1000, -1000);
        expect(mgr.positionGizmoEnabled).to.be.false;
      });
    });

    // ─── viewMeshWithCamera: orbit view ──────────────────────────────────────

    describe('viewMeshWithCamera (orbit view)', function () {
      let freeCamera;
      let prevActiveCamera;
      let prevSavedCamera;
      let prevCurrentBlock;

      beforeEach(function () {
        prevActiveCamera = flock.scene.activeCamera;
        prevSavedCamera = flock.savedCamera;
        // viewMeshWithCamera falls back to window.currentBlock when nothing is
        // selected; clear it so the "no selection" case is deterministic.
        prevCurrentBlock = window.currentBlock;
        window.currentBlock = null;

        // A free camera (no metadata.following) selects the orbit-view branch.
        freeCamera = new BABYLON.FreeCamera(
          'orbitTestFreeCamera',
          new BABYLON.Vector3(0, 5, -10),
          flock.scene
        );
        flock.scene.activeCamera = freeCamera;
      });

      afterEach(function () {
        // Orbit no longer tracks gizmo selection, so detach alone does not
        // exit it — always run the full teardown.
        exitGizmoState();
        flock.scene.activeCamera = prevActiveCamera;
        flock.savedCamera = prevSavedCamera;
        window.currentBlock = prevCurrentBlock;
        if (freeCamera && !freeCamera.isDisposed()) freeCamera.dispose();
        freeCamera = null;
      });

      // Select a box and press V (orbit-view on).
      function orbitBox(name = 'orbitBox') {
        const box = makeBox(name);
        mgr.attachToMesh(box);
        viewMeshWithCamera();
        return box;
      }

      it('attaches an ArcRotateCamera tagged orbitView and frames the mesh', function () {
        orbitBox();
        const cam = flock.scene.activeCamera;
        expect(cam).to.be.an.instanceof(BABYLON.ArcRotateCamera);
        expect(cam.metadata?.orbitView).to.be.true;
        // Unit box at the origin: radius clamps to the 8 minimum, target centred.
        expect(cam.radius).to.equal(8);
        expect(cam.target.x).to.be.closeTo(0, 1e-6);
        expect(cam.target.y).to.be.closeTo(0, 1e-6);
        expect(cam.target.z).to.be.closeTo(0, 1e-6);
        // Beta is unconstrained so the user can orbit fully.
        expect(cam.lowerBetaLimit).to.be.null;
        expect(cam.upperBetaLimit).to.be.null;
      });

      it('disables pointer-to-attach while orbiting (drag no longer disconnects)', function () {
        mgr.usePointerToAttachGizmos = true;
        orbitBox();
        expect(mgr.usePointerToAttachGizmos).to.be.false;
      });

      it('V again toggles back to the free camera and restores pointer-to-attach', function () {
        mgr.usePointerToAttachGizmos = true;
        orbitBox();
        viewMeshWithCamera(); // toggle off
        expect(flock.scene.activeCamera).to.equal(freeCamera);
        expect(mgr.usePointerToAttachGizmos).to.be.true;
      });

      it('deselecting the gizmo keeps the orbit camera (independent selection)', function () {
        const box = orbitBox();
        expect(flock.scene.activeCamera).to.not.equal(freeCamera);
        mgr.attachToMesh(null);
        expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
        expect(window.orbitMesh).to.equal(box);
      });

      it('selecting a different mesh keeps the orbit camera on its target', function () {
        const box = orbitBox();
        const other = makeBox('orbitOtherBox');
        mgr.attachToMesh(other);
        expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
        expect(window.orbitMesh).to.equal(box);
        expect(mgr.attachedMesh).to.equal(other);
      });

      it('disposing the orbited mesh exits orbit', function () {
        const box = orbitBox();
        expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
        box.dispose();
        expect(flock.scene.activeCamera).to.equal(freeCamera);
        expect(flock.scene.activeCamera.metadata?.orbitView).to.not.equal(true);
      });

      it('does nothing when no mesh is selected', function () {
        mgr.attachToMesh(null);
        viewMeshWithCamera();
        expect(flock.scene.activeCamera).to.equal(freeCamera);
        expect(flock.scene.activeCamera.metadata?.orbitView).to.not.equal(true);
      });

      it('leaves the play camera (flock.savedCamera) untouched while orbiting', function () {
        const playCamera = new BABYLON.FreeCamera(
          'orbitTestPlayCamera',
          new BABYLON.Vector3(0, 0, 0),
          flock.scene
        );
        flock.savedCamera = playCamera;
        orbitBox();
        expect(flock.savedCamera).to.equal(playCamera);
        playCamera.dispose();
      });

      describe('orbit-preserving tools', function () {
        let buttons;

        function addButton(id) {
          const btn = document.createElement('button');
          btn.id = id;
          btn.className = 'gizmo-button';
          document.body.appendChild(btn);
          buttons.push(btn);
          return btn;
        }

        beforeEach(function () {
          buttons = [];
          ['positionButton', 'rotationButton', 'scaleButton', 'selectButton', 'eyeButton'].forEach(
            addButton
          );
        });

        afterEach(function () {
          buttons.forEach((b) => b.remove());
          buttons = [];
          // toggleGizmo('position'|'rotation'|'scale') registers a
          // click-away watcher on a timer; exitGizmoState clears it.
          exitGizmoState();
        });

        function orbitWithButtons(name = 'orbitPreserveBox') {
          return orbitBox(name);
        }

        it('ending orbit hides the previous orbit mesh box once the gizmo has moved elsewhere', function () {
          const orbitMeshA = orbitWithButtons('orbitEndA');
          toggleGizmo('position');
          const gizmoMeshC = makeBox('orbitEndC');
          // Retarget the position gizmo to C while still orbiting A (a real click).
          flock.scene.onPointerObservable.notifyObservers(
            new BABYLON.PointerInfo(BABYLON.PointerEventTypes.POINTERPICK, fakeMouseEvent(0), {
              pickedMesh: gizmoMeshC,
            })
          );
          expect(mgr.attachedMesh).to.equal(gizmoMeshC);
          // Kept alive by the orbit-preserving fix even though the gizmo moved.
          expect(orbitMeshA.showBoundingBox).to.be.true;

          // End orbit (eye button toggled off — the same disconnectOrbitView()
          // path a "switch orbit target to a different mesh" also goes
          // through) while the gizmo is still on C.
          toggleGizmo('eye');

          expect(flock.scene.activeCamera.metadata?.orbitView).to.not.be.true;
          // A was only kept boxed because it was the orbit target — orbit has
          // ended, and nothing else is tracking it, so its box should not be
          // left on indefinitely.
          expect(orbitMeshA.showBoundingBox).to.not.be.true;
          // The gizmo's own target is untouched by orbit ending.
          expect(mgr.attachedMesh).to.equal(gizmoMeshC);
        });

        it('position keeps the orbit camera with both buttons lit', function () {
          orbitWithButtons();
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          toggleGizmo('position');
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          expect(document.getElementById('eyeButton').classList.contains('active')).to.be.true;
          expect(document.getElementById('positionButton').classList.contains('active')).to.be.true;
          expect(mgr.positionGizmoEnabled).to.be.true;
        });

        it('rotation keeps the orbit camera with both buttons lit', function () {
          orbitWithButtons();
          toggleGizmo('rotation');
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          expect(document.getElementById('eyeButton').classList.contains('active')).to.be.true;
          expect(document.getElementById('rotationButton').classList.contains('active')).to.be.true;
          expect(mgr.rotationGizmoEnabled).to.be.true;
        });

        it('scale keeps the orbit camera with both buttons lit', function () {
          orbitWithButtons();
          toggleGizmo('scale');
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          expect(document.getElementById('eyeButton').classList.contains('active')).to.be.true;
          expect(document.getElementById('scaleButton').classList.contains('active')).to.be.true;
          expect(mgr.scaleGizmoEnabled).to.be.true;
        });

        it('duplicate keeps the orbit camera with both buttons lit', function () {
          addButton('duplicateButton');
          orbitWithButtons();
          toggleGizmo('duplicate');
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          expect(document.getElementById('eyeButton').classList.contains('active')).to.be.true;
          expect(document.getElementById('duplicateButton').classList.contains('active')).to.be.true;
        });

        it('toggling the transform off stays in orbit', function () {
          orbitWithButtons();
          toggleGizmo('position');
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          toggleGizmo('position'); // toggle off
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          expect(document.getElementById('eyeButton').classList.contains('active')).to.be.true;
          expect(document.getElementById('positionButton').classList.contains('active')).to.be.false;
        });

        it('eye toggle-off keeps the transform picked while orbiting', function () {
          orbitWithButtons();
          toggleGizmo('position');
          expect(mgr.positionGizmoEnabled).to.be.true;
          toggleGizmo('eye'); // orbit off
          expect(flock.scene.activeCamera).to.equal(freeCamera);
          expect(document.getElementById('eyeButton').classList.contains('active')).to.be.false;
          expect(document.getElementById('positionButton').classList.contains('active')).to.be.true;
          expect(mgr.positionGizmoEnabled).to.be.true;
        });

        it('select keeps the orbit camera with both buttons lit', function () {
          orbitWithButtons();
          toggleGizmo('select');
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          expect(document.getElementById('eyeButton').classList.contains('active')).to.be.true;
          expect(document.getElementById('selectButton').classList.contains('active')).to.be.true;
        });

        it('add menu keeps the orbit camera with the eye still lit', function () {
          // enableGizmos only wires when every required button exists.
          [
            'duplicateButton',
            'deleteButton',
            'cameraButton',
            'showShapesButton',
            'scrollShapesLeftButton',
            'scrollShapesRightButton',
            'scrollModelsLeftButton',
            'scrollModelsRightButton',
            'scrollObjectsLeftButton',
            'scrollObjectsRightButton',
            'scrollCharactersLeftButton',
            'scrollCharactersRightButton',
          ].forEach(addButton);
          enableGizmos();
          let called = false;
          const saved = window.showShapes;
          window.showShapes = () => (called = true);
          try {
            orbitWithButtons();
            expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
            document.getElementById('showShapesButton').click();
            expect(called).to.be.true;
            expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
            expect(document.getElementById('eyeButton').classList.contains('active')).to.be.true;
          } finally {
            window.showShapes = saved;
          }
        });

        it('transform can retarget to another mesh without leaving orbit', function () {
          const first = orbitWithButtons('orbitRetargetA');
          toggleGizmo('position');
          expect(mgr.attachedMesh).to.equal(first);
          const second = makeBox('orbitRetargetB');
          mgr.attachToMesh(second);
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          expect(window.orbitMesh).to.equal(first);
          expect(mgr.attachedMesh).to.equal(second);
          expect(mgr.positionGizmoEnabled).to.be.true;
        });

        it('a real click retargets the transform gizmo and keeps the orbited mesh boxed (not the new target)', function () {
          const first = orbitWithButtons('orbitClickRetargetA');
          toggleGizmo('position');
          const second = makeBox('orbitClickRetargetB');

          flock.scene.onPointerObservable.notifyObservers(
            new BABYLON.PointerInfo(BABYLON.PointerEventTypes.POINTERPICK, fakeMouseEvent(0), { pickedMesh: second })
          );

          expect(mgr.attachedMesh).to.equal(second);
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          expect(window.orbitMesh).to.equal(first);
          // The orbited mesh's box would otherwise be hidden by
          // resetAttachedMesh() switching the gizmo away from it.
          expect(first.showBoundingBox).to.be.true;
          // The new gizmo target gets no box of its own — only the orbited
          // mesh keeps one, matching how retargeting behaved before this.
          expect(second.showBoundingBox).to.not.be.true;
        });

        it('a drag (POINTERDOWN with no matching POINTERPICK) does not retarget the gizmo', function () {
          const first = orbitWithButtons('orbitDragNoRetargetA');
          toggleGizmo('position');
          const second = makeBox('orbitDragNoRetargetB');

          // A drag never fires POINTERPICK; simulate the raw pointerdown that
          // Babylon's built-in usePointerToAttachGizmos would have reacted to,
          // to prove this observer (POINTERPICK-only) ignores it.
          flock.scene.onPointerObservable.notifyObservers(
            new BABYLON.PointerInfo(BABYLON.PointerEventTypes.POINTERDOWN, fakeMouseEvent(0), { pickedMesh: second })
          );

          expect(mgr.attachedMesh).to.equal(first);
        });

        it('a secondary-button (right) click does not retarget the gizmo', function () {
          const first = orbitWithButtons('orbitRightClickNoRetargetA');
          toggleGizmo('position');
          const second = makeBox('orbitRightClickNoRetargetB');

          // Babylon's click detection doesn't filter by button, so a
          // right-click that doesn't drag still fires POINTERPICK.
          flock.scene.onPointerObservable.notifyObservers(
            new BABYLON.PointerInfo(BABYLON.PointerEventTypes.POINTERPICK, fakeMouseEvent(2), { pickedMesh: second })
          );

          expect(mgr.attachedMesh).to.equal(first);
        });

        it('transform leaves pointer attach off while orbiting, so a drag to rotate never exits the gizmo', function () {
          orbitWithButtons();
          expect(mgr.usePointerToAttachGizmos).to.be.false;
          toggleGizmo('position');
          expect(mgr.usePointerToAttachGizmos).to.be.false;
          toggleGizmo('position'); // transform off
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          expect(mgr.usePointerToAttachGizmos).to.be.false;
        });

        it('exiting orbit keeps the retargeted transform selection', function () {
          orbitWithButtons('orbitKeepA');
          toggleGizmo('position');
          const second = makeBox('orbitKeepB');
          mgr.attachToMesh(second);
          toggleGizmo('eye'); // orbit off
          expect(flock.scene.activeCamera).to.equal(freeCamera);
          expect(mgr.attachedMesh).to.equal(second);
          expect(mgr.positionGizmoEnabled).to.be.true;
        });
      });

      describe('camera button while orbiting', function () {
        let cameraButton;

        beforeEach(function () {
          cameraButton = document.createElement('button');
          cameraButton.id = 'cameraButton';
          cameraButton.className = 'gizmo-button';
          document.body.appendChild(cameraButton);
        });

        afterEach(function () {
          cameraButton.remove();
        });

        it('exits orbit and returns to the previous camera, not fly mode', function () {
          orbitBox();
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
          toggleGizmo('camera');
          expect(flock.scene.activeCamera).to.equal(freeCamera);
          expect(flock.scene.activeCamera.metadata?.orbitView).to.not.equal(true);
          expect(cameraButton.classList.contains('active')).to.be.false;
        });

        it('returns to a follow camera if that was active before orbiting', function () {
          const player = makeBox('cameraButtonFollowPlayer');
          const followCamera = new BABYLON.FreeCamera(
            'cameraButtonFollowCamera',
            new BABYLON.Vector3(0, 5, -10),
            flock.scene
          );
          followCamera.metadata = { following: player };
          flock.scene.activeCamera = followCamera;

          orbitBox('cameraButtonFollowBox');
          expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;

          toggleGizmo('camera');
          expect(flock.scene.activeCamera).to.equal(followCamera);
          expect(cameraButton.classList.contains('active')).to.be.false;

          followCamera.dispose();
        });
      });

      it('focusOnMesh (J) during orbit exits orbit instead of mutating the orbit camera', function () {
        orbitBox('focusDuringOrbitBox');
        expect(flock.scene.activeCamera.metadata?.orbitView).to.be.true;
        focusOnMesh();
        expect(flock.scene.activeCamera.metadata?.orbitView).to.not.equal(true);
        expect(flock.scene.activeCamera).to.equal(freeCamera);
        expect(window.orbitMesh).to.be.null;
      });
    });

    // ─── enableGizmos ────────────────────────────────────────────────────────

    describe('enableGizmos', function () {
      const REQUIRED_IDS = [
        'positionButton',
        'rotationButton',
        'scaleButton',
        'selectButton',
        'duplicateButton',
        'deleteButton',
        'cameraButton',
        'eyeButton',
        'showShapesButton',
        'scrollShapesLeftButton',
        'scrollShapesRightButton',
        'scrollModelsLeftButton',
        'scrollModelsRightButton',
        'scrollObjectsLeftButton',
        'scrollObjectsRightButton',
        'scrollCharactersLeftButton',
        'scrollCharactersRightButton',
      ];

      let created;

      beforeEach(function () {
        created = [];
      });

      afterEach(function () {
        created.forEach((el) => el.remove());
        created = [];
      });

      function addButton(id, { disabled = true } = {}) {
        const btn = document.createElement('button');
        btn.id = id;
        if (disabled) btn.setAttribute('disabled', '');
        document.body.appendChild(btn);
        created.push(btn);
        return btn;
      }

      it('does nothing when a required button is missing from the DOM', function () {
        REQUIRED_IDS.slice(1).forEach((id) => addButton(id));
        expect(() => enableGizmos()).to.not.throw();
        expect(document.getElementById(REQUIRED_IDS[1]).hasAttribute('disabled')).to.be.true;
      });

      it('removes the disabled attribute from every button once all required ones exist', function () {
        REQUIRED_IDS.forEach((id) => addButton(id));
        enableGizmos();
        REQUIRED_IDS.forEach((id) => {
          expect(document.getElementById(id).hasAttribute('disabled'), id).to.be.false;
        });
      });

      it('wires the position button click through to toggleGizmo', function () {
        REQUIRED_IDS.forEach((id) => addButton(id));
        enableGizmos();
        document.getElementById('positionButton').click();
        expect(document.getElementById('positionButton').classList.contains('active')).to.be.true;
        expect(mgr.positionGizmoEnabled).to.be.true;
      });

      it('wires the "show shapes" button to exitGizmoState + window.showShapes', function () {
        REQUIRED_IDS.forEach((id) => addButton(id));
        mgr.positionGizmoEnabled = true;
        let called = false;
        const saved = window.showShapes;
        window.showShapes = () => (called = true);
        try {
          enableGizmos();
          document.getElementById('showShapesButton').click();
          expect(called).to.be.true;
          expect(mgr.positionGizmoEnabled).to.be.false;
        } finally {
          window.showShapes = saved;
        }
      });

      it('wires the scroll buttons to window.scrollShapes/scrollModels/scrollObjects/scrollCharacters', function () {
        REQUIRED_IDS.forEach((id) => addButton(id));
        const calls = [];
        const saved = {
          scrollShapes: window.scrollShapes,
          scrollModels: window.scrollModels,
          scrollObjects: window.scrollObjects,
          scrollCharacters: window.scrollCharacters,
        };
        window.scrollShapes = (dir) => calls.push(['shapes', dir]);
        window.scrollModels = (dir) => calls.push(['models', dir]);
        window.scrollObjects = (dir) => calls.push(['objects', dir]);
        window.scrollCharacters = (dir) => calls.push(['characters', dir]);
        try {
          enableGizmos();
          document.getElementById('scrollShapesLeftButton').click();
          document.getElementById('scrollShapesRightButton').click();
          document.getElementById('scrollModelsLeftButton').click();
          document.getElementById('scrollObjectsRightButton').click();
          document.getElementById('scrollCharactersLeftButton').click();
          expect(calls).to.deep.equal([
            ['shapes', -1],
            ['shapes', 1],
            ['models', -1],
            ['objects', 1],
            ['characters', -1],
          ]);
        } finally {
          Object.assign(window, saved);
        }
      });
    });

    // ─── disposeGizmoManager ─────────────────────────────────────────────────

    describe('disposeGizmoManager', function () {
      it('clears the module-level gizmoManager reference', function () {
        disposeGizmoManager();
        expect(gizmoManager).to.be.null;
      });
    });

    // ─── rotate/resize replay order ──────────────────────────────────────────

    describe('rotate/resize replay order', function () {
      // flock.resize() anchors from the mesh's *current* world-space box
      // while rotateTo preserves position, so each op is state-dependent:
      // Play must replay them in the order the gizmos were dragged. A fixed
      // canonical order reproduces one drag sequence and visibly shifts a
      // tilted model on the other. These tests run both drag orders through
      // the real flock API and compare against the live gizmo transforms.
      const DIMS = { width: 1, height: 3, depth: 1 };
      const BASE_Y = DIMS.height / 2; // ground-aligned: base sits at y=0
      const TILT = { x: 30, y: 0, z: 0 };
      const SCALE = { x: 2, y: 1.5, z: 2 };
      const SIZE = {
        width: DIMS.width * SCALE.x,
        height: DIMS.height * SCALE.y,
        depth: DIMS.depth * SCALE.z,
      };
      let seq = 0;

      function freshBox() {
        seq += 1;
        return flock.createBox(`gizmoOrderBox${seq}`, {
          color: '#FFFFFF',
          ...DIMS,
          position: [0, BASE_Y, 0],
        });
      }

      // rotation gizmo: orientation only, position untouched.
      function liveTilt(mesh) {
        mesh.rotationQuaternion = flock.eulerDegreesToQuat(TILT.x, TILT.y, TILT.z);
        mesh.computeWorldMatrix(true);
      }

      // scale gizmo drag: local scaling, Y re-anchored to the current
      // (possibly rotated) base, X/Z untouched.
      function liveScale(mesh) {
        const bottomBefore = flock.getEffectiveWorldBounds(mesh).min.y;
        mesh.scaling.set(SCALE.x, SCALE.y, SCALE.z);
        const bottomAfter = flock.getEffectiveWorldBounds(mesh).min.y;
        mesh.position.y += bottomBefore - bottomAfter;
        mesh.computeWorldMatrix(true);
      }

      async function replay(order) {
        const id = freshBox();
        try {
          if (order === 'tilt-first') {
            await flock.rotateTo(id, { ...TILT });
            await flock.resize(id, { ...SIZE });
          } else {
            await flock.resize(id, { ...SIZE });
            await flock.rotateTo(id, { ...TILT });
          }
          return flock.scene.getMeshByID(id).position.clone();
        } finally {
          flock.dispose(id);
        }
      }

      it('replaying tilt-then-scale matches the live gizmos', async function () {
        const id = freshBox();
        let live;
        try {
          const mesh = flock.scene.getMeshByID(id);
          liveTilt(mesh);
          liveScale(mesh);
          live = mesh.position.clone();
        } finally {
          flock.dispose(id);
        }
        const replayed = await replay('tilt-first');
        expect(replayed.subtract(live).length()).to.be.lessThan(0.001);
      });

      it('replaying scale-then-tilt matches the live gizmos', async function () {
        const id = freshBox();
        let live;
        try {
          const mesh = flock.scene.getMeshByID(id);
          liveScale(mesh);
          liveTilt(mesh);
          live = mesh.position.clone();
        } finally {
          flock.dispose(id);
        }
        const replayed = await replay('scale-first');
        expect(replayed.subtract(live).length()).to.be.lessThan(0.001);
      });
    });

    // ─── rotate/resize block ordering ───────────────────────────────────────

    describe('rotate/resize block ordering', function () {
      // A move after scaling commits the live (already anchor-shifted)
      // position in the unrotated-base convention, so Play must resize
      // (upright box) before it rotates - otherwise the rotated anchor shift
      // applies twice and the mesh jumps. The resize block therefore always
      // runs before rotate_to for the same model, regardless of which gizmo
      // the user drags first.
      function collectDoTypes(modelBlock) {
        const types = [];
        for (
          let cur = modelBlock.getInput('DO')?.connection?.targetBlock?.();
          cur;
          cur = cur.getNextBlock?.()
        ) {
          types.push(cur.type);
        }
        return types;
      }

      function makeModelFixture(ws, varName) {
        // Stand-in for an imported model (e.g. a tree): the block type, not
        // the mesh type, decides the resize code path (see
        // findOrCreateResizeBlock / scaleMemberSizeInputs).
        const mesh = makeBox('gizmoOrderTree');
        const modelBlock = ws.newBlock('load_model');
        const vm = ws.getVariableMap();
        let v = vm.getVariable(varName);
        if (!v) v = vm.createVariable(varName);
        modelBlock.getField('ID_VAR').setValue(typeof v.getId === 'function' ? v.getId() : v.id);
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.blockKey = modelBlock.id;
        meshMap[modelBlock.id] = modelBlock;
        return { mesh, modelBlock };
      }

      function withHeadlessBlocks(fn) {
        const hadInitSvg = Object.prototype.hasOwnProperty.call(Blockly.Block.prototype, 'initSvg');
        const hadRender = Object.prototype.hasOwnProperty.call(Blockly.Block.prototype, 'render');
        if (!Blockly.Block.prototype.initSvg) Blockly.Block.prototype.initSvg = function () {};
        if (!Blockly.Block.prototype.render) Blockly.Block.prototype.render = function () {};
        try {
          fn();
        } finally {
          if (!hadInitSvg) delete Blockly.Block.prototype.initSvg;
          if (!hadRender) delete Blockly.Block.prototype.render;
        }
      }

      function expectResizeFirst(ws, varName, first, second) {
        withHeadlessBlocks(() => {
          const { mesh, modelBlock } = makeModelFixture(ws, varName);
          try {
            first(mesh);
            second(mesh);
            const types = collectDoTypes(modelBlock);
            expect(types).to.include('rotate_to');
            expect(types).to.include('resize');
            expect(
              types.indexOf('resize'),
              'resize must run before rotate_to regardless of gizmo drag order'
            ).to.be.lessThan(types.indexOf('rotate_to'));
          } finally {
            delete meshMap[modelBlock.id];
            if (!modelBlock.disposed) modelBlock.dispose(true);
          }
        });
      }

      it('rotate-then-resize drag order plays back resize before rotate', function () {
        const ws = Blockly.getMainWorkspace();
        expect(ws, 'main workspace present').to.exist;
        expectResizeFirst(ws, 'gizmoOrderTreeVarA', updateRotationBlock, updateScaleBlock);
      });

      it('resize-then-rotate drag order plays back resize before rotate', function () {
        const ws = Blockly.getMainWorkspace();
        expect(ws, 'main workspace present').to.exist;
        expectResizeFirst(ws, 'gizmoOrderTreeVarB', updateScaleBlock, updateRotationBlock);
      });
    });

    // ─── reposition after tilt+scale ─────────────────────────────────────────

    describe('reposition after tilt+scale', function () {
      // Tilt, then scale, then move a tree: the move commits the live
      // (already anchor-shifted) position in the unrotated-base convention,
      // so Play must resize (upright box) before it rotates - otherwise the
      // rotated anchor shift applies twice and the tree jumps up.
      // NOTE: createObject names meshes by the pre-__ part of modelId
      // (api/models.js), so every lookup below uses the RETURNED mesh name -
      // reusing the modelId can resolve to another same-model mesh.
      this.timeout(30000);

      async function waitTree(meshName) {
        const t0 = Date.now();
        while (Date.now() - t0 < 25000) {
          const m = flock.scene.getMeshByName(meshName);
          if (m && m.getChildMeshes && m.getChildMeshes(false).length > 0) {
            try {
              m.computeWorldMatrix(true);
              const b = flock.getEffectiveWorldBounds(m);
              if (Number.isFinite(b.min.y) && Number.isFinite(b.max.y)) return m;
            } catch { /* not ready */ }
          }
          await new Promise((r) => setTimeout(r, 150));
        }
        throw new Error('timeout waiting for ' + meshName);
      }

      it('replays without jumping up', async function () {
        const r1 = (v) => Math.round(v * 10) / 10;
        // live gizmo sequence on a real tree: tilt, scale, sidestep.
        const liveName = flock.createObject({
          modelName: 'tree.glb',
          modelId: 'tree.glb__reproLive',
          color: ['#cd853f', '#66cdaa'],
          position: { x: 0, y: 0, z: 0 },
        });
        const live = await waitTree(liveName);
        try {
          live.rotationQuaternion = flock.eulerDegreesToQuat(30, 0, 0);
          live.computeWorldMatrix(true);
          const b0 = flock.getEffectiveWorldBounds(live).min.y;
          live.scaling.set(2, 2, 2);
          live.computeWorldMatrix(true);
          const b1 = flock.getEffectiveWorldBounds(live).min.y;
          live.position.y += b0 - b1;
          live.position.x += 3;
          live.computeWorldMatrix(true);
          const livePos = live.position.clone();

          // what the position gizmo commits.
          const commit = flock.getBlockPositionFromMesh(live);
          // sizes as updateScaleBlock writes them (1dp of local size × scale).
          const bb = live.getBoundingInfo().boundingBox;
          const sz = {
            width: r1((bb.maximum.x - bb.minimum.x) * 2),
            height: r1((bb.maximum.y - bb.minimum.y) * 2),
            depth: r1((bb.maximum.z - bb.minimum.z) * 2),
          };

          // Play: creation base-rule apply, then resize before rotate.
          const replayName = flock.createObject({
            modelName: 'tree.glb',
            modelId: 'tree.glb__reproReplay',
            color: ['#cd853f', '#66cdaa'],
            position: { x: 0, y: 0, z: 0 },
          });
          try {
            await waitTree(replayName);
            await flock.positionAt(replayName, {
              x: commit.x,
              y: commit.y,
              z: commit.z,
              useY: true,
            });
            await flock.resize(replayName, { width: sz.width, height: sz.height, depth: sz.depth });
            await flock.rotateTo(replayName, { x: 30, y: 0, z: 0 });
            const replayed = flock.scene.getMeshByName(replayName).position.clone();
            expect(replayed.subtract(livePos).length()).to.be.lessThan(0.1);
          } finally {
            flock.dispose(replayName);
          }
        } finally {
          flock.dispose(liveName);
        }
      });
    });
  });
}
