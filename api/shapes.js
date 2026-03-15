import earcut from "earcut";
import Module from "manifold-3d";
import opentype from "opentype.js";

let flock;
let manifoldModule = null;
let manifoldInitPromise = null;

// Initialize the Manifold WASM module once
async function getManifold() {
  if (manifoldModule) return manifoldModule;
  if (manifoldInitPromise) return manifoldInitPromise;
  
  manifoldInitPromise = (async () => {
    try {
      // Load with explicit WASM location using the correct base path
      // Ensure base URL ends with a slash
      let baseUrl = import.meta.env.BASE_URL || '/';
      if (!baseUrl.endsWith('/')) baseUrl += '/';
      
      const wasm = await Module({
        locateFile: (file) => {
          if (file.endsWith('.wasm')) {
            // Use base URL for both dev and production (GitHub Pages)
            return `${baseUrl}wasm/manifold.wasm`;
          }
          return file;
        }
      });
      
      // Setup is required for manifold-3d
      if (wasm.setup) {
        wasm.setup();
      }
      
      manifoldModule = wasm;
      return wasm;
    } catch (e) {
      console.error('[Manifold] Failed to initialize WASM:', e);
      manifoldInitPromise = null; // Reset so it can be retried
      throw e;
    }
  })();
  
  return manifoldInitPromise;
}

export function setFlockReference(ref) {
  flock = ref;
}

/**
 * Convert font path commands to polygons suitable for Manifold CrossSection.
 * Handles curves by subdividing them into line segments.
 */
function convertPathToPolygons(path, curveSegments = 12) {
  const polygons = [];
  let currentContour = [];
  let lastX = 0, lastY = 0;
  let startX = 0, startY = 0;
  
  const commands = path.commands;
  
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    
    switch (cmd.type) {
      case 'M': // Move to
        if (currentContour.length >= 3) {
          polygons.push(currentContour);
        }
        currentContour = [[cmd.x, -cmd.y]]; // Flip Y for correct orientation
        lastX = cmd.x;
        lastY = cmd.y;
        startX = cmd.x;
        startY = cmd.y;
        break;
        
      case 'L': // Line to
        currentContour.push([cmd.x, -cmd.y]);
        lastX = cmd.x;
        lastY = cmd.y;
        break;
        
      case 'Q': // Quadratic bezier curve
        for (let t = 1; t <= curveSegments; t++) {
          const tNorm = t / curveSegments;
          const tInv = 1 - tNorm;
          // Quadratic bezier: P = (1-t)²P0 + 2(1-t)tP1 + t²P2
          const x = tInv * tInv * lastX + 2 * tInv * tNorm * cmd.x1 + tNorm * tNorm * cmd.x;
          const y = tInv * tInv * lastY + 2 * tInv * tNorm * cmd.y1 + tNorm * tNorm * cmd.y;
          currentContour.push([x, -y]);
        }
        lastX = cmd.x;
        lastY = cmd.y;
        break;
        
      case 'C': // Cubic bezier curve
        for (let t = 1; t <= curveSegments; t++) {
          const tNorm = t / curveSegments;
          const tInv = 1 - tNorm;
          // Cubic bezier: P = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
          const x = tInv * tInv * tInv * lastX + 
                    3 * tInv * tInv * tNorm * cmd.x1 + 
                    3 * tInv * tNorm * tNorm * cmd.x2 + 
                    tNorm * tNorm * tNorm * cmd.x;
          const y = tInv * tInv * tInv * lastY + 
                    3 * tInv * tInv * tNorm * cmd.y1 + 
                    3 * tInv * tNorm * tNorm * cmd.y2 + 
                    tNorm * tNorm * tNorm * cmd.y;
          currentContour.push([x, -y]);
        }
        lastX = cmd.x;
        lastY = cmd.y;
        break;
        
      case 'Z': // Close path
        if (currentContour.length >= 3) {
          polygons.push(currentContour);
        }
        currentContour = [];
        lastX = startX;
        lastY = startY;
        break;
    }
  }
  
  // Don't forget any remaining contour
  if (currentContour.length >= 3) {
    polygons.push(currentContour);
  }
  
  return polygons;
}

/**
 * Calculate the signed area of a polygon to determine winding direction.
 */
function polygonArea(polygon) {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }
  return area / 2;
}

/**
 * Create manifold 3D text mesh using Manifold library.
 * This produces guaranteed watertight geometry suitable for CSG operations.
 */
