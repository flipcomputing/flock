import { TEXTURE_TILE_SIZE } from '../config.js';
import { isHeightDirection } from './material.js';
import {
  isBodyAlive,
  movePendingBody,
  releaseShape,
  restoreRestingState,
  shareShape,
  teleportBodyToMesh,
} from './physics.js';

let flock;

const LINK_EPSILON = 1e-4;
const LINK_PROPERTY_KEYS = {
  position: ['position.x', 'position.y', 'position.z'],
  size: ['size.x', 'size.y', 'size.z'],
  rotation: ['rotation'],
  colour: ['colour'],
};
const LOOK_CATEGORIES = new Set(['colour', 'material', 'alpha', 'effects']);
const linkOf = new WeakMap();
const linkedCopiesOf = new WeakMap();
const replayingConstruction = new WeakSet();
let linkSync = null;

const isInstance = (node) => node?.getClassName?.() === 'InstancedMesh';

function instantiateClone(source, name) {
  const visit = (from, parent) => {
    const nodeName = parent ? `${parent.name}.${from.name}` : name;
    let node;
    if (isInstance(from)) {
      node = from.sourceMesh.createInstance(nodeName);
    } else if (from instanceof flock.BABYLON.Mesh && from.getTotalVertices() > 0) {
      node = from.createInstance(nodeName);
    } else {
      node = from.clone(nodeName, parent ?? from.parent, true);
    }
    if (isInstance(node)) {
      const source = node.sourceMesh;
      node.onDisposeObservable.addOnce(() => releaseDeletedOriginal(source));
    }
    node.parent = parent ?? from.parent;
    copyPlacement(from, node);
    node.id = node.name;
    node.metadata = from.metadata;
    if (from instanceof flock.BABYLON.AbstractMesh) node.isVisible = from.isVisible;
    for (const child of from.getChildTransformNodes(true)) visit(child, node);
    return node;
  };
  return visit(source, null);
}

function lookTarget(mesh) {
  return mesh?.getChildMeshes?.(true).find((child) => child.metadata?.lookVisual) ?? mesh;
}

function disposeClonedBodies(node) {
  flock.scene
    .getPhysicsEngine?.()
    ?.getBodies?.()
    .filter((body) => body.transformNode === node)
    .forEach((body) => body.dispose());
  node.physics = null;
}

function moveBody(from, to) {
  movePendingBody(from, to);
  if (!isBodyAlive(from.physics)) return;
  const body = from.physics.clone(to);
  shareShape(from.physics.shape);
  body.setLinearVelocity(from.physics.getLinearVelocity());
  body.setAngularVelocity(from.physics.getAngularVelocity());
  to.physics = body;
  releaseShape(from.physics.shape);
  from.physics.dispose();
  from.physics = null;
}

function copyPlacement(from, to) {
  to.position.copyFrom(from.position);
  to.scaling.copyFrom(from.scaling);
  if (from.rotationQuaternion) to.rotationQuaternion = from.rotationQuaternion.clone();
  else {
    to.rotationQuaternion = null;
    to.rotation.copyFrom(from.rotation);
  }
}

function replaceInstance(instance) {
  const look = instance.getChildMeshes(true).find((child) => child.metadata?.lookVisual);
  const template = look ? (isInstance(look) ? look.sourceMesh : look) : instance.sourceMesh;
  const mesh = template.clone(instance.name, instance.parent, true);
  mesh.parent = instance.parent;
  disposeClonedBodies(mesh);
  mesh.id = instance.id;
  mesh.metadata = instance.metadata;
  mesh.isVisible = look ? true : instance.isVisible;
  mesh.isPickable = instance.isPickable;
  mesh.setEnabled(flock._isShown(instance));
  copyPlacement(instance, mesh);
  if (flock.shadowCasters?.has(instance.sourceMesh)) {
    flock.shadowCasters.add(mesh);
    flock.shadowGenerator?.addShadowCaster(mesh);
  }
  for (const child of instance.getChildren(undefined, true)) {
    if (child !== look) child.parent = mesh;
  }
  moveBody(instance, mesh);
  if (instance._awaitingDo) flock.releaseBody(mesh);
  if (instance.actionManager) {
    mesh.actionManager = instance.actionManager;
    instance.actionManager = null;
  }
  look?.dispose();
  instance.dispose(true);
  return mesh;
}

function addLookChild(root) {
  const look = root.sourceMesh.clone(`${root.name}.look`, root, true);
  disposeClonedBodies(look);
  look.position.setAll(0);
  look.rotationQuaternion = null;
  look.rotation.setAll(0);
  look.scaling.setAll(1);
  look.isVisible = true;
  look.isPickable = root.isPickable;
  look.metadata = { ...root.metadata, lookVisual: true };
  delete look.metadata.blockKey;
  delete look.metadata.tags;
  delete look.metadata.cloneOf;
  if (flock.shadowCasters?.has(root.sourceMesh)) {
    flock.shadowCasters.add(look);
    flock.shadowGenerator?.addShadowCaster(look);
  }
  root.isVisible = false;
  root.actionManager ??= new flock.BABYLON.ActionManager(flock.scene);
  root.actionManager.isRecursive = true;
  return look;
}

function drawsItself(instance) {
  return (
    instance.isVisible &&
    instance.sourceMesh.visibility > 0 &&
    !!instance.sourceMesh.material &&
    instance.metadata?.shapeType !== 'Group'
  );
}

function realiseHierarchy(root, { keepRoot }) {
  let result = root;
  const visit = (node) => {
    let current = node;
    if (isInstance(node)) {
      if (node !== root || !keepRoot) {
        current = replaceInstance(node);
        if (node === root) result = current;
      } else if (drawsItself(node) && lookTarget(node) === node) {
        addLookChild(node);
      }
    }
    for (const child of current.getChildren(undefined, true)) visit(child);
  };
  visit(root);
  return result;
}

const originalNameOf = (node) => node.metadata?.originalNodeName ?? node.name;

function copyLook(from, to) {
  const sources = new Map();
  for (const node of from.getDescendants(false)) {
    if (!node.metadata?.lookVisual) sources.set(originalNameOf(node), node);
  }
  const pairs = [[lookTarget(from), lookTarget(to)]];
  for (const node of to.getDescendants(false)) {
    const match = !node.metadata?.lookVisual && sources.get(originalNameOf(node));
    if (match) pairs.push([match, node]);
  }
  for (const [source, target] of pairs) {
    if (isInstance(target) || !source.material || source === target) continue;
    target.material = source.material;
    target.renderOverlay = source.renderOverlay;
    target.overlayColor = source.overlayColor?.clone?.() ?? target.overlayColor;
    target.overlayAlpha = source.overlayAlpha;
    target.metadata = { ...target.metadata, glow: source.metadata?.glow };
    if (source.metadata?.glowColor) target.metadata.glowColor = source.metadata.glowColor;
  }
}

function realise(copy) {
  const link = linkOf.get(copy);
  if (!link || link.realised) return;
  link.realised = true;
  realiseHierarchy(copy, { keepRoot: true });
  copyLook(link.source, copy);
  unlinkFromTemplate(copy);
  for (const follower of linkedCopiesOf.get(copy) ?? []) {
    if (!follower.isDisposed()) realise(follower);
  }
}

function rebindSkeletons(root) {
  const nodes = new Map();
  for (const node of root.getDescendants(false)) {
    const key = node.metadata?.originalNodeName;
    if (key && !nodes.has(key)) nodes.set(key, node);
  }
  const skeletons = new Map();
  for (const part of [root, ...root.getChildMeshes(false)]) {
    const original = part.skeleton;
    if (!original || isInstance(part)) continue;
    let skeleton = skeletons.get(original);
    if (!skeleton) {
      skeleton = original.clone(`${original.name}_${root.uniqueId}`);
      skeleton.bones.forEach((bone, i) => {
        const node = original.bones[i].getTransformNode();
        const own = node && nodes.get(originalNameOf(node));
        if (own) bone.linkTransformNode(own);
      });
      part.onDisposeObservable.addOnce(() => skeleton.dispose());
      skeletons.set(original, skeleton);
    }
    part.skeleton = skeleton;
  }
}

