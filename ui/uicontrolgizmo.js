import * as Blockly from 'blockly';
import { flock } from '../flock.js';
import { KeyboardDispatcher } from '../main/keyboardDispatcher.js';
import { createGizmoMobileHud } from './gizmo-mobile-hud.js';
import { isValueInputDescendantOf } from '../blocks/blocks.js';
import { isInsideProcedureDefinition } from '../blocks/variableScope.js';
import { isProjectLoading } from '../main/projectLoading.js';
import { readColourValue } from './blockmesh.js';
import { anchorAxis } from '../api/ui.js';

const KEY_STEP = 10;
const KEY_STEP_FINE = 1;
const ARROW_LENGTH = 24;

const ALIGN_FIELDS = { H_ALIGN: 'hAlign', V_ALIGN: 'vAlign' };

const UI_BLOCKS = {
  ui_text: {
    inputs: {
      TEXT: { option: 'text', empty: '' },
      X: { option: 'x', empty: 0 },
      Y: { option: 'y', empty: 0 },
      FONT_SIZE: { option: 'fontSize', empty: 24 },
      COLOR: { option: 'color', empty: '' },
      BACKGROUND_COLOR: { option: 'backgroundColor', empty: '#ffffff' },
      ALPHA: { option: 'alpha', empty: 1 },
    },
    fields: ALIGN_FIELDS,
  },
  ui_button: {
    inputs: {
      TEXT: { option: 'text', empty: '' },
      X: { option: 'x', empty: 0 },
      Y: { option: 'y', empty: 0 },
      TEXT_COLOR: { option: 'textColor', empty: '' },
      BACKGROUND_COLOR: { option: 'backgroundColor', empty: '' },
    },
    fields: { SIZE: 'width', TEXT_SIZE: 'textSize', ...ALIGN_FIELDS },
  },
  ui_input: {
    inputs: {
      TEXT: { option: 'text', empty: '' },
      X: { option: 'x', empty: 0 },
      Y: { option: 'y', empty: 0 },
      TEXT_SIZE: { option: 'fontSize', empty: 24 },
      TEXT_COLOR: { option: 'textColor', empty: '#000000' },
      BACKGROUND_COLOR: { option: 'backgroundColor', empty: '#ffffff' },
    },
    fields: { SIZE: 'size', ...ALIGN_FIELDS },
  },
  ui_slider: {
    inputs: {
      MIN: { option: 'min', empty: 0 },
      MAX: { option: 'max', empty: 100 },
      VALUE: { option: 'value', empty: 50 },
      X: { option: 'x', empty: 100 },
      Y: { option: 'y', empty: 50 },
      COLOR: { option: 'textColor', empty: '#000000' },
      BACKGROUND: { option: 'backgroundColor', empty: '#ffffff' },
    },
    fields: { SIZE: 'size', ...ALIGN_FIELDS },
  },
};

const UI_PREVIEWS = {
  ui_text: {
    create: 'UIText',
    defaults: {
      text: '',
      x: 0,
      y: 0,
      fontSize: 24,
      color: '',
      backgroundColor: '#ffffff',
      alpha: 1,
      duration: 0,
    },
  },
  ui_button: {
    create: 'UIButton',
    defaults: { text: '', x: 0, y: 0, width: 'SMALL' },
    id: (block) => ({ buttonId: `preview_${block.id}` }),
  },
  ui_input: {
    create: 'UIInput',
    defaults: { text: '', x: 0, y: 0, fontSize: 24, mode: 'START' },
    id: (block) => ({ id: `preview_${block.id}` }),
  },
  ui_slider: {
    create: 'UISlider',
    defaults: { x: 100, y: 50, min: 0, max: 100, value: 50 },
    id: (block) => ({ id: `preview_${block.id}` }),
  },
};

let selection = null;

function uiTexture() {
  return flock.scene?.UITexture ?? null;
}

function renderCanvas() {
  return flock.scene?.getEngine?.()?.getRenderingCanvas?.() ?? null;
}

function guiScale() {
  const engine = flock.scene.getEngine();
  const size = uiTexture().getSize();
  return size.width / (engine.getRenderWidth() * engine.getHardwareScalingLevel());
}

