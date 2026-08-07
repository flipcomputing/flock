import { expect } from 'chai';

export function runXRTests(flock) {
  describe('XR API @xr', function () {
    it('exposes teleport APIs to generated user code', function () {
      const api = flock.createWhitelist({ guard: (fn) => fn });
      expect(api.setXRViewMode).to.be.a('function');
      expect(api.setXRCameraMotionMode).to.be.a('function');
      expect(api.addTeleportTarget).to.be.a('function');
      expect(api.removeTeleportTarget).to.be.a('function');
    });

    describe('VR view mode', function () {
      let originalState;

      beforeEach(function () {
        originalState = {
          mode: flock._xrViewMode,
          helper: flock.xrHelper,
          target: flock._xrFollowTarget,
          xrMode: flock._xrMode,
          sessionActive: flock._xrSessionActive,
          lastPosition: flock._xrFollowLastPosition,
          settledPosition: flock._xrFollowSettledPosition,
          lastMovedAt: flock._xrFollowLastMovedAt,
          watchPosition: flock._xrWatchPosition,
          embodiedVisibility: flock._xrEmbodiedVisibility,
          cameraMotionMode: flock._xrCameraMotionMode,
          engine: flock.engine,
        };
      });

      afterEach(function () {
        flock._restoreXREmbodiedVisibility();
        flock._xrViewMode = originalState.mode;
        flock.xrHelper = originalState.helper;
        flock._xrFollowTarget = originalState.target;
        flock._xrMode = originalState.xrMode;
        flock._xrSessionActive = originalState.sessionActive;
        flock._xrFollowLastPosition = originalState.lastPosition;
        flock._xrFollowSettledPosition = originalState.settledPosition;
        flock._xrFollowLastMovedAt = originalState.lastMovedAt;
        flock._xrWatchPosition = originalState.watchPosition;
        flock._xrEmbodiedVisibility = originalState.embodiedVisibility;
        flock._xrCameraMotionMode = originalState.cameraMotionMode;
        flock.engine = originalState.engine;
        flock.inputManager._setAxis('XR_MOVE_X', 0);
        flock.inputManager._setAxis('XR_MOVE_Y', 0);
      });

      it('sets view and camera motion independently in either order', function () {
        flock.setXRViewMode('embody');
        flock.setXRCameraMotionMode('smooth');
        expect(flock._xrViewMode).to.equal('embody');
        expect(flock._xrCameraMotionMode).to.equal('smooth');

        flock.setXRCameraMotionMode('teleport');
        flock.setXRViewMode('watch');
        expect(flock._xrViewMode).to.equal('watch');
        expect(flock._xrCameraMotionMode).to.equal('comfort');
      });

      it('ignores an unknown view mode', function () {
        flock._xrViewMode = 'watch';
        flock._xrCameraMotionMode = 'smooth';
        flock.setXRViewMode('unknown');
        expect(flock._xrViewMode).to.equal('watch');
        expect(flock._xrCameraMotionMode).to.equal('smooth');
      });

      it('ignores an unknown camera motion mode', function () {
        flock._xrViewMode = 'embody';
        flock._xrCameraMotionMode = 'none';
        flock.setXRCameraMotionMode('unknown');
        expect(flock._xrViewMode).to.equal('embody');
        expect(flock._xrCameraMotionMode).to.equal('none');
      });

      it('rejects camera motion modes that do not apply to the current view', function () {
        flock._xrViewMode = 'watch';
        flock._xrCameraMotionMode = 'none';
        flock.setXRCameraMotionMode('teleport');
        expect(flock._xrCameraMotionMode).to.equal('none');

        flock._xrViewMode = 'embody';
        flock.setXRCameraMotionMode('comfort');
        expect(flock._xrCameraMotionMode).to.equal('none');
      });

      it('comfort holds the camera while moving, then catches up after movement stops', function () {
        const camera = { position: new flock.BABYLON.Vector3(0, 2, -7) };
        const target = { position: new flock.BABYLON.Vector3(0, 0, 0) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = target;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'watch';
        flock._xrCameraMotionMode = 'comfort';
        flock._resetXRViewTracking();

        target.position.x = 3;
        flock._updateXRView();
        expect(camera.position.x).to.equal(0);

        flock._xrFollowLastMovedAt -= 300;
        flock._updateXRView();
        expect(camera.position.x).to.equal(3);
      });

      it('watch never inherits movement from the follow target', function () {
        const camera = { position: new flock.BABYLON.Vector3(0, 2, -7) };
        const target = { position: new flock.BABYLON.Vector3(0, 0, 0) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = target;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'watch';
        flock._xrCameraMotionMode = 'none';
        flock._resetXRViewTracking();
        target.position.x = 3;
        flock._updateXRView();
        expect(camera.position.x).to.equal(0);
      });

      it('restores the watch position without a follow target', function () {
        const camera = { position: new flock.BABYLON.Vector3(4, 1, 2) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = null;
        flock._xrWatchPosition = new flock.BABYLON.Vector3(0, 2, -7);
        flock._xrViewMode = 'embody';

        flock.setXRViewMode('watch');

        expect(camera.position.asArray()).to.deep.equal([0, 2, -7]);
      });

      it('watch with smooth motion continuously follows the target', function () {
        const camera = { position: new flock.BABYLON.Vector3(0, 2, -7) };
        const target = { position: new flock.BABYLON.Vector3(0, 0, 0) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = target;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'watch';
        flock._xrCameraMotionMode = 'smooth';
        flock._resetXRViewTracking();
        target.position.x = 3;
        flock._updateXRView();
        expect(camera.position.x).to.equal(3);
      });

      it('embodied smooth locomotion moves the XR origin without project action shims', function () {
        const camera = {
          position: new flock.BABYLON.Vector3(0, 0, 0),
          getDirectionToRef(direction, result) {
            result.copyFrom(direction);
          },
        };
        flock.xrHelper = { baseExperience: { camera } };
        flock.engine = { getDeltaTime: () => 16 };
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';
        flock._xrCameraMotionMode = 'smooth';
        flock.inputManager._setAxis('XR_MOVE_Y', -1);
        flock._updateXRView();
        expect(camera.position.z).to.be.closeTo(0.032, 0.000001);
      });

      it('embody hides the followed hierarchy and restores its previous visibility', function () {
        const child = { isVisible: true, isDisposed: () => false };
        const alreadyHidden = { isVisible: false, isDisposed: () => false };
        const target = {
          isVisible: true,
          isDisposed: () => false,
          getChildMeshes: () => [child, alreadyHidden],
        };
        flock._xrFollowTarget = target;
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';
        flock._applyXRViewVisibility();

        expect(target.isVisible).to.be.false;
        expect(child.isVisible).to.be.false;
        expect(alreadyHidden.isVisible).to.be.false;

        flock._xrViewMode = 'watch';
        flock._applyXRViewVisibility();
        expect(target.isVisible).to.be.true;
        expect(child.isVisible).to.be.true;
        expect(alreadyHidden.isVisible).to.be.false;
      });

      it('leaving XR restores an embodied hierarchy', function () {
        const target = {
          isVisible: true,
          isDisposed: () => false,
          getChildMeshes: () => [],
        };
        flock._xrFollowTarget = target;
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';
        flock._applyXRViewVisibility();
        expect(target.isVisible).to.be.false;

        flock._xrSessionActive = false;
        flock._applyXRViewVisibility();
        expect(target.isVisible).to.be.true;
      });
    });

    describe('setCameraBackground', function () {
      it("should not throw when called with 'user'", function () {
        expect(() => flock.setCameraBackground('user')).to.not.throw();
      });

      it("should not throw when called with 'environment'", function () {
        expect(() => flock.setCameraBackground('environment')).to.not.throw();
      });
    });

    describe('setXRMode', function () {
      let originalInitializeXR;
      let originalPrintText;

      beforeEach(function () {
        // WebXR and i18n are unavailable in headless — stub all three
        originalInitializeXR = flock.initializeXR;
        flock.initializeXR = async () => {};
        originalPrintText = flock.printText;
        flock.printText = () => {};
        window.translate = (key) => key;
      });

      afterEach(function () {
        flock.initializeXR = originalInitializeXR;
        flock.printText = originalPrintText;
        delete window.translate;
      });

      it('should not throw for VR mode', async function () {
        await flock.setXRMode('VR');
      });

      it('should not throw for AR mode', async function () {
        await flock.setXRMode('AR');
      });
    });

    describe('teleport locomotion', function () {
      let originalHelper;
      let originalScene;
      let originalGround;
      let originalXRMode;
      let originalTeleportState;
      let calls;

      beforeEach(function () {
        originalHelper = flock.xrHelper;
        originalScene = flock.scene;
        originalGround = flock.ground;
        originalXRMode = flock._xrMode;
        originalTeleportState = {
          cameraMotionMode: flock._xrCameraMotionMode,
          viewMode: flock._xrViewMode,
          allTargets: flock._teleportAllTargets,
          groundTarget: flock._teleportGroundTarget,
          explicitTargetNames: flock._teleportExplicitTargetNames,
          explicitTargetMeshes: flock._teleportExplicitTargetMeshes,
          floorMeshes: flock._teleportFloorMeshes,
          blockerMeshes: flock._teleportBlockerMeshes,
        };
        calls = { addFloor: [], removeFloor: [], addBlocker: [], removeBlocker: [] };
        const teleportation = {
          attach() {},
          detach() {},
          addFloorMesh(mesh) {
            calls.addFloor.push(mesh);
          },
          removeFloorMesh(mesh) {
            calls.removeFloor.push(mesh);
          },
          addBlockerMesh(mesh) {
            calls.addBlocker.push(mesh);
          },
          removeBlockerMesh(mesh) {
            calls.removeBlocker.push(mesh);
          },
        };
        flock.xrHelper = { teleportation };
        flock._xrMode = 'VR';
        flock._teleportAllTargets = false;
        flock._teleportGroundTarget = true;
        flock._teleportExplicitTargetNames = new Set();
        flock._teleportExplicitTargetMeshes = new Set();
        flock._teleportFloorMeshes = new Set();
        flock._teleportBlockerMeshes = new Set();
      });

      afterEach(function () {
        flock.xrHelper = originalHelper;
        flock.scene = originalScene;
        flock.ground = originalGround;
        flock._xrMode = originalXRMode;
        flock._xrCameraMotionMode = originalTeleportState.cameraMotionMode;
        flock._xrViewMode = originalTeleportState.viewMode;
        flock._teleportAllTargets = originalTeleportState.allTargets;
        flock._teleportGroundTarget = originalTeleportState.groundTarget;
        flock._teleportExplicitTargetNames = originalTeleportState.explicitTargetNames;
        flock._teleportExplicitTargetMeshes = originalTeleportState.explicitTargetMeshes;
        flock._teleportFloorMeshes = originalTeleportState.floorMeshes;
        flock._teleportBlockerMeshes = originalTeleportState.blockerMeshes;
      });

      it('registers ground by default', function () {
        const ground = { name: 'ground' };
        flock.ground = ground;
        flock.scene = { meshes: [ground] };
        flock.setXRViewMode('embody');
        flock.setXRCameraMotionMode('teleport');
        expect(calls.addFloor).to.deep.equal([ground]);
      });

      it('makes an explicit physics target a floor instead of a blocker', function () {
        const mesh = { name: 'platform', physics: {} };
        flock.scene = { meshes: [mesh], getMeshByName: () => mesh };
        flock.addTeleportTarget('platform');
        expect(calls.addFloor).to.deep.equal([mesh]);
        expect(calls.addBlocker).to.be.empty;
      });

      it('all targets Flock meshes but excludes helper meshes', function () {
        const object = { name: 'box', metadata: { blockKey: 'block' } };
        const helper = { name: 'teleportationTarget' };
        flock.scene = { meshes: [object, helper] };
        flock.addTeleportTarget('all');
        expect(calls.addFloor).to.deep.equal([object]);
      });

      it('applies an explicit target to its descendants only', function () {
        const child = { name: 'platform-child' };
        const sibling = { name: 'platform-sibling' };
        const parent = {
          name: 'platform',
          getChildMeshes: () => [child],
        };
        child.parent = parent;
        flock.scene = {
          meshes: [parent, child, sibling],
          getMeshByName: (name) => (name === parent.name ? parent : null),
        };

        flock.addTeleportTarget('platform');

        expect(calls.addFloor).to.deep.equal([parent, child]);
        expect(flock._isTeleportTarget(sibling)).to.be.false;
      });

      it('removes inherited target status from descendants', function () {
        const child = { name: 'platform-child' };
        const parent = { name: 'platform', getChildMeshes: () => [child] };
        child.parent = parent;
        flock.scene = {
          meshes: [parent, child],
          getMeshByName: () => parent,
        };
        flock.addTeleportTarget('platform');

        flock.removeTeleportTarget('platform');

        expect(calls.removeFloor).to.deep.equal([parent, child]);
      });

      it('applies parent physics blocker status to descendants', function () {
        const child = { name: 'model-child' };
        const parent = { name: 'model', physics: {}, getChildMeshes: () => [child] };
        child.parent = parent;
        flock.scene = { meshes: [parent, child] };

        flock._syncTeleportMeshHierarchy(parent);

        expect(calls.addBlocker).to.deep.equal([parent, child]);
      });

      it('target status overrides inherited blocker status', function () {
        const child = { name: 'model-child' };
        const parent = { name: 'model', physics: {}, getChildMeshes: () => [child] };
        child.parent = parent;
        flock.scene = {
          meshes: [parent, child],
          getMeshByName: () => parent,
        };

        flock.addTeleportTarget('model');

        expect(calls.addFloor).to.deep.equal([parent, child]);
        expect(calls.addBlocker).to.be.empty;
      });

      it('inherits target status when a descendant is added later', function () {
        const parent = { name: 'platform' };
        const child = { name: 'late-child', parent };
        flock._teleportExplicitTargetNames.add(parent.name);

        flock._syncTeleportMesh(child);

        expect(calls.addFloor).to.deep.equal([child]);
      });

      it('preserves identity for object targets with duplicate names', function () {
        const selected = { name: 'platform' };
        const duplicate = { name: 'platform' };
        flock.scene = { meshes: [selected, duplicate] };

        flock.addTeleportTarget(selected);

        expect(flock._isTeleportTarget(selected)).to.be.true;
        expect(flock._isTeleportTarget(duplicate)).to.be.false;

        flock.removeTeleportTarget(selected);

        expect(flock._isTeleportTarget(selected)).to.be.false;
        expect(flock._isTeleportTarget(duplicate)).to.be.false;
      });

      it('keeps string targets name-based when meshes share a name', function () {
        const first = { name: 'platform' };
        const second = { name: 'platform' };
        flock.scene = { meshes: [first, second], getMeshByName: () => first };

        flock.addTeleportTarget('platform');

        expect(flock._isTeleportTarget(first)).to.be.true;
        expect(flock._isTeleportTarget(second)).to.be.true;
      });

      it('unregisters removed floor and blocker meshes from Babylon', function () {
        const floor = { name: 'floor' };
        const blocker = { name: 'blocker' };
        flock._teleportFloorMeshes.add(floor);
        flock._teleportBlockerMeshes.add(blocker);
        flock._teleportExplicitTargetMeshes.add(floor);

        flock._unregisterTeleportMesh(floor);
        flock._unregisterTeleportMesh(blocker);

        expect(calls.removeFloor).to.deep.equal([floor]);
        expect(calls.removeBlocker).to.deep.equal([blocker]);
        expect(flock._teleportFloorMeshes).to.be.empty;
        expect(flock._teleportBlockerMeshes).to.be.empty;
        expect(flock._teleportExplicitTargetMeshes).to.be.empty;
      });
    });
  });
}
