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

    // ─── disposeGizmoManager ─────────────────────────────────────────────────

    describe('disposeGizmoManager', function () {
      it('clears the module-level gizmoManager reference', function () {
        disposeGizmoManager();
        expect(gizmoManager).to.be.null;
      });
    });
  });
}