function uiControls() {
  const texture = uiTexture();
  if (!texture) return [];
  return texture.rootContainer.children.filter(
    (control) => control.metadata?.uiKind && control.metadata.blockKey
  );
}

function controlParts(control) {
  return [control, control.metadata.submit].filter(Boolean);
}

export function uiControlsForBlock(blockId) {
  return uiControls().filter((control) => control.metadata.blockKey === blockId);
}

export function uiControlAt(x, y) {
  if (!uiTexture() || !flock.scene) return null;
  const scale = guiScale();
  const hits = uiControls().filter(
    (control) =>
      control.isVisible &&
      control.alpha > 0 &&
      controlParts(control).some((part) => part.contains(x * scale, y * scale))
  );
  return hits.at(-1) ?? null;
}

function blockFor(control) {
  return Blockly.getMainWorkspace()?.getBlockById(control?.metadata?.blockKey) ?? null;
}

function literalNumberBlock(block, inputName) {
  const target = block?.getInputTargetBlock(inputName);
  return target?.type === 'math_number' ? target : null;
}

function literalValue(block, inputName, rollRandom) {
  const target = block.getInputTargetBlock(inputName);
  if (!target) return undefined;
  if (!rollRandom && target.getDescendants(false).some((b) => b.type === 'random_colour')) {
    return undefined;
  }
  if (target.type === 'math_number') {
    const n = Number(target.getFieldValue('NUM'));
    return Number.isFinite(n) ? n : undefined;
  }
  if (target.type === 'text') return target.getFieldValue('TEXT');
  const { value } = readColourValue(target);
  return typeof value === 'string' ? value : undefined;
}

function readInputOptions(block, inputs, rollInput = true) {
  const options = {};
  for (const [inputName, { option, empty }] of Object.entries(inputs)) {
    const roll = rollInput === true || rollInput === inputName;
    const value = block.getInputTargetBlock(inputName)
      ? literalValue(block, inputName, roll)
      : empty;
    if (value !== undefined) options[option] = value;
  }
  return options;
}

function editedInputName(block, event) {
  if (event.type === Blockly.Events.BLOCK_MOVE) {
    if (event.newParentId === block.id) return event.newInputName;
    if (event.oldParentId === block.id) return event.oldInputName;
  }
  let child = block.workspace.getBlockById(event.blockId);
  while (child && child.getParent() !== block) child = child.getParent();
  return child ? (block.getInputWithBlock(child)?.name ?? null) : null;
}

function literalOptions(block, rollInput) {
  const config = UI_BLOCKS[block.type];
  const options = readInputOptions(block, config.inputs, rollInput);
  for (const [fieldName, option] of Object.entries(config.fields)) {
    const value = block.getFieldValue(fieldName);
    if (value != null) options[option] = value;
  }
  return options;
}

export function updateUIControlFromBlock(block, event) {
  const controls = uiControlsForBlock(block.id);
  if (!controls.length) return;
  const changes = literalOptions(block, event ? editedInputName(block, event) : true);
  for (const control of controls) flock._restyleUIControl(control, changes);
  if (selection && controls.includes(selection.control)) {
    const { x, y } = selection.control.metadata.layout;
    selection.onMove?.({ x, y });
  }
}

export function previewUIControlFromBlock(block) {
  const preview = UI_PREVIEWS[block.type];
  if (!preview || !flock.scene || !flock.GUI || uiControlsForBlock(block.id).length) return;
  flock[preview.create]({
    ...preview.defaults,
    ...literalOptions(block),
    ...preview.id?.(block),
    blockKey: block.id,
    editorPreview: true,
  });
}

export function removeUIControlsForBlock(blockId) {
  for (const control of uiControlsForBlock(blockId)) flock._removeUIControl(control);
}

function isLive(block) {
  if (!block.isEnabled()) return false;
  if (block.previousConnection && !block.previousConnection.isConnected()) return false;
  return block.getRootBlock().isEnabled() && !isInsideProcedureDefinition(block);
}

