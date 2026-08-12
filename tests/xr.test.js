import { expect } from 'chai';
import { createFlockXRState } from '../api/xr.js';

export function runXRTests(flock) {
  describe('XR API @xr', function () {
    it('exposes teleport APIs to generated user code', function () {
      const api = flock.createWhitelist({ guard: (fn) => fn });
      expect(api.setXRViewMode).to.be.a('function');
      expect(api.setXRCameraMotionMode).to.be.a('function');
      expect(api.addTeleportTarget).to.be.a('function');
      expect(api.removeTeleportTarget).to.be.a('function');
    });

    it('creates independent XR collection state', function () {
      const first = createFlockXRState();
      const second = createFlockXRState();

      first._xrEmbodiedVisibility.set('mesh', true);
      first._teleportExplicitTargetNames.add('ground');

      expect(second._xrEmbodiedVisibility).to.be.empty;
      expect(second._teleportExplicitTargetNames).to.be.empty;
    });

    it('stops the XR source and removes scene observers from their owner on reset', function () {
      const stateKeys = Object.keys(createFlockXRState());
      const originalState = Object.fromEntries(stateKeys.map((key) => [key, flock[key]]));
      const originalSource = flock._xrSource;
      const originalHelper = flock.xrHelper;
      const observer = {};
      const meshAddedObserver = {};
      const meshRemovedObserver = {};
      const removed = { view: [], added: [], removed: [] };
      let stopCalls = 0;
      try {
        flock._xrSource = { stop: () => stopCalls++ };
        flock._xrViewObserver = observer;
        flock._xrViewObserverScene = {
          onBeforeRenderObservable: { remove: (value) => removed.view.push(value) },
        };
        flock._xrMeshAddedObserver = meshAddedObserver;
        flock._xrMeshRemovedObserver = meshRemovedObserver;
        flock._xrMeshObserverScene = {
          onNewMeshAddedObservable: { remove: (value) => removed.added.push(value) },
          onMeshRemovedObservable: { remove: (value) => removed.removed.push(value) },
        };
        flock.xrHelper = {};

        flock._resetXRState();

        expect(stopCalls).to.equal(1);
        expect(removed.view).to.deep.equal([observer]);
        expect(removed.added).to.deep.equal([meshAddedObserver]);
        expect(removed.removed).to.deep.equal([meshRemovedObserver]);
        expect(flock._xrSource).to.equal(null);
        expect(flock._xrViewObserver).to.equal(null);
        expect(flock._xrViewObserverScene).to.equal(null);
        expect(flock._xrMeshAddedObserver).to.equal(null);
        expect(flock._xrMeshRemovedObserver).to.equal(null);
        expect(flock._xrMeshObserverScene).to.equal(null);
        expect(flock.xrHelper).to.equal(null);
      } finally {
        Object.assign(flock, originalState);
        flock._xrSource = originalSource;
        flock.xrHelper = originalHelper;
      }
    });

    it('handles XR entry and exit after the HUD is disposed', function () {
      const original = {
        advancedTexture: flock.advancedTexture,
        meshTexture: flock.meshTexture,
        stackPanel: flock.stackPanel,
        uiPlane: flock.uiPlane,
        source: flock._xrSource,
        applyVisibility: flock._applyXRViewVisibility,
      };
      let starts = 0;
      let stops = 0;
      try {
        flock.advancedTexture = null;
        flock.meshTexture = null;
        flock.stackPanel = null;
        flock.uiPlane = null;
        flock._xrSource = { start: () => starts++, stop: () => stops++, setInputMode: () => {} };
        flock._applyXRViewVisibility = () => {};

        expect(() =>
          flock._handleXRStateChange(flock.BABYLON.WebXRState.ENTERING_XR)
        ).not.to.throw();
        expect(() =>
          flock._handleXRStateChange(flock.BABYLON.WebXRState.EXITING_XR)
        ).not.to.throw();
        expect(starts).to.equal(1);
        expect(stops).to.equal(1);
      } finally {
        flock.advancedTexture = original.advancedTexture;
        flock.meshTexture = original.meshTexture;
        flock.stackPanel = original.stackPanel;
        flock.uiPlane = original.uiPlane;
        flock._xrSource = original.source;
        flock._applyXRViewVisibility = original.applyVisibility;
      }
    });

    it('moves application controls to the XR HUD and restores them on exit', function () {
      const originalTexture = flock.scene.UITexture;
      const originalMeshTexture = flock.meshTexture;
      const originalDesktopTexture = flock._xrDesktopUITexture;
      const control = { name: 'testControl' };
      const makeTexture = (controls = []) => ({
        rootContainer: { children: controls },
        addControl(value) {
          this.rootContainer.children.push(value);
        },
        removeControl(value) {
          this.rootContainer.children = this.rootContainer.children.filter(
            (item) => item !== value
          );
        },
      });
      const desktopTexture = makeTexture([control]);
      const hudTexture = makeTexture();

      try {
        flock.scene.UITexture = desktopTexture;
        flock.meshTexture = hudTexture;
        flock._xrDesktopUITexture = null;

        flock._enterXRHUD();

        expect(flock.scene.UITexture).to.equal(hudTexture);
        expect(desktopTexture.rootContainer.children).not.to.include(control);
        expect(hudTexture.rootContainer.children).to.include(control);

        flock._exitXRHUD();

        expect(flock.scene.UITexture).to.equal(desktopTexture);
        expect(hudTexture.rootContainer.children).not.to.include(control);
        expect(desktopTexture.rootContainer.children).to.include(control);
      } finally {
        flock.scene.UITexture = originalTexture;
        flock.meshTexture = originalMeshTexture;
        flock._xrDesktopUITexture = originalDesktopTexture;
      }
    });

    it('magnifies pixel-sized controls on the HUD texture', function () {
      const plane = flock.BABYLON.MeshBuilder.CreatePlane('hudScaleTest', {}, flock.scene);
      const texture = flock._createXRHUDTexture(plane);
      try {
        const button = flock.GUI.Button.CreateSimpleButton('hudScaleButton', 'Hi');
        button.width = '100px';
        button.fontSize = '20px';
        texture.addControl(button);

        const magnification = texture.getSize().width / texture.idealWidth;
        expect(magnification).to.be.greaterThan(1);
        expect(button.widthInPixels).to.equal(Math.ceil(100 * magnification));
        expect(button.fontSizeInPixels).to.equal(Math.ceil(20 * magnification));
      } finally {
        texture.dispose();
        plane.dispose();
      }
    });

    it('rebuilds the on-screen controls as the HUD opens and closes', function () {
      const original = {
        uiTexture: flock.scene.UITexture,
        meshTexture: flock.meshTexture,
        desktopTexture: flock._xrDesktopUITexture,
        hudActive: flock._xrHUDActive,
        refresh: flock._refreshOnScreenControls,
      };
      const hudStates = [];
      const texture = () => ({
        rootContainer: { children: [] },
        addControl() {},
        removeControl() {},
      });

      try {
        flock.scene.UITexture = texture();
        flock.meshTexture = texture();
        flock._xrDesktopUITexture = null;
        flock._xrHUDActive = false;
        flock._refreshOnScreenControls = () => hudStates.push(flock._xrHUDActive);

        flock._enterXRHUD();
        expect(flock._xrHUDActive).to.equal(true);

        flock._exitXRHUD();
        expect(flock._xrHUDActive).to.equal(false);
        expect(hudStates).to.deep.equal([true, false]);

        flock._exitXRHUD();
        expect(hudStates).to.deep.equal([true, false]);
      } finally {
        flock.scene.UITexture = original.uiTexture;
        flock.meshTexture = original.meshTexture;
        flock._xrDesktopUITexture = original.desktopTexture;
        flock._xrHUDActive = original.hudActive;
        flock._refreshOnScreenControls = original.refresh;
      }
    });

    describe('VR UI placement', function () {
      let originalState;

      const makePlane = () => ({
        parent: null,
        isVisible: true,
        rotationQuaternion: null,
        position: new flock.BABYLON.Vector3(),
        rotation: new flock.BABYLON.Vector3(),
        scaling: new flock.BABYLON.Vector3(1, 1, 1),
      });

      // The rig cameras are the eyes: pose-driven, and untouched by writes to the XR camera.
      const makeRig = (x, y, z, yaw = 0) => {
        const rotation = flock.BABYLON.Quaternion.RotationYawPitchRoll(yaw, 0, 0);
        const world = flock.BABYLON.Matrix.Compose(
          flock.BABYLON.Vector3.One(),
          rotation,
          new flock.BABYLON.Vector3(x, y, z)
        );
        return {
          globalPosition: new flock.BABYLON.Vector3(x, y, z),
          absoluteRotation: rotation,
          getWorldMatrix: () => world,
          getDirectionToRef: (axis, result) =>
            flock.BABYLON.Vector3.TransformNormalToRef(axis, world, result),
        };
      };

      const makeHeadset = (yaw = 0) => ({
        name: 'xrCamera',
        position: new flock.BABYLON.Vector3(0, 1.6, 0),
        rotationQuaternion: flock.BABYLON.Quaternion.RotationYawPitchRoll(yaw, 0, 0),
        rigCameras: [makeRig(-0.03, 1.6, 0, yaw), makeRig(0.03, 1.6, 0, yaw)],
      });

      beforeEach(function () {
        originalState = {
          placement: flock._xrUIPlacement,
          plane: flock.uiPlane,
          helper: flock.xrHelper,
        };
      });

      afterEach(function () {
        flock._xrUIPlacement = originalState.placement;
        flock.uiPlane = originalState.plane;
        flock.xrHelper = originalState.helper;
      });

      it('exposes the placement API to generated user code', function () {
        const api = flock.createWhitelist({ guard: (fn) => fn });
        expect(api.setXRUIPlacement).to.be.a('function');
      });

      it('releases both controller observers on reset', function () {
        const stateKeys = Object.keys(createFlockXRState());
        const saved = Object.fromEntries(stateKeys.map((key) => [key, flock[key]]));
        const savedHelper = flock.xrHelper;
        const added = { name: 'addedObserver' };
        const removedObserver = { name: 'removedObserver' };
        const releasedFrom = { added: [], removed: [] };
        try {
          flock._xrUIControllerObserver = added;
          flock._xrUIControllerRemovedObserver = removedObserver;
          flock.xrHelper = {
            input: {
              onControllerAddedObservable: {
                remove: (value) => releasedFrom.added.push(value),
              },
              onControllerRemovedObservable: {
                remove: (value) => releasedFrom.removed.push(value),
              },
            },
          };

          flock._resetXRState();

          expect(releasedFrom.added).to.deep.equal([added]);
          expect(releasedFrom.removed).to.deep.equal([removedObserver]);
          expect(flock._xrUIControllerObserver).to.equal(null);
          expect(flock._xrUIControllerRemovedObserver).to.equal(null);
        } finally {
          Object.assign(flock, saved);
          flock.xrHelper = savedHelper;
        }
      });

      it('ignores unknown placements', function () {
        flock._xrUIPlacement = 'hud';
        flock.setXRUIPlacement('elbow');
        expect(flock._xrUIPlacement).to.equal('hud');
      });

      it('head-locks the panel for hud placement', function () {
        const camera = makeHeadset();
        const plane = makePlane();
        flock.uiPlane = plane;
        flock.xrHelper = { baseExperience: { camera }, input: { controllers: [] } };

        flock.setXRUIPlacement('hud');

        expect(flock._xrUIPlacement).to.equal('hud');
        expect(plane.parent).to.equal(null);
        expect(plane.position.x).to.be.closeTo(0, 1e-6);
        expect(plane.position.y).to.be.closeTo(1.6, 1e-6);
        expect(plane.position.z).to.be.closeTo(1.5, 1e-6);
        expect(plane.rotationQuaternion.y).to.be.closeTo(0, 1e-6);
        expect(plane.scaling.x).to.equal(1);
      });

      it('turns the panel with the eyes rather than the headset the wearer is facing', function () {
        const camera = makeHeadset(Math.PI / 2);
        const plane = makePlane();
        flock.uiPlane = plane;
        flock.xrHelper = { baseExperience: { camera }, input: { controllers: [] } };

        flock.setXRUIPlacement('hud');

        expect(plane.position.x).to.be.closeTo(1.5, 1e-6);
        expect(plane.position.z).to.be.closeTo(0, 1e-6);
        expect(plane.rotationQuaternion.y).to.be.closeTo(Math.sin(Math.PI / 4), 1e-6);
      });

      // Snap turn, watch trailing and teleport all move the XR camera after the frame's pose
      // has been read. The eyes only catch up next frame, and the panel has to wait with them.
      it('ignores an XR camera moved after the frame opened', function () {
        const camera = makeHeadset();
        const plane = makePlane();
        flock.uiPlane = plane;
        flock.xrHelper = { baseExperience: { camera }, input: { controllers: [] } };
        flock.setXRUIPlacement('hud');

        camera.position.set(10, 1.6, 10);
        flock._rotateXRCameraYaw(Math.PI / 6);
        flock._syncXRHUDPose();

        expect(plane.position.x).to.be.closeTo(0, 1e-6);
        expect(plane.position.z).to.be.closeTo(1.5, 1e-6);
        expect(plane.rotationQuaternion.y).to.be.closeTo(0, 1e-6);
      });

      it('attaches the panel to the left controller grip for wrist placement', function () {
        const grip = { name: 'leftGrip' };
        const plane = makePlane();
        flock.uiPlane = plane;
        flock.xrHelper = {
          baseExperience: { camera: makeHeadset() },
          input: {
            controllers: [
              { inputSource: { handedness: 'right' }, grip: { name: 'rightGrip' } },
              { inputSource: { handedness: 'left' }, grip },
            ],
          },
        };

        flock.setXRUIPlacement('wrist');

        expect(plane.parent).to.equal(grip);
        expect(plane.position).to.include({ x: 0.1, y: -0.05, z: 0 });
        expect(plane.rotation.x).to.be.closeTo(Math.PI / 2, 1e-9);
        expect(plane.scaling.x).to.be.lessThan(1);
      });

      it('falls back to the head-locked panel while no left controller is connected', function () {
        const camera = makeHeadset();
        const plane = makePlane();
        flock.uiPlane = plane;
        flock.xrHelper = {
          baseExperience: { camera },
          input: { controllers: [{ inputSource: { handedness: 'right' }, grip: {} }] },
        };

        flock.setXRUIPlacement('wrist');

        expect(flock._xrUIPlacement).to.equal('wrist');
        expect(plane.parent).to.equal(null);
        expect(plane.position.y).to.be.closeTo(1.6, 1e-6);
        expect(plane.position.z).to.be.closeTo(1.5, 1e-6);
      });

      it('falls back to the head-locked panel when the left controller disconnects', function () {
        const camera = makeHeadset();
        const grip = { name: 'leftGrip' };
        const plane = makePlane();
        const controllers = [{ inputSource: { handedness: 'left' }, grip }];
        flock.uiPlane = plane;
        flock.xrHelper = { baseExperience: { camera }, input: { controllers } };

        flock.setXRUIPlacement('wrist');
        expect(plane.parent).to.equal(grip);

        controllers.length = 0;
        flock._applyXRUIPlacement();

        expect(plane.parent).to.equal(null);
        expect(plane.position.z).to.be.closeTo(1.5, 1e-6);
        expect(plane.scaling.x).to.equal(1);
      });

      it('picks up a left controller that connects after the placement is set', function () {
        const camera = makeHeadset();
        const grip = { name: 'leftGrip' };
        const plane = makePlane();
        const controllers = [];
        flock.uiPlane = plane;
        flock.xrHelper = { baseExperience: { camera }, input: { controllers } };

        flock.setXRUIPlacement('wrist');
        expect(plane.parent).to.equal(null);

        controllers.push({ inputSource: { handedness: 'left' }, grip });
        flock._applyXRUIPlacement();

        expect(plane.parent).to.equal(grip);
      });
    });

    describe('XR HUD picking', function () {
      let originalPlane;
      let originalTexture;

      beforeEach(function () {
        originalPlane = flock.uiPlane;
        originalTexture = flock.meshTexture;
      });

      afterEach(function () {
        flock.uiPlane = originalPlane;
        flock.meshTexture = originalTexture;
      });

      it('leaves the panel unpickable while it carries nothing to press', function () {
        flock.uiPlane = { isPickable: true };
        flock.meshTexture = { rootContainer: { children: [{ isPointerBlocker: false }] } };

        flock._syncXRHUDPicking();

        expect(flock.uiPlane.isPickable).to.equal(false);
      });

      it('makes the panel pickable for a nested interactive control', function () {
        flock.uiPlane = { isPickable: false };
        flock.meshTexture = {
          rootContainer: {
            children: [{ isPointerBlocker: false, children: [{ isPointerBlocker: true }] }],
          },
        };

        flock._syncXRHUDPicking();

        expect(flock.uiPlane.isPickable).to.equal(true);
      });

      it('ignores hidden controls', function () {
        flock.uiPlane = { isPickable: true };
        flock.meshTexture = {
          rootContainer: { children: [{ isVisible: false, isPointerBlocker: true }] },
        };

        flock._syncXRHUDPicking();

        expect(flock.uiPlane.isPickable).to.equal(false);
      });
    });

    describe('VR view mode', function () {
      let originalState;

      beforeEach(function () {
        originalState = {
          mode: flock._xrViewMode,
          helper: flock.xrHelper,
          target: flock._xrFollowTarget,
          followCameraDirection: flock._xrFollowCameraDirection,
          followCameraRadius: flock._xrFollowCameraRadius,
          followCameraVerticalOffset: flock._xrFollowCameraVerticalOffset,
          xrMode: flock._xrMode,
          sessionActive: flock._xrSessionActive,
          lastPosition: flock._xrFollowLastPosition,
          settledPosition: flock._xrFollowSettledPosition,
          lastMovedAt: flock._xrFollowLastMovedAt,
          lastHeading: flock._xrFollowLastHeading,
          watchYawOffset: flock._xrWatchYawOffset,
          watchAnchorYaw: flock._xrWatchAnchorYaw,
          watchAnchorPosition: flock._xrWatchAnchorPosition,
          watchAnchorTarget: flock._xrWatchAnchorTarget,
          snapTurnHeld: flock._xrSnapTurnHeld,
          watchPosition: flock._xrWatchPosition,
          nonXRCameraPosition: flock._xrNonXRCameraPosition,
          embodiedVisibility: flock._xrEmbodiedVisibility,
          cameraMotionMode: flock._xrCameraMotionMode,
          canvasControlsEnabled: flock._canvasControlsEnabled,
          engine: flock.engine,
        };
      });

      afterEach(function () {
        flock._restoreXREmbodiedVisibility();
        flock._xrViewMode = originalState.mode;
        flock.xrHelper = originalState.helper;
        flock._xrFollowTarget = originalState.target;
        flock._xrFollowCameraDirection = originalState.followCameraDirection;
        flock._xrFollowCameraRadius = originalState.followCameraRadius;
        flock._xrFollowCameraVerticalOffset = originalState.followCameraVerticalOffset;
        flock._xrMode = originalState.xrMode;
        flock._xrSessionActive = originalState.sessionActive;
        flock._xrFollowLastPosition = originalState.lastPosition;
        flock._xrFollowSettledPosition = originalState.settledPosition;
        flock._xrFollowLastMovedAt = originalState.lastMovedAt;
        flock._xrFollowLastHeading = originalState.lastHeading;
        flock._xrWatchYawOffset = originalState.watchYawOffset;
        flock._xrWatchAnchorYaw = originalState.watchAnchorYaw;
        flock._xrWatchAnchorPosition = originalState.watchAnchorPosition;
        flock._xrWatchAnchorTarget = originalState.watchAnchorTarget;
        flock._xrSnapTurnHeld = originalState.snapTurnHeld;
        flock._xrWatchPosition = originalState.watchPosition;
        flock._xrNonXRCameraPosition = originalState.nonXRCameraPosition;
        flock._xrEmbodiedVisibility = originalState.embodiedVisibility;
        flock._xrCameraMotionMode = originalState.cameraMotionMode;
        flock._canvasControlsEnabled = originalState.canvasControlsEnabled;
        flock.engine = originalState.engine;
        flock.inputManager._setAxis('XR_MOVE_X', 0);
        flock.inputManager._setAxis('XR_MOVE_Y', 0);
        flock.inputManager._setAxis('XR_MOVE_VERTICAL', 0);
        flock.inputManager._setAxis('XR_TURN_X', 0);
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

      it('routes embodied smooth thumbsticks through project controls', function () {
        const originalSource = flock._xrSource;
        const modes = [];
        flock._xrSource = { setInputMode: (mode) => modes.push(mode) };
        try {
          flock._xrFollowTarget = {
            position: new flock.BABYLON.Vector3(0, 0, 0),
          };
          flock._xrViewMode = 'embody';
          flock._xrCameraMotionMode = 'smooth';
          flock._applyXRInputState();
          flock._xrCameraMotionMode = 'teleport';
          flock._applyXRInputState();
        } finally {
          flock._xrSource = originalSource;
        }
        expect(modes).to.deep.equal(['project', 'disabled']);
      });

      it('uses fly input for smooth movement without a follow target', function () {
        const originalSource = flock._xrSource;
        const modes = [];
        flock._xrSource = { setInputMode: (mode) => modes.push(mode) };
        try {
          flock._xrFollowTarget = null;
          flock._xrViewMode = 'embody';
          flock._xrCameraMotionMode = 'smooth';
          flock._canvasControlsEnabled = true;
          flock._applyXRInputState();
          flock._canvasControlsEnabled = false;
          flock._applyXRInputState();
        } finally {
          flock._xrSource = originalSource;
          flock._canvasControlsEnabled = undefined;
        }
        expect(modes).to.deep.equal(['fly', 'project']);
      });

      it('routes the thumbstick to project controls when nothing else moves the camera', function () {
        const originalSource = flock._xrSource;
        const modes = [];
        flock._xrSource = { setInputMode: (mode) => modes.push(mode) };
        try {
          flock._xrFollowTarget = null;
          flock._xrViewMode = 'watch';
          flock._xrCameraMotionMode = 'none';
          flock._applyXRInputState();
          flock._xrViewMode = 'embody';
          flock._xrCameraMotionMode = 'teleport';
          flock._applyXRInputState();
        } finally {
          flock._xrSource = originalSource;
        }
        expect(modes).to.deep.equal(['project', 'disabled']);
      });

      for (const { viewMode, motionMode, initialMode } of [
        { viewMode: 'watch', motionMode: 'comfort', initialMode: 'project' },
        { viewMode: 'embody', motionMode: 'smooth', initialMode: 'fly' },
      ]) {
        it(`applies project mode to a late follow camera in ${viewMode}`, function () {
          const originalSource = flock._xrSource;
          const modes = [];
          flock._xrSource = { setInputMode: (mode) => modes.push(mode) };
          try {
            flock._xrFollowTarget = null;
            flock._xrViewMode = viewMode;
            flock._xrCameraMotionMode = motionMode;
            flock._applyXRInputState();

            flock._setXRFollowTarget({
              position: new flock.BABYLON.Vector3(0, 0, 0),
              isDisposed: () => false,
              getChildMeshes: () => [],
            });
          } finally {
            flock._xrSource = originalSource;
          }

          expect(modes).to.deep.equal([initialMode, 'project']);
        });
      }

      it('defaults VR without a follow target to embodied teleport movement', function () {
        flock._xrFollowTarget = null;
        flock._xrViewMode = 'watch';
        flock._xrCameraMotionMode = 'none';

        flock._applyXRDefaults('VR');

        expect(flock._xrViewMode).to.equal('embody');
        expect(flock._xrCameraMotionMode).to.equal('teleport');
      });

      it('defaults VR with a follow target to watching with comfort movement', function () {
        flock._xrFollowTarget = {
          position: new flock.BABYLON.Vector3(0, 0, 0),
          isDisposed: () => false,
        };
        flock._xrViewMode = 'watch';
        flock._xrCameraMotionMode = 'none';

        flock._applyXRDefaults('VR');

        expect(flock._xrViewMode).to.equal('watch');
        expect(flock._xrCameraMotionMode).to.equal('comfort');
      });

      it('preserves an explicit no-follow locomotion mode', function () {
        flock._xrFollowTarget = null;
        flock._xrViewMode = 'embody';
        flock._xrCameraMotionMode = 'teleport';

        flock._applyXRDefaults('VR');

        expect(flock._xrViewMode).to.equal('embody');
        expect(flock._xrCameraMotionMode).to.equal('teleport');
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

      it('watch with smooth motion swings behind a turning character', function () {
        const camera = { position: new flock.BABYLON.Vector3(0, 2, -7) };
        const target = {
          position: new flock.BABYLON.Vector3(0, 0, 0),
          rotation: new flock.BABYLON.Vector3(0, 0, 0),
        };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = target;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'watch';
        flock._xrCameraMotionMode = 'smooth';
        flock._resetXRViewTracking();

        target.rotation.y = Math.PI / 2;
        flock._updateXRView();

        expect(camera.position.x).to.be.closeTo(-7, 0.000001);
        expect(camera.position.y).to.equal(2);
        expect(camera.position.z).to.be.closeTo(0, 0.000001);
      });

      it('comfort holds the view until a turning character stops', function () {
        const camera = { position: new flock.BABYLON.Vector3(0, 2, -7) };
        const target = {
          position: new flock.BABYLON.Vector3(0, 0, 0),
          rotation: new flock.BABYLON.Vector3(0, 0, 0),
        };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = target;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'watch';
        flock._xrCameraMotionMode = 'comfort';
        flock._resetXRViewTracking();

        target.rotation.y = Math.PI / 2;
        flock._updateXRView();
        expect(camera.position.asArray()).to.deep.equal([0, 2, -7]);

        flock._xrFollowLastMovedAt -= 300;
        flock._updateXRView();
        expect(camera.position.x).to.be.closeTo(-7, 0.000001);
        expect(camera.position.z).to.be.closeTo(0, 0.000001);
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

      it('snap turns the embodied view once per thumbstick push', function () {
        const camera = {
          position: new flock.BABYLON.Vector3(0, 1.7, 0),
          rotationQuaternion: flock.BABYLON.Quaternion.Identity(),
        };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = null;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';
        flock._xrCameraMotionMode = 'smooth';
        flock._xrSnapTurnHeld = false;

        flock.inputManager._setAxis('XR_TURN_X', 0.9);
        flock._updateXRSnapTurn();
        flock._updateXRSnapTurn();
        expect(camera.rotationQuaternion.toEulerAngles().y).to.be.closeTo(Math.PI / 6, 0.000001);

        flock.inputManager._setAxis('XR_TURN_X', 0);
        flock._updateXRSnapTurn();
        flock.inputManager._setAxis('XR_TURN_X', -0.9);
        flock._updateXRSnapTurn();
        expect(camera.rotationQuaternion.toEulerAngles().y).to.be.closeTo(0, 0.000001);
      });

      it('snap turn swings the watch camera around the character', function () {
        const camera = {
          position: new flock.BABYLON.Vector3(0, 2, -7),
          rotationQuaternion: flock.BABYLON.Quaternion.Identity(),
        };
        const target = { position: new flock.BABYLON.Vector3(0, 0, 0) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = target;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'watch';
        flock._xrCameraMotionMode = 'comfort';
        flock._resetXRViewTracking();
        flock._xrSnapTurnHeld = false;

        flock.inputManager._setAxis('XR_TURN_X', 0.9);
        flock._updateXRSnapTurn();

        expect(camera.position.x).to.be.closeTo(-7 * Math.sin(Math.PI / 6), 0.000001);
        expect(camera.position.z).to.be.closeTo(-7 * Math.cos(Math.PI / 6), 0.000001);
        expect(camera.rotationQuaternion.toEulerAngles().y).to.be.closeTo(Math.PI / 6, 0.000001);
        expect(flock.BABYLON.Vector3.Distance(camera.position, target.position)).to.be.closeTo(
          Math.sqrt(7 * 7 + 4),
          0.000001
        );
      });

      it('does not snap turn when canvas controls are disabled', function () {
        const camera = {
          position: new flock.BABYLON.Vector3(0, 1.7, 0),
          rotationQuaternion: flock.BABYLON.Quaternion.Identity(),
        };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';
        flock._canvasControlsEnabled = false;
        flock._xrSnapTurnHeld = false;

        flock.inputManager._setAxis('XR_TURN_X', 0.9);
        flock._updateXRSnapTurn();

        expect(camera.rotationQuaternion.toEulerAngles().y).to.equal(0);
      });

      it('leaves snap turning to teleport steering', function () {
        const camera = {
          position: new flock.BABYLON.Vector3(0, 1.7, 0),
          rotationQuaternion: flock.BABYLON.Quaternion.Identity(),
        };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';
        flock._xrCameraMotionMode = 'teleport';
        flock._xrSnapTurnHeld = false;

        flock.inputManager._setAxis('XR_TURN_X', 0.9);
        flock._updateXRSnapTurn();

        expect(camera.rotationQuaternion.toEulerAngles().y).to.equal(0);
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

      it('positions watch mode at the non-XR camera position without a follow target', function () {
        const camera = { position: new flock.BABYLON.Vector3(0, 0, 0) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrViewMode = 'watch';
        flock._xrFollowTarget = null;
        flock._xrNonXRCameraPosition = new flock.BABYLON.Vector3(0, 3, -10);

        flock._positionXRWatchCamera();

        expect(camera.position.asArray()).to.deep.equal([0, 3, -10]);
        expect(flock._xrWatchPosition.asArray()).to.deep.equal([0, 3, -10]);
      });

      it('positions embody mode at the non-XR camera position without a follow target', function () {
        const camera = { position: new flock.BABYLON.Vector3(0, 0, 0) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrViewMode = 'embody';
        flock._xrFollowTarget = null;
        flock._xrNonXRCameraPosition = new flock.BABYLON.Vector3(0, 20, -3);

        flock._positionXRWatchCamera();

        expect(camera.position.asArray()).to.deep.equal([0, 20, -3]);
      });

      it('positions watch mode using the non-XR camera height', function () {
        const camera = { position: new flock.BABYLON.Vector3(0.2, 1.7, -0.1) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrViewMode = 'watch';
        flock._xrFollowTarget = { position: new flock.BABYLON.Vector3(4, 0.5, 6) };
        flock._xrFollowCameraDirection = new flock.BABYLON.Vector3(0, 0, -1);
        flock._xrFollowCameraRadius = 8;
        flock._xrFollowCameraVerticalOffset = 3;

        flock._positionXRWatchCamera();

        expect(camera.position.x).to.equal(4);
        expect(camera.position.y).to.equal(3.5);
        expect(camera.position.z).to.be.closeTo(6 - Math.sqrt(8 * 8 - 3 * 3), 0.000001);
        expect(
          flock.BABYLON.Vector3.Distance(camera.position, flock._xrFollowTarget.position)
        ).to.be.closeTo(8, 0.000001);
      });

      it('preserves the non-XR camera height when it exceeds the project radius', function () {
        const camera = { position: new flock.BABYLON.Vector3(0, 2, 0) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrViewMode = 'watch';
        flock._xrFollowTarget = { position: new flock.BABYLON.Vector3(4, 0.5, 6) };
        flock._xrFollowCameraDirection = new flock.BABYLON.Vector3(0, 0, -1);
        flock._xrFollowCameraRadius = 1;
        flock._xrFollowCameraVerticalOffset = 2.5;

        flock._positionXRWatchCamera();

        expect(camera.position.asArray()).to.deep.equal([4, 3, 6]);
      });

      it('faces the follow target when watch mode positions the camera', function () {
        const targets = [];
        const camera = {
          position: new flock.BABYLON.Vector3(0, 0, 0),
          setTarget: (value) => targets.push(value.clone()),
        };
        const target = { position: new flock.BABYLON.Vector3(4, 0.5, 6) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrViewMode = 'watch';
        flock._xrFollowTarget = target;
        flock._xrFollowCameraDirection = new flock.BABYLON.Vector3(0, 0, -1);
        flock._xrFollowCameraRadius = 8;
        flock._xrFollowCameraVerticalOffset = 3;

        flock._positionXRWatchCamera();

        expect(targets).to.have.lengthOf(1);
        expect(targets[0].asArray()).to.deep.equal(target.position.asArray());
      });

      it('leaves the headset height alone when entering XR embodied', function () {
        const camera = { position: new flock.BABYLON.Vector3(0.2, 1.7, -0.1) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrViewMode = 'embody';
        flock._xrFollowTarget = { position: new flock.BABYLON.Vector3(4, 0.5, 6) };
        flock._xrFollowCameraDirection = new flock.BABYLON.Vector3(0, 0, -1);
        flock._xrFollowCameraRadius = 8;
        flock._xrFollowCameraVerticalOffset = 3;

        flock._positionXRWatchCamera();

        expect(camera.position.asArray()).to.deep.equal([0.2, 1.7, -0.1]);
        expect(flock._xrWatchPosition.y).to.equal(3.5);
      });

      it('captures the project follow camera direction and radius', function () {
        const target = { position: new flock.BABYLON.Vector3(2, 1, 5) };
        const camera = {
          position: new flock.BABYLON.Vector3(2, 4, -3),
          radius: 12,
          lockedTarget: target,
        };

        flock._syncXRFollowTargetFromCamera(camera);

        expect(flock._xrFollowCameraDirection.asArray()).to.deep.equal([0, 0, -1]);
        expect(flock._xrFollowCameraRadius).to.equal(12);
        expect(flock._xrFollowCameraVerticalOffset).to.equal(3);
        expect(flock._xrNonXRCameraPosition.asArray()).to.deep.equal([2, 4, -3]);
        expect(flock._xrFollowTarget).to.equal(target);
      });

      it('re-reads the project camera when the session starts', function () {
        const original = {
          activeCamera: flock.scene.activeCamera,
          meshTexture: flock.meshTexture,
          stackPanel: flock.stackPanel,
          uiPlane: flock.uiPlane,
          advancedTexture: flock.advancedTexture,
          source: flock._xrSource,
        };
        const target = { position: new flock.BABYLON.Vector3(0, 1, 0) };
        try {
          flock.meshTexture = null;
          flock.stackPanel = null;
          flock.uiPlane = null;
          flock.advancedTexture = null;
          flock._xrSource = { start: () => {}, setInputMode: () => {} };
          flock._xrFollowCameraDirection = new flock.BABYLON.Vector3(0, 0, -1);
          flock._xrFollowCameraRadius = 7;
          flock._xrFollowCameraVerticalOffset = 1;
          flock._xrNonXRCameraPosition = new flock.BABYLON.Vector3(0, 0, 0);
          flock.scene.activeCamera = {
            position: new flock.BABYLON.Vector3(0, 4, 3),
            radius: 5,
            lockedTarget: target,
          };

          flock._handleXRStateChange(flock.BABYLON.WebXRState.ENTERING_XR);

          expect(flock._xrFollowCameraDirection.asArray()).to.deep.equal([0, 0, 1]);
          expect(flock._xrFollowCameraRadius).to.equal(5);
          expect(flock._xrFollowCameraVerticalOffset).to.equal(3);
          expect(flock._xrNonXRCameraPosition.asArray()).to.deep.equal([0, 4, 3]);
          expect(flock._xrFollowTarget).to.equal(target);
        } finally {
          flock.scene.activeCamera = original.activeCamera;
          flock.meshTexture = original.meshTexture;
          flock.stackPanel = original.stackPanel;
          flock.uiPlane = original.uiPlane;
          flock.advancedTexture = original.advancedTexture;
          flock._xrSource = original.source;
        }
      });

      it('drops a follow target the project camera no longer has when the session starts', function () {
        const original = {
          activeCamera: flock.scene.activeCamera,
          meshTexture: flock.meshTexture,
          stackPanel: flock.stackPanel,
          uiPlane: flock.uiPlane,
          advancedTexture: flock.advancedTexture,
          source: flock._xrSource,
        };
        const hidden = { isVisible: false };
        try {
          flock.meshTexture = null;
          flock.stackPanel = null;
          flock.uiPlane = null;
          flock.advancedTexture = null;
          flock._xrSource = { start: () => {}, setInputMode: () => {} };
          flock._xrFollowTarget = { position: new flock.BABYLON.Vector3(0, 1, 0) };
          flock._xrFollowCameraDirection = new flock.BABYLON.Vector3(0, 0, -1);
          flock._xrFollowCameraRadius = 7;
          flock._xrFollowCameraVerticalOffset = 1;
          flock._xrEmbodiedVisibility = new Map([[hidden, true]]);
          flock.scene.activeCamera = { position: new flock.BABYLON.Vector3(0, 3, -10) };

          flock._handleXRStateChange(flock.BABYLON.WebXRState.ENTERING_XR);

          expect(flock._xrFollowTarget).to.equal(null);
          expect(flock._xrFollowCameraDirection).to.equal(null);
          expect(flock._xrFollowCameraRadius).to.equal(null);
          expect(flock._xrFollowCameraVerticalOffset).to.equal(null);
          expect(hidden.isVisible).to.equal(true);
        } finally {
          flock.scene.activeCamera = original.activeCamera;
          flock.meshTexture = original.meshTexture;
          flock.stackPanel = original.stackPanel;
          flock.uiPlane = original.uiPlane;
          flock.advancedTexture = original.advancedTexture;
          flock._xrSource = original.source;
        }
      });

      it('preserves headset height when entering embody mode', function () {
        const camera = { position: new flock.BABYLON.Vector3(4, 1.7, 2) };
        const target = { position: new flock.BABYLON.Vector3(8, 0.5, -6) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = target;
        flock._xrViewMode = 'watch';

        flock.setXRViewMode('embody');

        expect(camera.position.asArray()).to.deep.equal([8, 1.7, -6]);
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

      it('embodied smooth locomotion follows movement produced by the project', function () {
        const target = {
          position: new flock.BABYLON.Vector3(0, 4, 0),
          getAbsolutePosition() {
            return this.position;
          },
          setAbsolutePosition(position) {
            this.position.copyFrom(position);
          },
          isDisposed: () => false,
        };
        const camera = { position: new flock.BABYLON.Vector3(0, 1.7, 0) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';
        flock._xrCameraMotionMode = 'smooth';
        flock._xrFollowTarget = target;
        flock._resetXRViewTracking();
        target.position.z = 2;
        flock._updateXRView();
        expect(camera.position.z).to.equal(2);
        expect(camera.position.y).to.equal(1.7);
        expect(target.position.z).to.equal(2);
        expect(target.position.y).to.equal(4);
      });

      it('embodied smooth locomotion stays still when the project does not move the player', function () {
        const camera = { position: new flock.BABYLON.Vector3(0, 1.7, 0) };
        const target = { position: new flock.BABYLON.Vector3(0, 4, 0) };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = target;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';
        flock._xrCameraMotionMode = 'smooth';
        flock._resetXRViewTracking();
        flock.inputManager._setAxis('XR_MOVE_Y', -1);

        flock._updateXRView();

        expect(camera.position.asArray()).to.deep.equal([0, 1.7, 0]);
        expect(target.position.asArray()).to.deep.equal([0, 4, 0]);
      });

      it('flies the XR camera when smooth mode has no follow target', function () {
        const camera = {
          position: new flock.BABYLON.Vector3(0, 1.7, 0),
          getDirectionToRef(direction, result) {
            result.copyFrom(direction);
          },
        };
        flock.xrHelper = { baseExperience: { camera } };
        flock.engine = { getDeltaTime: () => 1000 / 60 };
        flock._xrFollowTarget = null;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';
        flock._xrCameraMotionMode = 'smooth';
        flock._canvasControlsEnabled = true;
        flock.inputManager._setAxis('XR_MOVE_Y', -1);
        flock.inputManager._setAxis('XR_MOVE_VERTICAL', 1);

        flock._updateXRView();

        expect(camera.position.z).to.be.greaterThan(0);
        expect(camera.position.y).to.be.greaterThan(1.7);
      });

      it('does not fly the XR camera when canvas controls are disabled', function () {
        const camera = {
          position: new flock.BABYLON.Vector3(0, 1.7, 0),
          getDirectionToRef(direction, result) {
            result.copyFrom(direction);
          },
        };
        flock.xrHelper = { baseExperience: { camera } };
        flock._xrFollowTarget = null;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrCameraMotionMode = 'smooth';
        flock._canvasControlsEnabled = false;
        flock.inputManager._setAxis('XR_MOVE_Y', -1);

        flock._updateXRView();

        expect(camera.position.asArray()).to.deep.equal([0, 1.7, 0]);
      });

      it('moves the embodied collision target to a teleport landing', function () {
        const calls = [];
        const target = {
          position: new flock.BABYLON.Vector3(1, 3, 2),
          rotationQuaternion: {},
          physics: { setTargetTransform: (position) => calls.push(position.clone()) },
          getAbsolutePosition() {
            return this.position;
          },
          setAbsolutePosition(position) {
            this.position.copyFrom(position);
          },
          isDisposed: () => false,
        };
        flock.xrHelper = {
          baseExperience: { camera: { position: new flock.BABYLON.Vector3(8, 1.7, -6) } },
        };
        flock._xrFollowTarget = target;
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';
        flock._xrCameraMotionMode = 'teleport';

        flock._updateXRView();

        expect(target.position.asArray()).to.deep.equal([8, 3, -6]);
        expect(calls).to.have.length(1);
        expect(calls[0].asArray()).to.deep.equal([8, 3, -6]);
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

      it('keeps an embodied say HUD visible while hiding the player', function () {
        const hud = {
          isVisible: true,
          metadata: { isXREmbodiedHUD: true },
          isDisposed: () => false,
        };
        const target = {
          isVisible: true,
          isDisposed: () => false,
          getChildMeshes: () => [hud],
        };
        flock._xrFollowTarget = target;
        flock._xrSessionActive = true;
        flock._xrViewMode = 'embody';

        flock._applyXRViewVisibility();

        expect(target.isVisible).to.be.false;
        expect(hud.isVisible).to.be.true;
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
      const keys = [
        '_cameraBackgroundLayer',
        '_cameraBackgroundTexture',
        '_cameraBackgroundFacing',
        '_xrMirror',
        '_xrSessionActive',
        '_xrMode',
      ];
      let saved;
      let savedHelper;

      beforeEach(function () {
        saved = Object.fromEntries(keys.map((key) => [key, flock[key]]));
        savedHelper = flock.xrHelper;
      });

      afterEach(function () {
        flock._disposeCameraBackground();
        Object.assign(flock, saved);
        flock.xrHelper = savedHelper;
      });

      const startFeed = (facing) => {
        const texture = new flock.BABYLON.DynamicTexture(
          'cameraBackgroundTest',
          { width: 64, height: 48 },
          flock.scene
        );
        flock._cameraBackgroundTexture = texture;
        flock._cameraBackgroundFacing = facing;
        flock._applyCameraBackground();
        return texture;
      };

      const enterVR = (position, forward) => {
        flock.xrHelper = {
          baseExperience: {
            camera: { position, getDirection: () => forward.clone() },
          },
        };
        flock._xrMode = 'VR';
        flock._xrSessionActive = true;
      };

      it("should not throw when called with 'user'", function () {
        expect(() => flock.setCameraBackground('user')).to.not.throw();
      });

      it("should not throw when called with 'environment'", function () {
        expect(() => flock.setCameraBackground('environment')).to.not.throw();
      });

      it('swaps the flat layer for a mirror facing the viewer when a VR session starts', function () {
        const texture = startFeed('user');
        expect(flock._cameraBackgroundLayer).to.not.equal(null);

        enterVR(new flock.BABYLON.Vector3(1, 1.6, 2), new flock.BABYLON.Vector3(1, 0, 0));
        flock._applyCameraBackground();

        expect(flock._cameraBackgroundLayer).to.equal(null);
        const mirror = flock._xrMirror;
        expect(mirror).to.not.equal(null);
        // Disposing the layer must not take the shared feed with it.
        expect(texture.isDisposed?.() ?? false).to.equal(false);
        expect(mirror.material.emissiveTexture).to.equal(texture);

        expect(mirror.position.x).to.be.closeTo(3.5, 1e-6);
        expect(mirror.position.y).to.be.closeTo(1.6, 1e-6);
        expect(mirror.position.z).to.be.closeTo(2, 1e-6);

        mirror.computeWorldMatrix(true);
        const facing = flock.BABYLON.Vector3.TransformNormal(
          new flock.BABYLON.Vector3(0, 0, -1),
          mirror.getWorldMatrix()
        );
        expect(facing.x).to.be.closeTo(-1, 1e-6);
        expect(facing.y).to.be.closeTo(0, 1e-6);
        expect(facing.z).to.be.closeTo(0, 1e-6);
      });

      it('puts the flat layer back when the VR session ends', function () {
        enterVR(new flock.BABYLON.Vector3(0, 1.6, 0), new flock.BABYLON.Vector3(0, 0, 1));
        const texture = startFeed('user');
        const mirror = flock._xrMirror;
        expect(mirror).to.not.equal(null);

        flock._xrSessionActive = false;
        flock._applyCameraBackground();

        expect(flock._xrMirror).to.equal(null);
        expect(mirror.isDisposed()).to.equal(true);
        expect(flock._cameraBackgroundLayer?.texture).to.equal(texture);
      });

      it('leaves the world-facing camera on the flat layer in VR', function () {
        enterVR(new flock.BABYLON.Vector3(0, 1.6, 0), new flock.BABYLON.Vector3(0, 0, 1));
        const texture = startFeed('environment');

        expect(flock._xrMirror).to.equal(null);
        expect(flock._cameraBackgroundLayer?.texture).to.equal(texture);
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

    describe('enter-VR button on headsets', function () {
      let originalInitializeXR;
      let originalSupported;
      let originalHeadsetBrowser;
      let originalHelper;
      let originalXRMode;
      let originalAbortController;
      let initCalls;

      beforeEach(function () {
        originalInitializeXR = flock.initializeXR;
        originalSupported = flock._immersiveVRSupported;
        originalHeadsetBrowser = flock._isHeadsetBrowser;
        originalHelper = flock.xrHelper;
        originalXRMode = flock._xrMode;
        originalAbortController = flock.abortController;
        initCalls = [];
        flock.initializeXR = async (mode) => {
          initCalls.push(mode);
        };
        flock._immersiveVRSupported = async () => true;
        flock._isHeadsetBrowser = () => true;
        flock.xrHelper = null;
        flock._xrMode = undefined;
        flock.abortController = new AbortController();
      });

      afterEach(function () {
        flock.initializeXR = originalInitializeXR;
        flock._immersiveVRSupported = originalSupported;
        flock._isHeadsetBrowser = originalHeadsetBrowser;
        flock.xrHelper = originalHelper;
        flock._xrMode = originalXRMode;
        flock.abortController = originalAbortController;
      });

      it('initializes VR so the enter button appears without an XR block', async function () {
        expect(await flock._showXRButtonOnHeadset()).to.equal(true);
        expect(initCalls).to.deep.equal(['VR']);
      });

      it('does nothing when the browser reports no immersive-vr support', async function () {
        flock._immersiveVRSupported = async () => false;

        expect(await flock._showXRButtonOnHeadset()).to.equal(false);
        expect(initCalls).to.deep.equal([]);
      });

      it('leaves phones to the XR block even though they support immersive-vr', async function () {
        flock._isHeadsetBrowser = () => false;

        expect(await flock._showXRButtonOnHeadset()).to.equal(false);
        expect(initCalls).to.deep.equal([]);
      });

      it('leaves a mode chosen by the project alone', async function () {
        flock._xrMode = 'MAGIC_WINDOW';

        expect(await flock._showXRButtonOnHeadset()).to.equal(false);
        expect(initCalls).to.deep.equal([]);
      });

      it('gives up when the project sets its own mode while detecting', async function () {
        flock._immersiveVRSupported = async () => {
          flock._xrMode = 'AR';
          return true;
        };

        expect(await flock._showXRButtonOnHeadset()).to.equal(false);
        expect(initCalls).to.deep.equal([]);
      });

      it('gives up when the run is stopped while detecting', async function () {
        const controller = flock.abortController;
        flock._immersiveVRSupported = async () => {
          controller.abort();
          return true;
        };

        expect(await flock._showXRButtonOnHeadset()).to.equal(false);
        expect(initCalls).to.deep.equal([]);
      });

      describe('_immersiveVRSupported', function () {
        let hadOwnXR;
        let originalOwnXR;

        beforeEach(function () {
          flock._immersiveVRSupported = originalSupported;
          hadOwnXR = Object.prototype.hasOwnProperty.call(navigator, 'xr');
          originalOwnXR = navigator.xr;
        });

        afterEach(function () {
          if (hadOwnXR) {
            Object.defineProperty(navigator, 'xr', {
              value: originalOwnXR,
              configurable: true,
              writable: true,
            });
          } else {
            delete navigator.xr;
          }
        });

        const stubXR = (xr) => {
          Object.defineProperty(navigator, 'xr', {
            value: xr,
            configurable: true,
            writable: true,
          });
        };

        it('reports support when the browser offers immersive-vr', async function () {
          const modes = [];
          stubXR({
            isSessionSupported: async (mode) => {
              modes.push(mode);
              return true;
            },
          });

          expect(await flock._immersiveVRSupported()).to.equal(true);
          expect(modes).to.deep.equal(['immersive-vr']);
        });

        it('reports no support without WebXR', async function () {
          stubXR(undefined);

          expect(await flock._immersiveVRSupported()).to.equal(false);
        });

        it('reports no support when the check rejects', async function () {
          stubXR({
            isSessionSupported: async () => {
              throw new Error('blocked');
            },
          });

          expect(await flock._immersiveVRSupported()).to.equal(false);
        });
      });

      describe('_isHeadsetBrowser', function () {
        let hadOwnAgent;
        let originalOwnAgent;

        beforeEach(function () {
          flock._isHeadsetBrowser = originalHeadsetBrowser;
          hadOwnAgent = Object.prototype.hasOwnProperty.call(navigator, 'userAgent');
          originalOwnAgent = navigator.userAgent;
        });

        afterEach(function () {
          if (hadOwnAgent) {
            Object.defineProperty(navigator, 'userAgent', {
              value: originalOwnAgent,
              configurable: true,
              writable: true,
            });
          } else {
            delete navigator.userAgent;
          }
        });

        const stubAgent = (agent) => {
          Object.defineProperty(navigator, 'userAgent', {
            value: agent,
            configurable: true,
            writable: true,
          });
        };

        it('recognises a headset browser', function () {
          stubAgent(
            'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 OculusBrowser/33.0 Mobile VR Safari/537.36'
          );

          expect(flock._isHeadsetBrowser()).to.equal(true);
        });

        it('does not treat a Cardboard-capable phone as a headset', function () {
          stubAgent(
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36'
          );

          expect(flock._isHeadsetBrowser()).to.equal(false);
        });

        it('treats a desktop reporting immersive-vr as a tethered headset', function () {
          stubAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'
          );

          expect(flock._isHeadsetBrowser()).to.equal(true);
        });
      });
    });

    describe('Magic Window initialization', function () {
      let originalHelper;
      let originalScene;
      let originalUIPlane;
      let originalXRMode;

      beforeEach(function () {
        originalHelper = flock.xrHelper;
        originalScene = flock.scene;
        originalUIPlane = flock.uiPlane;
        originalXRMode = flock._xrMode;
      });

      afterEach(function () {
        flock.xrHelper = originalHelper;
        flock.scene = originalScene;
        flock.uiPlane = originalUIPlane;
        flock._xrMode = originalXRMode;
      });

      it('configures device orientation without creating XR wrist UI', async function () {
        let addCalls = 0;
        const deviceOrientation = {};
        flock.xrHelper = null;
        flock.uiPlane = null;
        flock.scene = {
          render() {},
          activeCamera: {
            inputs: {
              attached: {},
              addDeviceOrientation() {
                addCalls++;
                this.attached.deviceOrientation = deviceOrientation;
              },
            },
          },
        };

        await flock.initializeXR('MAGIC_WINDOW');
        await flock.initializeXR('MAGIC_WINDOW');

        expect(addCalls).to.equal(1);
        expect(flock.xrHelper).to.equal(null);
        expect(flock.uiPlane).to.equal(null);
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

      it('teleports a free camera that has no follow target', function () {
        const ground = { name: 'ground' };
        const originalTarget = flock._xrFollowTarget;
        const teleportCalls = [];
        flock.ground = ground;
        flock.scene = { meshes: [ground] };
        flock._xrFollowTarget = null;
        flock.xrHelper.teleportation.attach = () => teleportCalls.push('attach');
        flock.xrHelper.teleportation.detach = () => teleportCalls.push('detach');

        try {
          flock.setXRViewMode('embody');
          flock.setXRCameraMotionMode('teleport');
        } finally {
          flock._xrFollowTarget = originalTarget;
        }

        expect(teleportCalls.at(-1)).to.equal('attach');
        expect(calls.addFloor).to.deep.equal([ground]);
      });

      it('stops free camera teleporting while canvas controls are off', function () {
        const ground = { name: 'ground' };
        const originalTarget = flock._xrFollowTarget;
        const originalControls = flock._canvasControlsEnabled;
        const teleportCalls = [];
        flock.ground = ground;
        flock.scene = { meshes: [ground] };
        flock._xrFollowTarget = null;
        flock.xrHelper.teleportation.attach = () => teleportCalls.push('attach');
        flock.xrHelper.teleportation.detach = () => teleportCalls.push('detach');

        try {
          flock.setXRViewMode('embody');
          flock.setXRCameraMotionMode('teleport');
          expect(teleportCalls.at(-1)).to.equal('attach');

          flock._canvasControlsEnabled = false;
          flock._applyTeleportationState();
        } finally {
          flock._xrFollowTarget = originalTarget;
          flock._canvasControlsEnabled = originalControls;
        }

        expect(teleportCalls.at(-1)).to.equal('detach');
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
