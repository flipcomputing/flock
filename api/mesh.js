import { attachBlockMapping, attachMixamoMapping } from "../config.js";

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockMesh = {
  createCapsuleFromBoundingBox(mesh, scene) {
    mesh.computeWorldMatrix(true);
    const boundingInfo = mesh.getBoundingInfo();

    // Use LOCAL bounding box coordinates
    const localMin = boundingInfo.boundingBox.minimum;
    const localMax = boundingInfo.boundingBox.maximum;

    const height = localMax.y - localMin.y;
    const width = localMax.x - localMin.x;
    const depth = localMax.z - localMin.z;
    const radius = Math.min(width, depth) / 2;

    //console.log("Create capsule from bounding box", mesh.name, height);
    //console.log("Local bounding min Y:", localMin.y, "max Y:", localMax.y);

    // Shrink the capsule vertically to allow intersections
    const shrinkAmount = 0.01; // Adjust this value as needed
    const adjustedHeight = Math.max(0, height - shrinkAmount);
    const cylinderHeight = Math.max(0, adjustedHeight - 2 * radius);

    // Center the capsule at the bounding box center in LOCAL space
    const localCenter = new flock.BABYLON.Vector3(
      (localMin.x + localMax.x) / 2,
      (localMin.y + localMax.y) / 2,
      (localMin.z + localMax.z) / 2,
    );

    const segmentStart = new flock.BABYLON.Vector3(
      localCenter.x,
      localCenter.y - cylinderHeight / 2,
      localCenter.z,
    );
    const segmentEnd = new flock.BABYLON.Vector3(
      localCenter.x,
      localCenter.y + cylinderHeight / 2,
      localCenter.z,
    );

    const shape = new flock.BABYLON.PhysicsShapeCapsule(
      segmentStart,
      segmentEnd,
      radius,
      scene,
    );

    if (!mesh.metadata) mesh.metadata = {};
    mesh.metadata.physicsCapsule = {
      radius,
      height: adjustedHeight,
      localCenter,
    };
    return shape;
  },
  createHorizontalCapsuleFromBoundingBox(mesh, scene, yOffsetFactor = 0) {
    // Get dimensions from the current vertical capsule
    let radius, height;

    const physicsMesh = mesh.physics
      ? mesh
      : mesh.parent?.physics
        ? mesh.parent
        : null;

    if (
      physicsMesh?.physics?.shape?.constructor.name === "_PhysicsShapeCapsule"
    ) {
      const currentShape = physicsMesh.physics.shape;
      if (
        currentShape.pointA &&
        currentShape.pointB &&
        currentShape.radius !== undefined
      ) {
        const cylinderLength = flock.BABYLON.Vector3.Distance(
          currentShape.pointA,
          currentShape.pointB,
        );
        radius = currentShape.radius;
        height = cylinderLength + 2 * radius;
      }
    }

    if (!radius || !height) {
      if (mesh.metadata?.physicsCapsule) {
        radius = mesh.metadata.physicsCapsule.radius;
        height = mesh.metadata.physicsCapsule.height;
      } else {
        mesh.computeWorldMatrix(true);
        const boundingInfo = mesh.getBoundingInfo();
        height =
          boundingInfo.boundingBox.maximumWorld.y -
          boundingInfo.boundingBox.minimumWorld.y;
        const width =
          boundingInfo.boundingBox.maximumWorld.x -
          boundingInfo.boundingBox.minimumWorld.x;
        const depth =
          boundingInfo.boundingBox.maximumWorld.z -
          boundingInfo.boundingBox.minimumWorld.z;
        radius = Math.min(width, depth) / 2;
      }
    }

    // Create horizontal capsule with same dimensions as vertical, rotated along Z-axis
    const cylinderLength = Math.max(0, height - 2 * radius);
    const center = flock.BABYLON.Vector3.Zero();

    // Calculate Y offset relative to mesh height
    const yOffset = yOffsetFactor * height;

    const segmentStart = new flock.BABYLON.Vector3(
      center.x,
      center.y + yOffset,
      center.z - cylinderLength / 2,
    );
    const segmentEnd = new flock.BABYLON.Vector3(
      center.x,
      center.y + yOffset,
      center.z + cylinderLength / 2,
    );

    const shape = new flock.BABYLON.PhysicsShapeCapsule(
      segmentStart,
      segmentEnd,
      radius,
      scene,
    );

    return shape;
  },
  // backRatio: signed fraction of mesh size along the chosen axis (e.g., 0.25 = 25% back; -0.25 = 25% forward)
  // axis: "z" (default) if your rig faces ±Z; use "x" if it faces ±X
  createSittingCapsuleFromBoundingBox(
    mesh,
    scene,
    { backRatio = -1, axis = "z" } = {},
  ) {
    mesh.computeWorldMatrix(true);

    const boundingInfo = mesh.getBoundingInfo();
    const bb = boundingInfo.boundingBox;

    // Local-space extents
    const localMin = bb.minimum;
    const localMax = bb.maximum;

    const localHeight = localMax.y - localMin.y;
    const localWidth = localMax.x - localMin.x;
    const localDepth = localMax.z - localMin.z;

    // Capsule sizing for sitting pose
    const radius = Math.max(1e-5, Math.min(localWidth, localDepth) * 0.5);
    const targetHeight = Math.max(0, localHeight * 0.65);
    const cylinderHeight = Math.max(0, targetHeight - 2 * radius);
    const halfCylinder = cylinderHeight * 0.5;

    // Base center in LOCAL space
    const centerLocal = bb.center.clone();

    // Small upward nudge
    const centerYOffset = localHeight * 0.02;

    // Signed backward/forward offset relative to mesh size on chosen axis
    const sizeAlongAxis = axis === "x" ? localWidth : localDepth;
    const signedUnits = backRatio * sizeAlongAxis; // negative values move the other way

    const offsetX = axis === "x" ? -signedUnits : 0; // "-signedUnits" so positive backRatio = move toward local -axis
    const offsetZ = axis === "z" ? -signedUnits : 0;

    const segmentStart = new flock.BABYLON.Vector3(
      centerLocal.x + offsetX,
      centerLocal.y + centerYOffset - halfCylinder,
      centerLocal.z + offsetZ,
    );

    const segmentEnd = new flock.BABYLON.Vector3(
      centerLocal.x + offsetX,
      centerLocal.y + centerYOffset + halfCylinder,
      centerLocal.z + offsetZ,
    );

    if (segmentStart.equals(segmentEnd)) {
      segmentEnd.y += 1e-3; // guard against degenerate segment
    }

    return new flock.BABYLON.PhysicsShapeCapsule(
      segmentStart,
      segmentEnd,
      radius,
      scene,
    );
  },
  
  coerceToMaterialIfNeeded(spec) {
    // Already a Babylon Material?
    if (spec && typeof spec === "object" && typeof spec.getClassName === "function") {
      return spec;
    }
    // Plain spec like { materialName, color, alpha } → build it
    if (spec && typeof spec === "object" && !Array.isArray(spec) && spec.materialName) {
      return flock.createMaterial(spec);
    }
    return null;
  },

  initializeMesh(mesh, position, color, shapeType, alpha = 1) {
    // Accept Vector3 or [x,y,z]
    const px = Array.isArray(position) ? position[0] : position?.x ?? 0;
    const py = Array.isArray(position) ? position[1] : position?.y ?? 0;
    const pz = Array.isArray(position) ? position[2] : position?.z ?? 0;

    mesh.position = new flock.BABYLON.Vector3(px, py, pz);

    // Set metadata and unique name
    mesh.metadata = { ...(mesh.metadata || {}), shapeType };
    mesh.metadata.blockKey = mesh.name;

    let handledMaterial = false;
    const singleMat = flock.coerceToMaterialIfNeeded(color);

    if (singleMat) {
      // Optional tiling like sky if texture exists
      const tex = singleMat.diffuseTexture || singleMat.albedoTexture || singleMat.baseTexture || null;
      if (tex && typeof tex.uScale === "number" && typeof tex.vScale === "number") {
        if (!tex.uScale) tex.uScale = 10;
        if (!tex.vScale) tex.vScale = 10;
      }

      // Respect alpha if provided
      if (alpha != null) {
        singleMat.alpha = alpha;
        if (singleMat.alpha < 1 && singleMat.transparencyMode == null) {
          singleMat.transparencyMode = flock.BABYLON.Material.MATERIAL_ALPHABLEND;
        }
      }

      // Apply to mesh and children
      if (typeof mesh.getChildMeshes === "function") {
        for (const m of mesh.getChildMeshes(false)) {
          if (m && m.material !== undefined) m.material = singleMat;
        }
      }
      if (mesh.material !== undefined) mesh.material = singleMat;

      handledMaterial = true;
    }

    if (!handledMaterial && Array.isArray(color) && color.length && color.every(c => c && typeof c === "object")) {
      const mats = color.map(c => flock.coerceToMaterialIfNeeded(c) || c);
      if (mesh.material !== undefined && mats[0]) mesh.material = mats[0];

      const kids = typeof mesh.getChildMeshes === "function" ? mesh.getChildMeshes(false) : [];
      for (let i = 0; i < kids.length; i++) {
        if (kids[i] && kids[i].material !== undefined && mats[i]) {
          kids[i].material = mats[i];
        }
      }
      handledMaterial = true;
    }

    if (!handledMaterial) {
      flock.applyMaterialToMesh(mesh, shapeType, color, alpha);
    }

    mesh.metadata.sharedMaterial = false;

    // Guard: ensure material exists before tagging metadata
    if (mesh.material) {
      mesh.material.metadata = mesh.material.metadata || {};
      mesh.material.metadata.internal = true;
    }

    // Enable and make the mesh visible
    mesh.isVisible = true;
    mesh.setEnabled(true);
    if (alpha > 0 && mesh.material) mesh.material.needDepthPrePass = true;
    mesh.metadata.sharedGeometry = true;
  },

  // 1 tile = `texturePhysicalSize` world units
  // Sets edge-aligned, per-face planar UVs for a bSox so the pattern has constant physical size.
  // Works for non-cubes (width ≠ height ≠ depth). Keeps seams consistent by flipping some faces.
  setSizeBasedBoxUVs(mesh, width, height, depth, texturePhysicalSize = 4) {
    // Ensure we can read/write UVs
    const positions = mesh.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
    const normals   = mesh.getVerticesData(flock.BABYLON.VertexBuffer.NormalKind);
    let uvs         = mesh.getVerticesData(flock.BABYLON.VertexBuffer.UVKind);
    if (!positions || !normals) return;
    if (!uvs) uvs = new Float32Array((positions.length / 3) * 2);

    // Compute local-space AABB to align tiles to edges (not the centre).
    // This makes (min edge) map to UV 0, so every face starts on a tile boundary.
    let minX = +Infinity, maxX = -Infinity;
    let minY = +Infinity, maxY = -Infinity;
    let minZ = +Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    // Fallback to provided sizes if the geometry AABB is degenerate
    const spanX = (Number.isFinite(minX) && Number.isFinite(maxX)) ? (maxX - minX) : width;
    const spanY = (Number.isFinite(minY) && Number.isFinite(maxY)) ? (maxY - minY) : height;
    const spanZ = (Number.isFinite(minZ) && Number.isFinite(maxZ)) ? (maxZ - minZ) : depth;

    // Scale factor: converts world/local distance → UV repeats
    // 1 tile per `texturePhysicalSize` units
    const invTile = 1 / texturePhysicalSize;

    // Assign per-vertex UVs based on dominant normal (face detection).
    // Orientation choices below keep seams continuous:
    // - Front (+Z):   U=X increasing +, V=Y increasing +
    // - Back  (-Z):   U=X flipped,      V=Y increasing +
    // - Right (+X):   U=Z flipped,      V=Y increasing +
    // - Left  (-X):   U=Z increasing +, V=Y increasing +
    // - Top   (+Y):   U=X increasing +, V=Z flipped
    // - Bottom(-Y):   U=X increasing +, V=Z increasing +
    for (let i = 0, vi = 0; i < positions.length; i += 3, vi += 2) {
      const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
      const x  = positions[i], y  = positions[i + 1], z  = positions[i + 2];

      // Decide which axis the face is aligned to
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);

      let u = 0, v = 0;

      if (az >= ax && az >= ay) {
        // Z faces (front/back) → map X × Y
        // edge-aligned: subtract min edge so 0 at the border
        const uRaw = (x - minX) * invTile; // 0..spanX/texturePhysicalSize
        const vRaw = (y - minY) * invTile; // 0..spanY/texturePhysicalSize
        if (nz >= 0) {
          // Front (+Z): no flip
          u = uRaw; v = vRaw;
        } else {
          // Back (-Z): flip U to keep seam continuity
          u = (spanX * invTile) - uRaw; v = vRaw;
        }
      } else if (ax >= ay && ax >= az) {
        // X faces (left/right) → map Z × Y
        const uRaw = (z - minZ) * invTile; // 0..spanZ/texturePhysicalSize
        const vRaw = (y - minY) * invTile; // 0..spanY/texturePhysicalSize
        if (nx >= 0) {
          // Right (+X): flip U so front-right edge matches
          u = (spanZ * invTile) - uRaw; v = vRaw;
        } else {
          // Left (-X): no flip
          u = uRaw; v = vRaw;
        }
      } else {
        // Y faces (top/bottom) → map X × Z
        const uRaw = (x - minX) * invTile; // 0..spanX/texturePhysicalSize
        const vRaw = (z - minZ) * invTile; // 0..spanZ/texturePhysicalSize
        if (ny >= 0) {
          // Top (+Y): flip V so front-top edge matches
          u = uRaw; v = (spanZ * invTile) - vRaw;
        } else {
          // Bottom (-Y): no flip
          u = uRaw; v = vRaw;
        }
      }

      uvs[vi]     = u;
      uvs[vi + 1] = v;
    }

    // Apply updated UVs
    mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);

    // Make sure any assigned texture will actually tile
    if (mesh.material && mesh.material.diffuseTexture) {
      const t = mesh.material.diffuseTexture;
      t.wrapU = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
      t.wrapV = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
      // Per-vertex UVs already encode the repeats; keep global scales neutral
      t.uScale = 1; t.vScale = 1;
      t.uOffset = 0; t.vOffset = 0;
    }
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
    bb.metadata = bb.metadata || {};
    bb.metadata.blockKey = blockId;

    //console.log("Model setup", bb.name, bb.metadata.blockKey);
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
        // Save pre-attach world rotation for later restore
        {
          const worldMatrix = meshToAttachInstance.getWorldMatrix(true).clone();
          const scale = new flock.BABYLON.Vector3();
          const rotation = new flock.BABYLON.Quaternion();
          const position = new flock.BABYLON.Vector3();
          worldMatrix.decompose(scale, rotation, position);
          (meshToAttachInstance.metadata ||= {})._preAttachWorldRotation =
            rotation.clone();
        }

        // Pause physics by removing body from Havok world (keep reference)
        if (
          meshToAttachInstance.physics &&
          meshToAttachInstance.physics._pluginData
        ) {
          flock.hk._hknp.HP_World_RemoveBody(
            flock.hk.world,
            meshToAttachInstance.physics._pluginData.hpBodyId,
          );
        }

        const logicalBoneName = boneName;
        boneName = targetMeshInstance?.metadata?.modelName?.startsWith(
          "Character",
        )
          ? attachBlockMapping[boneName]
          : attachMixamoMapping[boneName];

        const targetWithSkeleton = targetMeshInstance.skeleton
          ? targetMeshInstance
          : targetMeshInstance.getChildMeshes().find((mesh) => mesh.skeleton);

        if (targetWithSkeleton) {
          const bone = targetWithSkeleton.skeleton.bones.find(
            (b) => b.name === boneName,
          );
          if (bone) {
            meshToAttachInstance.attachToBone(bone, targetWithSkeleton);

            if (logicalBoneName === "Head") {
              let estimatedLength = 0.1;
              if (bone.children.length > 0) {
                const headWorld = flock.BABYLON.Vector3.TransformCoordinates(
                  flock.BABYLON.Vector3.Zero(),
                  bone.getWorldMatrix(),
                );
                const childWorld = flock.BABYLON.Vector3.TransformCoordinates(
                  flock.BABYLON.Vector3.Zero(),
                  bone.children[0].getWorldMatrix(),
                );
                estimatedLength = childWorld.subtract(headWorld).length();
              } else {
                const meshes = targetWithSkeleton.getChildMeshes?.() || [
                  targetWithSkeleton,
                ];
                const minYVals = [];
                const maxYVals = [];
                for (const m of meshes) {
                  const info = m.getBoundingInfo?.();
                  if (!info) continue;
                  const minY = info.boundingBox.minimumWorld.y;
                  const maxY = info.boundingBox.maximumWorld.y;
                  if (isFinite(minY) && isFinite(maxY)) {
                    minYVals.push(minY);
                    maxYVals.push(maxY);
                  }
                }
                let modelHeight = 1;
                if (minYVals.length && maxYVals.length) {
                  const allMinY = Math.min(...minYVals);
                  const allMaxY = Math.max(...maxYVals);
                  modelHeight = allMaxY - allMinY;
                }
                const defaultHeadOffset = 1.3;
                estimatedLength = defaultHeadOffset * Math.max(modelHeight, 1);
              }
              y += estimatedLength;
            }

            meshToAttachInstance.position = new flock.BABYLON.Vector3(x, y, z);
          }
        }
      });
    });
  },
  drop(meshToDetach) {
    return flock.whenModelReady(meshToDetach, (mesh) => {
      // Capture current world transform
      const worldMatrix = mesh.getWorldMatrix(true).clone();
      const scale = new flock.BABYLON.Vector3();
      const rotationNow = new flock.BABYLON.Quaternion();
      const position = new flock.BABYLON.Vector3();
      worldMatrix.decompose(scale, rotationNow, position);

      // Restore pre-attach world rotation if available
      const md = mesh.metadata || {};
      const restoreRotation = md._preAttachWorldRotation || rotationNow;

      mesh.detachFromBone?.();
      mesh.parent = null;
      mesh.rotationQuaternion = restoreRotation.clone();
      mesh.scaling = scale;
      mesh.position = position.add(new flock.BABYLON.Vector3(0, 0.002, 0));
      mesh.computeWorldMatrix(true);

      const body = mesh.physics;
      if (body && body._pluginData) {
        body.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
        if (body.setTargetTransform)
          body.setTargetTransform(mesh.position, mesh.rotationQuaternion);
        body.setLinearVelocity(flock.BABYLON.Vector3.Zero());
        body.setAngularVelocity(flock.BABYLON.Vector3.Zero());

        flock.hk._hknp.HP_World_AddBody(
          flock.hk.world,
          body._pluginData.hpBodyId,
          true,
        );

        flock.scene.onBeforeRenderObservable.addOnce(() => {
          body.setMotionType(flock.BABYLON.PhysicsMotionType.DYNAMIC);
          body.setLinearVelocity(flock.BABYLON.Vector3.Zero());
          body.setAngularVelocity(flock.BABYLON.Vector3.Zero());
        });
      }
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