function isOwnLifecycleEvent(block, event) {
  if (event.type === Blockly.Events.BLOCK_CREATE) return !!event.ids?.includes(block.id);
  if (event.blockId !== block.id) return false;
  if (event.type === Blockly.Events.BLOCK_MOVE) return true;
  return event.type === Blockly.Events.BLOCK_CHANGE && event.element === 'disabled';
}

function editsConfig(block, event) {
  if (event.type === Blockly.Events.BLOCK_MOVE) {
    return event.oldParentId === block.id || event.newParentId === block.id;
  }
  if (event.type !== Blockly.Events.BLOCK_CHANGE) return false;
  const changed = block.workspace.getBlockById(event.blockId);
  return !!changed && isValueInputDescendantOf(block, changed);
}

const SAY_STYLE_INPUTS = {
  TEXT: { option: 'text', empty: undefined },
  TEXT_COLOR: { option: 'textColor', empty: '#000000' },
  BACKGROUND_COLOR: { option: 'backgroundColor', empty: '#ffffff' },
  ALPHA: { option: 'alpha', empty: 1 },
  SIZE: { option: 'size', empty: 24 },
};

export function handleSayBlockEvent(block, event) {
  if (block.disposed || event.workspaceId !== block.workspace.id) return;
  if (!editsConfig(block, event)) return;
  const bubbles = flock._sayBubblesForBlock?.(block.id) ?? [];
  if (!bubbles.length) return;
  const changes = readInputOptions(block, SAY_STYLE_INPUTS, editedInputName(block, event));
  for (const bg of bubbles) flock._restyleSayBubble(bg, changes);
}

export function handleUIControlBlockEvent(block, event) {
  if (block.disposed || event.workspaceId !== block.workspace.id) return;
  if (isOwnLifecycleEvent(block, event)) {
    if (isProjectLoading() && !event.recordUndo) return;
    if (!isLive(block)) removeUIControlsForBlock(block.id);
    else previewUIControlFromBlock(block);
    return;
  }
  if (editsConfig(block, event)) updateUIControlFromBlock(block, event);
}

const COLOUR_INPUTS = {
  text: { glyph: 'COLOR', rest: 'BACKGROUND_COLOR' },
  button: { glyph: 'TEXT_COLOR', rest: 'BACKGROUND_COLOR' },
  input: { glyph: 'TEXT_COLOR', rest: 'BACKGROUND_COLOR' },
  submit: { glyph: 'BACKGROUND_COLOR', rest: 'TEXT_COLOR' },
  slider: { glyph: 'COLOR', rest: 'BACKGROUND' },
};

function inside(rect, x, y) {
  return (
    x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
  );
}

function alignedStart(start, space, size, alignment, alignStart, alignEnd) {
  if (alignment === alignStart) return start;
  if (alignment === alignEnd) return start + space - size;
  return start + (space - size) / 2;
}

function textGlyphBox(textBlock) {
  const m = textBlock._currentMeasure;
  const lines = textBlock.lines;
  const fontOffset = textBlock._fontOffset;
  if (!lines?.length || !fontOffset) return m;
  const { Control } = flock.GUI;
  const width = Math.max(...lines.map((line) => line.width));
  const height = fontOffset.height * lines.length;
  return {
    left: alignedStart(
      m.left,
      m.width,
      width,
      textBlock.textHorizontalAlignment,
      Control.HORIZONTAL_ALIGNMENT_LEFT,
      Control.HORIZONTAL_ALIGNMENT_RIGHT
    ),
    top: alignedStart(
      m.top,
      m.height,
      height,
      textBlock.textVerticalAlignment,
      Control.VERTICAL_ALIGNMENT_TOP,
      Control.VERTICAL_ALIGNMENT_BOTTOM
    ),
    width,
    height,
  };
}

function inputGlyphBox(input) {
  const m = input._currentMeasure;
  const margin = input.marginInPixels;
  const height = Math.min(m.height, input.fontSizeInPixels * 1.2);
  return {
    left: m.left + margin,
    top: m.top + (m.height - height) / 2,
    width: Math.max(0, m.width - margin * 2),
    height,
  };
}