function ownSkeleton(copy) {
  const link = linkOf.get(copy);
  if (!link || link.ownSkeleton) return;
  realise(copy);
  link.ownSkeleton = true;
  rebindSkeletons(copy);
  for (const follower of linkedCopiesOf.get(copy) ?? []) {
    if (!follower.isDisposed()) ownSkeleton(follower);
  }
}

const ANIMATION_STATE = new Set([
  'animationGroups',
  'embeddedAnimationGroups',
  'currentAnimationName',
  'requestedAnimationName',
  'requestCounter',
  '_activeGlide',
  '_activeRotate',
  '_glideTicket',
]);

function clearAnimationState(node) {
  for (const key of Object.keys(node.metadata ?? {})) {
    if (ANIMATION_STATE.has(key) || key.startsWith('_activeAnim_')) delete node.metadata[key];
  }
  node._currentAnimGroup = null;
  node._activeBlend = null;
}

function followAxes(link, kind, current, target, last) {
  let changed = false;
  for (const axis of ['x', 'y', 'z']) {
    const key = `${kind}.${axis}`;
    if (link.overrides.has(key)) continue;
    if (Math.abs(current[axis] - last[axis]) > LINK_EPSILON) {
      link.overrides.add(key);
    } else if (current[axis] !== target[axis]) {
      current[axis] = target[axis];
      changed = true;
    }
  }
  return changed;
}

function absoluteRotation(node, result) {
  node.computeWorldMatrix(true);
  node.getWorldMatrix().decompose(undefined, result);
  return result;
}

function sameRotation(a, b) {
  return Math.abs(flock.BABYLON.Quaternion.Dot(a, b)) > 1 - LINK_EPSILON * LINK_EPSILON;
}

function setAbsoluteRotation(node, rotation) {
  const local = node.parent
    ? flock.BABYLON.Quaternion.Inverse(
        absoluteRotation(node.parent, new flock.BABYLON.Quaternion())
      ).multiply(rotation)
    : rotation.clone();
  if (node.rotationQuaternion) node.rotationQuaternion.copyFrom(local);
  else node.rotationQuaternion = local;
  node.computeWorldMatrix(true);
}

function snapshotLink(copy, link) {
  link.scaling.copyFrom(copy.scaling);
  absoluteRotation(copy, link.rotation);
  link.position.copyFrom(copy.getAbsolutePosition());
  link.shown = flock._isShown(copy);
}

const LOCAL_STATE_SIZE = 12;

function recordLocalState(node, state) {
  const p = node.position;
  const s = node.scaling;
  const q = node.rotationQuaternion;
  const r = q ?? node.rotation;
  const w = q ? q.w : 0;
  const mode = q ? 1 : 0;
  const pivot = node.getPivotMatrix().updateFlag;
  if (
    state[0] === p.x &&
    state[1] === p.y &&
    state[2] === p.z &&
    state[3] === s.x &&
    state[4] === s.y &&
    state[5] === s.z &&
    state[6] === r.x &&
    state[7] === r.y &&
    state[8] === r.z &&
    state[9] === w &&
    state[10] === mode &&
    state[11] === pivot
  ) {
    return false;
  }
  state[0] = p.x;
  state[1] = p.y;
  state[2] = p.z;
  state[3] = s.x;
  state[4] = s.y;
  state[5] = s.z;
  state[6] = r.x;
  state[7] = r.y;
  state[8] = r.z;
  state[9] = w;
  state[10] = mode;
  state[11] = pivot;
  return true;
}

function linkUnchanged(link, copy, source) {
  if (copy.parent || source.parent) return false;
  link.localState ??= {
    copy: new Float64Array(LOCAL_STATE_SIZE).fill(NaN),
    source: new Float64Array(LOCAL_STATE_SIZE).fill(NaN),
  };
  const copyChanged = recordLocalState(copy, link.localState.copy);
  const sourceChanged = recordLocalState(source, link.localState.source);
  return !copyChanged && !sourceChanged;
}

function syncLinkedVisibility(link, copy, source) {
  const shown = flock._isShown(copy);
  if (link.overrides.has('visible')) {
    link.shown = shown;
  } else if (shown !== link.shown) {
    link.overrides.add('visible');
    link.shown = shown;
  } else if (shown !== flock._isShown(source)) {
    flock._setShown(copy, !shown);
    link.shown = flock._isShown(copy);
  }
}

function syncLinkedCopy(copy) {
  const link = linkOf.get(copy);
  const source = link?.source;
  if (!source || source.isDisposed() || copy.isDisposed()) return;

  if (linkUnchanged(link, copy, source)) {
    syncLinkedVisibility(link, copy, source);
    return;
  }

  const scaling = linkSync.scaling.copyFrom(copy.scaling);
  if (followAxes(link, 'size', scaling, source.scaling, link.scaling)) {
    copy.scaling.copyFrom(scaling);
    flock.retileTextures(copy);
    flock.updatePhysics(copy);
  }
  link.scaling.copyFrom(copy.scaling);

  if (!link.overrides.has('rotation')) {
    const rotation = absoluteRotation(copy, linkSync.rotation);
    if (!sameRotation(rotation, link.rotation)) {
      link.overrides.add('rotation');
    } else {
      const target = absoluteRotation(source, linkSync.sourceRotation);
      if (!sameRotation(rotation, target)) {
        setAbsoluteRotation(copy, target);
        teleportBodyToMesh(copy);
      }
    }
  }
  absoluteRotation(copy, link.rotation);

  source.computeWorldMatrix(true);
  copy.computeWorldMatrix(true);
  const position = linkSync.position.copyFrom(copy.getAbsolutePosition());
  if (followAxes(link, 'position', position, source.getAbsolutePosition(), link.position)) {
    copy.setAbsolutePosition(position);
    copy.computeWorldMatrix(true);
    teleportBodyToMesh(copy);
  }
  link.position.copyFrom(copy.getAbsolutePosition());

  syncLinkedVisibility(link, copy, source);
  if (link.localState) recordLocalState(copy, link.localState.copy);
}

function linkClone(source, copy) {
  source.computeWorldMatrix(true);
  copy.computeWorldMatrix(true);
  const position = copy.getAbsolutePosition().clone();
  const sourcePosition = source.getAbsolutePosition();
  const overrides = new Set();
  for (const axis of ['x', 'y', 'z']) {
    if (Math.abs(position[axis] - sourcePosition[axis]) > LINK_EPSILON) {
      overrides.add(`position.${axis}`);
    }
    if (Math.abs(copy.scaling[axis] - source.scaling[axis]) > LINK_EPSILON) {
      overrides.add(`size.${axis}`);
    }
  }
  const rotation = absoluteRotation(copy, new flock.BABYLON.Quaternion());
  if (!sameRotation(rotation, absoluteRotation(source, new flock.BABYLON.Quaternion()))) {
    overrides.add('rotation');
  }
  if (flock._isShown(copy) !== flock._isShown(source)) overrides.add('visible');

  linkOf.set(copy, {
    source,
    overrides,
    position,
    scaling: copy.scaling.clone(),
    rotation,
    shown: flock._isShown(copy),
  });

  let siblings = linkedCopiesOf.get(source);
  if (!siblings) linkedCopiesOf.set(source, (siblings = new Set()));
  siblings.add(copy);

  if (linkSync?.scene !== flock.scene) {
    const scene = flock.scene;
    const copies = new Set();
    linkSync = {
      scene,
      copies,
      position: new flock.BABYLON.Vector3(),
      scaling: new flock.BABYLON.Vector3(),
      rotation: new flock.BABYLON.Quaternion(),
      sourceRotation: new flock.BABYLON.Quaternion(),
    };
    scene.onBeforeRenderObservable.add(() => copies.forEach(syncLinkedCopy));
    scene.onDisposeObservable.addOnce(() => {
      if (linkSync?.scene === scene) linkSync = null;
    });
  }
  const synced = linkSync.copies;
  synced.add(copy);
  copy.onDisposeObservable.addOnce(() => {
    synced.delete(copy);
    siblings.delete(copy);
    releaseDeletedOriginal(linkOf.get(copy)?.source ?? source);
  });
}

