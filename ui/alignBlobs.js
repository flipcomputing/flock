import { flock } from '../flock.js';
import { hideFromInspector } from './inspectorVisibility.js';
import { isPlacementSurface, SELECTED_HIDDEN_VISIBILITY } from './meshhelpers.js';

const HANDLE_PX = 12;
const SNAP_RADIUS_PX = 18;
const MIN_FACE_PX = 36;
const MIN_FIT = 1 / 3;
const BAR_WIDTH = 0.45;
const CORNER_ARM = 1.6;
const AXIS_COLOUR_HEX = ['#0072B2', '#009E73', '#D55E00'];
const HIGHLIGHT_COLOUR_HEX = '#fff200';
const PART_MIN_PX = 40;
const MAX_PARTS = 20;
const PART_PREFIX = /^align_/i;
const EXCLUDED_NAMES = new Set(['ground', 'sky', '__root__']);
const HANDLE_STENCIL_BIT = 0x80;
const MOVER_RENDERING_GROUP = 1;
const CONTACT_TOLERANCE = 0.02;

function isAlignTarget(mesh, mover) {
  const key = mesh.metadata?.blockKey;
  if (!key || key === mover.metadata?.blockKey || mesh.isDescendantOf(mover)) return false;
  if (mesh.parent?.metadata?.blockKey === key) return false;
  if (EXCLUDED_NAMES.has(mesh.name)) return false;
  if (mesh.metadata?.shape === 'camera' || mesh.metadata?.shapeType === 'Group') return false;
  if (!mesh.isEnabled() || mesh.isVisible === false) return false;
  if (mesh.visibility === 0 && mesh.getChildMeshes().length === 0) return false;
  return !!mesh.getBoundingInfo?.();
}

function orientedBox(mesh) {
  mesh.computeWorldMatrix(true);
  const box = mesh.getBoundingInfo().boundingBox;
  const { Vector3 } = flock.BABYLON;
  const halfAxes = [
    new Vector3(box.extendSize.x, 0, 0),
    new Vector3(0, box.extendSize.y, 0),
    new Vector3(0, 0, box.extendSize.z),
  ].map((v) => Vector3.TransformNormal(v, mesh.getWorldMatrix()));
  return {
    centre: box.centerWorld.clone(),
    axes: halfAxes.map((v) => v.normalizeToNew()),
    extents: halfAxes.map((v) => v.length()),
  };
}

export function getAlignMarkers(mesh) {
  const { centre, axes, extents } = orientedBox(mesh);
  const markers = [];
  axes.forEach((axis, i) => {
    const [j, k] = [0, 1, 2].filter((n) => n !== i);
    for (const sign of [1, -1]) {
      const normal = axis.scale(sign);
      const faceCentre = centre.add(normal.scale(extents[i]));
      for (const aj of [0, 1, -1]) {
        for (const ak of [0, 1, -1]) {
          const tangents = [
            { axis: axes[j], extent: extents[j], a: aj, index: j },
            { axis: axes[k], extent: extents[k], a: ak, index: k },
          ];
          const point = tangents.reduce(
            (sum, t) => sum.add(t.axis.scale(t.a * t.extent)),
            faceCentre
          );
          markers.push({
            mesh,
            faceCentre,
            normal,
            normalIndex: i,
            tangents,
            point,
            isCentre: !aj && !ak,
          });
        }
      }
    }
  });
  return markers;
}

export function getAlignParts(root) {
  return root
    .getChildMeshes(false)
    .filter((mesh) => PART_PREFIX.test(mesh.metadata?.originalNodeName ?? mesh.name));
}

function pixelsPerUnitAt(scene, point) {
  const engine = scene.getEngine();
  const camera = scene.activeCamera;
  const cssHeight = engine.getRenderHeight() * engine.getHardwareScalingLevel();
  const distance = flock.BABYLON.Vector3.Distance(camera.globalPosition, point);
  return cssHeight / (2 * distance * Math.tan(camera.fov / 2));
}

