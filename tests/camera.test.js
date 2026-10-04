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
      let savedCamera, savedFlyCamera, savedXRState;

      beforeEach(function () {
        savedCamera = flock.scene.activeCamera;
        savedFlyCamera = flock.savedCamera;
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
        const followCamera = flock.scene.activeCamera;
        if (followCamera !== savedCamera && followCamera instanceof flock.BABYLON.ArcRotateCamera) {
          followCamera.dispose();
        }
        flock.scene.activeCamera = savedCamera;
        flock.savedCamera = savedFlyCamera;
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

      it('should sit behind the facing the mesh has at attachment time', async function () {
        const id = 'cameraBehindBox';
        await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        boxIds.push(id);

        await flock.rotateTo(id, { x: 0, y: 90, z: 0 });
        await flock.attachCamera(id, { radius: 10, front: false });

        const position = flock.scene.activeCamera.position;
        expect(position.x).to.be.closeTo(10, 0.001);
        expect(position.z).to.be.closeTo(0, 0.001);
      });

      it('should sit in front of the facing the mesh has at attachment time', async function () {
        const id = 'cameraFrontBox';
        await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        boxIds.push(id);

        await flock.rotateTo(id, { x: 0, y: 90, z: 0 });
        await flock.attachCamera(id, { radius: 10, front: true });

        const position = flock.scene.activeCamera.position;
        expect(position.x).to.be.closeTo(-10, 0.001);
        expect(position.z).to.be.closeTo(0, 0.001);
      });

      it('should keep a live fly camera saved when it replaces a follow camera', async function () {
        const id = 'cameraResaveBox';
        await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        boxIds.push(id);

        await flock.attachCamera(id, { front: false });
        const flyCamera = flock.savedCamera;
        await flock.attachCamera(id, { front: false });

        expect(flock.savedCamera).to.equal(flyCamera);
        expect(flyCamera.isDisposed()).to.be.false;
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

    describe('createCamera and switchCamera', function () {
      this.timeout(5000);
      const meshIds = [];
      let savedActive, savedFly, savedMain;

      const renderFrame = () => flock.scene.render();

      const addCamera = async (id, options) => {
        const name = flock.createCamera(id, { visible: true, ...options });
        meshIds.push(name);
        const frame = flock.scene.getMeshByName(name);
        const camera = await frame.metadata.cameraReady;
        return { name, frame, camera };
      };

      beforeEach(function () {
        savedActive = flock.scene.activeCamera;
        savedFly = flock.savedCamera;
        savedMain = flock.mainCamera;
      });

      afterEach(function () {
        const active = flock.scene.activeCamera;
        if (active !== savedActive && !active?.metadata?.cameraRig) {
          flock.scene.activeCamera = savedActive;
          active?.dispose();
        }
        meshIds.forEach((id) => {
          try {
            flock.dispose(id);
          } catch (e) {
            console.warn(`Failed to dispose ${id}:`, e);
          }
        });
        meshIds.length = 0;
        flock.scene.activeCamera = savedActive;
        flock.savedCamera = savedFly;
        flock.mainCamera = savedMain;
      });

      it('should create a flyable fly camera at its frame', async function () {
        const { name, frame, camera } = await addCamera('camFree', { position: [2, 1, -4] });
        expect(camera.inputs.attached.keyboard).to.exist;

        expect(name).to.be.a('string');
        expect(frame.metadata.shape).to.equal('camera');
        expect(camera).to.be.instanceOf(flock.BABYLON.FreeCamera);
        expect(camera.metadata.cameraRig).to.be.true;
        expect(camera.position.equalsWithEpsilon(frame.getAbsolutePosition(), 1e-4)).to.be.true;
      });

      it('should move and turn a free camera with its frame', async function () {
        const { name, frame, camera } = await addCamera('camFreeMove', { position: [0, 0, 0] });

        await flock.positionAt(name, { x: 5, y: 2, z: 3 });
        await flock.rotateTo(name, { x: 0, y: 90, z: 0 });
        renderFrame();

        expect(camera.position.equalsWithEpsilon(frame.getAbsolutePosition(), 1e-3)).to.be.true;
        const cameraRotation = flock.BABYLON.Quaternion.FromEulerVector(camera.rotation);
        expect(
          Math.abs(flock.BABYLON.Quaternion.Dot(cameraRotation, frame.absoluteRotationQuaternion))
        ).to.be.closeTo(1, 1e-3);
      });

      it('should keep its eye at the block Y once the camera model has loaded', async function () {
        const { name, frame, camera } = await addCamera('camEyeY', { position: [2, 3, -4] });
        for (let i = 0; i < 100 && frame.getTotalVertices() === 0; i++) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(frame.getTotalVertices()).to.be.above(0);

        expect(frame.getAbsolutePosition().y).to.be.closeTo(3, 1e-3);
        expect(flock.getBlockPositionFromMesh(frame).y).to.be.closeTo(3, 1e-3);

        await flock.positionAt(name, { x: 2, y: 5, z: -4, useY: true });
        renderFrame();
        expect(frame.getAbsolutePosition().y).to.be.closeTo(5, 1e-3);
        expect(camera.position.y).to.be.closeTo(5, 1e-3);
        expect(flock.getBlockPositionFromMesh(frame).y).to.be.closeTo(5, 1e-3);
      });

      it('should switch to a camera and hide its own frame while active', async function () {
        const { name, frame, camera } = await addCamera('camSwitch', { position: [0, 2, -6] });

        await flock.switchCamera(name);
        renderFrame();
        expect(flock.scene.activeCamera === camera).to.be.true;
        expect(frame.isVisible).to.be.false;

        flock.scene.activeCamera = savedActive;
        renderFrame();
        expect(frame.isVisible).to.be.true;
      });

      it('should hide a camera frame by default', async function () {
        const name = flock.createCamera('camDefaultHidden', { position: [0, 0, 0] });
        meshIds.push(name);
        await flock.scene.getMeshByName(name).metadata.cameraReady;
        renderFrame();
        expect(flock.scene.getMeshByName(name).isVisible).to.be.false;
      });

      it('should keep a hidden frame hidden', async function () {
        const { frame } = await addCamera('camHidden', { position: [0, 0, 0], visible: false });
        renderFrame();
        expect(frame.isVisible).to.be.false;
      });

      it('should drag the frame along when the active free camera is moved', async function () {
        const { name, frame } = await addCamera('camActiveMove', { position: [0, 0, 0] });
        await flock.switchCamera(name);
        renderFrame();

        await flock.positionAt(flock.getCamera(), { x: 4, y: 3, z: 1 });
        renderFrame();
        renderFrame();

        const frameCentre = frame.getAbsolutePosition();
        expect(frameCentre.x).to.be.closeTo(4, 1e-3);
        expect(frameCentre.z).to.be.closeTo(1, 1e-3);
      });

      it('should create a follow camera locked on its target', async function () {
        const targetId = 'camFollowTarget';
        await flock.createBox(targetId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        meshIds.push(targetId);

        const { frame, camera } = await addCamera('camFollow', {
          type: 'follow',
          target: targetId,
          distance: 6,
          up: 30,
          around: 0,
        });

        expect(camera).to.be.instanceOf(flock.BABYLON.ArcRotateCamera);
        expect(camera.lockedTarget.name).to.equal(targetId);
        expect(camera.radius).to.be.closeTo(6, 1e-3);
        expect(flock.BABYLON.Tools.ToDegrees(camera.beta)).to.be.closeTo(60, 1e-3);
        expect(camera.position.x).to.be.closeTo(0, 1e-3);
        expect(camera.position.z).to.be.lessThan(0);
        renderFrame();
        expect(frame.getAbsolutePosition().equalsWithEpsilon(camera.position, 1e-3)).to.be.true;
      });

      it('should let a gizmo drag a follow camera past its limits', async function () {
        const targetId = 'camDragTarget';
        await flock.createBox(targetId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        meshIds.push(targetId);
        const { frame, camera } = await addCamera('camDragFollow', {
          type: 'follow',
          target: targetId,
          distance: 6,
          up: 40,
        });
        const startUpper = camera.upperBetaLimit;

        flock._releaseFollowCameraLimits(camera);
        frame.setAbsolutePosition(new flock.BABYLON.Vector3(0, 0.5, -9));
        renderFrame();
        flock._settleFollowCameraLimits(camera);

        expect(camera.beta).to.be.greaterThan(startUpper);
        expect(camera.radius).to.be.closeTo(9, 0.05);
        expect(camera.upperBetaLimit).to.be.closeTo(camera.beta, 1e-6);
        expect(camera.lowerRadiusLimit).to.be.closeTo(camera.radius * 0.6, 1e-6);
      });

      it('should rebuild a camera whose first target never appeared', async function () {
        const targetId = 'camLateTarget';
        await flock.createBox(targetId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        meshIds.push(targetId);
        const name = flock.createCamera('camNoTarget', {
          type: 'follow',
          target: 'camMissingTarget',
        });
        meshIds.push(name);

        await flock.updateCameraRig(name, { target: targetId });

        const camera = flock.scene.getMeshByName(name).metadata.camera;
        expect(camera.lockedTarget.name).to.equal(targetId);
      });

      it('should glide a fly camera onto another camera', async function () {
        const from = await addCamera('camGlideFrom', { position: [0, 2, -8] });
        const to = await addCamera('camGlideTo', { position: [6, 4, 2] });
        await flock.rotateTo(to.name, { x: 0, y: 90, z: 0 });
        renderFrame();
        const activeBefore = flock.scene.activeCamera;

        await flock.glideToObject(from.name, to.name, { duration: 0.1 });
        renderFrame();

        expect(from.camera.position.equalsWithEpsilon(to.camera.position, 1e-2)).to.be.true;
        const fromRotation = flock.BABYLON.Quaternion.FromEulerVector(from.camera.rotation);
        const toRotation = flock.BABYLON.Quaternion.FromEulerVector(to.camera.rotation);
        expect(Math.abs(flock.BABYLON.Quaternion.Dot(fromRotation, toRotation))).to.be.closeTo(
          1,
          1e-3
        );
        expect(flock.scene.activeCamera === activeBefore).to.be.true;
      });

      it('should glide a follow camera past its limits', async function () {
        const targetId = 'camGlideLimitTarget';
        await flock.createBox(targetId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        meshIds.push(targetId);
        const follow = await addCamera('camGlideLimitFollow', {
          type: 'follow',
          target: targetId,
          distance: 6,
          up: 40,
        });
        const to = await addCamera('camGlideLimitTo', { position: [0, 0.2, -12] });

        await flock.glideToObject(follow.name, to.name, { duration: 0.05 });
        follow.camera.computeWorldMatrix(true);

        expect(follow.camera.position.equalsWithEpsilon(to.camera.position, 1e-2)).to.be.true;
        expect(follow.camera.upperBetaLimit).to.be.closeTo(follow.camera.beta, 1e-6);
      });

      it('should glide a grouped fly camera onto another camera', async function () {
        const parentId = 'camGlideParent';
        await flock.createBox(parentId, { width: 1, height: 1, depth: 1, position: [3, 0, 2] });
        meshIds.push(parentId);
        const parent = flock.scene.getMeshByName(parentId);
        await flock.rotateTo(parentId, { x: 0, y: 90, z: 0 });
        const from = await addCamera('camGroupedFrom', { position: [0, 2, -8] });
        from.frame.setParent(parent);
        const to = await addCamera('camGroupedTo', { position: [-4, 5, 6] });

        await flock.glideToObject(from.name, to.name, { duration: 0.05 });
        from.frame.computeWorldMatrix(true);

        expect(from.frame.getAbsolutePosition().equalsWithEpsilon(to.camera.position, 1e-2)).to.be
          .true;
      });

      it('should glide back to where it started when reversed', async function () {
        const from = await addCamera('camReverseFrom', { position: [0, 2, -8] });
        const to = await addCamera('camReverseTo', { position: [6, 4, 2] });
        const start = from.frame.getAbsolutePosition().clone();

        await flock.glideToObject(from.name, to.name, { duration: 0.05, reverse: true });

        expect(from.frame.getAbsolutePosition().equalsWithEpsilon(start, 1e-2)).to.be.true;
      });

      it('should keep gliding when looped', async function () {
        const from = await addCamera('camLoopFrom', { position: [0, 2, -8] });
        const to = await addCamera('camLoopTo', { position: [6, 4, 2] });

        flock.glideToObject(from.name, to.name, { duration: 0.05, loop: true });
        await new Promise((resolve) => setTimeout(resolve, 200));

        const glide = from.frame.metadata._cameraGlide;
        expect(glide).to.exist;
        glide.stop();
      });

      it('should glide the active built-in camera onto a camera', async function () {
        const to = await addCamera('camActiveGlideTo', { position: [5, 3, 5] });
        const camera = flock.scene.activeCamera;
        const startPosition = camera.position.clone();
        const startRotation = camera.rotation.clone();

        await flock.glideToObject(flock.getCamera(), to.name, { duration: 0.05 });

        expect(camera.position.equalsWithEpsilon(to.camera.position, 1e-2)).to.be.true;
        expect(camera.rotationQuaternion).to.equal(null);
        camera.position.copyFrom(startPosition);
        camera.rotation.copyFrom(startRotation);
      });

      it('should glide a follow camera around its target onto another camera', async function () {
        const targetId = 'camGlideFollowTarget';
        await flock.createBox(targetId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        meshIds.push(targetId);
        const follow = await addCamera('camGlideFollow', {
          type: 'follow',
          target: targetId,
          distance: 6,
          up: 20,
        });
        const to = await addCamera('camGlideFollowTo', { position: [0, 4, 8] });

        await flock.glideToObject(follow.name, to.name, { duration: 0.05 });
        follow.camera.computeWorldMatrix(true);

        expect(follow.camera.position.equalsWithEpsilon(to.camera.position, 1e-2)).to.be.true;
        expect(follow.camera.lockedTarget.name).to.equal(targetId);
      });

      it('should still glide a camera frame to an ordinary object', async function () {
        const targetId = 'camGlideBox';
        await flock.createBox(targetId, { width: 1, height: 1, depth: 1, position: [3, 0, 3] });
        meshIds.push(targetId);
        const { name, frame } = await addCamera('camGlideToBox', { position: [0, 0, 0] });

        await flock.glideToObject(name, targetId, { duration: 0.05 });

        expect(frame.position.x).to.be.closeTo(3, 1e-3);
        expect(frame.position.z).to.be.closeTo(3, 1e-3);
      });

      it('should create an unconstrained orbit camera', async function () {
        const targetId = 'camOrbitTarget';
        await flock.createBox(targetId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        meshIds.push(targetId);

        const { name, camera } = await addCamera('camOrbit', {
          type: 'orbit',
          target: targetId,
          distance: 8,
          up: 45,
          around: 90,
        });

        expect(camera).to.be.instanceOf(flock.BABYLON.ArcRotateCamera);
        expect(camera.upperBetaLimit).to.equal(null);
        expect(camera.allowUpsideDown).to.be.true;

        const offset = flock.cameraOffsetFromTarget(name, camera.position);
        expect(offset.distance).to.be.closeTo(8, 1e-3);
        expect(offset.up).to.be.closeTo(45, 1e-3);
        expect(offset.around).to.be.closeTo(90, 1e-3);
        expect(camera.position.x).to.be.greaterThan(0);

        const overhead = flock.cameraOffsetFromTarget(
          flock.scene.getMeshByName(targetId),
          new flock.BABYLON.Vector3(0, 10, 0)
        );
        expect(overhead.up).to.be.closeTo(90, 1e-3);
      });

      it('should not dispose an active rig camera when a follow camera is attached', async function () {
        const targetId = 'camAttachTarget';
        await flock.createBox(targetId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        meshIds.push(targetId);
        const { name, camera } = await addCamera('camBeforeAttach', { position: [0, 2, -6] });
        await flock.switchCamera(name);

        const followName = await flock.attachCamera(targetId, { name: 'playerCamera' });

        expect(camera.isDisposed()).to.be.false;
        expect(followName).to.equal('playerCamera');
        expect(flock.mainCamera.name).to.equal('playerCamera');

        await flock.switchCamera(name);
        expect(flock.scene.activeCamera === camera).to.be.true;
        await flock.switchCamera(followName);
        expect(flock.scene.activeCamera.name).to.equal('playerCamera');
      });

      it('should fall back to the main camera when the active rig is deleted', async function () {
        const { name, camera } = await addCamera('camDeleted', { position: [0, 2, -6] });
        await flock.switchCamera(name);

        flock.dispose(name);
        renderFrame();

        expect(camera.isDisposed()).to.be.true;
        expect(flock.scene.activeCamera.isDisposed()).to.be.false;
        expect(flock.scene.activeCamera.metadata?.cameraRig).to.not.be.true;
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
