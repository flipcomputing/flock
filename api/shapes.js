import earcut from "earcut";

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockShapes = {
  createBox(
    boxId,
    {
      width = 1,
      height = 1,
      depth = 1,
      color = "#9932CC",
      position = new BABYLON.Vector3(0, 0, 0),
      alpha = 1,
      callback = null,
    },
  ) {
    let blockKey = boxId;

    if (boxId.includes("__")) {
      [boxId, blockKey] = boxId.split("__");
    }

    let groupName = boxId;

    if (flock.scene.getMeshByName(boxId)) {
      boxId = boxId + "_" + flock.scene.getUniqueId();
    }

    const dimensions = { width, height, depth };

    // Retrieve cached VertexData or create it if this is the first instance
    const vertexData = flock.getOrCreateGeometry(
      "Box",
      dimensions,
      flock.scene,
    );

    // Create a new mesh and apply the cached VertexData
    const newBox = new flock.BABYLON.Mesh(boxId, flock.scene);
    vertexData.applyToMesh(newBox);

    // Apply size-based UV mapping
    flock.setSizeBasedBoxUVs(newBox, width, height, depth);

    // Bake the scaling into the mesh
    newBox.bakeCurrentTransformIntoVertices();

    // Reset scaling to (1,1,1) since the transformation is now baked
    newBox.scaling.set(1, 1, 1);

    // Initialise the mesh with position, color, and other properties
    flock.initializeMesh(newBox, position, color, "Box", alpha);

    newBox.position.y += height / 2; // Middle of the box
    newBox.metadata = newBox.metadata || {};
    newBox.metadata.blockKey = blockKey;

    // Define and apply the physics shape
    const boxShape = new flock.BABYLON.PhysicsShapeBox(
      flock.BABYLON.Vector3.Zero(),
      new flock.BABYLON.Quaternion(0, 0, 0, 1),
      new flock.BABYLON.Vector3(width, height, depth),
      flock.scene,
    );
    flock.applyPhysics(newBox, boxShape);

    flock.announceMeshReady(newBox.name, groupName);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    if (!flock.callbackMode) {
      const readyPromise = Promise.resolve();
      flock.modelReadyPromises.set(boxId, readyPromise);
    }

    return newBox.name;
  },
  createSphere(
    sphereId,
    {
      color = "#9932CC",
      diameterX = 1,
      diameterY = 1,
      diameterZ = 1,
      position = new BABYLON.Vector3(0, 0, 0),
      alpha = 1,
      callback = null,
    },
  ) {
    let blockKey = sphereId;

    if (sphereId.includes("__")) {
      [sphereId, blockKey] = sphereId.split("__");
    }

    let groupName = sphereId;

    if (flock.scene.getMeshByName(sphereId)) {
      sphereId = sphereId + "_" + flock.scene.getUniqueId();
    }

    const dimensions = { diameterX, diameterY, diameterZ };

    // Retrieve cached VertexData or create it if this is the first instance
    const vertexData = flock.getOrCreateGeometry(
      "Sphere",
      dimensions,
      flock.scene,
    );

    if (!vertexData) return;

    // Create a new mesh and apply the cached VertexData
    const newSphere = new flock.BABYLON.Mesh(sphereId, flock.scene);
    vertexData.applyToMesh(newSphere);

    flock.setSphereUVs(newSphere, diameterX, diameterY, diameterZ, 1);
    newSphere.bakeCurrentTransformIntoVertices();

    // Reset scaling to (1,1,1) since the transformation is now baked
    newSphere.scaling.set(1, 1, 1);

    // Initialise the mesh with position, color, and other properties
    flock.initializeMesh(newSphere, position, color, "Sphere", alpha);
    newSphere.position.y += diameterY / 2;

    newSphere.metadata = newSphere.metadata || {};
    newSphere.metadata.blockKey = blockKey;

    // Define and apply the physics shape
    const sphereShape = new flock.BABYLON.PhysicsShapeSphere(
      flock.BABYLON.Vector3.Zero(),
      Math.max(diameterX, diameterY, diameterZ) / 2,
      flock.scene,
    );
    flock.applyPhysics(newSphere, sphereShape);

    flock.announceMeshReady(newSphere.name, groupName);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    if (!flock.callbackMode) {
      const readyPromise = Promise.resolve();
      flock.modelReadyPromises.set(sphereId, readyPromise);
    }

    return newSphere.name;
  },
  createCylinder(
    cylinderId,
    {
      color,
      height,
      diameterTop,
      diameterBottom,
      tessellation = 24,
      position,
      alpha = 1,
      callback = null,
    },
  ) {
    const dimensions = {
      height,
      diameterTop,
      diameterBottom,
      tessellation, // Include tessellation in dimensions
      updatable: true,
    };

    let blockKey = cylinderId;

    if (cylinderId.includes("__")) {
      [cylinderId, blockKey] = cylinderId.split("__");
    }

    let groupName = cylinderId;

    if (flock.scene.getMeshByName(cylinderId)) {
      cylinderId = cylinderId + "_" + flock.scene.getUniqueId();
    }

    // Get or create cached VertexData
    const vertexData = flock.getOrCreateGeometry(
      "Cylinder",
      dimensions,
      flock.scene,
    );

    // Create a new mesh and apply the cached VertexData
    const newCylinder = new flock.BABYLON.Mesh(cylinderId, flock.scene);
    vertexData.applyToMesh(newCylinder);

    flock.setSizeBasedCylinderUVs(
      newCylinder,
      height,
      diameterTop,
      diameterBottom,
    ); // Adjust texturePhysicalSize as needed

    newCylinder.bakeCurrentTransformIntoVertices();

    // Reset scaling to (1,1,1) since the transformation is now baked
    newCylinder.scaling.set(1, 1, 1);

    // Initialise the mesh with position, color, and other properties
    flock.initializeMesh(newCylinder, position, color, "Cylinder", alpha);
    newCylinder.position.y += height / 2;
    // Initialise the mesh with position, color, and other properties

    newCylinder.metadata = newCylinder.metadata || {};
    newCylinder.metadata.blockKey = blockKey;

    // Create and apply physics shape
    const startPoint = new flock.BABYLON.Vector3(0, -height / 2, 0);
    const endPoint = new flock.BABYLON.Vector3(0, height / 2, 0);
    const cylinderShape = new flock.BABYLON.PhysicsShapeCylinder(
      startPoint,
      endPoint,
      diameterBottom / 2,
      flock.scene,
    );
    flock.applyPhysics(newCylinder, cylinderShape);

    flock.announceMeshReady(newCylinder.name, groupName);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    if (!flock.callbackMode) {
      const readyPromise = Promise.resolve();
      flock.modelReadyPromises.set(cylinderId, readyPromise);
    }

    return newCylinder.name;
  },
  createCapsule(
    capsuleId,
    { color, diameter, height, position, alpha = 1, callback = null },
  ) {
    let radius = diameter / 2;
    let blockKey = capsuleId;

    if (capsuleId.includes("__")) {
      [capsuleId, blockKey] = capsuleId.split("__");
    }

    let groupName = capsuleId;

    const dimensions = {
      radius,
      height,
      tessellation: 24,
      updatable: false,
    };

    if (flock.scene.getMeshByName(capsuleId)) {
      capsuleId = capsuleId + "_" + flock.scene.getUniqueId();
    }

    // Get or create cached VertexData
    const vertexData = flock.getOrCreateGeometry(
      "Capsule",
      dimensions,
      flock.scene,
    );

    // Create a new mesh and apply the cached VertexData
    const newCapsule = new flock.BABYLON.Mesh(capsuleId, flock.scene);
    vertexData.applyToMesh(newCapsule);
    newCapsule.bakeCurrentTransformIntoVertices();

    // Reset scaling to (1,1,1) since the transformation is now baked
    newCapsule.scaling.set(1, 1, 1);

    // Initialise the mesh with position, color, and other properties
    flock.initializeMesh(newCapsule, position, color, "Capsule", alpha);
    newCapsule.position.y += height / 2;

    flock.setCapsuleUVs(newCapsule, radius, height, 1); // Adjust texturePhysicalSize as needed

    newCapsule.metadata = newCapsule.metadata || {};
    newCapsule.metadata.blockKey = blockKey;
    // Define central point for the capsule
    const center = flock.BABYLON.Vector3.Zero();

    // Calculate physics shape parameters
    const capsuleRadius = radius;
    const cylinderHeight = Math.max(0, height - 2 * capsuleRadius);

    // Define the start and end points of the cylindrical segment
    const segmentStart = new flock.BABYLON.Vector3(
      center.x,
      center.y - cylinderHeight / 2 + 0.1,
      center.z,
    );
    const segmentEnd = new flock.BABYLON.Vector3(
      center.x,
      center.y + cylinderHeight / 2 + 0.1,
      center.z,
    );

    // Create and apply the physics shape using the central reference
    const capsuleShape = new flock.BABYLON.PhysicsShapeCapsule(
      segmentStart,
      segmentEnd,
      capsuleRadius,
      flock.scene,
    );
    flock.applyPhysics(newCapsule, capsuleShape);

    flock.announceMeshReady(newCapsule.name, groupName);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    if (!flock.callbackMode) {
      const readyPromise = Promise.resolve();
      flock.modelReadyPromises.set(capsuleId, readyPromise);
    }

    return newCapsule.name;
  },
  createPlane(planeId, { color, width, height, position, callback = null }) {
    let blockKey = planeId;
    if (planeId.includes("__")) {
      [planeId, blockKey] = planeId.split("__");
    }

    let groupName = planeId;
    if (flock.scene.getMeshByName(planeId)) {
      planeId = planeId + "_" + flock.scene.getUniqueId();
    }

    const newPlane = flock.BABYLON.MeshBuilder.CreatePlane(
      planeId,
      {
        width,
        height,
        sideOrientation: flock.BABYLON.Mesh.DOUBLESIDE,
      },
      flock.scene,
    );

    newPlane.metadata = newPlane.metadata || {};
    newPlane.metadata.shape = "plane";
    newPlane.metadata.blockKey = blockKey;

    newPlane.position = new flock.BABYLON.Vector3(
      position[0],
      position[1] + height / 2,
      position[2],
    );

    const planeBody = new flock.BABYLON.PhysicsBody(
      newPlane,
      flock.BABYLON.PhysicsMotionType.STATIC,
      false,
      flock.scene,
    );

    const planeShape = new flock.BABYLON.PhysicsShapeBox(
      flock.BABYLON.Vector3.Zero(),
      new flock.BABYLON.Quaternion(0, 0, 0, 1),
      new flock.BABYLON.Vector3(width, height, 0.001),
      flock.scene,
    );

    planeBody.shape = planeShape;
    planeBody.setMassProperties({
      mass: 0,
      restitution: 0.5,
      inertia: flock.BABYLON.Vector3.ZeroReadOnly,
    });
    newPlane.physics = planeBody;

    flock.setMaterialWithCleanup(newPlane, {
      color: color,
      materialName: "none.png"
    });

    newPlane.metadata.blockKey = blockKey;

    flock.announceMeshReady(newPlane.name, groupName);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    if (!flock.callbackMode) {
      const readyPromise = Promise.resolve();
      flock.modelReadyPromises.set(planeId, readyPromise);
    }

    return newPlane.name;
  },
  create3DText({
    text,
    font,
    color = "#FFFFFF",
    size = 50,
    depth = 1.0,
    position = { x: 0, y: 0, z: 0 },
    modelId,
    callback = null,
  }) {
    const { x, y, z } = position;

    let [desiredBase, blockKey] = modelId.includes("__")
      ? modelId.split("__")
      : [modelId, modelId];
    desiredBase = desiredBase.replace(/[^a-zA-Z0-9._-]/g, "");

    const meshName = flock._reserveName(desiredBase || "text");

    let resolveReady;
    let rejectReady;
    const readyPromise = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    flock.modelReadyPromises.set(meshName, readyPromise);

    (async () => {
      try {
        const fontData = await (await fetch(font)).json();

        const mesh = flock.BABYLON.MeshBuilder.CreateText(
          meshName,
          text,
          fontData,
          {
            size: size,
            depth: depth,
          },
          flock.scene,
          earcut,
        );

        mesh.position.set(x, y, z);
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.blockKey = blockKey;

        const material = new flock.BABYLON.StandardMaterial(
          "textMaterial",
          flock.scene,
        );

        material.diffuseColor = flock.BABYLON.Color3.FromHexString(
          flock.getColorFromString(color),
        );

        mesh.material = material;

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        mesh.setEnabled(true);
        mesh.visibility = 1;

        const textShape = new flock.BABYLON.PhysicsShapeMesh(mesh, flock.scene);
        flock.applyPhysics(mesh, textShape);

        flock._markNameCreated(meshName);
        flock.announceMeshReady(meshName, desiredBase);

        resolveReady(mesh);

        if (callback) {
          requestAnimationFrame(() => callback(mesh));
        }
      } catch (error) {
        console.error(`Error creating 3D text '${meshName}':`, error);
        flock._releaseName(meshName);
        flock.modelReadyPromises.delete(meshName);
        rejectReady?.(error);
      } finally {
        setTimeout(() => {
          flock.modelReadyPromises.delete(meshName);
        }, 5000);
      }
    })();

    return meshName;
  },
};
