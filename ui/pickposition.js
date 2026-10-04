import { flock } from '../flock.js';
import {
  startCanvasKeyboardMode,
  stopCanvasKeyboardMode,
  setCrosshairCursor,
  setDefaultCursor,
  getCanvasCirclePosition,
} from './canvas-utils.js';
import { showStatus, clearStatus } from './status.js';
import { translate } from '../main/translation.js';
import { setPositionValues, getCanvasXAndCanvasYValues } from './blocklyutil.js';
import { hideFromInspector } from './inspectorVisibility.js';
import { announceToScreenReader } from '../main/input.js';
import { isPlacementSurface } from './meshhelpers.js';
import {
  startAlignBlobs,
  getAlignDelta,
  getAlignedBlockPosition,
  surfaceMarker,
} from './alignBlobs.js';

let getMeshFromBlock = () => null;
let selectMeshForBlock = () => {};
let moveGroupBy = null;
Promise.all([import('./blockmesh.js'), import('./gizmos.js')])
  .then(([blockmesh, gizmos]) => {
    getMeshFromBlock = blockmesh.getMeshFromBlock;
    selectMeshForBlock = gizmos.selectMeshForBlock;
    moveGroupBy = gizmos.moveGroupBy;
  })
  .catch((error) => console.warn('Position pick alignment unavailable:', error));

const STATUS_OWNER = 'pick-position';

// These blocks don't move a mesh when their position updates, so picking
// needs its own visible confirmation.
const CONFIRMATION_PING_BLOCK_TYPES = new Set(['glide_to', 'glide_to_seconds', 'xyz_keyframe']);
const PING_DURATION_MS = 650;
const DRAG_THRESHOLD_PX = 6;
const PING_COLOUR_HEX = '#fff200';

function showPositionPickedPing(position) {
  const scene = flock.scene;
  const BABYLON = flock.BABYLON;
  if (!scene || !BABYLON) return;

  const ring = BABYLON.MeshBuilder.CreateTorus(
    '__flock_position_pick_ping',
    { diameter: 0.6, thickness: 0.06, tessellation: 32 },
    scene
  );
  hideFromInspector(ring);
  ring.position.copyFrom(position);
  ring.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  ring.isPickable = false;
  ring.checkCollisions = false;
  ring.renderingGroupId = 1;

  const mat = new BABYLON.StandardMaterial('__flock_position_pick_ping_mat', scene);
  mat.emissiveColor = BABYLON.Color3.FromHexString(PING_COLOUR_HEX);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  ring.material = mat;

  const start = performance.now();
  const observer = scene.onBeforeRenderObservable.add(() => {
    const t = Math.min(1, (performance.now() - start) / PING_DURATION_MS);
    ring.scaling.setAll(0.5 + t * 1.5);
    mat.alpha = 1 - t;
    if (t < 1) return;
    scene.onBeforeRenderObservable.remove(observer);
    ring.dispose();
    mat.dispose();
  });
}

function formatPickedPositionAnnouncement(block) {
  const readAxis = (name) => block.getInput(name)?.connection?.targetBlock()?.getFieldValue('NUM');
  const x = readAxis('X');
  const y = readAxis('Y');
  const z = readAxis('Z');
  return translate('pick_position_confirmed')
    .replace('%1', x ?? '0')
    .replace('%2', y ?? '0')
    .replace('%3', z ?? '0');
}

function activeGroupOf(mesh) {
  let group = null;
  for (let node = mesh?.parent; node?.metadata?.shapeType === 'Group'; node = node.parent) {
    group = node;
  }
  return group;
}

let activeCleanup = null;

