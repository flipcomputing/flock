import * as Blockly from 'blockly';
import { flock } from '../flock.js';
import { setNumberInputs } from './blocklyutil.js';
import { getMeshFromBlock } from './blockmesh.js';
import { roundToOneDecimal } from './meshhelpers.js';
import {
  extrudeFace,
  mergePoints,
  sharesEdge,
  faceCentre,
  faceNormal,
  shapeError,
} from '../api/freeformgeometry.js';

const POINT_SIZE_PER_DISTANCE = 0.025;
const ARROW_SIZE_PER_DISTANCE = 0.06;
const MERGE_TARGET_GROWTH = 1.8;
const SELECTED_GROWTH = 1.4;
const POINT_COLOR = '#ffcc33';
const ARROW_COLOR = '#33ccff';
const SELECTED_COLOR = '#ffffff';
export const FREEFORM_STEP = 0.1;

const ENGINE_RETRY_MS = 250;

const editors = new Map();
const meshEditors = new Map();
const pendingStarts = new Set();

const copyShape = ({ points, faces }) => ({
  points: points.map((p) => [...p]),
  faces: faces.map((f) => [...f]),
});

const roundPoint = (v) => [v.x, v.y, v.z].map((n) => roundToOneDecimal(n) + 0);

// Follows the block's current mesh, so the handles move onto the new mesh
// after a re-run. Points worked out by code can't be checked or written back,
// so those shapes get no handles; nor does play view.
export function setFreeformEditing(block, on) {
  const editor = editors.get(block.id);
  if (!on) {
    editor?.stop();
    return;
  }
  if (editor) return;
  // A project restored on page load arrives before the engine exists.
  if (!flock.engine) {
    if (!pendingStarts.has(block.id)) {
      pendingStarts.add(block.id);
      setTimeout(() => {
        pendingStarts.delete(block.id);
        if (!block.disposed && block.getFieldValue('EDIT') === 'TRUE') {
          setFreeformEditing(block, true);
        }
      }, ENGINE_RETRY_MS);
    }
    return;
  }

  let mesh = null;
  let detach = null;
  const release = () => {
    detach?.();
    detach = null;
    mesh = null;
  };
  const tick = flock.engine.onBeginFrameObservable.add(() => {
    if (block.disposed || block.getFieldValue('EDIT') !== 'TRUE') {
      stop();
      return;
    }
    const current = getMeshFromBlock(block);
    const editable =
      current?.metadata?.shapeType === 'Freeform' &&
      !document.body.classList.contains('play-mode') &&
      !!block.getPoints();
    if (current !== mesh || !editable) release();
    if (!detach && editable && !current.isDisposed()) {
      mesh = current;
      detach = attachEditor(mesh, block);
    }
  });
  const stop = () => {
    flock.engine?.onBeginFrameObservable.remove(tick);
    release();
    editors.delete(block.id);
  };
  editors.set(block.id, { stop });
}

// The editor for a mesh in edit mode, which the move tool drives.
export function freeformEditorFor(mesh) {
  return meshEditors.get(mesh) ?? null;
}

// The handle under a canvas position, as { editor, selection }.
export function freeformHandleAt(x, y) {
  if (!meshEditors.size) return null;
  const handleScene = flock.BABYLON.UtilityLayerRenderer.DefaultUtilityLayer.utilityLayerScene;
  const pick = handleScene.pick(x, y, (m) => !!m.metadata?.freeformHandle && m.isEnabled());
  return pick?.hit ? pick.pickedMesh.metadata.freeformHandle : null;
}

