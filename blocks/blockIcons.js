import * as Blockly from 'blockly';
import { toolbox as toolboxDefinition } from '../toolbox.js';

// A purely decorative image field (block-type and category icons). The default
// FieldImage contributes an "empty" placeholder to the block's ARIA label when
// its alt is empty; returning an empty string makes the composer ignore it, so
// the icon is silent to screen readers.
export class DecorativeFieldImage extends Blockly.FieldImage {
  computeAriaLabel() {
    return '';
  }
}

function buildSvgDataUri(svgContent) {
  return 'data:image/svg+xml,' + encodeURIComponent(svgContent);
}

/**
 * Compute the relative luminance of a hex colour string.
 * Returns a value in [0, 1] (0 = black, 1 = white).
 */
function relativeLuminance(hex) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0;
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const r = toLinear(parseInt(clean.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(clean.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(clean.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getIconColorForBackground(hexColor) {
  if (!hexColor || typeof hexColor !== 'string') return 'white';
  const L = relativeLuminance(hexColor);
  return L > 0.179 ? 'black' : 'white';
}

export function makeIconDataUrl(viewBox, pathD, fillColor) {
  return buildSvgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill="${fillColor}" d="${pathD}"/></svg>`
  );
}

function makePathIcon(viewBox, pathD, color) {
  return buildSvgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="${color}" d="${pathD}"/></svg>`
  );
}

const ICON_PATHS = {
  start: {
    viewBox: '0 0 384 512',
    d: 'M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z',
  },
  // Adapted from Font Awesome Free 7.2.0 Repeat icon by @fontawesome - https://fontawesome.com
  // License - https://fontawesome.com/license/free (Icons: CC BY 4.0)
  repeat: {
    viewBox: '0 0 512 512',
    d: 'M107.27,275.93c15.56,0,25.12-4.94,25.12-20.5,0-45.9,35.91-67.81,81.81-67.81h82.55v31.02c0,6.06,3.27,11.63,8.53,14.59s11.74,2.82,16.89-.31l100.31-61.3c4.98-3.03,8.01-8.43,8.01-14.28s-3.03-11.22-8.01-14.28l-100.31-61.3c-5.15-3.17-11.63-3.27-16.89-.31s-8.53,8.53-8.53,14.59v35.16h-82.55c-77.02,0-132.7,45.43-132.7,122.45,0,15.56,10.22,22.29,25.77,22.29ZM404.73,239.32c-15.56,0-25.12,4.94-25.12,20.5,0,45.9-35.91,67.81-81.81,67.81h-82.55v-31.02c0-6.06-3.27-11.63-8.53-14.59-5.26-2.96-11.74-2.82-16.89.31l-100.31,61.3c-4.98,3.03-8.01,8.43-8.01,14.28s3.03,11.22,8.01,14.28l100.31,61.3c5.15,3.17,11.63,3.27,16.89.31,5.26-2.96,8.53-8.53,8.53-14.59v-35.16h82.55c77.02,0,132.7-45.43,132.7-122.45,0-15.56-10.22-22.29-25.77-22.29Z',
  },

  click: {
    viewBox: '0 0 448 512',
    d: 'M429.6 92.1c4.9-11.9 2.1-25.6-7-34.7s-22.8-11.9-34.7-7l-352 144c-14.2 5.8-22.2 20.8-19.3 35.8s16.1 25.8 31.4 25.8l176 0 0 176c0 15.3 10.8 28.4 25.8 31.4s30-5.1 35.8-19.3l144-352z',
  },
  // Custom icon incorporating an adapted element from the Font Awesome Free 7.2.0 Play icon
  // by @fontawesome - https://fontawesome.com
  // License - https://fontawesome.com/license/free (Icons: CC BY 4.0)
  collision: {
    viewBox: '0 0 512 512',
    d: 'M498.89,139.41c-8.08-4.55-18.03-4.33-25.95.48l-154.08,94.16c-7.65,4.65-12.31,12.95-12.31,21.94s4.65,17.23,12.31,21.94l154.08,94.16c7.92,4.87,17.87,5.03,25.95.48,8.08-4.55,13.11-13.11,13.11-22.42v-188.32c0-9.31-5.03-17.87-13.11-22.42ZM256,99.85c-14.64,0-26.5,11.87-26.5,26.5v259.29c0,14.64,11.87,26.5,26.5,26.5s26.5-11.87,26.5-26.5V126.36c0-14.64-11.87-26.5-26.5-26.5ZM193.14,234.07L39.06,139.91c-7.92-4.87-17.87-5.03-25.95-.48C5.03,143.98,0,152.54,0,161.85v188.32c0,9.31,5.03,17.87,13.11,22.42,8.08,4.55,18.03,4.33,25.95-.48l154.08-94.16c7.65-4.65,12.31-12.95,12.31-21.94s-4.65-17.23-12.31-21.94Z',
  },
  keyboard: {
    viewBox: '0 0 576 512',
    d: 'M64 64C28.7 64 0 92.7 0 128V384c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zm16 64h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zm0 96h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V240c0-8.8 7.2-16 16-16zm16 160c-8.8 0-16-7.2-16-16v-32h224v32c0 8.8-7.2 16-16 16H96zm176-160c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H288c-8.8 0-16-7.2-16-16V240zm16-96h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H288c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM160 144c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V144zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V240c0-8.8 7.2-16 16-16zm176 96h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H352c-8.8 0-16-7.2-16-16V320c0-8.8 7.2-16 16-16zm16-96c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V240zm16-96h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zm80 96c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V240zm16-96h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16z',
  },
  press: {
    viewBox: '0 0 512 512',
    d: 'M234.05,305.69c4.66,7.65,12.95,12.31,21.94,12.31s17.23-4.66,21.94-12.31l94.18-154.11c4.87-7.92,5.03-17.87.48-25.95-4.55-8.08-13.11-13.11-22.42-13.11h-188.36c-9.31,0-17.87,5.03-22.42,13.11-4.55,8.08-4.33,18.03.48,25.95l94.18,154.11ZM385.14,350.64H126.86c-13.49,0-24.42,10.94-24.42,24.42s10.94,24.42,24.42,24.42h258.27c13.49,0,24.42-10.94,24.42-24.42s-10.94-24.42-24.42-24.42Z',
  },
  event: {
    viewBox: '0 0 512 512',
    d: 'M416.08,190.86a61.95,61.95,0,1,0,0,123.9,61.95,61.95,0,1,0,0-123.9ZM239.4,119.92c-14.26-8.25-32.51-3.38-40.76,10.88-8.25,14.26-3.38,32.51,10.88,40.76,30.07,17.39,48.75,49.75,48.75,84.43s-18.68,67.04-48.75,84.43c-14.26,8.25-19.13,26.5-10.88,40.76,5.53,9.56,15.55,14.9,25.85,14.9,5.07,0,10.21-1.29,14.91-4.01,48.44-28.02,78.53-80.16,78.53-136.08s-30.09-108.05-78.53-136.07ZM56.11,58.94c-14.26-8.25-32.51-3.38-40.76,10.88-8.25,14.26-3.38,32.51,10.88,40.76,51.78,29.95,83.95,85.67,83.95,145.41s-32.17,115.46-83.95,145.41c-14.26,8.25-19.13,26.5-10.88,40.76,5.53,9.56,15.55,14.9,25.85,14.9,5.07,0,10.21-1.29,14.91-4.01,70.15-40.58,113.73-116.09,113.73-197.06S126.26,99.53,56.11,58.94Z',
  },
  indent: {
    viewBox: '0 0 320 512',
    d: 'M311.1 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L243.2 256 73.9 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z',
  },
  outdent: {
    viewBox: '0 0 320 512',
    d: 'M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z',
  },
  // Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com
  // License - https://fontawesome.com/license/free (Icons: CC BY 4.0)
  section: {
    viewBox: '0 0 512 512',
    d: 'M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H288c-10.1 0-19.6-4.7-25.6-12.8L243.2 57.6C231.1 41.5 212.1 32 192 32H64C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64z',
  },
  sectionOpen: {
    viewBox: '0 0 576 512',
    d: 'M88.7 223.8L0 375.8 0 96C0 60.7 28.7 32 64 32l117.5 0c17 0 33.3 6.7 45.3 18.7l26.5 26.5c12 12 28.3 18.7 45.3 18.7L416 96c35.3 0 64 28.7 64 64l0 32-336 0c-22.8 0-43.8 12.1-55.3 31.8zm27.6 16.1C122.1 230 132.6 224 144 224l400 0c11.5 0 22 6.1 27.7 16.1s5.7 22.2-.1 32.1l-112 192C453.9 474 443.4 480 432 480L32 480c-11.5 0-22-6.1-27.7-16.1s-5.7-22.2 .1-32.1l112-192z',
  },
};

export function makeStartIcon(color) {
  return makePathIcon(ICON_PATHS.start.viewBox, ICON_PATHS.start.d, color);
}
export function makeRepeatIcon(color) {
  return makePathIcon(ICON_PATHS.repeat.viewBox, ICON_PATHS.repeat.d, color);
}
export function makeClickIcon(color) {
  return makePathIcon(ICON_PATHS.click.viewBox, ICON_PATHS.click.d, color);
}
export function makeCollisionIcon(color) {
  return makePathIcon(ICON_PATHS.collision.viewBox, ICON_PATHS.collision.d, color);
}
export function makeKeyboardIcon(color) {
  return makePathIcon(ICON_PATHS.keyboard.viewBox, ICON_PATHS.keyboard.d, color);
}
export function makePressIcon(color) {
  return makePathIcon(ICON_PATHS.press.viewBox, ICON_PATHS.press.d, color);
}
export function makeOnEventIcon(color) {
  return makePathIcon(ICON_PATHS.event.viewBox, ICON_PATHS.event.d, color);
}
export function makeIndentIcon(color) {
  return makePathIcon(ICON_PATHS.indent.viewBox, ICON_PATHS.indent.d, color);
}
export function makeOutdentIcon(color) {
  return makePathIcon(ICON_PATHS.outdent.viewBox, ICON_PATHS.outdent.d, color);
}
export function makeSectionIcon(color, collapsed = false) {
  const icon = collapsed ? ICON_PATHS.section : ICON_PATHS.sectionOpen;
  return makePathIcon(icon.viewBox, icon.d, color);
}

export function makeToggleButtonIcon(isInline, color = 'white') {
  return isInline ? makeOutdentIcon(color) : makeIndentIcon(color);
}

let _currentIconColor = 'white';

export function setCurrentIconColor(color) {
  _currentIconColor = color;
}

export function getCurrentIconColor() {
  return _currentIconColor;
}

export const startIcon = makeStartIcon('white');
export const repeatIcon = makeRepeatIcon('white');
export const clickIcon = makeClickIcon('white');
export const collisionIcon = makeCollisionIcon('white');
export const keyboardIcon = makeKeyboardIcon('white');
export const pressIcon = makePressIcon('white');
export const eventIcon = makeOnEventIcon('white');

export const BLOCK_ICON_FIELD_NAME = 'BLOCK_ICON';
// A second copy of the block icon, inserted into Blockly's auto-generated
// collapsed-summary input so the icon survives native collapse (which
// otherwise hides the whole input row the real BLOCK_ICON field lives in).
export const BLOCK_ICON_COLLAPSED_FIELD_NAME = 'BLOCK_ICON_COLLAPSED';
export const TOGGLE_BUTTON_FIELD_NAME = 'TOGGLE_BUTTON';
const LOW_VISION_ICON_FIELD_NAME = 'LOW_VISION_CATEGORY_ICON';
const LOW_VISION_BAR_FIELD_NAME = 'LOW_VISION_CATEGORY_BAR';

const CATEGORY_ICON_PATH_BY_STYLE = {
  events_blocks: '../images/events.svg',
  scene_blocks: '../images/scene.svg',
  scene_meshes_blocks: '../images/meshes.svg',
  scene_xr_blocks: '../images/xr.svg',
  scene_lights_blocks: '../images/lights.svg',
  scene_camera_blocks: '../images/camera.svg',
  transform_blocks: '../images/motion.svg',
  transform_physics_blocks: '../images/physics.svg',
  transform_connect_blocks: '../images/connect.svg',
  transform_combine_blocks: '../images/combine.svg',
  animate_blocks: '../images/animate.svg',
  animate_keyframe_blocks: '../images/keyframe.svg',
  materials_blocks: '../images/looks.svg',
  sound_blocks: '../images/sound.svg',
  sensing_blocks: '../images/sensing.svg',
  snippets_blocks: '../images/snippets.svg',
  snippets_physics_blocks: '../images/physics.svg',
  snippets_arrows_blocks: '../images/arrows.svg',
  control_blocks: '../images/control.svg',
  logic_blocks: '../images/conditions.svg',
  variable_blocks: '../images/variables.svg',
  variables_blocks: '../images/variables.svg',
  text_blocks: '../images/text.svg',
  list_blocks: '../images/lists.svg',
  lists_blocks: '../images/lists.svg',
  math_blocks: '../images/math.svg',
  procedure_blocks: '../images/functions.svg',
};

const CATEGORY_ACCENT_BY_STYLE = {
  events_blocks: '#d99d98',
  scene_blocks: '#bed998',
  scene_meshes_blocks: '#bed998',
  scene_xr_blocks: '#bed998',
  scene_lights_blocks: '#bed998',
  scene_camera_blocks: '#bed998',
  transform_blocks: '#d3d998',
  transform_physics_blocks: '#d3d998',
  transform_connect_blocks: '#d3d998',
  transform_combine_blocks: '#d3d998',
  animate_blocks: '#d9c898',
  animate_keyframe_blocks: '#d9c898',
  materials_blocks: '#c398d9',
  sound_blocks: '#d9b398',
  sensing_blocks: '#98d9d9',
  snippets_blocks: '#98c3d9',
  snippets_physics_blocks: '#98c3d9',
  snippets_arrows_blocks: '#98c3d9',
  control_blocks: '#98d998',
  logic_blocks: '#98b8d9',
  variable_blocks: '#d998b8',
  variables_blocks: '#d998b8',
  text_blocks: '#98d9c3',
  list_blocks: '#ad98d9',
  lists_blocks: '#ad98d9',
  math_blocks: '#98a3d9',
  procedure_blocks: '#ce98d9',
};
const LOW_VISION_ICON_DATA_URL_BY_STYLE = new Map();
const LOW_VISION_ICON_SVG_BY_STYLE = new Map();
const LOW_VISION_ICON_LOAD_PROMISE_BY_STYLE = new Map();
const LOW_VISION_REFRESH_PENDING_BY_WORKSPACE = new WeakMap();

const LOW_VISION_STYLE_BY_ICON_FILE = {
  'events.svg': 'events_blocks',
  'scene.svg': 'scene_blocks',
  'meshes.svg': 'scene_meshes_blocks',
  'xr.svg': 'scene_xr_blocks',
  'lights.svg': 'scene_lights_blocks',
  'camera.svg': 'scene_camera_blocks',
  'motion.svg': 'transform_blocks',
  'physics.svg': 'transform_physics_blocks',
  'connect.svg': 'transform_connect_blocks',
  'combine.svg': 'transform_combine_blocks',
  'animate.svg': 'animate_blocks',
  'keyframe.svg': 'animate_keyframe_blocks',
  'looks.svg': 'materials_blocks',
  'sound.svg': 'sound_blocks',
  'sensing.svg': 'sensing_blocks',
  'snippets.svg': 'snippets_blocks',
  'arrows.svg': 'snippets_arrows_blocks',
  'control.svg': 'control_blocks',
  'conditions.svg': 'logic_blocks',
  'variables.svg': 'variable_blocks',
  'data.svg': 'variable_blocks',
  'text.svg': 'text_blocks',
  'lists.svg': 'list_blocks',
  'math.svg': 'math_blocks',
  'functions.svg': 'procedure_blocks',
};
const LOW_VISION_STYLE_BY_BLOCK_TYPE = buildLowVisionStyleByBlockType();
const LOW_VISION_SUBCATEGORY_STYLE_OVERRIDES = new Set([
  'scene_blocks',
  'transform_blocks',
  'animate_blocks',
  'snippets_blocks',
]);

const BLOCK_ICON_MAKERS = {
  start: makeStartIcon,
  forever: makeRepeatIcon,
  when_clicked: makeClickIcon,
  on_collision: makeCollisionIcon,
  when_key_event: makeKeyboardIcon,
  when_action_event: makePressIcon,
  on_event: makeOnEventIcon,
  section: makeSectionIcon,
};

// Sizes (in px) the collapsed-summary copy of each block's icon should render
// at, matching the size used for its expanded BLOCK_ICON field. Section is
// excluded: it never goes through native collapse (see setCollapsed override
// in section.js), so it has no collapsed-summary copy to size.
const BLOCK_ICON_COLLAPSED_SIZES = {
  start: { width: 18, height: 18 },
  forever: { width: 18, height: 18 },
  when_clicked: { width: 22, height: 22 },
  on_collision: { width: 24, height: 24 },
  when_key_event: { width: 36, height: 36 },
  when_action_event: { width: 32, height: 32 },
  on_event: { width: 28, height: 28 },
};

export function updateBlockIcons(workspace, iconColor) {
  if (!workspace) return;
  const blocks = getWorkspaceAndFlyoutBlocks(workspace);
  for (const block of blocks) {
    if (!block || typeof block.getField !== 'function') continue;
    const maker = BLOCK_ICON_MAKERS[block.type];
    if (!maker) continue;
    const iconField = block.getField(BLOCK_ICON_FIELD_NAME);
    if (iconField) {
      iconField.setValue(
        block.type === 'section' ? maker(iconColor, block.sectionCollapsed_) : maker(iconColor)
      );
    }
    const collapsedIconField = block.getField(BLOCK_ICON_COLLAPSED_FIELD_NAME);
    if (collapsedIconField) {
      collapsedIconField.setValue(maker(iconColor));
    }
  }
}

export function updateAllBlockIcons(workspace, iconColor) {
  updateBlockIcons(workspace, iconColor);
}

// Inserts a copy of the block's icon into Blockly's auto-generated
// collapsed-summary input, so it's still visible once the block is natively
// collapsed. Returns true once handled (inserted, already present, or not
// applicable to this block type), false if the collapsed input doesn't exist
// yet - Blockly can create it on a later render pass, so the caller should
// retry.
function insertCollapsedBlockIcon(block) {
  if (!block || typeof block.getInput !== 'function') return true;
  const maker = BLOCK_ICON_MAKERS[block.type];
  const size = BLOCK_ICON_COLLAPSED_SIZES[block.type];
  if (!maker || !size) return true;
  const collapsedInput = block.getInput(Blockly.Block.COLLAPSED_INPUT_NAME);
  if (!collapsedInput) return false;
  if (collapsedInput.fieldRow?.some((field) => field.name === BLOCK_ICON_COLLAPSED_FIELD_NAME)) {
    return true;
  }
  collapsedInput.insertFieldAt(
    0,
    new DecorativeFieldImage(maker(getCurrentIconColor()), size.width, size.height, '', null),
    BLOCK_ICON_COLLAPSED_FIELD_NAME
  );
  return true;
}

// Blockly may not have created the collapsed-summary input yet at the moment
// a block's 'collapsed' change event fires, since rendering can happen on a
// later pass - retry once via rAF if the first attempt finds nothing to
// attach to.
export function updateCollapsedBlockIcon(block) {
  if (insertCollapsedBlockIcon(block)) return;
  if (typeof requestAnimationFrame !== 'function') return;
  requestAnimationFrame(() => insertCollapsedBlockIcon(block));
}

// Catch-up pass for blocks that load already collapsed (e.g. from saved
// workspace JSON), since deserialization doesn't fire per-block 'collapsed'
// change events.
export function syncCollapsedBlockIcons(workspace) {
  if (!workspace) return;
  const blocks = getWorkspaceAndFlyoutBlocks(workspace);
  for (const block of blocks) {
    if (block?.isCollapsed?.()) updateCollapsedBlockIcon(block);
  }
}

function getBlockStyleName(block) {
  if (!block) return '';
  if (typeof block.getStyleName === 'function') {
    return block.getStyleName() || '';
  }
  return block.styleName_ || '';
}

function scheduleLowVisionIconRefresh(workspace, styleName) {
  if (!workspace || !styleName) return;
  const pendingLoad = LOW_VISION_ICON_LOAD_PROMISE_BY_STYLE.get(styleName);
  if (!pendingLoad) return;

  let pendingStyles = LOW_VISION_REFRESH_PENDING_BY_WORKSPACE.get(workspace);
  if (!pendingStyles) {
    pendingStyles = new Set();
    LOW_VISION_REFRESH_PENDING_BY_WORKSPACE.set(workspace, pendingStyles);
  }
  if (pendingStyles.has(styleName)) return;
  pendingStyles.add(styleName);

  pendingLoad
    .then(() => {
      pendingStyles.delete(styleName);
      applyLowVisionCategoryIcons(workspace);
    })
    .catch(() => {
      pendingStyles.delete(styleName);
    });
}

function getLowVisionStyleNameForBlock(block) {
  const styleName = getBlockStyleName(block);
  if (styleName && !LOW_VISION_SUBCATEGORY_STYLE_OVERRIDES.has(styleName)) {
    return styleName;
  }

  const explicitSubcategoryStyle = LOW_VISION_STYLE_BY_BLOCK_TYPE[block?.type];
  if (explicitSubcategoryStyle) return explicitSubcategoryStyle;
  if (styleName) return styleName;

  const blockType = block?.type || '';
  if (blockType.startsWith('lists_')) return 'list_blocks';
  if (blockType.startsWith('variables_')) return 'variable_blocks';
  return styleName;
}

function withSvgFill(svg, fillColor) {
  if (!svg || !fillColor || !svg.includes('<svg')) return svg;
  const fillStyle = `<style>*{fill:${fillColor} !important;}</style>`;
  if (svg.includes('</svg>')) {
    return svg.replace(/<svg([^>]*)>/, `<svg$1>${fillStyle}`);
  }
  return svg;
}

function getStyleNameFromIconPath(iconPath) {
  const iconName = (iconPath || '').toLowerCase().split('/').pop();
  return LOW_VISION_STYLE_BY_ICON_FILE[iconName] || '';
}

function buildLowVisionStyleByBlockType() {
  const byType = {};

  const walkToolbox = (items, inheritedStyle = '') => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      if (item.kind === 'category') {
        const categoryStyle = getStyleNameFromIconPath(item.icon) || inheritedStyle;
        walkToolbox(item.contents, categoryStyle);
        continue;
      }

      if (item.kind === 'block' && item.type && inheritedStyle) {
        byType[item.type] = inheritedStyle;
      }
    }
  };

  walkToolbox(toolboxDefinition?.contents || []);
  return byType;
}

export function makeLowVisionCategoryIconDataUrl(styleName) {
  if (LOW_VISION_ICON_DATA_URL_BY_STYLE.has(styleName)) {
    return LOW_VISION_ICON_DATA_URL_BY_STYLE.get(styleName);
  }
  const iconSvg = LOW_VISION_ICON_SVG_BY_STYLE.get(styleName);
  if (!iconSvg) {
    loadLowVisionCategoryIconSvg(styleName);
    return '';
  }
  const accent = CATEGORY_ACCENT_BY_STYLE[styleName];
  if (!iconSvg || !accent) return '';
  const dataUrl = buildSvgDataUri(withSvgFill(iconSvg, accent));
  LOW_VISION_ICON_DATA_URL_BY_STYLE.set(styleName, dataUrl);
  return dataUrl;
}

function loadLowVisionCategoryIconSvg(styleName) {
  if (LOW_VISION_ICON_SVG_BY_STYLE.has(styleName)) {
    return Promise.resolve(LOW_VISION_ICON_SVG_BY_STYLE.get(styleName));
  }
  if (LOW_VISION_ICON_LOAD_PROMISE_BY_STYLE.has(styleName)) {
    return LOW_VISION_ICON_LOAD_PROMISE_BY_STYLE.get(styleName);
  }
  const iconPath = CATEGORY_ICON_PATH_BY_STYLE[styleName];
  if (!iconPath) return Promise.resolve('');

  const iconUrl = new URL(iconPath, import.meta.url).href;
  const loadPromise = fetch(iconUrl)
    .then((response) => (response.ok ? response.text() : ''))
    .then((svgText) => {
      LOW_VISION_ICON_SVG_BY_STYLE.set(styleName, svgText || '');
      LOW_VISION_ICON_LOAD_PROMISE_BY_STYLE.delete(styleName);
      return svgText || '';
    })
    .catch(() => {
      LOW_VISION_ICON_LOAD_PROMISE_BY_STYLE.delete(styleName);
      return '';
    });
  LOW_VISION_ICON_LOAD_PROMISE_BY_STYLE.set(styleName, loadPromise);
  return loadPromise;
}

export function preloadLowVisionCategoryIcons() {
  if (typeof Image === 'undefined' || typeof fetch !== 'function') {
    return Promise.resolve();
  }
  const pendingDecodes = [];
  for (const styleName of Object.keys(CATEGORY_ICON_PATH_BY_STYLE)) {
    pendingDecodes.push(
      loadLowVisionCategoryIconSvg(styleName).then(() => {
        const dataUrl = makeLowVisionCategoryIconDataUrl(styleName);
        if (!dataUrl) return;
        const img = new Image();
        img.decoding = 'sync';
        img.src = dataUrl;
        if (typeof img.decode === 'function') {
          return img.decode().catch(() => {});
        }
      })
    );
  }
  return Promise.allSettled(pendingDecodes);
}

/* A full-block field paints the block itself, and only while it is the block's
   only field — Blockly's blockIsSimpleReporter() rejects a field row longer than
   one. Inserting the category icon therefore stops a colour swatch rendering at
   all, leaving the block on its theme fill with the icon on top. */
function hasFullBlockField(block) {
  for (const input of block.inputList) {
    for (const field of input.fieldRow) {
      if (typeof field.isFullBlockField !== 'function') continue;
      try {
        if (field.isFullBlockField()) return true;
      } catch {
        // Throws when the field has no source block; such a field is not rendered
        // as a full-block field either, so treat it as not one.
      }
    }
  }
  return false;
}

export function applyLowVisionCategoryIcons(workspace) {
  if (!workspace) return;
  const blocks = getWorkspaceAndFlyoutBlocks(workspace);
  for (const block of blocks) {
    if (!block || typeof block.getField !== 'function' || !Array.isArray(block.inputList)) {
      continue;
    }
    const styleName = getLowVisionStyleNameForBlock(block);
    const iconPath = makeLowVisionCategoryIconDataUrl(styleName);
    if (!iconPath) {
      scheduleLowVisionIconRefresh(workspace, styleName);
      continue;
    }

    const firstInput = block.inputList?.[0];
    if (!firstInput) continue;
    if (hasFullBlockField(block)) continue;
    if (!block.getField(LOW_VISION_ICON_FIELD_NAME)) {
      firstInput.insertFieldAt(
        0,
        new DecorativeFieldImage(iconPath, 18, 18, '', null),
        LOW_VISION_ICON_FIELD_NAME
      );
    }
  }
}

export function clearLowVisionCategoryIcons(workspace) {
  if (!workspace) return;
  const blocks = getWorkspaceAndFlyoutBlocks(workspace);
  for (const block of blocks) {
    if (!block || typeof block.getField !== 'function') {
      continue;
    }
    const firstInput = block.inputList?.[0];
    if (!firstInput || typeof firstInput.removeField !== 'function') continue;
    if (block.getField(LOW_VISION_BAR_FIELD_NAME))
      firstInput.removeField(LOW_VISION_BAR_FIELD_NAME, true);
    if (block.getField(LOW_VISION_ICON_FIELD_NAME))
      firstInput.removeField(LOW_VISION_ICON_FIELD_NAME, true);
  }
}

export function getWorkspaceAndFlyoutBlocks(workspace) {
  const blocks = workspace.getAllBlocks(false) || [];
  const flyoutWorkspace = workspace.getFlyout?.()?.getWorkspace?.();
  if (flyoutWorkspace) {
    blocks.push(...(flyoutWorkspace.getAllBlocks(false) || []));
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// micro:bit status icons (add_microbit block). A coloured disc with a white
// glyph: grey = no board bound (click to connect), amber = connecting or
// flashing, green + plug = tethered over USB, green + waves = heard over
// radio. Font Awesome Free v7.2.0 glyph paths (see licence comment above).

const MICROBIT_GLYPHS = {
  plug: {
    width: 384,
    height: 512,
    d: 'M96 0C78.3 0 64 14.3 64 32l0 96 64 0 0-96c0-17.7-14.3-32-32-32zM288 0c-17.7 0-32 14.3-32 32l0 96 64 0 0-96c0-17.7-14.3-32-32-32zM32 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l0 32c0 77.4 55 142 128 156.8l0 67.2c0 17.7 14.3 32 32 32s32-14.3 32-32l0-67.2C297 398 352 333.4 352 256l0-32c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 160z',
  },
  waves: {
    width: 640,
    height: 512,
    d: 'M54.2 202.9C123.2 136.7 216.8 96 320 96s196.8 40.7 265.8 106.9c12.8 12.2 33 11.8 45.2-.9s11.8-33-.9-45.2C549.7 79.5 440.4 32 320 32S90.3 79.5 9.8 156.7C-2.9 169-3.3 189.2 8.9 202s32.5 13.2 45.2 .9zM320 256c56.8 0 108.6 21.1 148.2 56c13.3 11.7 33.5 10.4 45.2-2.8s10.4-33.5-2.8-45.2C459.8 219.2 393 192 320 192s-139.8 27.2-190.5 72c-13.3 11.7-14.5 32-2.8 45.2s32 14.5 45.2 2.8c39.5-34.9 91.3-56 148.2-56zm64 160a64 64 0 1 0 -128 0 64 64 0 1 0 128 0z',
  },
  hourglass: {
    width: 384,
    height: 512,
    d: 'M32 0C14.3 0 0 14.3 0 32S14.3 64 32 64l0 11c0 42.4 16.9 83.1 46.9 113.1L146.7 256 78.9 323.9C48.9 353.9 32 394.6 32 437l0 11c-17.7 0-32 14.3-32 32s14.3 32 32 32l32 0 256 0 32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l0-11c0-42.4-16.9-83.1-46.9-113.1L237.3 256l67.9-67.9c30-30 46.9-70.7 46.9-113.1l0-11c17.7 0 32-14.3 32-32s-14.3-32-32-32L320 0 64 0 32 0zM96 75l0-11 192 0 0 11c0 25.5-10.1 49.9-28.1 67.9L192 210.7l-67.9-67.9C106.1 124.9 96 100.5 96 75z',
  },
};

const MICROBIT_STATUS_SPECS = {
  unbound: { color: '#757575', glyph: 'plug' },
  busy: { color: '#e6a817', glyph: 'hourglass' },
  tethered: { color: '#2e8b57', glyph: 'plug' },
  radio: { color: '#2e8b57', glyph: 'waves' },
};

export function makeMicrobitStatusIcon(status) {
  const spec = MICROBIT_STATUS_SPECS[status] ?? MICROBIT_STATUS_SPECS.unbound;
  const glyph = MICROBIT_GLYPHS[spec.glyph];
  const scale = 280 / Math.max(glyph.width, glyph.height);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<circle cx="256" cy="256" r="256" fill="${spec.color}"/>` +
    `<g transform="translate(256 256) scale(${scale.toFixed(3)}) ` +
    `translate(${-glyph.width / 2} ${-glyph.height / 2})">` +
    `<path fill="white" d="${glyph.d}"/></g></svg>`;
  return buildSvgDataUri(svg);
}