function halfwayTo(glyph, outer) {
  const left = (glyph.left + outer.left) / 2;
  const top = (glyph.top + outer.top) / 2;
  const right = (glyph.left + glyph.width + outer.left + outer.width) / 2;
  const bottom = (glyph.top + glyph.height + outer.top + outer.height) / 2;
  return { left, top, width: right - left, height: bottom - top };
}

function sliderFillBox(slider) {
  const m = slider._currentMeasure;
  const thumbEnd = slider._getThumbPosition() + (slider._effectiveThumbThickness ?? 0);
  return { left: m.left, top: m.top, width: Math.min(m.width, thumbEnd), height: m.height };
}

function colourZone(control, x, y) {
  const kind = control.metadata.uiKind;
  const submit = control.metadata.submit;
  if (submit && inside(submit._currentMeasure, x, y)) {
    const zone = halfwayTo(textGlyphBox(submit.textBlock), submit._currentMeasure);
    return { part: 'submit', zone };
  }
  if (kind === 'slider') return { part: kind, zone: sliderFillBox(control) };
  const glyph =
    kind === 'text'
      ? textGlyphBox(control.children[0])
      : kind === 'button'
        ? textGlyphBox(control.textBlock)
        : inputGlyphBox(control);
  return { part: kind, zone: halfwayTo(glyph, control._currentMeasure) };
}

function uiControlColourTargetAt(x, y) {
  const control = uiControlAt(x, y);
  if (!control) return null;
  const scale = guiScale();
  const gx = x * scale;
  const gy = y * scale;
  const { part, zone } = colourZone(control, gx, gy);
  const onGlyph = inside(zone, gx, gy);
  return {
    control,
    inputName: COLOUR_INPUTS[part][onGlyph ? 'glyph' : 'rest'],
    highlight: onGlyph
      ? {
          left: zone.left / scale,
          top: zone.top / scale,
          width: zone.width / scale,
          height: zone.height / scale,
        }
      : null,
  };
}

function sayBubbles(mesh) {
  return (
    mesh.advancedTexture
      ?.getControlByName('stackPanel')
      ?.children.filter((bg) => bg.metadata?.blockKey) ?? []
  );
}

function sayBubbleAt(x, y) {
  const scene = flock.scene;
  if (!scene?.activeCamera) return null;
  const ray = scene.createPickingRay(x, y, flock.BABYLON.Matrix.Identity(), scene.activeCamera);
  const hits = scene.multiPickWithRay(
    ray,
    (mesh) => mesh.isEnabled() && mesh.isVisible && sayBubbles(mesh).length > 0
  );
  for (const hit of (hits ?? []).sort((a, b) => a.distance - b.distance)) {
    const mesh = hit.pickedMesh;
    const texture = mesh.advancedTexture;
    const uv = hit.getTextureCoordinates();
    if (!uv) continue;
    const size = texture.getSize();
    const gx = uv.x * size.width;
    const gy = (texture.applyYInversionOnUpdate ? 1 - uv.y : uv.y) * size.height;
    const bubble = sayBubbles(mesh).find((bg) => inside(bg._currentMeasure, gx, gy));
    if (!bubble) continue;
    const occluder = scene.pickWithRay(
      ray,
      (other) => other !== mesh && other.isEnabled() && other.isVisible && other.isPickable
    );
    if (occluder?.hit && occluder.distance < hit.distance) return null;
    return { mesh, texture, bubble, gx, gy };
  }
  return null;
}

function textureRectOnScreen(mesh, texture, rect) {
  const { Vector3, Matrix } = flock.BABYLON;
  const scene = flock.scene;
  const engine = scene.getEngine();
  const canvas = renderCanvas();
  const viewport = scene.activeCamera.viewport.toGlobal(
    engine.getRenderWidth(),
    engine.getRenderHeight()
  );
  const transform = scene.getTransformMatrix();
  const toCss = canvas.clientWidth / engine.getRenderWidth();
  const points = mesh
    .getBoundingInfo()
    .boundingBox.vectorsWorld.map((corner) =>
      Vector3.Project(corner, Matrix.Identity(), transform, viewport)
    );
  const xs = points.map((point) => point.x * toCss);
  const ys = points.map((point) => point.y * toCss);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  const size = texture.getSize();
  return {
    left: left + (rect.left / size.width) * width,
    top: top + (rect.top / size.height) * height,
    width: (rect.width / size.width) * width,
    height: (rect.height / size.height) * height,
  };
}

