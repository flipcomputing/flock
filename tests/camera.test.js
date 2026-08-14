import { expect } from 'chai';

export function runCameraTests(flock) {
  describe('Camera API @camera', function () {
    describe('cameraControl', function () {
      afterEach(function () {
        delete flock._cameraControlBindings;
      });

      it('should store the binding in _cameraControlBindings', function () {
        flock.cameraControl('W', 'moveUp');
        expect(flock._cameraControlBindings).to.be.an('array');
        const binding = flock._cameraControlBindings.find((b) => b.action === 'moveUp');
        expect(binding).to.exist;
        expect(binding.normalizedKey).to.equal('W'.toUpperCase().charCodeAt(0));
      });

      it('should replace an existing binding for the same action', function () {
        flock.cameraControl('W', 'moveUp');
        flock.cameraControl('I', 'moveUp');
        const bindings = flock._cameraControlBindings.filter((b) => b.action === 'moveUp');
        expect(bindings).to.have.length(1);
        expect(bindings[0].normalizedKey).to.equal('I'.toUpperCase().charCodeAt(0));
      });

      it('should warn and not store a binding for an unsupported key', function () {
        const warnings = [];
        const original = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));
        flock.cameraControl('@@@', 'moveUp');
        console.warn = original;
        expect(warnings.length).to.be.greaterThan(0);
        const binding = (flock._cameraControlBindings || []).find((b) => b.action === 'moveUp');
        expect(binding).to.not.exist;
      });
    });

    describe('attachCamera', function () {
      const boxIds = [];
      let savedCamera, savedXRState;

      beforeEach(function () {
        savedCamera = flock.scene.activeCamera;
        savedXRState = {
          followTarget: flock._xrFollowTarget,
          followCameraRadius: flock._xrFollowCameraRadius,
          followCameraDirection: flock._xrFollowCameraDirection,
          followCameraVerticalOffset: flock._xrFollowCameraVerticalOffset,
          helper: flock.xrHelper,
          sessionActive: flock._xrSessionActive,
          mode: flock._xrMode,
          viewMode: flock._xrViewMode,
          watchPosition: flock._xrWatchPosition,
        };
      });

      afterEach(function () {
        boxIds.forEach((id) => {
          try {
            flock.dispose(id);
          } catch (e) {
            console.warn(`Failed to dispose ${id}:`, e);
          }
        });
        boxIds.length = 0;
        flock.scene.activeCamera = savedCamera;
        flock._xrFollowTarget = savedXRState.followTarget;
        flock._xrFollowCameraRadius = savedXRState.followCameraRadius;
        flock._xrFollowCameraDirection = savedXRState.followCameraDirection;
        flock._xrFollowCameraVerticalOffset = savedXRState.followCameraVerticalOffset;
        flock.xrHelper = savedXRState.helper;
        flock._xrSessionActive = savedXRState.sessionActive;
        flock._xrMode = savedXRState.mode;
        flock._xrViewMode = savedXRState.viewMode;
        flock._xrWatchPosition = savedXRState.watchPosition;
      });

      it('should set scene.activeCamera to an ArcRotateCamera following the mesh', async function () {
        const id = 'cameraAttachBox';
        await flock.createBox(id, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        boxIds.push(id);

        await flock.attachCamera(id);

        expect(flock.scene.activeCamera).to.exist;
        expect(flock.scene.activeCamera.metadata.following).to.exist;
        expect(flock.scene.activeCamera.metadata.following.name).to.equal(id);
        expect(flock._xrFollowTarget).to.equal(flock.scene.activeCamera.metadata.following);
      });

      it('should hand the XR watch framing the radius it was attached with', async function () {
        const id = 'cameraFramingBox';
        await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        boxIds.push(id);

        await flock.attachCamera(id, { radius: 12 });

        expect(flock._xrFollowCameraRadius).to.be.closeTo(12, 0.000001);
        expect(flock._xrFollowCameraVerticalOffset).to.be.closeTo(0, 0.000001);
        expect(flock._xrFollowCameraDirection.y).to.equal(0);
      });

      it('should reframe a running VR session when a camera is attached', async function () {
        const id = 'cameraSessionBox';
        await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        boxIds.push(id);

        const xrCamera = { position: new flock.BABYLON.Vector3(0, 0, 0) };
        flock.xrHelper = { baseExperience: { camera: xrCamera } };
        flock._xrSessionActive = true;
        flock._xrMode = 'VR';
        flock._xrViewMode = 'watch';

        await flock.attachCamera(id, { radius: 12 });

        const target = flock._xrFollowTarget.getAbsolutePosition();
        expect(xrCamera.position.y).to.be.closeTo(target.y + 1.5, 0.000001);
        expect(
          Math.hypot(xrCamera.position.x - target.x, xrCamera.position.z - target.z)
        ).to.be.closeTo(12, 0.000001);
      });
    });

    describe('canvasControls', function () {
      it('should not throw when called with false', function () {
        expect(() => flock.canvasControls(false)).to.not.throw();
      });

      it('should not throw when called with true', function () {
        expect(() => flock.canvasControls(true)).to.not.throw();
      });
    });

    describe('interactIndicator', function () {
      it('should not throw when called with false', function () {
        expect(() => flock.interactIndicator(false)).to.not.throw();
      });

      it('should not throw when called with true', function () {
        expect(() => flock.interactIndicator(true)).to.not.throw();
      });
    });
  });
}