function nearbyParts(scene, targets) {
  const viewpoint = scene.activeCamera.globalPosition;
  return targets
    .flatMap(getAlignParts)
    .filter((part) => part.isEnabled() && part.getTotalVertices() > 0)
    .map((part) => ({ part, sphere: part.getBoundingInfo().boundingSphere }))
    .filter(
      ({ sphere }) => sphere.radiusWorld * pixelsPerUnitAt(scene, sphere.centerWorld) >= PART_MIN_PX
    )
    .sort(
      (a, b) =>
        flock.BABYLON.Vector3.Distance(viewpoint, a.sphere.centerWorld) -
        flock.BABYLON.Vector3.Distance(viewpoint, b.sphere.centerWorld)
    )
    .slice(0, MAX_PARTS)
    .map(({ part }) => part);
}

function extentAlong(box, normal) {
  return box.axes.reduce(
    (sum, axis, i) => sum + Math.abs(flock.BABYLON.Vector3.Dot(axis, normal)) * box.extents[i],
    0
  );
}

function worldVertices(root) {
  const { Vector3, VertexBuffer } = flock.BABYLON;
  return [root, ...root.getChildMeshes(false)]
    .filter(
      (mesh) =>
        mesh.isEnabled() &&
        mesh.isVisible !== false &&
        mesh.visibility > SELECTED_HIDDEN_VISIBILITY &&
        mesh.getTotalVertices?.() > 0
    )
    .flatMap((mesh) => {
      const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
      const world = mesh.computeWorldMatrix(true);
      const points = [];
      for (let i = 0; i < positions.length; i += 3) {
        const point = new Vector3();
        Vector3.TransformCoordinatesFromFloatsToRef(
          positions[i],
          positions[i + 1],
          positions[i + 2],
          world,
          point
        );
        points.push(point);
      }
      return points;
    });
}

function freeAxes(marker) {
  const { Vector3 } = flock.BABYLON;
  if (marker.tangents.length) return marker.tangents.filter((t) => !t.a).map((t) => t.axis);
  const helper = Math.abs(marker.normal.y) < 0.9 ? Vector3.Up() : Vector3.Right();
  const u = Vector3.Cross(marker.normal, helper).normalize();
  return [u, Vector3.Cross(marker.normal, u).normalize()];
}

function range(points, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const along = flock.BABYLON.Vector3.Dot(p, axis);
    min = Math.min(min, along);
    max = Math.max(max, along);
  }
  return { min, max };
}

function facingEnd(points, axes, normal) {
  const { Vector3 } = flock.BABYLON;
  const towards = axes
    .flatMap((axis) => [axis, axis.negate()])
    .reduce((best, axis) => (Vector3.Dot(axis, normal) < Vector3.Dot(best, normal) ? axis : best));
  const extent = range(points, towards);
  const tolerance = Math.max(1e-4, (extent.max - extent.min) * CONTACT_TOLERANCE);
  return points.filter((p) => Vector3.Dot(p, towards) >= extent.max - tolerance);
}

function geometryAlignDelta(points, axes, marker) {
  const { Vector3 } = flock.BABYLON;
  const { normal, faceCentre } = marker;
  const depth = range(points, normal);
  const contact = facingEnd(points, axes, normal);

  const delta = normal.scale(Vector3.Dot(faceCentre, normal) - depth.min);
  for (const t of marker.tangents.filter((t) => t.a)) {
    const outward = t.axis.scale(t.a);
    const edge = Vector3.Dot(faceCentre, outward) + t.extent;
    delta.addInPlace(outward.scale(edge - range(points, outward).max));
  }
  for (const axis of freeAxes(marker)) {
    const { min, max } = range(contact, axis);
    delta.addInPlace(axis.scale(Vector3.Dot(faceCentre, axis) - (min + max) / 2));
  }
  return delta;
}

export function getAlignDelta(mover, marker) {
  const box = orientedBox(mover);
  const points = worldVertices(mover);
  if (points.length) return geometryAlignDelta(points, box.axes, marker);

  const targetCentre = marker.tangents.reduce(
    (sum, t) => sum.add(t.axis.scale(t.a * (t.extent - extentAlong(box, t.axis)))),
    marker.faceCentre.add(marker.normal.scale(extentAlong(box, marker.normal)))
  );
  return targetCentre.subtract(box.centre);
}