function sayColourTargetAt(x, y) {
  const hit = sayBubbleAt(x, y);
  if (!hit) return null;
  const { mesh, texture, bubble, gx, gy } = hit;
  const zone = halfwayTo(textGlyphBox(bubble.children[0]), bubble._currentMeasure);
  const onGlyph = inside(zone, gx, gy);
  return {
    control: bubble,
    inputName: onGlyph ? 'TEXT_COLOR' : 'BACKGROUND_COLOR',
    highlight: onGlyph ? textureRectOnScreen(mesh, texture, zone) : null,
  };
}

export function uiColourTargetAt(x, y) {
  return uiControlColourTargetAt(x, y) ?? sayColourTargetAt(x, y);
}

let colourHighlight = null;

export function showColourTarget(target) {
  const canvas = renderCanvas();
  if (!target?.highlight || !canvas?.parentElement) {
    hideColourTarget();
    return;
  }
  if (!colourHighlight) {
    colourHighlight = document.createElement('div');
    colourHighlight.className = 'ui-colour-target';
  }
  if (colourHighlight.parentElement !== canvas.parentElement) {
    canvas.parentElement.appendChild(colourHighlight);
  }
  const { left, top, width, height } = target.highlight;
  Object.assign(colourHighlight.style, {
    left: `${canvas.offsetLeft + left}px`,
    top: `${canvas.offsetTop + top}px`,
    width: `${width}px`,
    height: `${height}px`,
  });
}

export function hideColourTarget() {
  colourHighlight?.remove();
}

export function applyColourToUIControl(target, colour) {
  const block = blockFor(target.control);
  const input = block?.getInput(target.inputName);
  if (!input?.connection) return null;
  const current = input.connection.targetBlock();
  const field = current?.getField('COLOR')
    ? 'COLOR'
    : current?.getField('COLOUR')
      ? 'COLOUR'
      : null;
  if (current && !field) return null;
  Blockly.Events.setGroup(true);
  try {
    if (field) {
      current.setFieldValue(colour, field);
    } else {
      const shadow = block.workspace.newBlock('colour');
      shadow.setShadow(true);
      shadow.setFieldValue(colour, 'COLOR');
      shadow.initSvg();
      shadow.render();
      input.connection.connect(shadow.outputConnection);
    }
  } finally {
    Blockly.Events.setGroup(false);
  }
  return block;
}

function axisSpan(control, axis) {
  const [start, length] = axis === 'x' ? ['left', 'width'] : ['top', 'height'];
  const measures = controlParts(control).map((part) => part._currentMeasure);
  const low = Math.min(...measures.map((m) => m[start]));
  const high = Math.max(...measures.map((m) => m[start] + m[length]));
  return { size: high - low, space: uiTexture().getSize()[length] };
}

function axisAlign(control, axis) {
  const { hAlign, vAlign } = control.metadata.layout;
  return axis === 'x' ? [hAlign, 'RIGHT'] : [vAlign, 'BOTTOM'];
}

function screenStart(control, axis) {
  const { size, space } = axisSpan(control, axis);
  const { edge, px } = anchorAxis(control.metadata.layout[axis], ...axisAlign(control, axis));
  if (edge === 'center') return (space - size) / 2 + px;
  if (edge === 'end') return space - size + px;
  return px;
}

function anchoredOffset(control, axis, start) {
  const { size, space } = axisSpan(control, axis);
  const [align, endName] = axisAlign(control, axis);
  const value = String(align ?? '').toUpperCase();
  if (value === 'CENTER') return Math.round(start - (space - size) / 2);
  if (value === endName) return Math.round(space - size - start);
  if (start + size / 2 > space / 2) return Math.min(Math.round(start + size - space), -1);
  return Math.max(Math.round(start), 0);
}

