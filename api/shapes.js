import earcut from 'earcut';
import Module from 'manifold-3d';
import opentype from 'opentype.js';
import { roundingSettings } from './freeformgeometry.js';
import { releaseShape } from './physics.js';
import { clampToRange } from '../config.js';

let flock;
let manifoldModule = null;
let manifoldInitPromise = null;

// Initialize the Manifold WASM module once
export async function getManifold(wasmUrl) {
  if (manifoldModule) return manifoldModule;
  if (manifoldInitPromise) return manifoldInitPromise;

  manifoldInitPromise = (async () => {
    try {
      const resolvedWasmUrl =
        wasmUrl ||
        flock?.runtimeUrl?.('wasm/manifold.wasm') ||
        `${import.meta.env.BASE_URL || '/'}wasm/manifold.wasm`;

      const wasm = await Module({
        locateFile: (file) => (file.endsWith('.wasm') ? resolvedWasmUrl : file),
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

// Validate a shape/mesh ID: must be a non-empty string, max 100 chars.
function validateShapeId(id, fnName) {
  if (!id || typeof id !== 'string' || id.length > 100) {
    console.warn(`${fnName}: invalid id`);
    return false;
  }
  return true;
}

// Coerce a dimension value to a positive finite number, falling back to `fallback`.
function toDim(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

// A list of depths cycles through the letters; one that never varies is a
// plain depth, so it builds exactly as a number would.
function toDepth(v) {
  if (!Array.isArray(v)) return toDim(v, 1);
  const depths = v.map((d) => toDim(d, 1));
  if (!depths.length) return 1;
  return depths.every((d) => d === depths[0]) ? depths[0] : depths;
}

function toSpacing(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// User code runs in another realm, so its objects have a different Object.prototype.
function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || Object.getPrototypeOf(proto) === null;
}

function toAlpha(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

const MARKER_COLOUR = [1, 1, 1];
const MARKER_DOT_COLOUR = [0, 0, 0];

const MARKER_DIAMETER = 1;
const MARKER_DOT_DIAMETER = 0.1;

const MARKER_CROSS_LENGTH = 0.6;
const MARKER_CROSS_WIDTH = 0.14;
const MARKER_CROSS_OUTLINE = 0.03;
const MARKER_CROSS_HEIGHT = 0.02;
const MARKER_CROSS_ALPHA = 0.5;
const MARKER_LAYER_GAP = 0.003;

function tintMarker(data, colour, alpha = 1) {
  const count = data.positions.length / 3;
  data.colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) data.colors.set([...colour, alpha], i * 4);
  return data;
}

function markerVertexData(type) {
  return type === 'sphere' ? sphereMarkerVertexData() : crossMarkerVertexData();
}

// A flat, double-sided shape from [x, z] points and triangles, at height y.
function flatMarkerPart(points, triangles, y, colour, alpha) {
  const data = new flock.BABYLON.VertexData();
  data.positions = points.flatMap(([x, z]) => [x, y, z]);
  data.indices = triangles.flatMap(([a, b, c]) => [a, b, c, a, c, b]);
  data.normals = points.flatMap(() => [0, 1, 0]);
  data.uvs = points.flatMap(() => [0, 0]);
  return tintMarker(data, colour, alpha);
}

// Upright walls along a closed polygon's edges, from the ground to height.
function markerWalls(points, height, colour) {
  const data = new flock.BABYLON.VertexData();
  data.positions = points.flatMap(([x, z], i) => {
    const [nx, nz] = points[(i + 1) % points.length];
    return [x, 0, z, nx, 0, nz, nx, height, nz, x, height, z];
  });
  data.indices = points.flatMap((_, i) => {
    const q = i * 4;
    return [q, q + 1, q + 2, q, q + 2, q + 3, q, q + 2, q + 1, q, q + 3, q + 2];
  });
  data.normals = points.flatMap(() => [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  data.uvs = points.flatMap(() => [0, 0, 0, 0, 0, 0, 0, 0]);
  return tintMarker(data, colour);
}

// A band around a polygon, between it and a copy grown by the outline width.
function markerOutlineRing(inner, outer) {
  const n = inner.length;
  const triangles = inner.flatMap((_, i) => {
    const j = (i + 1) % n;
    return [
      [i, j, n + j],
      [i, n + j, n + i],
    ];
  });
  return { points: [...inner, ...outer], triangles };
}

const MARKER_ARROW = [
  [0, -0.62],
  [-0.16, -0.36],
  [0, -0.45],
  [0.16, -0.36],
];
const MARKER_ARROW_OUTER = [
  [0, -0.677],
  [-0.246, -0.277],
  [0, -0.416],
  [0.246, -0.277],
];
const MARKER_ARROW_BACK = -0.277;

function markerArrowParts(arrow, arrowOuter) {
  const height = MARKER_CROSS_HEIGHT;
  const ring = markerOutlineRing(arrow, arrowOuter);
  return markerWalls(arrowOuter, height, MARKER_DOT_COLOUR)
    .merge(flatMarkerPart(ring.points, ring.triangles, height, MARKER_DOT_COLOUR, 1))
    .merge(
      flatMarkerPart(
        arrow,
        [
          [0, 1, 2],
          [0, 2, 3],
        ],
        height,
        MARKER_COLOUR,
        MARKER_CROSS_ALPHA
      )
    );
}

export function markerArrowVertexData() {
  const back = ([x, z]) => [x, z - MARKER_ARROW_BACK];
  return markerArrowParts(MARKER_ARROW.map(back), MARKER_ARROW_OUTER.map(back));
}

// A stage spike mark: an X on the surface at the marker's position. A solid
// black band round the X stands up from the surface like a low wall, so the X
// shows on light and dark floors and from low angles. The see-through fill
// is one shape, not two crossed arms, so it blends evenly where they meet.
// The forward (-Z) arrow has a black band too and stands in front of the X. Points mirroring the arrow behind the X are never drawn;
// they keep the bounds, and with them the anchor, centred on the X.
function crossMarkerVertexData() {
  const { VertexData, Matrix, Mesh } = flock.BABYLON;
  const a = MARKER_CROSS_WIDTH / 2;
  const b = MARKER_CROSS_LENGTH / 2;
  const m = MARKER_CROSS_OUTLINE;
  const height = MARKER_CROSS_HEIGHT;
  const turn = ([x, z]) => [(x - z) * Math.SQRT1_2, (x + z) * Math.SQRT1_2];
  const plus = [
    [a, b],
    [-a, b],
    [-a, a],
    [-b, a],
    [-b, -a],
    [-a, -a],
    [-a, -b],
    [a, -b],
    [a, -a],
    [b, -a],
    [b, a],
    [a, a],
  ];
  // Every corner of a plus is square, so growing it moves each corner
  // diagonally away from the axes.
  const grown = plus.map(([x, z]) => [x + Math.sign(x) * m, z + Math.sign(z) * m]);
  const fill = [
    [0, 1, 2],
    [0, 2, 11],
    [2, 3, 4],
    [2, 4, 5],
    [5, 6, 7],
    [5, 7, 8],
    [8, 9, 10],
    [8, 10, 11],
    [11, 2, 5],
    [11, 5, 8],
  ];
  const inner = plus.map(turn);
  const outer = grown.map(turn);
  const ring = markerOutlineRing(inner, outer);
  const balance = MARKER_ARROW_OUTER.map(([x, z]) => [-x, -z]);
  const dot = VertexData.CreateDisc({
    radius: MARKER_DOT_DIAMETER / 2,
    tessellation: 16,
    sideOrientation: Mesh.DOUBLESIDE,
  }).transform(
    Matrix.RotationX(Math.PI / 2).multiply(Matrix.Translation(0, height + MARKER_LAYER_GAP, 0))
  );
  return markerWalls(outer, height, MARKER_DOT_COLOUR)
    .merge(markerWalls(inner, height, MARKER_DOT_COLOUR))
    .merge(flatMarkerPart(ring.points, ring.triangles, height, MARKER_DOT_COLOUR, 1))
    .merge(flatMarkerPart(inner, fill, height, MARKER_COLOUR, MARKER_CROSS_ALPHA))
    .merge(markerArrowParts(MARKER_ARROW, MARKER_ARROW_OUTER))
    .merge(tintMarker(dot, MARKER_DOT_COLOUR))
    .merge(flatMarkerPart(balance, [], 0, MARKER_DOT_COLOUR, 0));
}

// The dot and the forward (-Z) arrow come first so they are drawn before the
// see-through shell around them. The arrow stays inside the shell, so the
// bounds, and with them the anchor, stay centred on the dot.
function sphereMarkerVertexData() {
  const { VertexData, Matrix } = flock.BABYLON;
  const alongForward = (data, from, to) =>
    data.transform(
      Matrix.RotationX(-Math.PI / 2).multiply(Matrix.Translation(0, 0, -(from + to) / 2))
    );
  const radius = MARKER_DIAMETER / 2 - 0.01;
  const headStart = radius - 0.2;
  const shaft = VertexData.CreateCylinder({ height: headStart, diameter: 0.05, tessellation: 12 });
  const head = VertexData.CreateCylinder({
    height: radius - headStart,
    diameterTop: 0,
    diameterBottom: 0.18,
    tessellation: 16,
  });
  return tintMarker(
    VertexData.CreateSphere({ diameter: MARKER_DOT_DIAMETER, segments: 16 }),
    MARKER_DOT_COLOUR
  )
    .merge(tintMarker(alongForward(shaft, 0, headStart), MARKER_COLOUR))
    .merge(tintMarker(alongForward(head, headStart, radius), MARKER_COLOUR))
    .merge(
      tintMarker(
        VertexData.CreateSphere({ diameter: MARKER_DIAMETER, segments: 24 }),
        MARKER_COLOUR,
        0.3
      )
    );
}

/**
 * Convert font path commands to polygons suitable for Manifold CrossSection.
 * Handles curves by subdividing them into line segments.
 */
function convertPathToPolygons(path, curveSegments = 12) {
  const polygons = [];
  let currentContour = [];
  let lastX = 0,
    lastY = 0;
  let startX = 0,
    startY = 0;

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
          const x =
            tInv * tInv * tInv * lastX +
            3 * tInv * tInv * tNorm * cmd.x1 +
            3 * tInv * tNorm * tNorm * cmd.x2 +
            tNorm * tNorm * tNorm * cmd.x;
          const y =
            tInv * tInv * tInv * lastY +
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

function pointKey(x, y, size) {
  const step = size * 1e-4 || 1e-4;
  return `${Math.round(x / step)},${Math.round(y / step)}`;
}

// Extruded vertices sit on their glyph's outline; ones Manifold adds where
// glyphs overlap fall back to the glyph spanning (or nearest) their x.
function letterOfPoint(letterAt, letters, x, y, size) {
  const index = letterAt.get(pointKey(x, y, size));
  if (index !== undefined) return index;
  let best = 0;
  let bestDistance = Infinity;
  letters.forEach((letter, index) => {
    const distance = Math.max(letter.minX - x, x - letter.maxX, 0);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

// Each letter takes the next depth in turn, all sharing the back plane at the
// deepest letter's depth so the fronts stand out by different amounts.
function extrudeLetters({ CrossSection, Manifold }, letters, depths) {
  const backZ = Math.max(...depths);
  const parts = letters.map((letter, i) => {
    const depth = depths[i % depths.length];
    const section = new CrossSection(letter.polygons.map((poly) => [...poly].reverse()));
    const extruded = section.extrude(depth);
    const part = extruded.translate(0, 0, backZ - depth);
    extruded.delete();
    section.delete();
    return part;
  });
  try {
    return Manifold.union(parts);
  } finally {
    parts.forEach((part) => part.delete());
  }
}

/**
 * Create manifold 3D text mesh using Manifold library.
 * This produces guaranteed watertight geometry suitable for CSG operations.
 */
async function createManifoldTextMesh(text, fontUrl, options = {}) {
  const { size = 50, depth = 1, spacing = 0, curveSegments = 12 } = options;

  const wasm = await getManifold();
  const { CrossSection } = wasm;

  // Load font - handle both URL and already-loaded font
  let font;
  if (typeof fontUrl === 'string') {
    // opentype.js v2 removed the async loader; fetch the buffer and parse it.
    const fontBuffer = await (await fetch(fontUrl)).arrayBuffer();
    font = opentype.parse(fontBuffer);
  } else {
    font = fontUrl;
  }

  // Get the path from the font
  // Scale factor: opentype uses 72 units per em by default
  // letterSpacing is in ems; spacing is in scene units.
  const letterSpacing = size > 0 ? spacing / size : 0;
  const glyphPaths = font.getPaths(text, 0, 0, size, { letterSpacing });

  // Convert to polygons, numbering only glyphs that draw something so spaces
  // don't take a letter slot.
  const polygons = [];
  const letters = [];
  const letterAt = new Map();
  for (const glyphPath of glyphPaths) {
    const glyphPolygons = convertPathToPolygons(glyphPath, curveSegments);
    if (!glyphPolygons.length) continue;
    const letter = { polygons: glyphPolygons, minX: Infinity, maxX: -Infinity };
    for (const polygon of glyphPolygons) {
      for (const [px, py] of polygon) {
        letterAt.set(pointKey(px, py, size), letters.length);
        letter.minX = Math.min(letter.minX, px);
        letter.maxX = Math.max(letter.maxX, px);
      }
    }
    letters.push(letter);
    polygons.push(...glyphPolygons);
  }

  if (polygons.length === 0) {
    throw new Error('No valid polygons generated from text');
  }

  // Manifold CrossSection requires positive area (counter-clockwise winding) for outer contours
  // and negative area (clockwise) for holes. Reverse our polygons to fix winding.
  const correctedPolygons = polygons.map((poly) => [...poly].reverse());

  let crossSection = null;
  let manifoldMesh = null;

  try {
    if (Array.isArray(depth)) {
      manifoldMesh = extrudeLetters(wasm, letters, depth);
    } else {
      // Create CrossSection - it handles polygons with holes automatically
      crossSection = new CrossSection(correctedPolygons);
      manifoldMesh = crossSection.extrude(depth);
    }

    // Get mesh data
    const meshData = manifoldMesh.getMesh();

    // Extract vertex positions and triangle indices
    const vertPos = meshData.vertProperties;
    const triVerts = meshData.triVerts;
    const numProp = meshData.numProp;

    // Convert to flat arrays for Babylon.js
    const positions = [];
    const indices = [];
    const letterIndex = [];

    // vertProperties is a flat array with numProp values per vertex
    for (let i = 0; i < vertPos.length; i += numProp) {
      positions.push(vertPos[i], vertPos[i + 1], vertPos[i + 2]);
      letterIndex.push(letterOfPoint(letterAt, letters, vertPos[i], vertPos[i + 1], size));
    }

    // triVerts is already a flat array of indices
    for (let i = 0; i < triVerts.length; i++) {
      indices.push(triVerts[i]);
    }

    // Use font cap height (or ascender) as a consistent reference height so that
    // normalization later is not affected by which glyphs happen to be in the string.
    // e.g. a lone "*" has a small bounding box but should be scaled the same as "H".
    const os2 = font.tables && font.tables.os2;
    const capHeightFontUnits = os2 && os2.sCapHeight > 0 ? os2.sCapHeight : font.ascender;
    const rawReferenceHeight = (capHeightFontUnits / font.unitsPerEm) * size;
    const referenceHeight =
      Number.isFinite(rawReferenceHeight) && rawReferenceHeight > 0 ? rawReferenceHeight : null;

    return { positions, indices, letterIndex, referenceHeight };
  } finally {
    if (manifoldMesh) manifoldMesh.delete();
    if (crossSection) crossSection.delete();
  }
}

// Builds text geometry at the origin, normalised so the cap height equals
// `size`. Horizontal text is turned to lie face-up with its base at y = 0.
// Built on a throwaway mesh so the caller can set up its real mesh in one
// synchronous step once the font work is done.
async function buildTextVertexData(
  meshId,
  { text, font, size, depth, spacing, horizontal, useManifold }
) {
  let mesh;
  let fontReferenceHeight = null;
  let letterIndex = null;

  if (useManifold) {
    try {
      let fontUrl = font;
      if (font.endsWith('.json')) {
        fontUrl = 'fonts/FreeSansBold.ttf';
      }

      const meshData = await createManifoldTextMesh(text, fontUrl, {
        size,
        depth,
        spacing,
        curveSegments: 12,
      });
      fontReferenceHeight = meshData.referenceHeight;
      letterIndex = meshData.letterIndex;

      mesh = new flock.BABYLON.Mesh(meshId, flock.scene);
      const vertexData = new flock.BABYLON.VertexData();

      vertexData.positions = meshData.positions;
      vertexData.indices = meshData.indices;

      const normals = [];
      flock.BABYLON.VertexData.ComputeNormals(meshData.positions, meshData.indices, normals);
      vertexData.normals = normals;

      const positions = meshData.positions;
      let minX = Infinity,
        maxX = -Infinity;
      let minZ = Infinity,
        maxZ = -Infinity;

      for (let i = 0; i < positions.length; i += 3) {
        minX = Math.min(minX, positions[i]);
        maxX = Math.max(maxX, positions[i]);
        minZ = Math.min(minZ, positions[i + 2]);
        maxZ = Math.max(maxZ, positions[i + 2]);
      }

      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;

      const centeredPositions = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i += 3) {
        centeredPositions[i] = positions[i] - centerX;
        centeredPositions[i + 1] = positions[i + 1];
        centeredPositions[i + 2] = positions[i + 2] - centerZ;
      }

      vertexData.positions = centeredPositions;
      vertexData.applyToMesh(mesh);
      mesh.flipFaces();
    } catch (manifoldError) {
      console.warn(
        '[create3DText] Manifold approach failed, falling back to standard:',
        manifoldError.message
      );
      mesh?.dispose();
      mesh = null;
      useManifold = false;
      letterIndex = null;
    }
  }

  if (!useManifold) {
    // MeshBuilder.CreateText needs a Babylon font JSON, not a raw .ttf.
    // If a .ttf was supplied, fall back to the bundled JSON font.
    const fontDataUrl = font.toLowerCase().endsWith('.ttf') ? '/fonts/FreeSans_Bold.json' : font;
    const fontData = await (await fetch(fontDataUrl)).json();
    mesh = flock.BABYLON.MeshBuilder.CreateText(
      meshId,
      text,
      fontData,
      { size, depth: Array.isArray(depth) ? Math.max(...depth) : depth },
      flock.scene,
      earcut
    );
  }

  if (!mesh) throw new Error('CreateText returned null');

  mesh.computeWorldMatrix(true);
  mesh.refreshBoundingInfo();

  const bbHeight = mesh.getBoundingInfo().boundingBox.extendSize.y * 2;
  // Use the font's cap height as the normalization reference so that glyphs
  // with a small bounding box (e.g. "*") are not scaled up disproportionately.
  const normReference = fontReferenceHeight ?? bbHeight;
  if (bbHeight > 0 && Math.abs(normReference - size) > 0.001) {
    const normScale = size / normReference;
    mesh.scaling.x = normScale;
    mesh.scaling.y = normScale;
    mesh.bakeCurrentTransformIntoVertices();
  }

  if (horizontal) {
    mesh.rotation.x = Math.PI / 2;
    mesh.bakeCurrentTransformIntoVertices();
    mesh.refreshBoundingInfo();
    mesh.position.y = -mesh.getBoundingInfo().boundingBox.minimum.y;
    mesh.bakeCurrentTransformIntoVertices();
  }

  const vertexData = flock.BABYLON.VertexData.ExtractFromMesh(mesh);
  mesh.dispose();
  return { vertexData, letterIndex };
}

export const flockShapes = {
  createBox(
    boxId,
    {
      width = 1,
      height = 1,
      depth = 1,
      color = '#9932CC',
      position = new flock.BABYLON.Vector3(0, 0, 0),
      alpha = 1,
      rotation = null,
      callback = null,
      hasDo = false,
    } = {}
  ) {
    if (!validateShapeId(boxId, 'createBox')) return null;
    width = toDim(width, 1);
    height = toDim(height, 1);
    depth = toDim(depth, 1);
    alpha = toAlpha(alpha);

    let blockKey;
    [boxId, blockKey] = flock._splitBlockKey(boxId);

    let groupName = boxId;
    boxId = flock._reserveName(boxId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    const dimensions = { width, height, depth };

    // Retrieve cached VertexData or create it if this is the first instance
    const vertexData = flock.getOrCreateGeometry('Box', dimensions, flock.scene);

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
    flock.initializeMesh(newBox, position, color, 'Box', alpha, true, { rotation });

    newBox.metadata = newBox.metadata || {};
    newBox.metadata.blockKey = blockKey;
    newBox.metadata.sectionOwner = flock._currentSection;

    flock.deferBody(newBox, (mesh) =>
      flock.applyPhysics(
        mesh,
        new flock.BABYLON.PhysicsShapeBox(
          flock.BABYLON.Vector3.Zero(),
          new flock.BABYLON.Quaternion(0, 0, 0, 1),
          new flock.BABYLON.Vector3(width, height, depth),
          flock.scene
        )
      )
    );
    newBox.metadata.physicsShapeType = 'BOX';
    flock._awaitDo(newBox, hasDo);

    flock.announceMeshReady(newBox.name, groupName);
    flock._registerInstance(blockKey, newBox.name, newBox);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return newBox.name;
  },
  createGroup(groupId, { position = new flock.BABYLON.Vector3(0, 0, 0), callback = null } = {}) {
    if (!validateShapeId(groupId, 'createGroup')) return null;

    let blockKey;
    [groupId, blockKey] = flock._splitBlockKey(groupId);

    let groupName = groupId;
    groupId = flock._reserveName(groupId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    const newGroup = new flock.BABYLON.Mesh(groupId, flock.scene);
    flock.rebuildGroupGeometry(newGroup, 0.01, 0.01, 0.01);

    flock.initializeMesh(newGroup, position, null, 'Group', 1, false);
    newGroup.metadata.blockKey = blockKey;
    newGroup.visibility = 0;
    newGroup.metadata.sharedGeometry = false;
    // The shell encloses its members, so without this it would swallow
    // their clicks even when the group itself has no click handler.
    flock.ensureGroupPickForwarder?.(newGroup);

    flock.announceMeshReady(newGroup.name, groupName);
    flock._registerInstance(blockKey, newGroup.name, newGroup);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return newGroup.name;
  },
  createMarker(
    markerId,
    {
      position = [0, 0, 0],
      type = 'cross',
      edit = true,
      rotation = null,
      size = null,
      callback = null,
      hasDo = false,
    } = {}
  ) {
    if (!validateShapeId(markerId, 'createMarker')) return null;

    let blockKey;
    [markerId, blockKey] = flock._splitBlockKey(markerId);

    let groupName = markerId;
    markerId = flock._reserveName(markerId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    const marker = new flock.BABYLON.Mesh(markerId, flock.scene);
    flock._buildMarker(marker, type);

    const material = new flock.BABYLON.StandardMaterial(`${markerId}_material`, flock.scene);
    material.disableLighting = true;
    material.emissiveColor = flock.BABYLON.Color3.White();
    material.fogEnabled = false;
    marker.material = material;

    marker.metadata = marker.metadata || {};
    marker.metadata.shape = 'marker';
    marker.metadata.blockKey = blockKey;
    marker.metadata.sectionOwner = flock._currentSection;
    marker.metadata.markerEdit = edit !== false;
    flock._applyMarkerVisibility(marker);

    flock.setBlockPositionOnMesh(marker, {
      x: position[0],
      y: position[1],
      z: position[2],
      useY: true,
      meshName: marker.name,
    });
    if (rotation || size) flock._applyInitialTransform(marker, { position, rotation, size });

    flock._awaitDo(marker, hasDo);

    flock.announceMeshReady(marker.name, groupName);
    flock._registerInstance(blockKey, marker.name, marker);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return marker.name;
  },
  setMarkerType(markerName, type) {
    const marker = flock.scene?.getMeshByName(markerName);
    if (marker?.metadata?.shape !== 'marker') return;
    flock._buildMarker(marker, type);
    delete marker.metadata.originalMin;
    delete marker.metadata.originalMax;
    marker.refreshBoundingInfo();
    marker.computeWorldMatrix(true);
  },
  _buildMarker(marker, type) {
    const markerType = type === 'sphere' ? 'sphere' : 'cross';
    markerVertexData(markerType).applyToMesh(marker, true);
    marker.hasVertexAlpha = true;
    marker.metadata = marker.metadata || {};
    marker.metadata.markerType = markerType;
    // A cross is built up from the surface, so its anchor is its base.
    if (markerType === 'cross') {
      marker.metadata.anchorSettings = { x: 'CENTER', y: 'MIN', z: 'CENTER' };
    } else {
      delete marker.metadata.anchorSettings;
    }
  },
  setMarkerEdit(markerName, edit) {
    const marker = flock.scene?.getMeshByName(markerName);
    if (marker?.metadata?.shape !== 'marker') return;
    marker.metadata.markerEdit = !!edit;
    flock._applyMarkerVisibility(marker);
  },
  // A marker only ever shows in the editor, and only while its edit box is ticked.
  _applyMarkerVisibility(marker) {
    const shown = marker.metadata.markerEdit && flock._editorView;
    marker.isVisible = shown;
    marker.isPickable = shown;
  },
  _refreshMarkers() {
    for (const mesh of flock.scene?.meshes ?? []) {
      if (mesh.metadata?.shape === 'marker') flock._applyMarkerVisibility(mesh);
    }
  },
  async addPrefab(
    groupId,
    { x = 0, y = 0, z = 0, rotationY = 0, args = [], material = true, build = null } = {}
  ) {
    const groupName = flock.createGroup(groupId);
    if (!groupName) return null;
    const group = flock.scene.getMeshByName(groupName);
    group.metadata.isPrefab = true;
    group.setEnabled(false);
    // Material arguments carry their index so the meshes they colour can be found for
    // live edits. The last argument is the prefab's own material, unless material is false.
    const tagged = args.map((arg, index) => {
      const value =
        material && index === args.length - 1 && typeof arg === 'string'
          ? { color: arg, materialName: 'none.png', alpha: 1 }
          : arg;
      if (!isPlainObject(value)) return value;
      const copy = { ...value };
      Object.defineProperty(copy, '__prefabSlot', { value: index });
      return copy;
    });
    try {
      if (build) await build(groupName, tagged);
      await flock._whenHierarchySettled(group);
      await flock.rotateTo(groupName, { y: rotationY });
      await flock.positionAt(groupName, { x, y, z });
    } finally {
      if (!group.isDisposed()) group.setEnabled(true);
    }
    return groupName;
  },
  createSphere(
    sphereId,
    {
      color = '#9932CC',
      diameterX = 1,
      diameterY = 1,
      diameterZ = 1,
      position = new flock.BABYLON.Vector3(0, 0, 0),
      alpha = 1,
      rotation = null,
      callback = null,
      hasDo = false,
    } = {}
  ) {
    if (!validateShapeId(sphereId, 'createSphere')) return null;
    diameterX = toDim(diameterX, 1);
    diameterY = toDim(diameterY, 1);
    diameterZ = toDim(diameterZ, 1);
    alpha = toAlpha(alpha);

    let blockKey;
    [sphereId, blockKey] = flock._splitBlockKey(sphereId);

    let groupName = sphereId;
    sphereId = flock._reserveName(sphereId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    const dimensions = { diameterX, diameterY, diameterZ };

    // Retrieve cached VertexData or create it if this is the first instance
    const vertexData = flock.getOrCreateGeometry('Sphere', dimensions, flock.scene);

    if (!vertexData) return;

    // Create a new mesh and apply the cached VertexData
    const newSphere = new flock.BABYLON.Mesh(sphereId, flock.scene);
    vertexData.applyToMesh(newSphere);

    flock.setSphereUVs(newSphere, diameterX);
    newSphere.bakeCurrentTransformIntoVertices();

    // Reset scaling to (1,1,1) since the transformation is now baked
    newSphere.scaling.set(1, 1, 1);

    // Initialise the mesh with position, color, and other properties
    flock.initializeMesh(newSphere, position, color, 'Sphere', alpha, true, { rotation });

    newSphere.metadata = newSphere.metadata || {};
    newSphere.metadata.blockKey = blockKey;
    newSphere.metadata.sectionOwner = flock._currentSection;

    flock.deferBody(newSphere, (mesh) =>
      flock.applyPhysics(
        mesh,
        new flock.BABYLON.PhysicsShapeSphere(
          flock.BABYLON.Vector3.Zero(),
          Math.max(diameterX, diameterY, diameterZ) / 2,
          flock.scene
        )
      )
    );
    newSphere.metadata.physicsShapeType = 'SPHERE';
    flock._awaitDo(newSphere, hasDo);

    flock.announceMeshReady(newSphere.name, groupName);
    flock._registerInstance(blockKey, newSphere.name, newSphere);

    if (callback) {
      requestAnimationFrame(() => callback());
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
      rotation = null,
      callback = null,
      hasDo = false,
    } = {}
  ) {
    if (!validateShapeId(cylinderId, 'createCylinder')) return null;
    height = toDim(height, 1);
    diameterTop = toDim(diameterTop, 1);
    diameterBottom = toDim(diameterBottom, 1);
    tessellation = clampToRange(Math.round(toDim(tessellation, 24)), 'sides');
    alpha = toAlpha(alpha);

    const dimensions = {
      height,
      diameterTop,
      diameterBottom,
      tessellation, // Include tessellation in dimensions
      updatable: true,
    };

    let blockKey;
    [cylinderId, blockKey] = flock._splitBlockKey(cylinderId);

    let groupName = cylinderId;
    cylinderId = flock._reserveName(cylinderId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    // Get or create cached VertexData
    const vertexData = flock.getOrCreateGeometry('Cylinder', dimensions, flock.scene);

    // Create a new mesh and apply the cached VertexData
    const newCylinder = new flock.BABYLON.Mesh(cylinderId, flock.scene);
    vertexData.applyToMesh(newCylinder);

    flock.setSizeBasedCylinderUVs(newCylinder, height, diameterTop, diameterBottom);

    newCylinder.bakeCurrentTransformIntoVertices();

    // Reset scaling to (1,1,1) since the transformation is now baked
    newCylinder.scaling.set(1, 1, 1);

    // Initialise the mesh with position, color, and other properties
    flock.initializeMesh(newCylinder, position, color, 'Cylinder', alpha, true, { rotation });
    // Initialise the mesh with position, color, and other properties

    newCylinder.metadata = newCylinder.metadata || {};
    newCylinder.metadata.blockKey = blockKey;
    newCylinder.metadata.sectionOwner = flock._currentSection;

    flock.deferBody(newCylinder, (mesh) => {
      let cylinderShape;
      if (diameterTop === diameterBottom) {
        const startPoint = new flock.BABYLON.Vector3(0, -height / 2, 0);
        const endPoint = new flock.BABYLON.Vector3(0, height / 2, 0);
        cylinderShape = new flock.BABYLON.PhysicsShapeCylinder(
          startPoint,
          endPoint,
          diameterBottom / 2,
          flock.scene
        );
      } else {
        cylinderShape = new flock.BABYLON.PhysicsShapeConvexHull(mesh, flock.scene);
      }
      flock.applyPhysics(mesh, cylinderShape);
    });
    newCylinder.metadata.physicsShapeType =
      diameterTop === diameterBottom ? 'CYLINDER' : 'CONVEX_HULL';
    flock._awaitDo(newCylinder, hasDo);

    flock.announceMeshReady(newCylinder.name, groupName);
    flock._registerInstance(blockKey, newCylinder.name, newCylinder);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return newCylinder.name;
  },
  createCapsule(
    capsuleId,
    {
      color,
      diameter,
      height,
      position,
      alpha = 1,
      rotation = null,
      callback = null,
      hasDo = false,
    } = {}
  ) {
    if (!validateShapeId(capsuleId, 'createCapsule')) return null;
    diameter = toDim(diameter, 1);
    height = toDim(height, 2);
    alpha = toAlpha(alpha);

    let radius = diameter / 2;
    let blockKey;
    [capsuleId, blockKey] = flock._splitBlockKey(capsuleId);

    let groupName = capsuleId;

    const dimensions = {
      radius,
      height,
      tessellation: 24,
      updatable: false,
    };

    capsuleId = flock._reserveName(capsuleId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    // Get or create cached VertexData
    const vertexData = flock.getOrCreateGeometry('Capsule', dimensions, flock.scene);

    // Create a new mesh and apply the cached VertexData
    const newCapsule = new flock.BABYLON.Mesh(capsuleId, flock.scene);
    vertexData.applyToMesh(newCapsule);
    newCapsule.bakeCurrentTransformIntoVertices();

    // Reset scaling to (1,1,1) since the transformation is now baked
    newCapsule.scaling.set(1, 1, 1);

    // Initialise the mesh with position, color, and other properties
    flock.initializeMesh(newCapsule, position, color, 'Capsule', alpha, true, { rotation });

    flock.setCapsuleUVs(newCapsule, radius, height);

    newCapsule.metadata = newCapsule.metadata || {};
    newCapsule.metadata.blockKey = blockKey;
    newCapsule.metadata.sectionOwner = flock._currentSection;
    // Define central point for the capsule
    const center = flock.BABYLON.Vector3.Zero();

    // Calculate physics shape parameters
    const capsuleRadius = radius;
    const cylinderHeight = Math.max(0, height - 2 * capsuleRadius);

    // Define the start and end points of the cylindrical segment
    const segmentStart = new flock.BABYLON.Vector3(
      center.x,
      center.y - cylinderHeight / 2 + 0.1,
      center.z
    );
    const segmentEnd = new flock.BABYLON.Vector3(
      center.x,
      center.y + cylinderHeight / 2 + 0.1,
      center.z
    );

    flock.deferBody(newCapsule, (mesh) =>
      flock.applyPhysics(
        mesh,
        new flock.BABYLON.PhysicsShapeCapsule(segmentStart, segmentEnd, capsuleRadius, flock.scene)
      )
    );
    flock._awaitDo(newCapsule, hasDo);

    flock.announceMeshReady(newCapsule.name, groupName);
    flock._registerInstance(blockKey, newCapsule.name, newCapsule);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return newCapsule.name;
  },
  createWedge(
    wedgeId,
    {
      width = 1,
      height = 1,
      depth = 1,
      peak = 0,
      axis = 'X',
      color = '#9932CC',
      position = new flock.BABYLON.Vector3(0, 0, 0),
      alpha = 1,
      rotation = null,
      callback = null,
      hasDo = false,
    } = {}
  ) {
    if (!validateShapeId(wedgeId, 'createWedge')) return null;
    width = toDim(width, 1);
    height = toDim(height, 1);
    depth = toDim(depth, 1);
    peak = Math.min(1, Math.max(0, toDim(peak, 0)));
    axis = String(axis).toUpperCase() === 'Z' ? 'Z' : 'X';
    alpha = toAlpha(alpha);

    let blockKey;
    [wedgeId, blockKey] = flock._splitBlockKey(wedgeId);

    let groupName = wedgeId;
    wedgeId = flock._reserveName(wedgeId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    const dimensions = { width, height, depth, peak, axis };

    const vertexData = flock.getOrCreateGeometry('Wedge', dimensions, flock.scene);

    const newWedge = new flock.BABYLON.Mesh(wedgeId, flock.scene);
    vertexData.applyToMesh(newWedge);

    flock.setSizeBasedBoxUVs(newWedge, width, height, depth);

    newWedge.bakeCurrentTransformIntoVertices();
    newWedge.scaling.set(1, 1, 1);

    flock.initializeMesh(newWedge, position, color, 'Wedge', alpha, true, { rotation });

    newWedge.metadata = newWedge.metadata || {};
    newWedge.metadata.blockKey = blockKey;
    newWedge.metadata.sectionOwner = flock._currentSection;
    newWedge.metadata.wedgePeak = peak;
    newWedge.metadata.wedgeAxis = axis;

    // A hull fits the slope and, unlike a mesh shape, works on a dynamic body.
    flock.deferBody(newWedge, (mesh) =>
      flock.applyPhysics(mesh, new flock.BABYLON.PhysicsShapeConvexHull(mesh, flock.scene))
    );
    // Read back when physics is disabled then re-enabled.
    newWedge.metadata.physicsShapeType = 'CONVEX_HULL';
    flock._awaitDo(newWedge, hasDo);

    flock.announceMeshReady(newWedge.name, groupName);
    flock._registerInstance(blockKey, newWedge.name, newWedge);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return newWedge.name;
  },
  createFreeform(
    freeformId,
    {
      vertices,
      faces,
      rounding = 'none',
      radius,
      color = '#ef7a7a',
      position = new flock.BABYLON.Vector3(0, 0, 0),
      alpha = 1,
      rotation = null,
      callback = null,
      hasDo = false,
    } = {}
  ) {
    if (!validateShapeId(freeformId, 'createFreeform')) return null;
    alpha = toAlpha(alpha);

    let blockKey;
    [freeformId, blockKey] = flock._splitBlockKey(freeformId);

    let groupName = freeformId;
    freeformId = flock._reserveName(freeformId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    const newFreeform = new flock.BABYLON.Mesh(freeformId, flock.scene);
    newFreeform.metadata = { freeformRounding: roundingSettings({ rounding, radius }) };
    const shape = flock.freeformShape(vertices, faces);
    flock.setFreeformShape(newFreeform, shape.points, shape.faces);

    flock.initializeMesh(newFreeform, position, color, 'Freeform', alpha, true, { rotation });

    newFreeform.metadata.blockKey = blockKey;
    newFreeform.metadata.sectionOwner = flock._currentSection;
    newFreeform.metadata.sharedGeometry = false;

    // A box is cheap on low-end machines; the physics shape block can swap it.
    flock.deferBody(newFreeform, (mesh) =>
      flock.applyPhysics(mesh, flock.createFreeformBox(mesh, flock.scene))
    );
    newFreeform.metadata.physicsShapeType = 'BOX';
    flock._awaitDo(newFreeform, hasDo);

    flock.announceMeshReady(newFreeform.name, groupName);
    flock._registerInstance(blockKey, newFreeform.name, newFreeform);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return newFreeform.name;
  },
  setFreeformShape(mesh, points, faces) {
    flock.freeformVertexData(points, faces, mesh.metadata?.freeformRounding).applyToMesh(mesh, true);
    mesh.refreshBoundingInfo();
    const { minimum, maximum } = mesh.getBoundingInfo().boundingBox;
    flock.setSizeBasedBoxUVs(
      mesh,
      maximum.x - minimum.x,
      maximum.y - minimum.y,
      maximum.z - minimum.z
    );
    mesh.metadata = mesh.metadata || {};
    mesh.metadata.freeformPoints = points.map((p) => [...p]);
    mesh.metadata.freeformFaces = faces.map((f) => [...f]);
  },
  createDonut(
    donutId,
    {
      color = '#9932CC',
      diameter = 1.5,
      innerDiameter,
      thickness,
      tessellation = 24,
      position = new flock.BABYLON.Vector3(0, 0, 0),
      alpha = 1,
      rotation = null,
      callback = null,
      hasDo = false,
    } = {}
  ) {
    if (!validateShapeId(donutId, 'createDonut')) return null;
    const dimensions = flock.donutDimensions({
      diameter,
      innerDiameter,
      thickness,
      tessellation,
    });
    alpha = toAlpha(alpha);

    let blockKey;
    [donutId, blockKey] = flock._splitBlockKey(donutId);

    let groupName = donutId;
    donutId = flock._reserveName(donutId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    const vertexData = flock.getOrCreateGeometry(
      'Donut',
      flock.donutTorusOptions(dimensions),
      flock.scene
    );

    const newDonut = new flock.BABYLON.Mesh(donutId, flock.scene);
    vertexData.applyToMesh(newDonut);

    newDonut.bakeCurrentTransformIntoVertices();
    newDonut.scaling.set(1, 1, 1);

    flock.initializeMesh(newDonut, position, color, 'Donut', alpha, true, { rotation });

    newDonut.metadata = newDonut.metadata || {};
    newDonut.metadata.blockKey = blockKey;
    newDonut.metadata.sectionOwner = flock._currentSection;
    newDonut.metadata.donutDimensions = dimensions;

    // A mesh shape leaves the hole open; a hull would fill it in.
    flock.deferBody(newDonut, (mesh) =>
      flock.applyPhysics(mesh, new flock.BABYLON.PhysicsShapeMesh(mesh, flock.scene))
    );
    newDonut.metadata.physicsShapeType = 'MESH';
    flock._awaitDo(newDonut, hasDo);

    flock.announceMeshReady(newDonut.name, groupName);
    flock._registerInstance(blockKey, newDonut.name, newDonut);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return newDonut.name;
  },
  createRing(
    ringId,
    {
      color = '#9932CC',
      diameter = 2,
      innerDiameter,
      thickness,
      height = 0.5,
      tessellation = 24,
      position = new flock.BABYLON.Vector3(0, 0, 0),
      alpha = 1,
      rotation = null,
      callback = null,
      hasDo = false,
    } = {}
  ) {
    if (!validateShapeId(ringId, 'createRing')) return null;
    const dimensions = flock.ringDimensions({
      diameter,
      innerDiameter,
      thickness,
      height,
      tessellation,
    });
    alpha = toAlpha(alpha);

    let blockKey;
    [ringId, blockKey] = flock._splitBlockKey(ringId);

    let groupName = ringId;
    ringId = flock._reserveName(ringId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    const vertexData = flock.getOrCreateGeometry('Ring', dimensions, flock.scene);

    const newRing = new flock.BABYLON.Mesh(ringId, flock.scene);
    vertexData.applyToMesh(newRing);

    flock.initializeMesh(newRing, position, color, 'Ring', alpha, true, { rotation });

    newRing.metadata = newRing.metadata || {};
    newRing.metadata.blockKey = blockKey;
    newRing.metadata.sectionOwner = flock._currentSection;
    newRing.metadata.ringDimensions = dimensions;

    flock.deferBody(newRing, (mesh) =>
      flock.applyPhysics(mesh, new flock.BABYLON.PhysicsShapeMesh(mesh, flock.scene))
    );
    newRing.metadata.physicsShapeType = 'MESH';
    flock._awaitDo(newRing, hasDo);

    flock.announceMeshReady(newRing.name, groupName);
    flock._registerInstance(blockKey, newRing.name, newRing);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return newRing.name;
  },
  createPlane(
    planeId,
    {
      color,
      width,
      height,
      position = [0, 0, 0],
      rotation = null,
      callback = null,
      hasDo = false,
    } = {}
  ) {
    if (!validateShapeId(planeId, 'createPlane')) return null;
    width = toDim(width, 1);
    height = toDim(height, 1);
    let blockKey;
    [planeId, blockKey] = flock._splitBlockKey(planeId);

    let groupName = planeId;
    planeId = flock._reserveName(planeId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    const newPlane = flock.BABYLON.MeshBuilder.CreatePlane(
      planeId,
      {
        width,
        height,
        sideOrientation: flock.BABYLON.Mesh.DOUBLESIDE,
      },
      flock.scene
    );

    newPlane.metadata = newPlane.metadata || {};
    newPlane.metadata.shape = 'plane';
    newPlane.metadata.blockKey = blockKey;
    newPlane.metadata.sectionOwner = flock._currentSection;

    flock.setBlockPositionOnMesh(newPlane, {
      x: position[0],
      y: position[1],
      z: position[2],
      useY: true,
      meshName: newPlane.name,
    });
    if (rotation) flock._applyInitialTransform(newPlane, { position, rotation });

    flock.deferBody(newPlane, (mesh) => {
      const planeBody = new flock.BABYLON.PhysicsBody(
        mesh,
        flock.BABYLON.PhysicsMotionType.STATIC,
        false,
        flock.scene
      );

      planeBody.disablePreStep = true;
      const planeShape = new flock.BABYLON.PhysicsShapeBox(
        flock.BABYLON.Vector3.Zero(),
        new flock.BABYLON.Quaternion(0, 0, 0, 1),
        new flock.BABYLON.Vector3(width, height, 0.001),
        flock.scene
      );

      planeBody.shape = planeShape;
      planeBody.setMassProperties({
        mass: 0,
        inertia: flock.BABYLON.Vector3.ZeroReadOnly,
      });
      flock.applyBounciness(planeBody, mesh);
      mesh.physics = planeBody;
    });
    flock._awaitDo(newPlane, hasDo);

    flock.setMaterialWithCleanup(newPlane, {
      color: color,
      materialName: 'none.png',
    });

    newPlane.metadata.blockKey = blockKey;
    newPlane.metadata.sectionOwner = flock._currentSection;

    flock.announceMeshReady(newPlane.name, groupName);
    flock._registerInstance(blockKey, newPlane.name, newPlane);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return newPlane.name;
  },
  create3DText({
    text,
    font,
    color = '#FFFFFF',
    alpha = 1,
    size = 50,
    depth = 1.0,
    position = { x: 0, y: 0, z: 0 },
    modelId,
    spacing = 0,
    horizontal = false,
    rotation = null,
    callback = null,
    then = null,
    useManifold = true,
  } = {}) {
    if (!validateShapeId(modelId, 'create3DText')) return null;
    if (!text || typeof text !== 'string') {
      console.warn('create3DText: invalid text');
      return null;
    }
    if (!font || typeof font !== 'string') {
      console.warn('create3DText: invalid font');
      return null;
    }
    size = toDim(size, 50);
    depth = toDepth(depth);
    spacing = toSpacing(spacing);
    const { x, y, z } = position;

    let [meshId, blockKey] = flock._splitBlockKey(modelId);

    if (!flock._pendingMeshIds) flock._pendingMeshIds = new Set();
    meshId = flock._reserveName(meshId);
    flock._pendingMeshIds.add(meshId);

    flock._recycleOldestByKey(blockKey);

    const loadPromise = (async () => {
      try {
        const { vertexData, letterIndex } = await buildTextVertexData(`${meshId}_build`, {
          text,
          font,
          size,
          depth,
          spacing,
          horizontal,
          useManifold,
        });

        const mesh = new flock.BABYLON.Mesh(meshId, flock.scene);
        vertexData.applyToMesh(mesh, true);

        mesh.metadata = mesh.metadata || {};
        mesh.metadata.blockKey = blockKey;
        mesh.metadata.sectionOwner = flock._currentSection;
        mesh.metadata.textSize = size;
        if (letterIndex) mesh.metadata.textLetterIndex = letterIndex;
        mesh.position.set(x, y, z);
        if (rotation) flock._applyInitialTransform(mesh, { position, rotation });

        const colors = Array.isArray(color) ? color : [color];
        const perLetter = letterIndex && colors.length > 1;
        const material = new flock.BABYLON.StandardMaterial('textMaterial_' + meshId, flock.scene);

        material.diffuseColor = flock.BABYLON.Color3.FromHexString(
          flock.getColorFromString(perLetter ? '#ffffff' : colors[0])
        );
        material.backFaceCulling = false;
        // A white glow would wash out the letter colours.
        material.emissiveColor = perLetter
          ? flock.BABYLON.Color3.Black()
          : material.diffuseColor.scale(0.2);
        material.alpha = toAlpha(alpha);
        mesh.material = material;
        if (perLetter) flock._paintTextLetters(mesh, colors);

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();

        mesh.setEnabled(true);
        mesh.visibility = 1;

        flock.deferBody(mesh, (target) =>
          flock.applyPhysics(target, new flock.BABYLON.PhysicsShapeMesh(target, flock.scene))
        );
        flock._awaitDo(mesh, !!callback);

        flock._pendingMeshIds.delete(meshId);

        flock._registerInstance(blockKey, mesh.name, mesh);
        flock._rememberConstruction(mesh, { dos: [callback], thens: [then] });

        if (callback || then) {
          requestAnimationFrame(async () => {
            for (const fn of [callback, then]) {
              if (fn) {
                if (flock.abortController?.signal?.aborted || mesh.isDisposed()) return;
                try {
                  await fn(meshId);
                } catch (err) {
                  console.error('create3DText callback error:', err);
                }
              }
              if (fn === callback) flock._finishDo(mesh);
            }
          });
        }
      } catch (error) {
        flock._pendingMeshIds?.delete(meshId);
        flock.reportBlockError({
          key: 'text_creation_failed',
          api: 'create3DText',
          values: { mesh: meshId },
          error,
        });
      }
    })();

    flock.modelReadyPromises.set(meshId, loadPromise);

    return meshId;
  },
  // Swaps new text geometry into an existing mesh, keeping its transform,
  // material and physics body. A newer call supersedes one still in flight.
  async _rebuild3DTextGeometry(mesh, { text, font, size, depth, spacing, horizontal = false }) {
    if (!mesh || !text || typeof text !== 'string') return;
    const token = {};
    mesh._flockTextRebuild = token;

    size = toDim(size, 50);
    const { vertexData, letterIndex } = await buildTextVertexData(`${mesh.name}_build`, {
      text,
      font,
      size,
      depth: toDepth(depth),
      spacing: toSpacing(spacing),
      horizontal,
      useManifold: true,
    });
    if (mesh._flockTextRebuild !== token || mesh.isDisposed()) return;
    delete mesh._flockTextRebuild;

    flock.ensureUniqueGeometry(mesh);
    vertexData.applyToMesh(mesh, true);
    // The new geometry is built at the requested size, so drop any scale
    // left over from a gizmo drag.
    mesh.scaling.set(1, 1, 1);
    const { textLetterColors } = mesh.metadata ?? {};
    mesh.metadata = { ...mesh.metadata, textSize: size, textLetterIndex: letterIndex };
    if (textLetterColors && letterIndex) {
      flock._paintTextLetters(mesh, textLetterColors);
    } else {
      flock._clearTextLetters(mesh);
    }
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();

    if (mesh.physics) {
      releaseShape(mesh.physics.shape);
      mesh.physics.shape = new flock.BABYLON.PhysicsShapeMesh(mesh, flock.scene);
    }
  },
};