export function startPositionPick(block, { showCircleImmediately = false } = {}) {
  cancelPositionPick();

  const canvas = flock.scene?.getEngine?.().getRenderingCanvas?.();
  if (!canvas || !flock.scene) return;

  let pointer = null;
  let pressStart = null;
  const member = CONFIRMATION_PING_BLOCK_TYPES.has(block.type) ? null : getMeshFromBlock(block);
  const group = moveGroupBy ? activeGroupOf(member) : null;
  const mover = group ?? member;
  if (mover) selectMeshForBlock(block);
  const align = mover ? startAlignBlobs(mover, () => getCanvasCirclePosition() ?? pointer) : null;

  const isSurface = (mesh) =>
    isPlacementSurface(mesh) && !(mover && (mesh === mover || mesh.isDescendantOf(mover)));

  const isValidHit = (x, y) => !!align?.markerAt(x, y) || !!flock.scene.pick(x, y, isSurface)?.hit;

  function surfaceMarkerAt(pick, ray) {
    const normal = mover ? pick.getNormal(true, true) : null;
    if (!normal) return null;
    if (flock.BABYLON.Vector3.Dot(normal, ray.direction) > 0) normal.scaleInPlace(-1);
    return surfaceMarker(pick.pickedPoint, normal);
  }

  function placeAgainst(marker) {
    if (!group) {
      setPositionValues(block, getAlignedBlockPosition(mover, marker), block.type, 2);
      return;
    }
    const delta = getAlignDelta(group, marker);
    for (const axis of ['x', 'y', 'z']) delta[axis] = Math.round(delta[axis] * 100) / 100;
    moveGroupBy(group, delta);
  }

  function commitAt(x, y) {
    const marker = align?.markerAt(x, y);
    if (marker) {
      placeAgainst(marker);
      announceToScreenReader(formatPickedPositionAnnouncement(block), {
        requireCanvasFocus: false,
      });
      cleanup();
      return;
    }
    const pickRay = flock.scene.createPickingRay(
      x,
      y,
      flock.BABYLON.Matrix.Identity(),
      flock.scene.activeCamera
    );
    const pick = flock.scene.pickWithRay(pickRay, isSurface);
    if (!pick?.hit) return;
    const surface = surfaceMarkerAt(pick, pickRay);
    if (surface) placeAgainst(surface);
    else setPositionValues(block, pick.pickedPoint, block.type);
    if (CONFIRMATION_PING_BLOCK_TYPES.has(block.type)) {
      showPositionPickedPing(pick.pickedPoint);
    }
    announceToScreenReader(formatPickedPositionAnnouncement(block), {
      requireCanvasFocus: false,
    });
    cleanup();
  }

  function onPointerDown(event) {
    pressStart = { x: event.clientX, y: event.clientY };
  }

  function onWindowClick(event) {
    const dragged =
      pressStart &&
      Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > DRAG_THRESHOLD_PX;
    pressStart = null;
    if (dragged) return;
    const rect = canvas.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      cleanup();
      return;
    }
    const [x, y] = getCanvasXAndCanvasYValues(event, rect);
    commitAt(x, y);
  }

  function onPointerMove(event) {
    const [x, y] = getCanvasXAndCanvasYValues(event, canvas.getBoundingClientRect());
    pointer = { x, y };
  }

  function onPointerLeave() {
    pointer = null;
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    cleanup();
  }

  function cleanup() {
    if (activeCleanup !== cleanup) return;
    activeCleanup = null;
    window.removeEventListener('click', onWindowClick, true);
    window.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    align?.dispose();
    stopCanvasKeyboardMode();
    setDefaultCursor();
    clearStatus(STATUS_OWNER);
  }

  activeCleanup = cleanup;

  startCanvasKeyboardMode((x, y) => commitAt(x, y), showCircleImmediately, isValidHit);
  setCrosshairCursor();
  showStatus(translate(align ? 'pick_position_align_prompt' : 'pick_position_prompt'), {
    owner: STATUS_OWNER,
    hint: true,
  });
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pointerdown', onPointerDown, true);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  // Defer so the activating click/Enter doesn't immediately fire this too.
  setTimeout(() => {
    if (activeCleanup === cleanup) window.addEventListener('click', onWindowClick, true);
  }, 0);
}

export function cancelPositionPick() {
  activeCleanup?.();
}