const TEMPLATE_OVERRIDES = [
  ...LINK_PROPERTY_KEYS.position,
  ...LINK_PROPERTY_KEYS.size,
  ...LINK_PROPERTY_KEYS.rotation,
  'visible',
];

function linkToTemplate(template, copy) {
  linkOf.set(copy, {
    source: template,
    template: true,
    overrides: new Set(TEMPLATE_OVERRIDES),
    position: copy.getAbsolutePosition().clone(),
    scaling: copy.scaling.clone(),
    rotation: absoluteRotation(copy, new flock.BABYLON.Quaternion()),
    shown: flock._isShown(copy),
  });
  let siblings = linkedCopiesOf.get(template);
  if (!siblings) linkedCopiesOf.set(template, (siblings = new Set()));
  siblings.add(copy);
  copy.onDisposeObservable.addOnce(() => unlinkFromTemplate(copy));
}

function unlinkFromTemplate(copy) {
  const link = linkOf.get(copy);
  if (!link?.template) return;
  linkOf.delete(copy);
  const template = link.source;
  const siblings = linkedCopiesOf.get(template);
  siblings?.delete(copy);
  if (siblings?.size) return;
  queueMicrotask(() => {
    if (template.isDisposed() || linkedCopiesOf.get(template)?.size) return;
    if (hierarchyOf(template).some((node) => node.instances?.length)) return;
    linkedCopiesOf.delete(template);
    flock.disposeMesh(template);
  });
}

const hierarchyOf = (mesh) => [mesh, ...(mesh.getDescendants?.(false) ?? [])];

function stillUsed(node) {
  if (node.instances?.length) return true;
  for (const follower of linkedCopiesOf.get(node) ?? []) {
    if (!follower.isDisposed()) return true;
  }
  return false;
}

function disposeBody(node) {
  const md = node.metadata;
  if (md?.uprightConstraint) {
    try {
      md.uprightConstraint.dispose();
    } catch (e) {
      console.warn('Error disposing constraint:', e);
    }
    md.uprightConstraint = null;
  }
  if (node._postPhysicsUpkeep) {
    flock.scene.onAfterPhysicsObservable.remove(node._postPhysicsUpkeep);
    node._postPhysicsUpkeep = null;
  }
  if (node.physics) {
    releaseShape(node.physics.shape);
    node.physics.dispose();
  }
}

function keepDeletedOriginal(mesh) {
  const nodes = hierarchyOf(mesh);
  flock.scene.stopAnimation(mesh);
  mesh.setParent(null);
  mesh.name = mesh.id = `${mesh.name}.deleted.${mesh.uniqueId}`;
  for (const node of nodes) {
    node.metadata = { ...node.metadata, deletedOriginal: true };
    delete node.metadata.blockKey;
    delete node.metadata.tags;
    node.metadata.currentSound?.stop();
    node._deletedOriginal = mesh;
    disposeBody(node);
    node.physics = null;
    delete node._pendingBody;
    node.actionManager?.dispose();
    node.actionManager = null;
    if (node instanceof flock.BABYLON.AbstractMesh) {
      node.isVisible = false;
      node.isPickable = false;
    }
  }
  for (const [name, cached] of flock._liveNameCache ?? []) {
    if (nodes.includes(cached)) flock._liveNameCache.delete(name);
  }
}

function releaseDeletedOriginal(node) {
  const original = node?._deletedOriginal;
  if (!original || original.isDisposed()) return;
  queueMicrotask(() => {
    if (!original.isDisposed() && !hierarchyOf(original).some(stillUsed)) {
      flock.disposeMesh(original);
    }
  });
}

function cloneBody(source, target) {
  if (!isBodyAlive(source.physics)) {
    target._pendingBodyStale = true;
    source._bodyRecipe?.(target);
    return;
  }
  target.physics = source.physics.clone(target);
  restoreRestingState(source, target.physics);
  shareShape(source.physics.shape);
}

// Babylon's clone gives every cloned node a copy of its source's body and
// also copies the source's `physics` reference, so a node can end up with
// several bodies syncing it (one cloned mid-glide pins it in place). Replace
// them with one pending body per node, cloned from its source in its resting
// state once built.
function clonePhysicsHierarchy(sourceMesh, clone) {
  // Babylon names a cloned child "<parent clone name>.<source name>".
  const sourceName = (node) => (node === clone ? '' : node.name.slice(node.parent.name.length + 1));
  const pathOf = (node, root, nameOf) => {
    const path = [];
    for (let n = node; n && n !== root; n = n.parent) path.unshift(nameOf(n));
    return path.join('/');
  };
  const sourceByPath = new Map(
    [sourceMesh, ...sourceMesh.getDescendants(false)].map((node) => [
      pathOf(node, sourceMesh, (n) => n.name),
      node,
    ])
  );
  const cloneNodes = [clone, ...clone.getDescendants(false)];
  const cloneSet = new Set(cloneNodes);
  flock.scene
    .getPhysicsEngine?.()
    ?.getBodies?.()
    .filter((body) => cloneSet.has(body.transformNode))
    .forEach((body) => body.dispose());

  for (const node of cloneNodes) {
    node.physics = null;
    const source = sourceByPath.get(pathOf(node, clone, sourceName));
    if (!source) continue;
    const pending = !source.physics && source._pendingBody;
    if (!isBodyAlive(source.physics) && !pending && !source._bodyRecipe) continue;
    if (source._bodyRecipe) node._bodyRecipe = source._bodyRecipe;
    node._pendingBody = pending || ((target) => cloneBody(source, target));
    if (pending && source._pendingBodyStale) node._pendingBodyStale = true;
  }
  return cloneNodes;
}

const sceneReady = () => !!(flock && flock.scene && flock.BABYLON);

export function setFlockReference(ref) {
  flock = ref;
}

// Two sky stops become a shaped multi-stop ramp for the clamped texture
// machinery: the blend eases across the visible band (cosine, flat at both
// ends so there is no seam) and the top colour holds to the zenith. Ramp
// values stay literal colours, so unlike Babylon's GradientMaterial mix
// factor (unclamped above 1) this can never overshoot past either stop.
function skyTwoStopRamp(bottom, top) {
  const stops = 17;
  const lo = 0.42;
  const hi = 0.75;
  const c0 = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(bottom));
  const c1 = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(top));
  const ramp = [];
  for (let i = 0; i < stops; i++) {
    const t = i / (stops - 1);
    const u = Math.min(1, Math.max(0, (t - lo) / (hi - lo)));
    const e = (1 - Math.cos(u * Math.PI)) / 2;
    ramp.push(c0.scale(1 - e).add(c1.scale(e)).toHexString());
  }
  return ramp;
}