async function createManifoldTextMesh(text, fontUrl, options = {}) {
  const {
    size = 50,
    depth = 1,
    curveSegments = 12
  } = options;
  
  const wasm = await getManifold();
  const { CrossSection } = wasm;
  
  // Load font - handle both URL and already-loaded font
  let font;
  if (typeof fontUrl === 'string') {
    font = await opentype.load(fontUrl);
  } else {
    font = fontUrl;
  }
  
  // Get the path from the font
  // Scale factor: opentype uses 72 units per em by default
  const fontPath = font.getPath(text, 0, 0, size);
  
  // Convert to polygons
  const polygons = convertPathToPolygons(fontPath, curveSegments);
  
  if (polygons.length === 0) {
    throw new Error('No valid polygons generated from text');
  }
  
  // Manifold CrossSection requires positive area (counter-clockwise winding) for outer contours
  // and negative area (clockwise) for holes. Reverse our polygons to fix winding.
  const correctedPolygons = polygons.map(poly => [...poly].reverse());
  
  let manifoldMesh = null;
  
  try {
    // Create CrossSection - it handles polygons with holes automatically
    const crossSection = new CrossSection(correctedPolygons);
    
    // Extrude to create 3D manifold mesh
    manifoldMesh = crossSection.extrude(depth);
    
    // Get mesh data
    const meshData = manifoldMesh.getMesh();
    
    // Extract vertex positions and triangle indices
    const vertPos = meshData.vertProperties;
    const triVerts = meshData.triVerts;
    const numProp = meshData.numProp;
    
    // Convert to flat arrays for Babylon.js
    const positions = [];
    const indices = [];
    
    // vertProperties is a flat array with numProp values per vertex
    for (let i = 0; i < vertPos.length; i += numProp) {
      positions.push(vertPos[i], vertPos[i + 1], vertPos[i + 2]);
    }
    
    // triVerts is already a flat array of indices
    for (let i = 0; i < triVerts.length; i++) {
      indices.push(triVerts[i]);
    }
    
    // Clean up Manifold objects
    manifoldMesh.delete();
    crossSection.delete();
    
    return { positions, indices };
  } catch (e) {
    if (manifoldMesh) manifoldMesh.delete();
    throw e;
  }
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

    flock.setBlockPositionOnMesh(newPlane, {
      x: position[0],
      y: position[1],
      z: position[2],
      useY: true,
      meshName: newPlane.name,
    });

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
    useManifold = true, // Use manifold by default for CSG compatibility
  }) {
    const { x, y, z } = position;

    // Create the loading promise
    const loadPromise = new Promise(async (resolve, reject) => {
      try {
        let mesh;
        
        if (useManifold) {
          // Use Manifold-based text generation for guaranteed watertight geometry
          try {
            
            // Get TTF/OTF font URL - convert JSON font path to TTF if needed
            let fontUrl = font;
            if (font.endsWith('.json')) {
              // Use FreeSans Bold as default TTF font for manifold text (matches original)
              fontUrl = 'fonts/FreeSansBold.ttf';
            }
            
            // Use size directly - manifold will work with scene units
            const scaledSize = size;
            
            const meshData = await createManifoldTextMesh(text, fontUrl, {
              size: scaledSize,
              depth: depth,
              curveSegments: 12
            });
            
            // Create Babylon.js mesh from manifold data
            mesh = new flock.BABYLON.Mesh(modelId, flock.scene);
            const vertexData = new flock.BABYLON.VertexData();
            
            vertexData.positions = meshData.positions;
            vertexData.indices = meshData.indices;
            
            // Compute normals
            const normals = [];
            flock.BABYLON.VertexData.ComputeNormals(
              meshData.positions,
              meshData.indices,
              normals
            );
            vertexData.normals = normals;
            
            // Center the positions on X and Z before applying to mesh
            // Y stays at base (already correct from manifold creation)
            const positions = meshData.positions;
            let minX = Infinity, maxX = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;
            
            for (let i = 0; i < positions.length; i += 3) {
              minX = Math.min(minX, positions[i]);
              maxX = Math.max(maxX, positions[i]);
              minZ = Math.min(minZ, positions[i + 2]);
              maxZ = Math.max(maxZ, positions[i + 2]);
            }
            
            const centerX = (minX + maxX) / 2;
            const centerZ = (minZ + maxZ) / 2;
            
            // Offset positions to center on X and Z
            const centeredPositions = new Float32Array(positions.length);
            for (let i = 0; i < positions.length; i += 3) {
              centeredPositions[i] = positions[i] - centerX;
              centeredPositions[i + 1] = positions[i + 1]; // Y unchanged
              centeredPositions[i + 2] = positions[i + 2] - centerZ;
            }
            
            vertexData.positions = centeredPositions;
            vertexData.applyToMesh(mesh);
            
            // Flip faces to ensure correct orientation for CSG operations
            mesh.flipFaces();
            
          } catch (manifoldError) {
            console.warn('[create3DText] Manifold approach failed, falling back to standard:', manifoldError.message);
            useManifold = false;
          }
        }
        
        if (!useManifold) {
          // Fall back to standard Babylon.js CreateText
          const fontData = await (await fetch(font)).json();

          mesh = flock.BABYLON.MeshBuilder.CreateText(
            modelId,
            text,
            fontData,
            {
              size: size,
              depth: depth,
            },
            flock.scene,
            earcut,
          );

        }

        if (!mesh) {
          reject(new Error('CreateText returned null'));
          return;
        }

        mesh.position.set(x, y, z);
        const material = new flock.BABYLON.StandardMaterial(
          "textMaterial_" + modelId,
          flock.scene,
        );

        material.diffuseColor = flock.BABYLON.Color3.FromHexString(
          flock.getColorFromString(color),
        );
        material.backFaceCulling = false;
        material.emissiveColor = material.diffuseColor.scale(0.2);

        mesh.material = material;

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        mesh.setEnabled(true);
        mesh.visibility = 1;

        const textShape = new flock.BABYLON.PhysicsShapeMesh(mesh, flock.scene);
        flock.applyPhysics(mesh, textShape);

        if (callback) {
          requestAnimationFrame(callback);
        }

        resolve();
      } catch (error) {
        console.error(`Error creating 3D text '${modelId}':`, error);
        reject(error);
      }
    });

    // Store promise for whenModelReady coordination
    flock.modelReadyPromises.set(modelId, loadPromise);

    return modelId;
  },
};
