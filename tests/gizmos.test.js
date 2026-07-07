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
  toggleGizmo,
  enableGizmos,
} from '../ui/gizmos.js';

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
        // If a test left orbit-view active, detaching the mesh runs the normal
        // disconnect path (restores the free camera, disposes the orbit camera).
        if (flock.scene.activeCamera?.metadata?.orbitView) {
          mgr.attachToMesh(null);
        }
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
        // Unit box at the origin: radius clamps to the 4 minimum, target centred.
        expect(cam.radius).to.equal(4);
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

      it('deselecting the mesh returns to the free camera', function () {
        orbitBox();
        expect(flock.scene.activeCamera).to.not.equal(freeCamera);
        mgr.attachToMesh(null);
        expect(flock.scene.activeCamera).to.equal(freeCamera);
      });

      it('selecting a different mesh returns to the free camera', function () {
        orbitBox();
        const other = makeBox('orbitOtherBox');
        mgr.attachToMesh(other);
        expect(flock.scene.activeCamera).to.equal(freeCamera);
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

      it('does nothing (and does not throw) when only eyeButton is missing', function () {
        // eyeButton is accessed unconditionally later in this function, so it
        // must be part of the required-button guard.
        REQUIRED_IDS.filter((id) => id !== 'eyeButton').forEach((id) => addButton(id));
        expect(() => enableGizmos()).to.not.throw();
        expect(document.getElementById('positionButton').hasAttribute('disabled')).to.be.true;
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

      it('wires the scroll buttons to window.scrollModels/scrollObjects/scrollCharacters', function () {
        REQUIRED_IDS.forEach((id) => addButton(id));
        const calls = [];
        const saved = {
          scrollModels: window.scrollModels,
          scrollObjects: window.scrollObjects,
          scrollCharacters: window.scrollCharacters,
        };
        window.scrollModels = (dir) => calls.push(['models', dir]);
        window.scrollObjects = (dir) => calls.push(['objects', dir]);
        window.scrollCharacters = (dir) => calls.push(['characters', dir]);
        try {
          enableGizmos();
          document.getElementById('scrollModelsLeftButton').click();
          document.getElementById('scrollObjectsRightButton').click();
          document.getElementById('scrollCharactersLeftButton').click();
          expect(calls).to.deep.equal([
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
  });
}