export function getAlignedBlockPosition(mover, marker) {
  const delta = getAlignDelta(mover, marker);
  const origin = mover.getAbsolutePosition();

  let baseY = origin.y;
  if (mover.metadata?.shape !== 'plane') {
    const localMinY = mover.getBoundingInfo().boundingBox.minimum.y;
    baseY += localMinY * mover.absoluteScaling.y;
  }

  return {
    x: origin.x + delta.x,
    y: baseY + delta.y,
    z: origin.z + delta.z,
  };
}

export function getSurfaceBlockPosition(mover, point, normal) {
  return getAlignedBlockPosition(mover, surfaceMarker(point, normal));
}

export function surfaceMarker(point, normal) {
  return { faceCentre: point, normal, tangents: [] };
}

function drawMoverBehindHandles(scene, mover) {
  const meshes = [mover, ...mover.getChildMeshes(false)];
  const materials = [
    ...new Set(meshes.flatMap((mesh) => [mesh.material, ...(mesh.material?.subMaterials ?? [])])),
  ].filter((material) => material?.stencil);
  const groups = meshes.map((mesh) => mesh.renderingGroupId);
  const stencils = materials.map(({ stencil }) => ({
    enabled: stencil.enabled,
    func: stencil.func,
    funcRef: stencil.funcRef,
    funcMask: stencil.funcMask,
    mask: stencil.mask,
  }));
  const clear = { ...scene.getAutoClearDepthStencilSetup(MOVER_RENDERING_GROUP) };

  scene.setRenderingAutoClearDepthStencil(MOVER_RENDERING_GROUP, false, false, false);
  meshes.forEach((mesh) => (mesh.renderingGroupId = MOVER_RENDERING_GROUP));
  materials.forEach(({ stencil }) =>
    Object.assign(stencil, {
      enabled: true,
      func: flock.BABYLON.Constants.NOTEQUAL,
      funcRef: HANDLE_STENCIL_BIT,
      funcMask: HANDLE_STENCIL_BIT,
      mask: 0,
    })
  );

  return () => {
    meshes.forEach((mesh, i) => {
      if (!mesh.isDisposed()) mesh.renderingGroupId = groups[i];
    });
    materials.forEach((material, i) => Object.assign(material.stencil, stencils[i]));
    scene.setRenderingAutoClearDepthStencil(
      MOVER_RENDERING_GROUP,
      clear.autoClear,
      clear.depth,
      clear.stencil
    );
  };
}