function arrowSvg(axis, colour) {
  const horizontal = axis === 'x';
  const w = horizontal ? ARROW_LENGTH : 16;
  const h = horizontal ? 16 : ARROW_LENGTH;
  const line = horizontal
    ? `<line x1="0" y1="8" x2="${w - 8}" y2="8" />`
    : `<line x1="8" y1="0" x2="8" y2="${h - 8}" />`;
  const head = horizontal
    ? `<polygon points="${w - 10},2 ${w},8 ${w - 10},14" stroke="none" />`
    : `<polygon points="2,${h - 10} 8,${h} 14,${h - 10}" stroke="none" />`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" stroke="${colour}" fill="${colour}" stroke-width="4">${line}${head}</svg>`;
}

function createOverlay(axisColors, freeAxes) {
  const root = document.createElement('div');
  root.className = 'ui-control-gizmo';
  const box = document.createElement('div');
  box.className = 'ui-control-gizmo-box';
  root.appendChild(box);
  const arrows = {};
  for (const axis of freeAxes) {
    const arrow = document.createElement('div');
    arrow.className = `ui-control-gizmo-arrow ui-control-gizmo-arrow-${axis}`;
    arrow.innerHTML = arrowSvg(axis, axisColors[axis]);
    const label = document.createElement('span');
    label.className = 'ui-control-gizmo-label';
    label.setAttribute('aria-hidden', 'true');
    label.style.color = axisColors[axis];
    label.textContent = axis;
    arrow.appendChild(label);
    root.appendChild(arrow);
    arrows[axis] = arrow;
  }
  return { root, box, arrows };
}

function positionOverlay() {
  const { control, overlay } = selection;
  const canvas = renderCanvas();
  const measures = controlParts(control)
    .map((part) => part._currentMeasure)
    .filter(Boolean);
  if (!canvas || !measures.length || !uiTexture()) return;
  const scale = guiScale();
  const left = Math.min(...measures.map((m) => m.left));
  const top = Math.min(...measures.map((m) => m.top));
  const right = Math.max(...measures.map((m) => m.left + m.width));
  const bottom = Math.max(...measures.map((m) => m.top + m.height));
  Object.assign(overlay.root.style, {
    left: `${canvas.offsetLeft + left / scale}px`,
    top: `${canvas.offsetTop + top / scale}px`,
    width: `${(right - left) / scale}px`,
    height: `${(bottom - top) / scale}px`,
  });
  overlay.root.hidden = !control.isVisible;
}

function writeAxisToBlock(block, axis, value) {
  const target = literalNumberBlock(block, axis === 'x' ? 'X' : 'Y');
  if (target) target.setFieldValue(String(value), 'NUM');
}

function moveTo(x, y) {
  const { control, onMove } = selection;
  const block = blockFor(control);
  if (!block || block.disposed) return;
  const current = control.metadata.layout;
  if (x !== current.x) writeAxisToBlock(block, 'x', x);
  if (y !== current.y) writeAxisToBlock(block, 'y', y);
  for (const twin of uiControlsForBlock(block.id)) flock._restyleUIControl(twin, { x, y });
  onMove?.({ x, y });
}

function nudge(dx, dy) {
  if (!selection) return;
  const { control, freeAxes } = selection;
  const { x, y } = control.metadata.layout;
  const groupId = Blockly.utils.idGenerator.genUid();
  Blockly.Events.setGroup(groupId);
  try {
    moveTo(
      freeAxes.includes('x') ? anchoredOffset(control, 'x', screenStart(control, 'x') + dx) : x,
      freeAxes.includes('y') ? anchoredOffset(control, 'y', screenStart(control, 'y') + dy) : y
    );
  } finally {
    Blockly.Events.setGroup(false);
  }
}