function attachEditor(mesh, block) {
  const BABYLON = flock.BABYLON;
  const scene = mesh.getScene();
  const handleScene = BABYLON.UtilityLayerRenderer.DefaultUtilityLayer.utilityLayerScene;

  const material = (name, color) => {
    const m = new BABYLON.StandardMaterial(name, handleScene);
    m.disableLighting = true;
    m.emissiveColor = BABYLON.Color3.FromHexString(color);
    return m;
  };
  const pointMaterial = material('freeformPointMaterial', POINT_COLOR);
  const arrowMaterial = material('freeformArrowMaterial', ARROW_COLOR);
  const selectedMaterial = material('freeformSelectedMaterial', SELECTED_COLOR);

  const shape = () => ({
    points: mesh.metadata.freeformPoints,
    faces: mesh.metadata.freeformFaces,
  });

  const toLocal = (world) =>
    BABYLON.Vector3.TransformCoordinates(world, mesh.computeWorldMatrix(true).clone().invert());
  const toWorld = (point) =>
    BABYLON.Vector3.TransformCoordinates(
      BABYLON.Vector3.FromArray(point),
      mesh.computeWorldMatrix(true)
    );

  // A neighbouring point under the pointer. Measured from the pointer's ray,
  // not the dragged point, which stays at its own depth from the camera.
  const pointerSnapTarget = ({ points, faces }, index) => {
    const camera = scene.activeCamera;
    if (!camera) return null;
    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, null, camera);
    let best = null;
    let bestDistance = Infinity;
    points.forEach((point, i) => {
      if (i === index || !sharesEdge(faces, index, i)) return;
      const target = toWorld(point);
      const distance = BABYLON.Vector3.Cross(ray.direction, target.subtract(ray.origin)).length();
      const reach = BABYLON.Vector3.Distance(camera.globalPosition, target) * POINT_SIZE_PER_DISTANCE;
      if (distance < reach && distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    return best;
  };

  // A neighbouring point at exactly this position, for gizmo and key moves.
  const coincidentNeighbour = ({ points, faces }, index, local) => {
    const i = points.findIndex(
      (p, j) => j !== index && p.every((v, axis) => v === local[axis]) && sharesEdge(faces, index, j)
    );
    return i === -1 ? null : i;
  };

  let drag = null;
  let extrusion = null;
  let markers = [];
  let arrows = [];
  let builtFor = '';

  const startPointEdit = (index) => {
    extrusion = null;
    const base = copyShape(shape());
    drag = { index, base, lastValid: base, display: base.points, mergeInto: null };
  };

  // Moves the edited point to a world position, or merges it into `into`.
  // A position that would break the shape leaves it at the last good one.
  const movePoint = (world, into) => {
    const { base, index } = drag;
    const merged = into === null ? null : mergePoints(base.points, base.faces, index, into);
    if (merged && !shapeError(merged.points, merged.faces)) {
      drag.mergeInto = into;
      drag.display = base.points.map((p, i) => (i === index ? base.points[into] : p));
      flock.setFreeformShape(mesh, merged.points, merged.faces);
      return;
    }
    const moved = base.points.map((p) => [...p]);
    moved[index] = roundPoint(toLocal(world));
    if (!shapeError(moved, base.faces, [index])) drag.lastValid = { points: moved, faces: base.faces };
    drag.mergeInto = null;
    drag.display = drag.lastValid.points;
    flock.setFreeformShape(mesh, drag.lastValid.points, drag.lastValid.faces);
  };

  const finishDrag = () => {
    if (!drag) return;
    const { index, mergeInto } = drag;
    drag = null;
    if (mesh.isDisposed() || block.disposed) return;
    commitShape(mesh, block);
    if (mergeInto !== null && api.selection?.kind === 'point' && api.selection.index === index) {
      api.select({ kind: 'point', index: mergeInto > index ? mergeInto - 1 : mergeInto });
    }
  };

  const api = {
    mesh,
    selection: null,
    onSelectionChange: null,
    pointNode: new BABYLON.TransformNode('freeformPointHandle', scene),

    select(selection) {
      const same =
        selection?.kind === this.selection?.kind && selection?.index === this.selection?.index;
      if (same) return;
      this.selection = selection;
      extrusion = null;
      if (selection?.kind === 'point') {
        this.pointNode.position.copyFrom(toWorld(shape().points[selection.index]));
      }
      this.onSelectionChange?.(selection);
    },

    // Gizmo drags of the selected point.
    beginPointDrag() {
      if (this.selection?.kind === 'point') startPointEdit(this.selection.index);
    },
    dragPointTo(world) {
      if (drag?.index !== this.selection?.index || mesh.isDisposed()) return;
      movePoint(world, coincidentNeighbour(drag.base, drag.index, roundPoint(toLocal(world))));
    },
    endPointDrag: () => finishDrag(),

    // One keyboard or button step, saved straight away.
    nudgePoint(dx, dy, dz) {
      if (this.selection?.kind !== 'point' || drag) return;
      const index = this.selection.index;
      startPointEdit(index);
      const world = toWorld(drag.base.points[index]).add(new BABYLON.Vector3(dx, dy, dz));
      movePoint(world, coincidentNeighbour(drag.base, index, roundPoint(toLocal(world))));
      finishDrag();
    },

    // Steps the selected face out or in. Repeated steps grow one extrusion
    // rather than stacking new ones; any other change starts a fresh one.
    extrudeSelected(step) {
      if (this.selection?.kind !== 'face' || drag) return;
      const { index: faceIndex } = this.selection;
      const current = JSON.stringify(shape());
      if (!extrusion || extrusion.faceIndex !== faceIndex || extrusion.applied !== current) {
        extrusion = { faceIndex, distance: 0, base: copyShape(shape()), applied: current };
      }
      const distance = roundToOneDecimal(extrusion.distance + step) + 0;
      const { base } = extrusion;
      const next =
        distance === 0 ? base : extrudeFace(base.points, base.faces, faceIndex, distance);
      if (shapeError(next.points, next.faces)) return;
      extrusion.distance = distance;
      flock.setFreeformShape(mesh, next.points, next.faces);
      commitShape(mesh, block);
      extrusion.applied = JSON.stringify(shape());
    },
  };

  const makeMarker = (index) => {
    const marker = BABYLON.MeshBuilder.CreateSphere(
      `freeformPoint${index}`,
      { diameter: 1, segments: 8 },
      handleScene
    );
    marker.material = pointMaterial;
    marker.metadata = { freeformHandle: { editor: api, selection: { kind: 'point', index } } };

    const behaviour = new BABYLON.PointerDragBehavior();
    behaviour.moveAttached = false;
    behaviour.updateDragPlane = false;
    marker.addBehavior(behaviour);

    let startWorld = null;
    let startPlanePoint = null;
    behaviour.onDragStartObservable.add((event) => {
      startPointEdit(index);
      startWorld = marker.position.clone();
      startPlanePoint = event.dragPlanePoint.clone();
    });
    behaviour.onDragObservable.add((event) => {
      if (drag?.index !== index || mesh.isDisposed()) return;
      const world = startWorld.add(event.dragPlanePoint.subtract(startPlanePoint));
      movePoint(world, pointerSnapTarget(drag.base, index));
    });
    behaviour.onDragEndObservable.add(finishDrag);
    return marker;
  };

  const makeArrow = (faceIndex) => {
    const arrow = BABYLON.MeshBuilder.CreateCylinder(
      `freeformExtrude${faceIndex}`,
      { diameterTop: 0, diameterBottom: 0.5, height: 1, tessellation: 12 },
      handleScene
    );
    arrow.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, 0.5, 0));
    arrow.material = arrowMaterial;
    arrow.rotationQuaternion = new BABYLON.Quaternion();
    arrow.metadata = {
      freeformHandle: { editor: api, selection: { kind: 'face', index: faceIndex } },
    };

    const behaviour = new BABYLON.PointerDragBehavior({ dragAxis: BABYLON.Vector3.Up() });
    behaviour.moveAttached = false;
    behaviour.updateDragPlane = false;
    arrow.addBehavior(behaviour);

    behaviour.onDragStartObservable.add(() => {
      extrusion = null;
      drag = { faceIndex, distance: 0, base: copyShape(shape()) };
    });
    behaviour.onDragObservable.add((event) => {
      if (drag?.faceIndex !== faceIndex || mesh.isDisposed()) return;
      drag.distance += event.dragDistance;
      const distance = roundToOneDecimal(drag.distance);
      const { base } = drag;
      if (distance === 0) {
        flock.setFreeformShape(mesh, base.points, base.faces);
        return;
      }
      const extruded = extrudeFace(base.points, base.faces, faceIndex, distance);
      const added = extruded.points.map((_, i) => i).slice(base.points.length);
      if (!shapeError(extruded.points, extruded.faces, added)) {
        flock.setFreeformShape(mesh, extruded.points, extruded.faces);
      }
    });
    behaviour.onDragEndObservable.add(finishDrag);
    return arrow;
  };

  const build = () => {
    [...markers, ...arrows].forEach((handle) => handle.dispose());
    const { points, faces } = shape();
    markers = points.map((_, index) => makeMarker(index));
    arrows = faces.map((_, faceIndex) => makeArrow(faceIndex));
    builtFor = `${points.length}/${faces.length}`;
    const { selection } = api;
    const count = selection?.kind === 'point' ? points.length : faces.length;
    if (selection && selection.index >= count) api.select(null);
  };

  const up = BABYLON.Vector3.Up();
  const syncObserver = scene.onBeforeRenderObservable.add(() => {
    if (mesh.isDisposed()) return;
    const { points, faces } = shape();
    if (!drag && builtFor !== `${points.length}/${faces.length}`) build();

    const world = mesh.computeWorldMatrix(true);
    const cameraPosition = scene.activeCamera?.globalPosition;
    if (!cameraPosition) return;
    const { selection } = api;

    // A point drag keeps the markers in their original order, even while a
    // merge preview has renumbered the shape's points.
    const merging = drag?.mergeInto != null;
    (drag?.display ?? points).forEach((point, index) => {
      const marker = markers[index];
      if (!marker) return;
      BABYLON.Vector3.TransformCoordinatesToRef(
        BABYLON.Vector3.FromArray(point),
        world,
        marker.position
      );
      const selected = selection?.kind === 'point' && selection.index === index;
      marker.material = selected ? selectedMaterial : pointMaterial;
      let grow = selected ? SELECTED_GROWTH : 1;
      if (merging && index === drag.mergeInto) grow = MERGE_TARGET_GROWTH;
      marker.scaling.setAll(
        BABYLON.Vector3.Distance(cameraPosition, marker.position) * POINT_SIZE_PER_DISTANCE * grow
      );
      // The gizmo moves the node itself while it drags.
      if (selected && !drag) api.pointNode.position.copyFrom(marker.position);
    });

    faces.forEach((face, faceIndex) => {
      const arrow = arrows[faceIndex];
      if (!arrow) return;
      const centre = BABYLON.Vector3.TransformCoordinates(
        BABYLON.Vector3.FromArray(faceCentre(points, face)),
        world
      );
      const normal = BABYLON.Vector3.TransformNormal(
        BABYLON.Vector3.FromArray(faceNormal(points, face)),
        world
      ).normalize();
      const selected = selection?.kind === 'face' && selection.index === faceIndex;
      const facing = BABYLON.Vector3.Dot(normal, cameraPosition.subtract(centre)) > 0;
      arrow.setEnabled(!merging && (facing || selected || drag?.faceIndex === faceIndex));
      arrow.material = selected ? selectedMaterial : arrowMaterial;
      const size = BABYLON.Vector3.Distance(cameraPosition, centre) * ARROW_SIZE_PER_DISTANCE;
      arrow.scaling.setAll(size);
      arrow.position = centre.add(normal.scale(size * 0.2));
      BABYLON.Quaternion.FromUnitVectorsToRef(up, normal, arrow.rotationQuaternion);
    });
  });

  meshEditors.set(mesh, api);

  return () => {
    scene.onBeforeRenderObservable.remove(syncObserver);
    finishDrag();
    api.select(null);
    meshEditors.delete(mesh);
    [...markers, ...arrows].forEach((handle) => handle.dispose());
    api.pointNode.dispose();
    pointMaterial.dispose();
    arrowMaterial.dispose();
    selectedMaterial.dispose();
  };
}

// Points, faces and Y go in together: the base moves when a bottom point
// does, and Y keeps the shape where it was edited.
function commitShape(mesh, block) {
  Blockly.Events.setGroup(true);
  try {
    block.writeShape(mesh.metadata.freeformPoints, mesh.metadata.freeformFaces);
    setNumberInputs(block, { Y: flock.getBlockPositionFromMesh(mesh).y });
  } finally {
    Blockly.Events.setGroup(false);
  }
}
