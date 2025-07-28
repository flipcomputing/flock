import { attachBlockMapping, attachMixamoMapping } from "../config.js";

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockMesh = {
  createCapsuleFromBoundingBox(mesh, scene) {
    mesh.computeWorldMatrix(true);
    const boundingInfo = mesh.getBoundingInfo();

    const height =
      boundingInfo.boundingBox.maximumWorld.y -
      boundingInfo.boundingBox.minimumWorld.y;
    const width =
      boundingInfo.boundingBox.maximumWorld.x -
      boundingInfo.boundingBox.minimumWorld.x;
    const depth =
      boundingInfo.boundingBox.maximumWorld.z -
      boundingInfo.boundingBox.minimumWorld.z;

    const radius = Math.min(width, depth) / 2;

    const cylinderHeight = Math.max(0, height - 2 * radius);

    const center = new flock.BABYLON.Vector3(0, 0, 0);

    const segmentStart = new flock.BABYLON.Vector3(
      center.x,
      center.y - cylinderHeight / 2,
      center.z,
    );
    const segmentEnd = new flock.BABYLON.Vector3(
      center.x,
      center.y + cylinderHeight / 2,
      center.z,
    );

    const shape = new flock.BABYLON.PhysicsShapeCapsule(
      segmentStart,
      segmentEnd,
      radius,
      scene,
    );

    return shape;
  },
  initializeMesh(mesh, position, color, shapeType, alpha = 1) {
    // Set position
    mesh.position = new flock.BABYLON.Vector3(
      position[0],
      position[1],
      position[2],
    );

    // Set metadata and unique name
    mesh.metadata = { shapeType };
    mesh.blockKey = mesh.name;
    //mesh.name = `${mesh.name}_${mesh.uniqueId}`;

    flock.applyMaterialToMesh(mesh, shapeType, color, alpha);

    mesh.metadata.sharedMaterial = false;

    mesh.material.metadata = mesh.material.metadata || {};
    mesh.material.metadata.internal = true;

    // Enable and make the mesh visible
    mesh.isVisible = true;
    mesh.setEnabled(true);
    mesh.material.needDepthPrePass = true;
    mesh.metadata.sharedGeometry = true;
  },

  setSizeBasedBoxUVs(mesh, width, height, depth, texturePhysicalSize = 4) {
    const positions = mesh.getVerticesData(
      flock.BABYLON.VertexBuffer.PositionKind,
    );
    const normals = mesh.getVerticesData(flock.BABYLON.VertexBuffer.NormalKind);
    const uvs =
      mesh.getVerticesData(flock.BABYLON.VertexBuffer.UVKind) ||
      new Array((positions.length / 3) * 2).fill(0);

    for (let i = 0; i < positions.length / 3; i++) {
      const normal = new flock.BABYLON.Vector3(
        normals[i * 3],
        normals[i * 3 + 1],
        normals[i * 3 + 2],
      );

      const position = new flock.BABYLON.Vector3(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      );

      let u = 0,
        v = 0;

      // Front/Back faces (aligned with Z-axis)
      if (
        Math.abs(normal.z) > Math.abs(normal.x) &&
        Math.abs(normal.z) > Math.abs(normal.y)
      ) {
        u = position.x / texturePhysicalSize; // Horizontal scale
        v = position.y / texturePhysicalSize; // Vertical scale
      }
      // Side faces (aligned with X-axis)
      else if (
        Math.abs(normal.x) > Math.abs(normal.y) &&
        Math.abs(normal.x) > Math.abs(normal.z)
      ) {
        u = position.z / texturePhysicalSize; // Horizontal scale
        v = position.y / texturePhysicalSize; // Vertical scale
      }
      // Top/Bottom faces (aligned with Y-axis)
      else if (
        Math.abs(normal.y) > Math.abs(normal.x) &&
        Math.abs(normal.y) > Math.abs(normal.z)
      ) {
        u = position.x / texturePhysicalSize; // Horizontal scale
        v = position.z / texturePhysicalSize; // Vertical scale
      }

      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }

    // Apply updated UV mapping
    mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
  },

  setSphereUVs(mesh, diameter, texturePhysicalSize = 1) {
    const positions = mesh.getVerticesData(
      flock.BABYLON.VertexBuffer.PositionKind,
    );
    const uvs =
      mesh.getVerticesData(flock.BABYLON.VertexBuffer.UVKind) ||
      new Array((positions.length / 3) * 2).fill(0);

    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      // Calculate longitude (theta) and latitude (phi)
      const theta = Math.atan2(z, x); // Longitude angle
      const phi = Math.acos(y / (diameter / 2)); // Latitude angle

      // Scale UVs inversely with diameter
      uvs[i * 2] = (theta / (2 * Math.PI) + 0.5) * texturePhysicalSize; // U-axis
      uvs[i * 2 + 1] = (phi / Math.PI) * texturePhysicalSize; // V-axis
    }

    mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
  },

  getOrCreateGeometry(shapeType, dimensions, scene) {
    const geometryKey = `${shapeType}_${Object.values(dimensions).join("_")}`;

    if (!flock.geometryCache) return;

    if (!flock.geometryCache[geometryKey]) {
      let initialMesh;

      // Create the initial mesh based on shape type
      if (shapeType === "Box") {
        initialMesh = flock.BABYLON.MeshBuilder.CreateBox(
          geometryKey,
          dimensions,
          scene,
        );
      } else if (shapeType === "Sphere") {
        initialMesh = flock.BABYLON.MeshBuilder.CreateSphere(
          geometryKey,
          dimensions,
          scene,
        );
      } else if (shapeType === "Cylinder") {
        initialMesh = flock.BABYLON.MeshBuilder.CreateCylinder(
          geometryKey,
          dimensions,
          scene,
        );
      } else if (shapeType === "Capsule") {
        initialMesh = flock.BABYLON.MeshBuilder.CreateCapsule(
          geometryKey,
          dimensions,
          scene,
        );
      } else {
        throw new Error(`Unsupported shape type: ${shapeType}`);
      }

      // Extract and cache the VertexData from the initial mesh, then dispose the mesh
      flock.geometryCache[geometryKey] =
        flock.BABYLON.VertexData.ExtractFromMesh(initialMesh);
      initialMesh.dispose(); // Dispose of the initial mesh to keep only VertexData
    }

    // Return the cached VertexData
    return flock.geometryCache[geometryKey];
  },

  setSizeBasedCylinderUVs(
    mesh,
    height,
    diameterTop,
    diameterBottom,
    texturePhysicalSize = 4,
  ) {
    const positions = mesh.getVerticesData(
      flock.BABYLON.VertexBuffer.PositionKind,
    );
    const normals = mesh.getVerticesData(flock.BABYLON.VertexBuffer.NormalKind);
    const uvs =
      mesh.getVerticesData(flock.BABYLON.VertexBuffer.UVKind) ||
      new Array((positions.length / 3) * 2).fill(0);

    const radiusTop = diameterTop / 2;
    const radiusBottom = diameterBottom / 2;

    for (let i = 0; i < positions.length / 3; i++) {
      const normal = new flock.BABYLON.Vector3(
        normals[i * 3],
        normals[i * 3 + 1],
        normals[i * 3 + 2],
      );

      const position = new flock.BABYLON.Vector3(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      );

      let u = 0,
        v = 0;

      // Side faces (curved surface) - unchanged
      if (
        Math.abs(normal.y) < Math.max(Math.abs(normal.x), Math.abs(normal.z))
      ) {
        const angle = Math.atan2(position.z, position.x); // Angle around the Y-axis
        const averageRadius = (radiusTop + radiusBottom) / 2;
        const circumference = 2 * Math.PI * averageRadius;
        u = (angle / (2 * Math.PI)) * (circumference / texturePhysicalSize); // Scale based on circumference
        v = (position.y + height / 2) / texturePhysicalSize; // Scale along height
      }
      // Top cap
      else if (normal.y > 0) {
        u = position.x / radiusTop / (texturePhysicalSize / 2) + 0.5; // Adjust scaling by factor of 2
        v = position.z / radiusTop / (texturePhysicalSize / 2) + 0.5;
      }
      // Bottom cap
      else {
        u = position.x / radiusBottom / (texturePhysicalSize / 2) + 0.5; // Adjust scaling by factor of 2
        v = position.z / radiusBottom / (texturePhysicalSize / 2) + 0.5;
      }

      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }

    // Apply updated UV mapping
    mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
  },

  setCapsuleUVs(mesh, radius, height, texturePhysicalSize = 4) {
    const positions = mesh.getVerticesData(
      flock.BABYLON.VertexBuffer.PositionKind,
    );
    const uvs =
      mesh.getVerticesData(flock.BABYLON.VertexBuffer.UVKind) ||
      new Array((positions.length / 3) * 2).fill(0);

    const cylinderHeight = Math.max(0, height - 2 * radius); // Height of the cylindrical part
    const circumference = 2 * Math.PI * radius; // Circumference of the cylinder

    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      let u = 0,
        v = 0;

      // Determine whether the vertex is in the spherical cap or cylindrical body
      if (Math.abs(y) > cylinderHeight / 2) {
        // Spherical cap (top or bottom)
        const theta = Math.atan2(z, x); // Longitude angle
        const offsetY = y > 0 ? y - cylinderHeight / 2 : y + cylinderHeight / 2; // Offset for cap position

        u = theta / (2 * Math.PI) + 0.5; // Wrap U-axis around the cap
        v = (offsetY / radius + 1) / (2 * texturePhysicalSize); // Scale V-axis by the texture size
      } else {
        // Cylindrical body
        const theta = Math.atan2(z, x); // Longitude angle

        u = theta / (2 * Math.PI) + 0.5; // Wrap U-axis around the cylinder
        v = (y + cylinderHeight / 2) / (texturePhysicalSize * cylinderHeight); // V-axis based on height
      }

      // Apply the calculated UV coordinates
      uvs[i * 2] = u * (circumference / texturePhysicalSize); // Normalize U-axis for physical size
      uvs[i * 2 + 1] = v; // V-axis remains proportional to height
    }
    mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
  },

  setSizeBasedPlaneUVs(mesh, width, height, texturePhysicalSize = 4) {
    const positions = mesh.getVerticesData(
      flock.BABYLON.VertexBuffer.PositionKind,
    );
    const uvs =
      mesh.getVerticesData(flock.BABYLON.VertexBuffer.UVKind) ||
      new Array((positions.length / 3) * 2).fill(0);

    for (let i = 0; i < positions.length / 3; i++) {
      const position = new flock.BABYLON.Vector3(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      );

      // Calculate UV coordinates based on the physical size of the texture
      const u = (position.x / width) * (width / texturePhysicalSize) + 0.5; // Scale proportionally to width
      const v = (position.y / height) * (height / texturePhysicalSize) + 0.5; // Scale proportionally to height

      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }

    // Apply updated UV mapping
    mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
  },
  ensureUniqueGeometry(mesh) {
    //console.log("Cloning geometry");

    if (mesh.metadata?.sharedGeometry) {
      // Extract vertex data from mesh
      const vertexData = flock.BABYLON.VertexData.ExtractFromMesh(mesh);

      // Remove shared geometry by clearing existing bindings
      mesh.setVerticesData("position", null); // Remove reference to old data

      // Apply cloned vertex data (creates a new internal geometry)
      vertexData.applyToMesh(mesh, true); // `true` = updatable

      // Mark the geometry as no longer shared
      mesh.metadata.sharedGeometry = false;

      //console.log("Geometry cloned and applied.");
    }
  },
  setupMesh(mesh, modelName, modelId, blockId, scale, x, y, z, color = null) {
    mesh.scaling = new flock.BABYLON.Vector3(scale, scale, scale);

    const bb =
      flock.BABYLON.BoundingBoxGizmo.MakeNotPickableAndWrapInBoundingBox(mesh);

    bb.name = modelId;
    bb.blockKey = blockId;

    //console.log("Model setup", bb.name, bb.blockKey);
    bb.isPickable = false;

    const objectNames = [
      "Star.glb",
      "Heart.glb",
      "Coin.glb",
      "Gem1.glb",
      "Gem2.glb",
      "Gem3.glb",
    ];

    if (!objectNames.includes(modelName)) {
      const boundingInfo = bb.getBoundingInfo();
      const halfHeight = boundingInfo.boundingBox.extendSizeWorld.y;

      bb.position.y -= halfHeight;
    }
    bb.bakeCurrentTransformIntoVertices();
    bb.scaling.set(1, 1, 1);

    bb.position = new flock.BABYLON.Vector3(x, y, z);

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
    mesh.isPickable = true;
    mesh.getDescendants().forEach((child) => {
      child.isPickable = true;
    });

    bb.metadata = bb.metadata || {};
    bb.metadata.yOffset = (bb.position.y - y) / scale;
    bb.metadata.modelName = modelName;
    flock.stopAnimationsTargetingMesh(flock.scene, mesh);

    const setMetadata = (mesh) => {
      // Ensure metadata exists
      mesh.metadata = mesh.metadata || {};

      // Add or update specific properties without overwriting existing metadata
      mesh.metadata.sharedMaterial = true;
      mesh.metadata.sharedGeometry = true;
    };

    // Set metadata on the root mesh
    setMetadata(bb);

    // Set metadata on all descendants
    bb.getDescendants().forEach((descendant) => {
      setMetadata(descendant);
    });

    bb.position.y += bb.getBoundingInfo().boundingBox.extendSizeWorld.y;

    const boxBody = new flock.BABYLON.PhysicsBody(
      bb,
      flock.BABYLON.PhysicsMotionType.STATIC,
      false,
      flock.scene,
    );

    const boxShape = flock.createCapsuleFromBoundingBox(bb, flock.scene);

    boxBody.shape = boxShape;
    boxBody.setMassProperties({ mass: 1, restitution: 0.5 });
    boxBody.disablePreStep = false;
    bb.physics = boxBody;

    return bb;
  },
  hold(meshToAttach, targetMesh, xOffset = 0, yOffset = 0, zOffset = 0) {
    return flock.whenModelReady(targetMesh, (targetMeshInstance) => {
      flock.whenModelReady(meshToAttach, (meshToAttachInstance) => {
        // Find the first mesh with a skeleton (including descendants)
        const targetWithSkeleton = targetMeshInstance.skeleton
          ? targetMeshInstance
          : targetMeshInstance.getChildMeshes().find((mesh) => mesh.skeleton);

        if (targetWithSkeleton) {
          const bone = targetWithSkeleton.skeleton.bones.find(
            (b) => b.name === "Hold",
          );
          if (bone) {
            meshToAttachInstance.attachToBone(bone, targetWithSkeleton);
            meshToAttachInstance.position = new flock.BABYLON.Vector3(
              xOffset,
              yOffset,
              zOffset,
            );
          }
        }
      });
    });
  },
  attach(
    meshToAttach,
    targetMesh,
    { boneName = "Hold", x = 0, y = 0, z = 0 } = {},
  ) {
    return flock.whenModelReady(targetMesh, (targetMeshInstance) => {
      flock.whenModelReady(meshToAttach, (meshToAttachInstance) => {
        if (targetMeshInstance?.metadata?.modelName?.startsWith("Character")) {
          boneName = attachBlockMapping[boneName];
        } else {
          boneName = attachMixamoMapping[boneName];    
        }

        // Find the first mesh with a skeleton (including descendants)
        const targetWithSkeleton = targetMeshInstance.skeleton
          ? targetMeshInstance
          : targetMeshInstance.getChildMeshes().find((mesh) => mesh.skeleton);

        if (targetWithSkeleton) {
          const bone = targetWithSkeleton.skeleton.bones.find(
            (b) => b.name === boneName,
          );

          if (bone) {
            meshToAttachInstance.attachToBone(bone, targetWithSkeleton);
            meshToAttachInstance.position = new flock.BABYLON.Vector3(x, y, z);
          }
        }
      });
    });
  },
  drop(meshToDetach) {
    return flock.whenModelReady(meshToDetach, (meshToDetachInstance) => {
      const worldPosition = meshToDetachInstance.getAbsolutePosition();
      meshToDetachInstance.detachFromBone();

      // Set the child mesh's position to its world position
      meshToDetachInstance.position = worldPosition;
    });
  },
  setParent(parentModelName, childModelName) {
    return flock.whenModelReady(parentModelName, (parentMesh) => {
      flock.whenModelReady(childModelName, (childMesh) => {
        // Set the parent-child relationship
        childMesh.setParent(parentMesh);
      });
    });
  },
  parentChild(
    parentModelName,
    childModelName,
    offsetX = 0,
    offsetY = 0,
    offsetZ = 0,
  ) {
    return flock.whenModelReady(parentModelName, (parentMesh) => {
      flock.whenModelReady(childModelName, (childMesh) => {
        // Set the parent-child relationship
        childMesh.parent = parentMesh;

        // Apply the offset to the child's position relative to the parent
        childMesh.position.set(offsetX, offsetY, offsetZ);
      });
    });
  },
  removeParent(childModelName) {
    return flock.whenModelReady(childModelName, (childMesh) => {
      // Calculate the world position before removing the parent
      const worldPosition = childMesh.getAbsolutePosition();

      // Remove the parent-child relationship
      childMesh.parent = null;

      // Set the child mesh's position to its world position
      childMesh.position = worldPosition;
    });
  },
  makeFollow(
    followerModelName,
    targetModelName,
    followPosition,
    offsetX = 0,
    offsetY = 0,
    offsetZ = 0,
  ) {
    // Ensure both models are loaded before proceeding
    return flock.whenModelReady(followerModelName, (followerMesh) => {
      flock.whenModelReady(targetModelName, (targetMesh) => {
        // Remove any existing follow observer before adding a new one
        followerMesh._followObserver &&
          flock.scene.onBeforeRenderObservable.remove(
            followerMesh._followObserver,
          );

        // Calculate Y position based on the follow position option
        let getYPosition = () => {
          if (followPosition === "TOP") {
            return targetMesh.position.y + targetMesh.scaling.y;
          } else if (followPosition === "CENTER") {
            return targetMesh.position.y + targetMesh.scaling.y / 2;
          } else {
            return targetMesh.position.y;
          }
        };

        // Create a new observer to update the follower's position
        followerMesh._followObserver = flock.scene.onBeforeRenderObservable.add(
          () => {
            followerMesh.position.x =
              targetMesh.position.x + parseFloat(offsetX);
            followerMesh.position.y = getYPosition() + parseFloat(offsetY);
            followerMesh.position.z =
              targetMesh.position.z + parseFloat(offsetZ);
          },
        );
      });
    });
  },
  stopFollow(followerModelName) {
    return flock.whenModelReady(followerModelName, (followerMesh) => {
      // Remove the follow observer if it exists
      if (followerMesh._followObserver) {
        flock.scene.onBeforeRenderObservable.remove(
          followerMesh._followObserver,
        );
        followerMesh._followObserver = null;
      }
    });
  },

  getClones(mesh) {
    return mesh.metadata.clones.map((name) => flock.scene.getMeshByName(name));
  },
};