export const flockScene = {
  /*
   Category: Scene
  */
  // The sky is a mesh, so the clear colour is what shows until its material is
  // ready to draw. Matching the middle of the ramp keeps that gap from flashing
  // the scene default; an average of every stop could land on a colour the sky
  // never shows.
  matchClearColorToSky(colors) {
    if (!sceneReady()) return;
    const list = (Array.isArray(colors) ? colors : [colors]).filter(Boolean);
    if (!list.length) return;

    const toColor3 = (c) =>
      c instanceof flock.BABYLON.Color3
        ? c
        : flock.BABYLON.Color3.FromHexString(flock.getColorFromString(c));

    // Cloned, so a colour read off a material can't be mutated through the scene.
    const middle = list.length / 2;
    flock.scene.clearColor =
      list.length % 2
        ? toColor3(list[(list.length - 1) / 2]).clone()
        : toColor3(list[middle - 1])
            .add(toColor3(list[middle]))
            .scale(0.5);
  },
  setSky(input, options = {}) {
    if (!sceneReady()) return;

    let color = input;

    // The gradient colour block hands over a descriptor. Unwrap to its colours
    // before the material conversion below, so the sky builds its own gradient
    // sized to the sky sphere; the sky only does bottom to top, so the
    // direction is ignored.
    if (color && typeof color === 'object' && !Array.isArray(color) && Array.isArray(color.color)) {
      // Only for an untextured descriptor: with a texture the colour list means
      // palette replacement, which the material conversion has to handle.
      const texName = color.materialName || color.textureSet || 'none.png';
      if (texName === 'none.png') color = color.color;
    }

    // Convert object input to a material (handles texture + colors)
    if (
      color &&
      typeof color === 'object' &&
      !(color instanceof flock.BABYLON.Material) &&
      !Array.isArray(color)
    ) {
      const scale = Number(color.scale);
      color = flock.createMaterial(color);
      if (Number.isFinite(scale) && scale > 0 && scale !== 1) {
        color.metadata = { ...color.metadata, textureScale: scale };
      }
    }

    if (!color) return;

    const { clear = false, flipV = true } = options;

    if (flock.sky) {
      flock.disposeMesh(flock.sky);
      flock.sky = null;
    }

    if (clear === true) {
      const c3 = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color));
      flock.scene.clearColor = c3;
      return;
    }

    const createSkySphere = () => {
      const s = flock.BABYLON.MeshBuilder.CreateSphere(
        'sky',
        {
          segments: 32,
          diameter: 1000,
          sideOrientation: flock.BABYLON.Mesh.BACKSIDE,
        },
        flock.scene
      );
      s.infiniteDistance = true;
      s.isPickable = false;
      s.applyFog = false;
      return s;
    };

    if (color && color instanceof flock.BABYLON.Material) {
      const skySphere = createSkySphere();
      flock.sky = skySphere;
      if (flock.glowLayer) flock.glowLayer.addExcludedMesh(flock.sky);

      const isShader = typeof color.setFloat === 'function';
      const tex = flock.materialTexture(color);

      if (tex || isShader) {
        const scaleValue = 10 / (color.metadata?.textureScale ?? 1);
        const verticalScale = flipV ? -scaleValue : scaleValue;

        if (tex) {
          tex.uScale = scaleValue;
          tex.vScale = verticalScale;
        }

        if (isShader) {
          color.setFloat('uScale', scaleValue);
          color.setFloat('vScale', verticalScale);
        }
      }

      color.backFaceCulling = false;
      skySphere.material = color;
      flock.matchClearColorToSky(
        color.metadata?.gradientColors ??
          color.diffuseColor ??
          color.albedoColor ??
          color.emissiveColor
      );
      return;
    }

    if (Array.isArray(color) && color.length === 1) color = color[0];

    if (Array.isArray(color) && color.length >= 2) {
      const skySphere = createSkySphere();
      flock.sky = skySphere;
      if (flock.glowLayer) flock.glowLayer.addExcludedMesh(flock.sky);

      // Two stops expand to a shaped ramp through the same clamped texture
      // machinery as longer ramps; the clear colour still comes from the
      // original pair.
      const ramp = color.length === 2 ? skyTwoStopRamp(color[0], color[1]) : color;
      // Colours come through the lit diffuse, so an unlit sky needs a white
      // emissive or the lighting term multiplies it to black.
      const mat = flock.createGradientMaterial('skyGradient', ramp);
      mat.backFaceCulling = false;
      mat.disableLighting = true;
      mat.emissiveColor = flock.BABYLON.Color3.White();
      skySphere.material = mat;
      flock.matchClearColorToSky(color);
      return;
    }

    if (typeof color === 'string') {
      const c3 = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color));
      const skySphere = createSkySphere();
      flock.sky = skySphere;
      if (flock.glowLayer) flock.glowLayer.addExcludedMesh(flock.sky);

      const skyMat = new flock.BABYLON.StandardMaterial('skyMaterial', flock.scene);
      skyMat.backFaceCulling = false;
      skyMat.disableLighting = false;
      skyMat.emissiveColor = c3.scale(0.3);
      skyMat.diffuseColor = c3;
      skyMat.ambientColor = c3.scale(0.1);
      skyMat.fogEnabled = false;

      skySphere.material = skyMat;
      flock.matchClearColorToSky(c3);
      return;
    }

    flock.scene.clearColor = new flock.BABYLON.Color3(0, 0, 0);
  },
  createLinearGradientTexture(colors, opts = {}) {
    if (!sceneReady()) {
      return null;
    }

    const size = opts.size || 512; // texture width
    const horizontal = !!opts.horizontal; // false => vertical along V, true => along U

    const dt = new flock.BABYLON.DynamicTexture(
      'groundGradientDT',
      { width: horizontal ? size : 1, height: horizontal ? 1 : size },
      flock.scene,
      false
    );
    const ctx = dt.getContext();
    const w = dt.getSize().width;
    const h = dt.getSize().height;

    // Build canvas gradient
    const grad = horizontal
      ? ctx.createLinearGradient(0, 0, w, 0)
      : ctx.createLinearGradient(0, 0, 0, h);
    const normalizedColors = colors.length === 1 ? [colors[0], colors[0]] : colors;
    const n = normalizedColors.length;
    for (let i = 0; i < n; i++) {
      const stop = i / (n - 1);
      const hex = flock.getColorFromString(normalizedColors[i]);
      const c3 = flock.BABYLON.Color3.FromHexString(hex);
      const rgb = `rgb(${Math.round(c3.r * 255)}, ${Math.round(c3.g * 255)}, ${Math.round(c3.b * 255)})`;
      if (opts.bands) {
        grad.addColorStop(i / n, rgb);
        grad.addColorStop((i + 1) / n, rgb);
      } else {
        grad.addColorStop(stop, rgb);
      }
    }

    if (horizontal) {
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, 1);
    } else {
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1, h);
    }
    dt.update(false);

    return dt;
  },
  createMap(image, material) {
    if (!sceneReady() || !material) return;

    const mapTexturePhysicalSize = TEXTURE_TILE_SIZE;

    const biasGroundDepth = (groundMat) => {
      groundMat.zOffset = 1;
      groundMat.zOffsetUnits = 4;
    };

    const applyMaterialToGround = (mesh, mat) => {
      if (Array.isArray(mat) && mat.length === 1) mat = mat[0];

      // Resolve a color list from either a plain array or a material object with
      // none.png texture and an array of colors.
      const colorList =
        Array.isArray(mat) && mat.length >= 2
          ? mat
          : mat &&
              typeof mat === 'object' &&
              Array.isArray(mat.color) &&
              mat.color.length >= 2 &&
              (mat.materialName === 'none.png' || !mat.materialName) &&
              !isHeightDirection(mat.direction) &&
              !(Number(mat.noise) > 0)
            ? mat.color
            : null;

      if (colorList) {
        // Normalise UVs to 0–1 so the gradient texture fills the mesh
        // regardless of whether UVs were previously scaled for tiling.
        const positions = mesh.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
        if (positions) {
          const { minimum, maximum } = mesh.getBoundingInfo();
          const turn =
            Array.isArray(mat) || !mat
              ? 0
              : (((Number(mat.direction) || 0) + (Number(mat.angle) || 0)) * Math.PI) / 180;
          const axisX = Math.sin(turn);
          const axisZ = Math.cos(turn);
          let low = Infinity;
          let high = -Infinity;
          for (const x of [minimum.x, maximum.x]) {
            for (const z of [minimum.z, maximum.z]) {
              const projected = x * axisX + z * axisZ;
              low = Math.min(low, projected);
              high = Math.max(high, projected);
            }
          }
          const span = high - low || 1;
          const uvs = new Float32Array((positions.length / 3) * 2);
          for (let i = 0, ui = 0; i < positions.length; i += 3, ui += 2) {
            uvs[ui] = 0.5;
            uvs[ui + 1] = (positions[i] * axisX + positions[i + 2] * axisZ - low) / span;
          }
          mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
        }

        const oldMat = mesh.material;
        const standardMat = new flock.BABYLON.StandardMaterial('mapGradientMat', flock.scene);
        const dt = flock.createLinearGradientTexture(colorList, {
          size: 1024,
          horizontal: false,
          bands: mat?.bands === true,
        });
        standardMat.diffuseTexture = dt;
        if (mat && typeof mat === 'object' && mat.alpha !== undefined) {
          const parsedAlpha = parseFloat(mat.alpha);
          if (Number.isFinite(parsedAlpha)) standardMat.alpha = parsedAlpha;
        }
        standardMat.specularColor = new flock.BABYLON.Color3(0, 0, 0);
        standardMat.diffuseTexture.wrapU = flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
        standardMat.diffuseTexture.wrapV = flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
        biasGroundDepth(standardMat);
        mesh.material = standardMat;
        flock.disposeOldMaterial(oldMat, [mesh]);
      } else {
        // Re-scale UVs for tiled textures in case they were previously
        // normalised for a gradient (switching back from gradient to texture).
        const needsTiling = !mat?.metadata?.gradientColors;
        if (needsTiling) {
          const positions = mesh.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
          if (positions) {
            const { minimum } = mesh.getBoundingInfo();
            const uvs = new Float32Array((positions.length / 3) * 2);
            for (let i = 0, ui = 0; i < positions.length; i += 3, ui += 2) {
              uvs[ui] = (positions[i] - minimum.x) / mapTexturePhysicalSize;
              uvs[ui + 1] = (positions[i + 2] - minimum.z) / mapTexturePhysicalSize;
            }
            mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
          }
        }
        const oldMat = mesh.material;
        const groundMat = flock.getOrCreateMaterial(mat, oldMat?.alpha ?? 1, { cached: false });
        biasGroundDepth(groundMat);
        mesh.material = groundMat;
        flock.disposeOldMaterial(oldMat, [mesh]);
      }
    };

    if (flock.ground && flock.ground.metadata?.heightMapImage === image) {
      applyMaterialToGround(flock.ground, material);
      return;
    }

    if (flock.ground) {
      flock.disposeMesh(flock.ground);
    }

    const scaleGroundUVs = (mesh) => {
      const positions = mesh.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
      if (!positions) return;
      const { minimum } = mesh.getBoundingInfo();
      const uvs = new Float32Array((positions.length / 3) * 2);
      for (let i = 0, ui = 0; i < positions.length; i += 3, ui += 2) {
        uvs[ui] = (positions[i] - minimum.x) / mapTexturePhysicalSize;
        uvs[ui + 1] = (positions[i + 2] - minimum.z) / mapTexturePhysicalSize;
      }
      mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
    };

    const isMaterialColorList =
      material &&
      typeof material === 'object' &&
      !Array.isArray(material) &&
      Array.isArray(material.color) &&
      material.color.length >= 2 &&
      (material.materialName === 'none.png' || !material.materialName) &&
      !isHeightDirection(material.direction) &&
      !(Number(material.noise) > 0);
    const shouldScaleUVs =
      !(Array.isArray(material) && material.length >= 2) &&
      !isMaterialColorList &&
      !material?.metadata?.gradientColors;

    let ground;
    if (image === 'NONE') {
      ground = flock.BABYLON.MeshBuilder.CreateGround(
        'ground',
        { width: 100, height: 100, subdivisions: 2 },
        flock.scene
      );
      ground.isPickable = true;
      ground.physics = new flock.BABYLON.PhysicsAggregate(
        ground,
        flock.BABYLON.PhysicsShapeType.BOX,
        { mass: 0, friction: 0.5 },
        flock.scene
      );
      ground.metadata = {
        blockKey: 'ground',
        skipAutoTiling: true,
        textureTileSize: mapTexturePhysicalSize,
        heightMapImage: 'NONE',
      };
      // Same helper as the heightmap ground below, so both behave identically.
      // Defaults to 0; set ground.metadata.bounciness first to give it a bounce.
      flock.applyBounciness(ground.physics.body, ground);
      ground.receiveShadows = true;
      if (shouldScaleUVs) scaleGroundUVs(ground);
      applyMaterialToGround(ground, material);
      flock.ground = ground;
    } else {
      ground = flock.BABYLON.MeshBuilder.CreateGroundFromHeightMap(
        'ground',
        flock.texturePath + image,
        {
          width: 100,
          height: 100,
          minHeight: 0,
          maxHeight: 10,
          subdivisions: 64,
          onReady: (gm) => {
            if (flock.ground !== gm) {
              gm.dispose();
              return;
            }
            gm.metadata = {
              blockKey: 'ground',
              skipAutoTiling: true,
              textureTileSize: mapTexturePhysicalSize,
              heightMapImage: image,
            };
            gm.isPickable = true;
            const vertexData = gm.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
            let minDistance = Infinity;
            let closestY = 0;
            for (let i = 0; i < vertexData.length; i += 3) {
              const dist = Math.sqrt(vertexData[i] ** 2 + vertexData[i + 2] ** 2);
              if (dist < minDistance) {
                minDistance = dist;
                closestY = vertexData[i + 1];
              }
            }
            gm.position.y -= closestY;
            const body = new flock.BABYLON.PhysicsBody(
              gm,
              flock.BABYLON.PhysicsMotionType.STATIC,
              false,
              flock.scene
            );
            body.shape = new flock.BABYLON.PhysicsShapeMesh(gm, flock.scene);
            flock.applyBounciness(body, gm);
            gm.physics = body;
            gm.physicsShape = body.shape;
            body.disablePreStep = false;
            if (shouldScaleUVs) scaleGroundUVs(gm);
            applyMaterialToGround(gm, material);
          },
        },
        flock.scene
      );
      flock.ground = ground;
    }
  },
  getGroundLevelAt(x = 0, z = 0, { rayStartY = 1000, rayLength = 5000 } = {}) {
    if (!sceneReady()) return 0;

    const groundMesh = flock.ground;
    if (!groundMesh) return 0;

    const rayOrigin = new flock.BABYLON.Vector3(x, rayStartY, z);
    const rayDirection = new flock.BABYLON.Vector3(0, -1, 0);
    const ray = new flock.BABYLON.Ray(rayOrigin, rayDirection, rayLength);

    const hit = flock.scene.pickWithRay(ray, (mesh) => {
      if (mesh === groundMesh) return true;
      const name = mesh?.name?.toLowerCase?.() ?? '';
      return name === 'ground' || name.includes('ground') || mesh?.metadata?.blockKey === 'ground';
    });

    if (hit?.pickedPoint) {
      return hit.pickedPoint.y;
    }

    return 0;
  },
  groundLevelAt(x = 0, z = 0) {
    return flock.getGroundLevelAt(Number(x) || 0, Number(z) || 0);
  },
  // Waits only for terrain that is loading; with no ground it resolves at once.
  async groundReady() {
    if (flock.ground && !flock._isGroundReady()) await flock.waitForGroundReady();
  },
  // A height map ground gets its metadata once its terrain has loaded.
  _isGroundReady() {
    return !!flock.ground?.metadata && !flock.ground.isDisposed?.();
  },
  waitForGroundReady() {
    if (!sceneReady()) return Promise.resolve(null);
    if (flock._isGroundReady()) return Promise.resolve(flock.ground);

    return new Promise((resolve) => {
      const observer = flock.scene.onBeforeRenderObservable.add(() => {
        if (flock._isGroundReady()) {
          flock.scene.onBeforeRenderObservable.remove(observer);
          resolve(flock.ground);
        }
      });
    });
  },
  show(meshName) {
    // Check if the ID refers to a UI button
    const uiButton = flock.scene.UITexture?.getControlByName(meshName);

    if (uiButton) {
      // Handle UI button case
      uiButton.isVisible = true; // Hide the button
      return;
    }
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, function (mesh) {
        if (mesh) {
          flock._setShown(mesh, true);
        } else {
          console.log('Model not loaded:', meshName);
        }
        resolve();
      });
    });
  },
  hide(meshName) {
    const uiButton = flock.scene.UITexture?.getControlByName(meshName);

    if (uiButton) {
      // Handle UI button case
      uiButton.isVisible = false; // Hide the button
      return;
    }
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (mesh) {
        if (mesh) {
          flock._setShown(mesh, false);
        } else {
          console.log('Mesh not loaded:', meshName);
        }
        resolve();
      });
    });
  },
  _setShown(mesh, shown) {
    if (mesh._awaitingDo) {
      if (mesh._shownAfterDo === shown) return;
      mesh._shownAfterDo = shown;
    } else {
      mesh.setEnabled(shown);
    }
    if (!mesh.physics?._pluginData) return;
    const bodyId = mesh.physics._pluginData.hpBodyId;
    if (shown) {
      flock.hk._hknp.HP_World_AddBody(flock.hk.world, bodyId, mesh.physics.startAsleep);
    } else {
      flock.hk._hknp.HP_World_RemoveBody(flock.hk.world, bodyId);
    }
  },
  disposeMesh(mesh) {
    if (!mesh) return;

    if (mesh.name === 'ground') {
      const material = mesh.material;
      mesh.material = null;
      flock.disposeOldMaterial(material, [mesh]);
      if (mesh.physicsShape) {
        mesh.physicsShape.dispose();
      }
      mesh.dispose();
      flock.ground = null;
      return;
    }
    if (mesh.name === 'sky') {
      const material = mesh.material;
      mesh.material = null;
      flock.disposeOldMaterial(material, [mesh]);
      mesh.dispose();
      flock.sky = null;
      return;
    }

    if (hierarchyOf(mesh).some(stillUsed)) {
      if (!mesh.metadata?.deletedOriginal) keepDeletedOriginal(mesh);
      return;
    }

    let meshesToDispose = [mesh];

    const particleSystem = flock.scene.particleSystems.find((system) => system.name === mesh.name);

    if (particleSystem) {
      particleSystem.dispose();
      return;
    }

    if (mesh.getChildMeshes) {
      meshesToDispose = mesh.getChildMeshes().concat(mesh);
    }

    flock.scene.animationGroups.slice().forEach((animationGroup) => {
      const targets = animationGroup.targetedAnimations.map((anim) => anim.target);

      if (
        targets.some((target) => meshesToDispose.includes(target)) ||
        targets.some((target) => mesh.getDescendants().includes(target)) ||
        targets.length === 0
      ) {
        animationGroup.targetedAnimations.forEach((anim) => {
          anim.target = null;
        });
        animationGroup.stop();
        animationGroup.dispose();
      }
    });

    meshesToDispose.forEach((currentMesh) => {
      if (currentMesh.animations) {
        currentMesh.animations.forEach((animation) => {
          animation.dispose?.();
        });
        currentMesh.animations.length = 0;
      }
    });

    meshesToDispose.forEach((currentMesh) => {
      const material = currentMesh.material;
      if (!material || isInstance(currentMesh)) return;

      currentMesh.material = null;
      flock.disposeOldMaterial(material, meshesToDispose);
    });

    meshesToDispose.forEach((currentMesh) => {
      if (currentMesh?.metadata?.currentSound) {
        currentMesh.metadata.currentSound.stop();
      }
    });

    meshesToDispose.forEach((currentMesh) => {
      currentMesh.parent = null;
    });

    meshesToDispose.reverse().forEach((currentMesh) => {
      if (!currentMesh.isDisposed()) {
        disposeBody(currentMesh);
        flock.scene.removeMesh(currentMesh);
        currentMesh.setEnabled(false);
        currentMesh.dispose();
      }
    });
  },
  dispose(meshName) {
    const uiButton = flock.scene.UITexture?.getControlByName(meshName);

    if (uiButton) {
      // Handle UI button case
      uiButton.dispose();
      return;
    }

    flock.whenModelReady(meshName, (mesh) => {
      if (mesh) flock.disposeMesh(mesh);
    });
  },
  cloneMesh({
    sourceMeshName,
    cloneId,
    cloneName = null,
    blockKey = cloneId,
    position = null,
    rotation = null,
    size = null,
    callback = null,
    then = null,
    transform = null,
    inheritConstruction = true,
    family = null,
    mode = 'copy',
  } = {}) {
    if (!sourceMeshName || typeof sourceMeshName !== 'string' || sourceMeshName.length > 100) {
      console.warn('cloneMesh: invalid sourceMeshName');
      return null;
    }
    if (!cloneId || typeof cloneId !== 'string' || cloneId.length > 100) {
      console.warn('cloneMesh: invalid cloneId');
      return null;
    }
    if (callback != null && typeof callback !== 'function') {
      console.warn('cloneMesh: callback must be a function');
      callback = null;
    }
    if (then != null && typeof then !== 'function') {
      console.warn('cloneMesh: then must be a function');
      then = null;
    }
    if (flock.maxMeshesReached()) return 'error_' + cloneId;

    const uniqueCloneId = flock._reserveName(cloneId, family ?? flock._familyOf(sourceMeshName));

    const signal = flock.abortController?.signal;

    let resolveReady;
    const readyPromise = new Promise((resolve) => {
      resolveReady = resolve;
    });
    flock.modelReadyPromises.set(uniqueCloneId, readyPromise);
    readyPromise.finally(() => {
      setTimeout(() => {
        if (flock.modelReadyPromises.get(uniqueCloneId) === readyPromise)
          flock.modelReadyPromises.delete(uniqueCloneId);
      }, 5000);
    });

    flock.whenModelReady(sourceMeshName, async (sourceMesh) => {
      if (!sourceMesh || sourceMesh.isDisposed?.()) {
        resolveReady(null);
        return;
      }

      await flock._whenHierarchySettled(sourceMesh);
      if (signal?.aborted) return;
      if (sourceMesh.isDisposed?.()) {
        resolveReady(null);
        return;
      }

      flock._recycleOldestByKey(sourceMeshName);

      const sayPlanes = sourceMesh
        .getDescendants(false)
        .filter((node) => node.metadata?.isTextPlane);
      const sayParents = sayPlanes.map((plane) => plane.parent);
      sayPlanes.forEach((plane) => (plane.parent = null));
      let clone;
      try {
        if (mode === 'linked') {
          clone = instantiateClone(sourceMesh, uniqueCloneId);
        } else if ([sourceMesh, ...sourceMesh.getDescendants(false)].some(isInstance)) {
          clone = instantiateClone(sourceMesh, uniqueCloneId);
          [clone, ...clone.getDescendants(false)].forEach(disposeClonedBodies);
          clone = realiseHierarchy(clone, { keepRoot: false });
        } else {
          clone = sourceMesh.clone(uniqueCloneId);
        }
      } finally {
        sayPlanes.forEach((plane, i) => (plane.parent = sayParents[i]));
      }

      flock._registerInstance(sourceMeshName, clone.name, clone);

      if (clone) {
        sourceMesh.computeWorldMatrix(true);

        const worldPosition = new flock.BABYLON.Vector3();
        const worldRotation = new flock.BABYLON.Quaternion();
        sourceMesh.getWorldMatrix().decompose(undefined, worldRotation, worldPosition);

        clone.parent = null;
        clone.position.copyFrom(worldPosition);
        clone.rotationQuaternion = worldRotation.clone();
        clone.scaling.copyFrom(sourceMesh.scaling);

        const holdBodies =
          !!callback || (inheritConstruction && flock._constructionOf(sourceMesh).dos.length > 0);
        for (const node of clonePhysicsHierarchy(sourceMesh, clone)) {
          if (holdBodies) flock.holdBody(node);
          else flock.ensureBody(node);
        }
        clone.setEnabled(flock._isShown(sourceMesh));
        if (holdBodies) flock._awaitDo(clone, true);

        const setMetadata = (mesh) => {
          // Ensure metadata exists
          mesh.metadata = mesh.metadata || {};

          // Add or update specific properties without overwriting existing metadata
          mesh.metadata.sharedMaterial = true;
          mesh.metadata.sharedGeometry = true;
        };

        clone.metadata = { ...(sourceMesh.metadata || {}) };
        if (clone.metadata.tags) clone.metadata.tags = [...clone.metadata.tags];
        clone.metadata.sourceBlockKey ??= sourceMesh.metadata?.blockKey;
        clone.metadata.blockKey = blockKey;
        clone.metadata.cloneOf = [...(sourceMesh.metadata?.cloneOf ?? []), sourceMesh.uniqueId];
        setMetadata(clone);
        [sourceMesh, ...sourceMesh.getDescendants()].forEach(setMetadata);
        clone.getDescendants().forEach((node) => {
          setMetadata(node);
          node.metadata = { ...node.metadata };
          node.metadata.originalNodeName ??= node.name.slice(node.parent.name.length + 1);
          if (node.metadata.tags) node.metadata.tags = [...node.metadata.tags];
          delete node.metadata.blockKey;
          delete node.metadata.mirror;
          delete node.metadata.cloneOf;
        });
        // A copy of a mirror is not a mirror itself; mirror() sets its own.
        delete clone.metadata.mirror;
        [clone, ...clone.getDescendants(false)].forEach(clearAnimationState);
        if (mode !== 'linked') rebindSkeletons(clone);

        if (clone.metadata?.shapeType === 'Group') {
          // A cloned action manager would still close over the source shell,
          // so drop any copied forwarders and bind fresh ones to the clone.
          if (clone.actionManager) {
            for (const action of [...clone.actionManager.actions]) {
              if (action?._flockForwarder) clone.actionManager.unregisterAction(action);
            }
          }
          delete clone.metadata._pickForwarded;
          flock.ensureGroupPickForwarder?.(clone);
        }

        const cloneNameFor = (sourceNode) => {
          const path = [];
          for (let node = sourceNode; node && node !== sourceMesh; node = node.parent) {
            path.unshift(node.name);
          }
          return [clone.name, ...path].join('.');
        };

        const sayTexturePlanes = [sourceMesh, ...sourceMesh.getDescendants(false)].filter(
          (node) => node.metadata?.hasSayTexture && node.advancedTexture
        );
        for (const sourcePlane of sayTexturePlanes) {
          const cloneTargetName = cloneNameFor(sourcePlane);
          const clonePlane = flock.scene.getMeshByName(cloneTargetName);
          if (!clonePlane) continue;
          if (clonePlane.advancedTexture !== sourcePlane.advancedTexture) {
            clonePlane.advancedTexture?.dispose?.();
          }
          delete clonePlane.advancedTexture;
          flock.say(cloneTargetName, { text: '', duration: 0 })?.catch?.(() => {});
        }

        if (typeof transform === 'function') {
          const kept = await transform(clone, sourceMesh);
          if (signal?.aborted) return;
          if (kept === false || clone.isDisposed()) {
            resolveReady(null);
            return;
          }
        }

        if (position || rotation || size) {
          const anchor = flock._getAnchor(clone);
          const target = {
            x: position?.x ?? anchor.x,
            y: position?.y ?? anchor.y,
            z: position?.z ?? anchor.z,
          };
          flock._applyInitialTransform(clone, { position: target, rotation, size });
        }

        const inherited = inheritConstruction
          ? flock._constructionOf(sourceMesh)
          : { dos: [], thens: [] };
        flock._rememberConstruction(clone, {
          dos: [...inherited.dos, callback],
          thens: [...inherited.thens, then],
        });
        const { dos, thens } = flock._constructionOf(clone);
        const replayed = new Set([...inherited.dos, ...inherited.thens]);

        if (mode === 'linked') linkClone(sourceMesh, clone);

        resolveReady(clone);
        flock.announceMeshReady(clone.name, clone.name);
        if (typeof cloneName === 'string' && cloneName) {
          const cloneFamily = flock._familyOf(cloneName);
          if (cloneFamily !== flock._familyOf(clone.name)) {
            flock._flushPendingTriggers(clone.name, cloneFamily);
          }
        }

        const finishConstruction = () => {
          flock._finishDo(clone);
          [clone, ...clone.getDescendants(false)].forEach((node) => flock.releaseBody(node));
        };

        if (dos.length || thens.length) {
          requestAnimationFrame(async () => {
            for (const [index, fn] of [...dos, ...thens].entries()) {
              if (signal?.aborted || clone.isDisposed()) return;
              if (index === dos.length) finishConstruction();
              if (replayed.has(fn)) replayingConstruction.add(clone);
              try {
                const result = fn(uniqueCloneId);
                if (result && typeof result.then === 'function') await result;
              } catch (err) {
                console.error('cloneMesh callback error:', err);
              } finally {
                replayingConstruction.delete(clone);
              }
            }
            if (!signal?.aborted && !clone.isDisposed()) finishConstruction();
          });
        }
      }
    });

    return uniqueCloneId;
  },
  _trackPendingChild(parentName, attached) {
    const pending = (flock._pendingChildren ??= new Map());
    let set = pending.get(parentName);
    if (!set) pending.set(parentName, (set = new Set()));
    set.add(attached);

    const signal = flock.abortController?.signal;
    const done = () => {
      set.delete(attached);
      if (!set.size && pending.get(parentName) === set) pending.delete(parentName);
    };
    attached.then(done, done);
    signal?.addEventListener('abort', done, { once: true });
  },
  _lookTarget(mesh) {
    return lookTarget(mesh);
  },
  _instantiateTemplate(template, name) {
    return instantiateClone(template, name);
  },
  _linkToTemplate(template, copy) {
    linkToTemplate(template, copy);
  },
  _claimLinked(mesh, category) {
    const link = linkOf.get(mesh);
    if (!link || replayingConstruction.has(mesh)) return;
    link.overrides.add(category);
    if (LOOK_CATEGORIES.has(category)) realise(mesh);
    else if (category === 'animation') ownSkeleton(mesh);
  },
  _realiseLinked(mesh) {
    realise(mesh);
  },
  _linkedOwner(mesh, property) {
    const keys = LINK_PROPERTY_KEYS[property] ?? [];
    let owner = mesh;
    for (let link = linkOf.get(owner); link; link = linkOf.get(owner)) {
      if (
        link.template ||
        link.source.isDisposed() ||
        keys.some((key) => link.overrides.has(key))
      ) {
        break;
      }
      owner = link.source;
    }
    return owner;
  },
  _linkedPart(part, property) {
    const path = [];
    let root = part;
    while (root && !linkOf.has(root)) {
      path.unshift(root);
      root = root.parent;
    }
    if (!root) return part;
    const owner = flock._linkedOwner(root, property);
    if (owner === root) return part;
    let node = owner;
    for (const step of path) {
      if (step.metadata?.lookVisual) return lookTarget(owner);
      const name = originalNameOf(step);
      const match = node
        .getChildren(undefined, true)
        .find((child) => !child.metadata?.lookVisual && originalNameOf(child) === name);
      if (!match) return owner;
      node = match;
    }
    return node;
  },
  _beginLinkedEdit(copy, property) {
    const owner = flock._linkedOwner(copy, property);
    if (owner === copy) return null;
    linkSync?.copies.delete(copy);
    const start = {
      position: copy.position.clone(),
      rotation: copy.rotation.clone(),
      rotationQuaternion: copy.rotationQuaternion?.clone() ?? null,
      scaling: copy.scaling.clone(),
    };
    copy.computeWorldMatrix(true);
    owner.computeWorldMatrix(true);
    const copyFrom = copy.getAbsolutePosition().clone();
    const ownerFrom = owner.getAbsolutePosition().clone();
    const ownerBottom = flock.getEffectiveWorldBounds(owner).min.y;
    const edit = {
      owner,
      ownerFrom,
      ownerBottom,
      update() {
        if (copy.isDisposed() || owner.isDisposed()) return;
        copy.computeWorldMatrix(true);
        if (property === 'position') {
          owner.setAbsolutePosition(ownerFrom.add(copy.getAbsolutePosition().subtract(copyFrom)));
        } else if (property === 'size') {
          owner.scaling.copyFrom(copy.scaling);
          owner.computeWorldMatrix(true);
          owner.position.y += ownerBottom - flock.getEffectiveWorldBounds(owner).min.y;
          flock.retileTextures(owner);
          flock.updatePhysics(owner);
        } else if (property === 'rotation') {
          setAbsoluteRotation(owner, absoluteRotation(copy, new flock.BABYLON.Quaternion()));
        }
        owner.computeWorldMatrix(true);
        teleportBodyToMesh(owner);
      },
      end() {
        edit.update();
        if (copy.isDisposed()) return owner;
        copy.position.copyFrom(start.position);
        copy.rotation.copyFrom(start.rotation);
        copy.rotationQuaternion = start.rotationQuaternion;
        copy.scaling.copyFrom(start.scaling);
        copy.computeWorldMatrix(true);
        if (property === 'size') {
          flock.retileTextures(copy);
          flock.updatePhysics(copy);
        }
        teleportBodyToMesh(copy);
        const link = linkOf.get(copy);
        if (link) {
          snapshotLink(copy, link);
          linkSync?.copies.add(copy);
        }
        return owner;
      },
    };
    return edit;
  },
  _standalone(mesh) {
    const followers = linkedCopiesOf.get(mesh);
    for (const follower of followers ?? []) {
      if (!follower.isDisposed()) realise(follower);
    }
    const link = linkOf.get(mesh);
    if (link?.template) {
      unlinkFromTemplate(mesh);
    } else if (link) {
      linkedCopiesOf.get(link.source)?.delete(mesh);
      linkSync?.copies.delete(mesh);
      linkOf.delete(mesh);
      releaseDeletedOriginal(link.source);
    }
    if (![mesh, ...mesh.getDescendants(false)].some(isInstance)) return mesh;
    const standalone = realiseHierarchy(mesh, { keepRoot: false });
    if (standalone !== mesh) {
      flock._registerLiveName(standalone.name, standalone);
      if (followers) {
        linkedCopiesOf.delete(mesh);
        linkedCopiesOf.set(standalone, followers);
        for (const follower of followers) {
          const followerLink = linkOf.get(follower);
          if (followerLink) followerLink.source = standalone;
        }
      }
    }
    return standalone;
  },
  _applyLinked(mesh, category, apply) {
    const look = LOOK_CATEGORIES.has(category);
    const shares = (target) => {
      const link = linkOf.get(target);
      if (!link) return false;
      return look ? !link.realised : category === 'animation' && !link.ownSkeleton;
    };
    flock._claimLinked(mesh, category);
    const results = [];
    const visit = (target) => {
      if (!shares(target)) results.push(apply(look ? lookTarget(target) : target));
      for (const copy of linkedCopiesOf.get(target) ?? []) {
        if (!copy.isDisposed() && !linkOf.get(copy).overrides.has(category)) visit(copy);
      }
    };
    visit(mesh);
    return results;
  },
  _constructionOf(mesh) {
    return (mesh && flock._constructions?.get(mesh)) || { dos: [], thens: [] };
  },
  _rememberConstruction(mesh, { dos = [], thens = [] } = {}) {
    const isFn = (fn) => typeof fn === 'function';
    dos = dos.filter(isFn);
    thens = thens.filter(isFn);
    if (!mesh || (!dos.length && !thens.length)) return;
    const current = flock._constructionOf(mesh);
    flock._constructions ??= new WeakMap();
    flock._constructions.set(mesh, {
      dos: [...current.dos, ...dos],
      thens: [...current.thens, ...thens],
    });
  },
  runDo(meshName, fn) {
    const mesh = flock.scene?.getMeshByName(meshName);
    flock._rememberConstruction(mesh, { dos: [fn] });
    const run = (async () => {
      try {
        await fn(meshName);
      } catch (err) {
        console.error('do error:', err);
      } finally {
        if (mesh?._doRun === run) delete mesh._doRun;
        try {
          flock._finishDo(mesh);
        } catch (err) {
          console.error('do error:', err);
        }
      }
    })();
    if (mesh) mesh._doRun = run;
    return run;
  },
  // An object with a DO stays hidden and without a body until the DO has
  // run, so it appears, and collides, in its constructed state. A hide or
  // show during the DO is kept for when it ends.
  _awaitDo(mesh, hasDo) {
    if (!hasDo) {
      flock.ensureBody(mesh);
      return;
    }
    flock.holdBody(mesh);
    if (mesh._awaitingDo) return;
    mesh._shownAfterDo = mesh.isEnabled(false);
    mesh._awaitingDo = true;
    mesh.setEnabled(false);
  },
  _finishDo(mesh) {
    if (!mesh || mesh.isDisposed()) return;
    if (mesh._awaitingDo) {
      mesh.setEnabled(mesh._shownAfterDo);
      delete mesh._awaitingDo;
      delete mesh._shownAfterDo;
      flock.releaseBody(mesh);
    }
    flock._refitGroupsAbove(mesh);
  },
  _refitGroupsAbove(mesh) {
    for (let node = mesh?.parent; node; node = node.parent) {
      if (node.metadata?.shapeType === 'Group') flock.recomputeGroupGeometry(node);
    }
  },
  _isShown(mesh) {
    return mesh._awaitingDo ? mesh._shownAfterDo : mesh.isEnabled(false);
  },
  runThen(meshName, fn) {
    const mesh = flock.scene?.getMeshByName(meshName);
    flock._rememberConstruction(mesh, { thens: [fn] });
    const signal = flock.abortController?.signal;
    const start = () => {
      if (signal?.aborted || mesh?.isDisposed()) return;
      try {
        const result = fn(meshName);
        if (result && typeof result.then === 'function') {
          Promise.resolve(result).catch((err) => console.error('then() error:', err));
        }
      } catch (err) {
        console.error('then() error:', err);
      }
    };
    if (mesh?._doRun) mesh._doRun.then(start);
    else start();
  },
  _trackReveal(mesh, revealed) {
    const settled = revealed.then(
      () => {},
      () => {}
    );
    mesh._flockRevealed = settled;
    settled.then(() => {
      if (mesh._flockRevealed === settled) delete mesh._flockRevealed;
    });
    return revealed;
  },
  async _whenHierarchySettled(root) {
    for (;;) {
      const waits = [];
      for (const node of [root, ...root.getDescendants(false)]) {
        const children = flock._pendingChildren?.get(node.name);
        if (children) waits.push(...children);
        if (node._flockRevealed) waits.push(node._flockRevealed);
      }
      if (!waits.length) return;
      await Promise.allSettled(waits);
    }
  },
};