export function startAlignBlobs(mover, getCursor) {
  const scene = flock.scene;
  const BABYLON = flock.BABYLON;
  const targets = scene.meshes.filter((m) => isAlignTarget(m, mover));
  const markers = [...targets, ...nearbyParts(scene, targets)].flatMap(getAlignMarkers);
  if (!markers.length) return null;

  const isCorner = (marker) => marker.tangents.every((t) => t.a);
  const pieceAxes = (marker) => {
    if (marker.isCentre) return [marker.normalIndex];
    if (isCorner(marker)) return [marker.tangents[1].index, marker.tangents[0].index];
    return [marker.tangents.find((t) => t.a).index];
  };
  const colours = { dot: [], bar: [] };
  const slots = markers.map((marker) => {
    const shape = marker.isCentre ? 'dot' : 'bar';
    const indices = pieceAxes(marker).map((axis) => colours[shape].push(axis) - 1);
    return { dot: [], bar: [], [shape]: indices };
  });

  const makeHandleMesh = (name, hex, shape, count) => {
    const mesh =
      shape === 'dot'
        ? BABYLON.MeshBuilder.CreateSphere(name, { diameter: 2, segments: 8 }, scene)
        : BABYLON.MeshBuilder.CreateBox(name, { size: 1 }, scene);
    const mat = new BABYLON.StandardMaterial(`${name}_mat`, scene);
    mat.emissiveColor = BABYLON.Color3.FromHexString(hex);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    Object.assign(mat.stencil, {
      enabled: true,
      func: BABYLON.Constants.ALWAYS,
      funcRef: HANDLE_STENCIL_BIT,
      opStencilDepthPass: BABYLON.Constants.REPLACE,
      mask: HANDLE_STENCIL_BIT,
    });
    mesh.material = mat;
    hideFromInspector(mesh);
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.alwaysSelectAsActiveMesh = true;
    const matrices = new Float32Array(Math.max(count, 1) * 16);
    mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
    return { mesh, matrices };
  };

  const handles = {
    dot: makeHandleMesh('__flock_align_dots', '#ffffff', 'dot', colours.dot.length),
    bar: makeHandleMesh('__flock_align_bars', '#ffffff', 'bar', colours.bar.length),
  };
  for (const shape of ['dot', 'bar']) {
    const rgba = colours[shape].flatMap((axis) =>
      BABYLON.Color4.FromColor3(BABYLON.Color3.FromHexString(AXIS_COLOUR_HEX[axis])).asArray()
    );
    handles[shape].mesh.thinInstanceSetBuffer('color', new Float32Array(rgba), 4, true);
  }
  const highlight = {
    dot: makeHandleMesh('__flock_align_highlight_dot', HIGHLIGHT_COLOUR_HEX, 'dot', 1),
    bar: makeHandleMesh('__flock_align_highlight_bars', HIGHLIGHT_COLOUR_HEX, 'bar', 2),
  };
  const highlightSlots = { dot: [0], bar: [0, 1] };
  const meshSets = [handles, highlight];
  const restoreMover = drawMoverBehindHandles(scene, mover);

  const hidden = BABYLON.Matrix.Scaling(0, 0, 0);
  const engine = scene.getEngine();

  function worldSizeAt(point, px) {
    return px / pixelsPerUnitAt(scene, point);
  }

  function toScreen(point) {
    const camera = scene.activeCamera;
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const projected = BABYLON.Vector3.Project(
      point,
      BABYLON.Matrix.Identity(),
      scene.getTransformMatrix(),
      viewport
    );
    if (projected.z < 0 || projected.z > 1) return null;
    const scale = engine.getHardwareScalingLevel();
    return { x: projected.x * scale, y: projected.y * scale };
  }

  function screenLength(origin, offset) {
    const from = toScreen(origin);
    const to = toScreen(origin.add(offset));
    return from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
  }

  function insetPoint(marker, insets) {
    return marker.tangents.reduce(
      (sum, t, i) => sum.add(t.axis.scale(t.a * (t.extent - insets[i]))),
      marker.faceCentre
    );
  }

  function bar(marker, sizes) {
    const insets = sizes.map((s) => s / 2);
    return { shape: 'bar', centre: insetPoint(marker, insets), sizes };
  }

  function layout(marker) {
    const toCamera = scene.activeCamera.globalPosition.subtract(marker.faceCentre);
    if (BABYLON.Vector3.Dot(marker.normal, toCamera) <= 0) return null;
    let unit = worldSizeAt(marker.faceCentre, HANDLE_PX);

    if (marker.isCentre) {
      const piece = { shape: 'dot', centre: marker.faceCentre, radius: unit / 2 };
      return { anchor: marker.faceCentre, unit, pieces: [piece] };
    }

    const reach = marker.tangents
      .filter((t) => t.a)
      .map((t) => screenLength(marker.faceCentre, t.axis.scale(t.extent)));
    const fit = Math.min(...reach) / MIN_FACE_PX;
    if (fit < MIN_FIT) return null;
    unit *= Math.min(1, fit);

    const width = unit * BAR_WIDTH;
    if (isCorner(marker)) {
      const arm = unit * CORNER_ARM;
      return {
        anchor: insetPoint(marker, [width, width]),
        unit,
        pieces: [bar(marker, [arm, width]), bar(marker, [width, arm])],
      };
    }

    const sizes = marker.tangents.map((t) =>
      t.a ? width : 2 * Math.max(unit / 2, Math.min(unit * 2.5, t.extent * 0.3))
    );
    const piece = bar(marker, sizes);
    return { anchor: piece.centre, unit, pieces: [piece] };
  }

  function writeRows(target, index, rows) {
    target.set(
      rows.flatMap((row, i) => [...row.asArray(), i === 3 ? 1 : 0]),
      index * 16
    );
  }

  function writePiece(marker, piece, unit, grow, target, index) {
    const [tj, tk] = marker.tangents;
    if (piece.shape === 'dot') {
      const r = piece.radius * grow;
      const centre = piece.centre.add(marker.normal.scale(r * 0.6));
      writeRows(target, index, [
        tj.axis.scale(r),
        marker.normal.scale(r),
        tk.axis.scale(r),
        centre,
      ]);
      return;
    }
    const margin = (grow - 1) * unit;
    const thickness = unit * 0.2 * grow;
    const centre = piece.centre.add(marker.normal.scale(thickness / 2 + unit * 0.05));
    writeRows(target, index, [
      tj.axis.scale(piece.sizes[0] + margin),
      marker.normal.scale(thickness),
      tk.axis.scale(piece.sizes[1] + margin),
      centre,
    ]);
  }

  function writeMarker(marker, placed, grow, set, markerSlots) {
    const used = { dot: 0, bar: 0 };
    placed?.pieces.forEach((piece) => {
      const index = markerSlots[piece.shape][used[piece.shape]++];
      writePiece(marker, piece, placed.unit, grow, set[piece.shape].matrices, index);
    });
    for (const shape of ['dot', 'bar']) {
      markerSlots[shape]
        .slice(used[shape])
        .forEach((index) => hidden.copyToArray(set[shape].matrices, index * 16));
    }
  }

  function distanceToSegment(x, y, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSq)) : 0;
    return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
  }

  function pieceDistance(marker, piece, x, y) {
    const sizes = piece.sizes ?? [0, 0];
    const shortest = Math.min(...sizes);
    const span = marker.tangents.reduce(
      (sum, t, i) => sum.add(t.axis.scale((sizes[i] - shortest) / 2)),
      BABYLON.Vector3.Zero()
    );
    const a = toScreen(piece.centre.subtract(span));
    const b = toScreen(piece.centre.add(span));
    return a && b ? distanceToSegment(x, y, a, b) : Infinity;
  }

  function isOccluded({ anchor, unit }) {
    const origin = scene.activeCamera.globalPosition;
    const toPoint = anchor.subtract(origin);
    const distance = toPoint.length();
    const ray = new BABYLON.Ray(origin, toPoint.normalize(), distance);
    const hit = scene.pickWithRay(
      ray,
      (mesh) => isPlacementSurface(mesh) && mesh !== mover && !mesh.isDescendantOf(mover)
    );
    return !!hit?.hit && hit.distance < distance - (0.01 + unit);
  }

  function nearestAt(x, y) {
    const candidates = [];
    for (const marker of markers) {
      const placed = layout(marker);
      if (!placed) continue;
      const d = Math.min(...placed.pieces.map((piece) => pieceDistance(marker, piece, x, y)));
      if (d <= SNAP_RADIUS_PX) candidates.push({ marker, placed, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    return candidates.find(({ placed }) => !isOccluded(placed)) ?? null;
  }

  function markerAt(x, y) {
    return nearestAt(x, y)?.marker ?? null;
  }

  const observer = scene.onBeforeRenderObservable.add(() => {
    markers.forEach((marker, i) => writeMarker(marker, layout(marker), 1, handles, slots[i]));

    const cursor = getCursor();
    const active = cursor ? nearestAt(cursor.x, cursor.y) : null;
    writeMarker(active?.marker, active?.placed, 1.4, highlight, highlightSlots);

    for (const set of meshSets) {
      for (const { mesh } of Object.values(set)) mesh.thinInstanceBufferUpdated('matrix');
    }
  });

  function dispose() {
    scene.onBeforeRenderObservable.remove(observer);
    restoreMover();
    for (const set of meshSets) {
      for (const { mesh } of Object.values(set)) {
        mesh.material.dispose();
        mesh.dispose();
      }
    }
  }

  return { markerAt, dispose };
}