function startDrag(event, axis, target = event.currentTarget) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  target.setPointerCapture?.(event.pointerId);
  const { control } = selection;
  const { x, y } = control.metadata.layout;
  const drag = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: x,
    startY: y,
    startLeft: screenStart(control, 'x'),
    startTop: screenStart(control, 'y'),
    groupId: Blockly.utils.idGenerator.genUid(),
  };
  const moveAxis = (name) => selection.freeAxes.includes(name) && (!axis || axis === name);
  selection.overlay.root.classList.add('dragging');

  const onPointerMove = (moveEvent) => {
    if (moveEvent.pointerId !== drag.pointerId || !selection) return;
    const scale = guiScale();
    const nextX = moveAxis('x')
      ? anchoredOffset(
          control,
          'x',
          drag.startLeft + (moveEvent.clientX - drag.startClientX) * scale
        )
      : drag.startX;
    const nextY = moveAxis('y')
      ? anchoredOffset(
          control,
          'y',
          drag.startTop + (moveEvent.clientY - drag.startClientY) * scale
        )
      : drag.startY;
    Blockly.Events.setGroup(drag.groupId);
    try {
      moveTo(nextX, nextY);
    } finally {
      Blockly.Events.setGroup(false);
    }
  };
  const onPointerUp = (upEvent) => {
    if (upEvent.pointerId !== drag.pointerId) return;
    target.removeEventListener('pointermove', onPointerMove);
    target.removeEventListener('pointerup', onPointerUp);
    target.removeEventListener('pointercancel', onPointerUp);
    selection?.overlay.root.classList.remove('dragging');
  };
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerUp);
}

function handleKeydown(event) {
  if (!selection || event.ctrlKey || event.metaKey || event.altKey) return;
  const step = event.shiftKey ? KEY_STEP_FINE : KEY_STEP;
  const moves = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  if (moves[event.key]) {
    event.preventDefault();
    event.stopPropagation();
    nudge(...moves[event.key]);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    const done = event.key === 'Escape' ? selection.onCancel : selection.onConfirm;
    deselectUIControl();
    done?.();
  }
}

function startHud(freeAxes) {
  if (!freeAxes.length) return () => {};
  const build = () =>
    createGizmoMobileHud({
      onMove: (dx, dy) => nudge(dx, dy),
      stepNormal: KEY_STEP_FINE,
      stepFast: KEY_STEP,
      mode: 'arrows',
      stepLabels: ['-', '+'],
      axes: freeAxes,
    });
  let hud = build();
  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      hud?.();
      hud = build();
    }, 200);
  };
  window.addEventListener('flock:canvas-resize', onResize);
  return () => {
    clearTimeout(resizeTimer);
    window.removeEventListener('flock:canvas-resize', onResize);
    hud?.();
  };
}

export function selectedUIControl() {
  return selection?.control ?? null;
}

export function selectUIControl(control, { axisColors, onMove, onConfirm, onCancel, onLost } = {}) {
  if (selection?.control === control) return;
  deselectUIControl();
  const block = blockFor(control);
  const canvas = renderCanvas();
  if (!block || !canvas?.parentElement) return;

  const freeAxes = ['x', 'y'].filter((axis) => literalNumberBlock(block, axis === 'x' ? 'X' : 'Y'));
  const overlay = createOverlay(axisColors, freeAxes);
  canvas.parentElement.appendChild(overlay.root);

  selection = { control, overlay, freeAxes, onMove, onConfirm, onCancel };

  overlay.box.addEventListener('pointerdown', (event) => startDrag(event, null));
  for (const [axis, arrow] of Object.entries(overlay.arrows)) {
    arrow.addEventListener('pointerdown', (event) => startDrag(event, axis));
  }

  const renderObserver = flock.scene.onAfterRenderObservable.add(() => {
    if (!selection) return;
    if (!control.parent || control.host !== uiTexture()) {
      deselectUIControl();
      onLost?.();
      return;
    }
    positionOverlay();
  });
  const stopHud = startHud(freeAxes);
  selection.cleanup = () => {
    flock.scene?.onAfterRenderObservable.remove(renderObserver);
    stopHud();
  };

  KeyboardDispatcher.pushMode(handleKeydown, 'ui-control-gizmo');
  positionOverlay();
  canvas.focus({ preventScroll: true });
}

export function dragSelectedUIControl(event) {
  if (selection) startDrag(event, null, selection.overlay.box);
}

export function deselectUIControl() {
  if (!selection) return;
  const { overlay, cleanup } = selection;
  selection = null;
  cleanup?.();
  overlay.root.remove();
  KeyboardDispatcher.removeMode(handleKeydown);
}
