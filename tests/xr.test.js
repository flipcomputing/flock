import { expect } from 'chai';

export function runXRTests(flock) {
  describe('XR API @xr', function () {
    it('exposes teleport APIs to generated user code', function () {
      const api = flock.createWhitelist({ guard: (fn) => fn });
      expect(api.setLocomotionMode).to.be.a('function');
      expect(api.addTeleportTarget).to.be.a('function');
      expect(api.removeTeleportTarget).to.be.a('function');
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
          locomotionMode: flock._locomotionMode,
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
          addFloorMesh(mesh) { calls.addFloor.push(mesh); },
          removeFloorMesh(mesh) { calls.removeFloor.push(mesh); },
          addBlockerMesh(mesh) { calls.addBlocker.push(mesh); },
          removeBlockerMesh(mesh) { calls.removeBlocker.push(mesh); },
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
        flock._locomotionMode = originalTeleportState.locomotionMode;
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
        flock.setLocomotionMode('teleport');
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
