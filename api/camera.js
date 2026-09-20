import { hideFromInspector } from '../ui/inspectorVisibility.js';

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockCamera = {
  /* 
                Category: Scene>Camera
        */
  attachCamera(meshName, options = {}) {
    const { radius = 7, front = true, angle = 90 } = options;

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (mesh) {
        if (!mesh) {
          console.log('Model not loaded:', meshName);
          resolve();
          return;
        }

        if (!mesh.physics) {
          console.log("Can't attach camera to: ", meshName);
          resolve();
          return;
        }
        flock.ensureVerticalConstraint(mesh);

        const existingCamera = flock.scene.activeCamera;
        const disposedFollowCamera = existingCamera instanceof flock.BABYLON.ArcRotateCamera;
        existingCamera?.detachControl();
        if (disposedFollowCamera) existingCamera.dispose();

        const facing = flockCamera._followFacing(mesh);
        const anchor = mesh.getAbsolutePosition().clone();

        // savedCamera is the fly camera the gizmo toggles back to, so a follow camera
        // we just replaced must not take its place.
        if (!front && !disposedFollowCamera) {
          flock.savedCamera = existingCamera;
        }

        const betaRadians = flock.BABYLON.Tools.ToRadians(angle);

        const camera = new flock.BABYLON.ArcRotateCamera(
          'camera',
          Math.PI / 2,
          betaRadians,
          radius,
          anchor,
          flock.scene
        );

        if (!front) camera.checkCollisions = true;
        // Upper limit sits at the requested angle itself, since setPosition below places the
        // camera there; lower limit allows orbiting 30° further overhead.
        camera.lowerBetaLimit = Math.max(0.01, betaRadians - Math.PI / 6);
        camera.upperBetaLimit = betaRadians;
        camera.lowerRadiusLimit = radius * 0.6;
        camera.upperRadiusLimit = radius * 1.6;
        camera.angularSensibilityX = 2000;
        camera.angularSensibilityY = 2000;
        camera.panningSensibility = 0;
        camera.inputs.removeByType('ArcRotateCameraMouseWheelInput');

        camera.inputs.attached.pointers.multiTouchPanAndZoom = false;
        camera.inputs.attached.pointers.multiTouchPanning = false;
        camera.inputs.attached.pointers.pinchZoom = false;
        camera.inputs.attached.pointers.pinchInwards = false;
        camera.inputs.attached.pointers.useNaturalPinchZoom = false;

        camera.lockedTarget = mesh;
        // front looks the character in the face, otherwise sit over its shoulder.
        const horizontalOffset = radius * Math.sin(betaRadians);
        const verticalOffset = radius * Math.cos(betaRadians);
        camera.setPosition(
          anchor
            .add(facing.scale(front ? horizontalOffset : -horizontalOffset))
            .add(flock.BABYLON.Vector3.Up().scale(verticalOffset))
        );

        camera.metadata = camera.metadata || {};
        camera.metadata.following = mesh;
        camera.attachControl(flock.canvas, false);
        flock.scene.activeCamera = camera;

        flockCamera._reapplyCameraBindings(camera);

        flock._frameXRFromProjectCamera(camera);
        resolve();
      });
    });
  },
  // The character's own forward, flattened. mesh.rotation stops tracking the mesh once
  // physics or a rotate block writes a quaternion, so read the live world matrix.
  _followFacing(mesh) {
    mesh.computeWorldMatrix(true);
    const facing = mesh.forward.negate();
    facing.y = 0;
    return facing.lengthSquared() > 1e-6
      ? facing.normalize()
      : new flock.BABYLON.Vector3(0, 0, -1);
  },
  ensureVerticalConstraint(mesh) {
    if (!mesh || !flock.scene) return;
    if (!mesh.physics) return;
    mesh.metadata = mesh.metadata || {};
    if (mesh.metadata.constraint) return; // unset this before calling when swapping meshes

    const scene = flock.scene;

    // --- find or create a reusable constraint box (anchor) ---
    let constraintBox =
      (flock._constraintBox && !flock._constraintBox.isDisposed() && flock._constraintBox) ||
      (scene.meshes || []).find(
        (m) =>
          m && typeof m.name === 'string' && m.name.startsWith('Constraint_') && !m.isDisposed()
      );

    if (!constraintBox) {
      // create a new hidden static box
      constraintBox = flock.BABYLON.MeshBuilder.CreateBox(
        'Constraint',
        { height: 1, width: 1, depth: 1 },
        scene
      );
      constraintBox.metadata = constraintBox.metadata || {};
      constraintBox.metadata.blockKey = constraintBox.name;
      constraintBox.metadata.sectionOwner = flock._currentSection;
      constraintBox.name = constraintBox.name + '_' + constraintBox.uniqueId;
      constraintBox.isVisible = false;
      hideFromInspector(constraintBox);
      constraintBox.material =
        constraintBox.material || new flock.BABYLON.StandardMaterial('staticMaterial', scene);

      const body = new flock.BABYLON.PhysicsBody(
        constraintBox,
        flock.BABYLON.PhysicsMotionType.STATIC,
        false,
        scene
      );
      const shape = new flock.BABYLON.PhysicsShapeBox(
        flock.BABYLON.Vector3.Zero(),
        new flock.BABYLON.Quaternion(0, 0, 0, 1),
        flock.BABYLON.Vector3.One(),
        scene
      );
      body.shape = shape;
      body.setMassProperties({ mass: 1 });
      flock.applyBounciness(body, constraintBox);
      constraintBox.physics = body;

      // cache it for reuse
      flock._constraintBox = constraintBox;
    } else {
      // ensure reused box still has a valid static body + shape
      if (!constraintBox.physics) {
        const body = new flock.BABYLON.PhysicsBody(
          constraintBox,
          flock.BABYLON.PhysicsMotionType.STATIC,
          false,
          scene
        );
        const shape = new flock.BABYLON.PhysicsShapeBox(
          flock.BABYLON.Vector3.Zero(),
          new flock.BABYLON.Quaternion(0, 0, 0, 1),
          flock.BABYLON.Vector3.One(),
          scene
        );
        body.shape = shape;
        body.setMassProperties({ mass: 1 });
        flock.applyBounciness(body, constraintBox);
        constraintBox.physics = body;
      } else if (!constraintBox.physics.shape) {
        constraintBox.physics.shape = new flock.BABYLON.PhysicsShapeBox(
          flock.BABYLON.Vector3.Zero(),
          new flock.BABYLON.Quaternion(0, 0, 0, 1),
          flock.BABYLON.Vector3.One(),
          scene
        );
      }
    }

    // position the anchor under the mesh out of the way
    const meshWorldPos = mesh.getAbsolutePosition
      ? mesh.getAbsolutePosition()
      : mesh.position.clone();
    constraintBox.position.copyFrom(meshWorldPos);
    constraintBox.position.y += -4; // keep original -4 offset
    constraintBox.computeWorldMatrix(true);

    if (constraintBox.physics) {
      if (!constraintBox.rotationQuaternion) {
        constraintBox.rotationQuaternion = flock.BABYLON.Quaternion.Identity();
      }
      constraintBox.physics.disablePreStep = false;
      constraintBox.physics.setTargetTransform(
        constraintBox.position,
        constraintBox.rotationQuaternion
      );
    }

    // --- add the vertical constraint (lock roll & pitch; allow yaw) ---
    const constraint = new flock.BABYLON.Physics6DoFConstraint(
      {
        axisA: new flock.BABYLON.Vector3(1, 0, 0),
        axisB: new flock.BABYLON.Vector3(1, 0, 0),
        perpAxisA: new flock.BABYLON.Vector3(0, 1, 0),
        perpAxisB: new flock.BABYLON.Vector3(0, 1, 0),
      },
      [
        {
          axis: flock.BABYLON.PhysicsConstraintAxis.ANGULAR_X,
          minLimit: 0,
          maxLimit: 0,
        },
        {
          axis: flock.BABYLON.PhysicsConstraintAxis.ANGULAR_Z,
          minLimit: 0,
          maxLimit: 0,
        },
      ],
      scene
    );

    try {
      mesh.physics.addConstraint(constraintBox.physics, constraint);
      mesh.metadata.constraint = true;
      mesh.metadata.uprightConstraint = constraint;
    } catch (e) {
      console.warn('[ensureVerticalConstraint] addConstraint failed:', e);
    }

    flock.ensurePostPhysicsUpkeep(mesh);
  },
  getCamera() {
    return '__active_camera__';
  },
  _normalizeKeyCode(inputKey) {
    const keyMap = {
      ArrowLeft: 37,
      ArrowUp: 38,
      ArrowRight: 39,
      ArrowDown: 40,
      ' ': 32,
      ',': 188,
      '.': 190,
      '/': 191,
    };

    if (typeof inputKey === 'number') {
      return inputKey;
    }

    if (typeof inputKey !== 'string') {
      return null;
    }

    if (/^[0-9]$/.test(inputKey)) {
      return inputKey.charCodeAt(0);
    }

    if (/^\d{2,}$/.test(inputKey)) {
      return Number(inputKey);
    }

    if (keyMap[inputKey] != null) {
      return keyMap[inputKey];
    }

    if (/^[a-z]$/i.test(inputKey)) {
      return inputKey.toUpperCase().charCodeAt(0);
    }

    return null;
  },
  _applyCameraBinding(camera, normalizedKey, action) {
    if (camera.keysRotateLeft) {
      switch (action) {
        case 'moveUp':
          camera.keysUp = [normalizedKey];
          break;
        case 'moveDown':
          camera.keysDown = [normalizedKey];
          break;
        case 'moveLeft':
          camera.keysLeft = [normalizedKey];
          break;
        case 'moveRight':
          camera.keysRight = [normalizedKey];
          break;
        case 'rotateUp':
          camera.keysRotateUp = [normalizedKey];
          break;
        case 'rotateDown':
          camera.keysRotateDown = [normalizedKey];
          break;
        case 'rotateLeft':
          camera.keysRotateLeft = [normalizedKey];
          break;
        case 'rotateRight':
          camera.keysRotateRight = [normalizedKey];
          break;
      }
    } else {
      switch (action) {
        case 'rotateLeft':
        case 'moveLeft':
          camera.keysLeft = [normalizedKey];
          break;
        case 'rotateRight':
        case 'moveRight':
          camera.keysRight = [normalizedKey];
          break;
        case 'moveUp':
        case 'rotateUp':
          camera.keysUp = [normalizedKey];
          break;
        case 'moveDown':
        case 'rotateDown':
          camera.keysDown = [normalizedKey];
          break;
      }
    }
  },
  _reapplyCameraBindings(camera) {
    if (!flock._cameraControlBindings) return;
    for (const { normalizedKey, action } of flock._cameraControlBindings) {
      this._applyCameraBinding(camera, normalizedKey, action);
    }
  },
  cameraControl(key, action) {
    const normalizedKey = this._normalizeKeyCode(key);
    if (normalizedKey == null) {
      console.warn('Unsupported camera control key:', key);
      return;
    }

    if (!flock._cameraControlBindings) {
      flock._cameraControlBindings = [];
    }
    flock._cameraControlBindings = flock._cameraControlBindings.filter((b) => b.action !== action);
    flock._cameraControlBindings.push({ normalizedKey, action });

    if (flock.scene.activeCamera) {
      this._applyCameraBinding(flock.scene.activeCamera, normalizedKey, action);
    } else {
      console.error('No active camera found in the scene.');
    }
  },
};
