import * as Blockly from "blockly";
import { toolbox as toolboxDefinition } from "../toolbox.js";
import eventsIconSvg from "../images/events.svg?raw";
import sceneIconSvg from "../images/scene.svg?raw";
import meshesIconSvg from "../images/meshes.svg?raw";
import xrIconSvg from "../images/xr.svg?raw";
import lightsIconSvg from "../images/lights.svg?raw";
import cameraIconSvg from "../images/camera.svg?raw";
import transformIconSvg from "../images/motion.svg?raw";
import physicsIconSvg from "../images/physics.svg?raw";
import connectIconSvg from "../images/connect.svg?raw";
import combineIconSvg from "../images/combine.svg?raw";
import animateIconSvg from "../images/animate.svg?raw";
import keyframeIconSvg from "../images/keyframe.svg?raw";
import materialsIconSvg from "../images/looks.svg?raw";
import soundIconSvg from "../images/sound.svg?raw";
import sensingIconSvg from "../images/sensing.svg?raw";
import snippetsIconSvg from "../images/snippets.svg?raw";
import arrowsIconSvg from "../images/arrows.svg?raw";
import controlIconSvg from "../images/control.svg?raw";
import logicIconSvg from "../images/conditions.svg?raw";
import variableIconSvg from "../images/variables.svg?raw";
import textIconSvg from "../images/text.svg?raw";
import listIconSvg from "../images/lists.svg?raw";
import mathIconSvg from "../images/math.svg?raw";
import procedureIconSvg from "../images/functions.svg?raw";

function buildSvgDataUri(svgContent) {
  return "data:image/svg+xml," + encodeURIComponent(svgContent);
}

/**
 * Compute the relative luminance of a hex colour string.
 * Returns a value in [0, 1] (0 = black, 1 = white).
 */
function relativeLuminance(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;
  const toLinear = (c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const r = toLinear(parseInt(clean.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(clean.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(clean.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getIconColorForBackground(hexColor) {
  if (!hexColor || typeof hexColor !== "string") return "white";
  const L = relativeLuminance(hexColor);
  return L > 0.179 ? "black" : "white";
}

export function makeIconDataUrl(viewBox, pathD, fillColor) {
  return buildSvgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill="${fillColor}" d="${pathD}"/></svg>`,
  );
}

function makePathIcon(viewBox, pathD, color) {
  return buildSvgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="${color}" d="${pathD}"/></svg>`,
  );
}

const ICON_PATHS = {
  start: {
    viewBox: "0 0 384 512",
    d: "M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z",
  },
  repeat: {
    viewBox: "0 0 720 512",
    d: "M470.6 118.6c12.5-12.5 12.5-32.8 0-45.3l-64-64c-9.2-9.2-22.9-11.9-34.9-6.9S352 19.1 352 32l0 32-160 0C86 64 0 150 0 256 0 273.7 14.3 288 32 288s32-14.3 32-32c0-70.7 57.3-128 128-128l160 0 0 32c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l64-64zM41.4 393.4c-12.5 12.5-12.5 32.8 0 45.3l64 64c9.2 9.2 22.9 11.9 34.9 6.9S160 492.9 160 480l0-32 160 0c106 0 192-86 192-192 0-17.7-14.3-32-32-32s-32 14.3-32 32c0 70.7-57.3 128-128 128l-160 0 0-32c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9l-64 64z",
  },

  click: {
    viewBox: "0 0 448 512",
    d: "M77.3 2.5c8.1-4.1 17.9-3.2 25.1 2.3l320 239.9c8.3 6.2 11.6 17 8.4 26.8s-12.4 16.4-22.8 16.4l-152.3 0 88.9 177.7c7.9 15.8 1.5 35-14.3 42.9s-35 1.5-42.9-14.3l-88.9-177.7-91.3 121.8c-6.2 8.3-17 11.6-26.8 8.4S64 434.3 64 424L64 24c0-9.1 5.1-17.4 13.3-21.5z",
  },
  collision: {
    viewBox: "0 0 448 512",
    d: "M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z",
  },
  keyboard: {
    viewBox: "0 0 576 512",
    d: "M64 64C28.7 64 0 92.7 0 128V384c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zm16 64h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zm0 96h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V240c0-8.8 7.2-16 16-16zm16 160c-8.8 0-16-7.2-16-16v-32h224v32c0 8.8-7.2 16-16 16H96zm176-160c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H288c-8.8 0-16-7.2-16-16V240zm16-96h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H288c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM160 144c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V144zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V240c0-8.8 7.2-16 16-16zm176 96h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H352c-8.8 0-16-7.2-16-16V320c0-8.8 7.2-16 16-16zm16-96c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V240zm16-96h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zm80 96c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V240zm16-96h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16z",
  },
  press: {
    viewBox: "0 0 640 512",
    d: "M256 0a256 256 0 1 0 0 512 256 256 0 1 0 0-512zM244.7 387.3l-104-104c-4.6-4.6-5.9-11.5-3.5-17.4s8.3-9.9 14.8-9.9l56 0 0-96c0-17.7 14.3-32 32-32l32 0c17.7 0 32 14.3 32 32l0 96 56 0c6.5 0 12.3 3.9 14.8 9.9s1.1 12.9-3.5 17.4l-104 104c-6.2 6.2-16.4 6.2-22.6 0z",
  },
  event: {
    viewBox: "0 0 640 640",
    d: "M352 96l64 0c17.7 0 32 14.3 32 32l0 256c0 17.7-14.3 32-32 32l-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0c53 0 96-43 96-96l0-256c0-53-43-96-96-96l-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32zm-9.4 182.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L242.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l210.7 0-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l128-128z",
  },
};

export function makeStartIcon(color) {
  return makePathIcon(ICON_PATHS.start.viewBox, ICON_PATHS.start.d, color);
}
export function makeRepeatIcon(color) {
  return makePathIcon(ICON_PATHS.repeat.viewBox, ICON_PATHS.repeat.d, color);
}
export function makeClickIcon(color) {
  return makePathIcon(
    ICON_PATHS.click.viewBox,
    ICON_PATHS.click.d,
    color,
  );
}
export function makeCollisionIcon(color) {
  return makePathIcon(ICON_PATHS.collision.viewBox, ICON_PATHS.collision.d, color);
}
export function makeKeyboardIcon(color) {
  return makePathIcon(
    ICON_PATHS.keyboard.viewBox,
    ICON_PATHS.keyboard.d,
    color,
  );
}
export function makePressIcon(color) {
  return makePathIcon(ICON_PATHS.press.viewBox, ICON_PATHS.press.d, color);
}
export function makeOnEventIcon(color) {
  return makePathIcon(ICON_PATHS.event.viewBox, ICON_PATHS.event.d, color);
}

let _currentIconColor = "white";

export function setCurrentIconColor(color) {
  _currentIconColor = color;
}

export function getCurrentIconColor() {
  return _currentIconColor;
}

export const startIcon = makeStartIcon("white");
export const repeatIcon = makeRepeatIcon("white");
export const clickIcon = makeClickIcon("white");
export const collisionIcon = makeCollisionIcon("white");
export const keyboardIcon = makeKeyboardIcon("white");
export const pressIcon = makePressIcon("white");
export const eventIcon = makeOnEventIcon("white");

export const BLOCK_ICON_FIELD_NAME = "BLOCK_ICON";
export const TOGGLE_BUTTON_FIELD_NAME = "TOGGLE_BUTTON";
const LOW_VISION_ICON_FIELD_NAME = "LOW_VISION_CATEGORY_ICON";
const LOW_VISION_BAR_FIELD_NAME = "LOW_VISION_CATEGORY_BAR";

const CATEGORY_ICON_BY_STYLE = {
  events_blocks: eventsIconSvg,
  scene_blocks: sceneIconSvg,
  scene_meshes_blocks: meshesIconSvg,
  scene_xr_blocks: xrIconSvg,
  scene_lights_blocks: lightsIconSvg,
  scene_camera_blocks: cameraIconSvg,
  transform_blocks: transformIconSvg,
  transform_physics_blocks: physicsIconSvg,
  transform_connect_blocks: connectIconSvg,
  transform_combine_blocks: combineIconSvg,
  animate_blocks: animateIconSvg,
  animate_keyframe_blocks: keyframeIconSvg,
  materials_blocks: materialsIconSvg,
  sound_blocks: soundIconSvg,
  sensing_blocks: sensingIconSvg,
  snippets_blocks: snippetsIconSvg,
  snippets_physics_blocks: physicsIconSvg,
  snippets_arrows_blocks: arrowsIconSvg,
  control_blocks: controlIconSvg,
  logic_blocks: logicIconSvg,
  variable_blocks: variableIconSvg,
  variables_blocks: variableIconSvg,
  text_blocks: textIconSvg,
  list_blocks: listIconSvg,
  lists_blocks: listIconSvg,
  math_blocks: mathIconSvg,
  procedure_blocks: procedureIconSvg,
};

const CATEGORY_ACCENT_BY_STYLE = {
  events_blocks: "#d99d98",
  scene_blocks: "#bed998",
  scene_meshes_blocks: "#bed998",
  scene_xr_blocks: "#bed998",
  scene_lights_blocks: "#bed998",
  scene_camera_blocks: "#bed998",
  transform_blocks: "#d3d998",
  transform_physics_blocks: "#d3d998",
  transform_connect_blocks: "#d3d998",
  transform_combine_blocks: "#d3d998",
  animate_blocks: "#d9c898",
  animate_keyframe_blocks: "#d9c898",
  materials_blocks: "#c398d9",
  sound_blocks: "#d9b398",
  sensing_blocks: "#98d9d9",
  snippets_blocks: "#98c3d9",
  snippets_physics_blocks: "#98c3d9",
  snippets_arrows_blocks: "#98c3d9",
  control_blocks: "#98d998",
  logic_blocks: "#98b8d9",
  variable_blocks: "#d998b8",
  variables_blocks: "#d998b8",
  text_blocks: "#98d9c3",
  list_blocks: "#ad98d9",
  lists_blocks: "#ad98d9",
  math_blocks: "#98a3d9",
  procedure_blocks: "#ce98d9",
};
const LOW_VISION_ICON_DATA_URL_BY_STYLE = new Map();

const LOW_VISION_STYLE_BY_ICON_FILE = {
  "events.svg": "events_blocks",
  "scene.svg": "scene_blocks",
  "meshes.svg": "scene_meshes_blocks",
  "xr.svg": "scene_xr_blocks",
  "lights.svg": "scene_lights_blocks",
  "camera.svg": "scene_camera_blocks",
  "motion.svg": "transform_blocks",
  "physics.svg": "transform_physics_blocks",
  "connect.svg": "transform_connect_blocks",
  "combine.svg": "transform_combine_blocks",
  "animate.svg": "animate_blocks",
  "keyframe.svg": "animate_keyframe_blocks",
  "looks.svg": "materials_blocks",
  "sound.svg": "sound_blocks",
  "sensing.svg": "sensing_blocks",
  "snippets.svg": "snippets_blocks",
  "arrows.svg": "snippets_arrows_blocks",
  "control.svg": "control_blocks",
  "conditions.svg": "logic_blocks",
  "variables.svg": "variable_blocks",
  "data.svg": "variable_blocks",
  "text.svg": "text_blocks",
  "lists.svg": "list_blocks",
  "math.svg": "math_blocks",
  "functions.svg": "procedure_blocks",
};
const LOW_VISION_STYLE_BY_BLOCK_TYPE = buildLowVisionStyleByBlockType();

export function makeInlineIcon(color) {
  const svg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="122.88px" height="80.593px" viewBox="0 0 122.88 80.593" xml:space="preserve"><g><polygon fill="${color}" points="122.88,80.593 122.88,49.772 61.44,0 0,49.772 0,80.593 61.44,30.82 122.88,80.593"/></g></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

const BLOCK_ICON_MAKERS = {
  start: makeStartIcon,
  forever: makeRepeatIcon,
  when_clicked: makeClickIcon,
  on_collision: makeCollisionIcon,
  when_key_event: makeKeyboardIcon,
  when_action_event: makePressIcon,
  on_event: makeOnEventIcon,
};

export function updateBlockIcons(workspace, iconColor) {
  if (!workspace) return;
  const blocks = getWorkspaceAndFlyoutBlocks(workspace);
  for (const block of blocks) {
    if (!block || typeof block.getField !== "function") continue;
    const iconField = block.getField(BLOCK_ICON_FIELD_NAME);
    if (iconField) {
      const maker = BLOCK_ICON_MAKERS[block.type];
      if (maker) {
        iconField.setValue(maker(iconColor));
      }
    }
  }
}

export function updateAllBlockIcons(workspace, iconColor) {
  updateBlockIcons(workspace, iconColor);
}

function getBlockStyleName(block) {
  if (!block) return "";
  if (typeof block.getStyleName === "function") {
    return block.getStyleName() || "";
  }
  return block.styleName_ || "";
}

function getCategoryIconForBlock(block) {
  const styleName = getLowVisionStyleNameForBlock(block);
  return makeLowVisionCategoryIconDataUrl(styleName);
}

function getLowVisionStyleNameForBlock(block) {
  const explicitSubcategoryStyle = LOW_VISION_STYLE_BY_BLOCK_TYPE[block?.type];
  if (explicitSubcategoryStyle) return explicitSubcategoryStyle;

  const styleName = getBlockStyleName(block);
  if (styleName) return styleName;

  const blockType = block?.type || "";
  if (blockType.startsWith("lists_")) return "list_blocks";
  if (blockType.startsWith("variables_")) return "variable_blocks";
  return styleName;
}

function withSvgFill(svg, fillColor) {
  if (!svg || !fillColor || !svg.includes("<svg")) return svg;
  const fillStyle = `<style>*{fill:${fillColor} !important;}</style>`;
  if (svg.includes("</svg>")) {
    return svg.replace(/<svg([^>]*)>/, `<svg$1>${fillStyle}`);
  }
  return svg;
}

function getStyleNameFromIconPath(iconPath) {
  const iconName = (iconPath || "").toLowerCase().split("/").pop();
  return LOW_VISION_STYLE_BY_ICON_FILE[iconName] || "";
}

function buildLowVisionStyleByBlockType() {
  const byType = {};

  const walkToolbox = (items, inheritedStyle = "") => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;

      if (item.kind === "category") {
        const categoryStyle =
          getStyleNameFromIconPath(item.icon) || inheritedStyle;
        walkToolbox(item.contents, categoryStyle);
        continue;
      }

      if (item.kind === "block" && item.type && inheritedStyle) {
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
  const iconSvg = CATEGORY_ICON_BY_STYLE[styleName];
  const accent = CATEGORY_ACCENT_BY_STYLE[styleName];
  if (!iconSvg || !accent) return "";
  const dataUrl = buildSvgDataUri(withSvgFill(iconSvg, accent));
  LOW_VISION_ICON_DATA_URL_BY_STYLE.set(styleName, dataUrl);
  return dataUrl;
}

export function preloadLowVisionCategoryIcons() {
  if (typeof Image === "undefined") return;
  for (const styleName of Object.keys(CATEGORY_ICON_BY_STYLE)) {
    const dataUrl = makeLowVisionCategoryIconDataUrl(styleName);
    if (!dataUrl) continue;
    const img = new Image();
    img.decoding = "sync";
    img.src = dataUrl;
  }
}

export function applyLowVisionCategoryIcons(workspace) {
  if (!workspace) return;
  const blocks = getWorkspaceAndFlyoutBlocks(workspace);
  for (const block of blocks) {
    if (
      !block ||
      typeof block.getField !== "function" ||
      !Array.isArray(block.inputList)
    ) {
      continue;
    }
    const iconPath = getCategoryIconForBlock(block);
    if (!iconPath) continue;

    const firstInput = block.inputList?.[0];
    if (!firstInput) continue;
    if (!block.getField(LOW_VISION_ICON_FIELD_NAME)) {
      firstInput.insertFieldAt(
        0,
        new Blockly.FieldImage(iconPath, 18, 18, "*", null),
        LOW_VISION_ICON_FIELD_NAME,
      );
    }
  }
}

export function clearLowVisionCategoryIcons(workspace) {
  if (!workspace) return;
  const blocks = getWorkspaceAndFlyoutBlocks(workspace);
  for (const block of blocks) {
    if (!block || typeof block.getField !== "function") {
      continue;
    }
    const firstInput = block.inputList?.[0];
    if (!firstInput || typeof firstInput.removeField !== "function") continue;
    if (block.getField(LOW_VISION_BAR_FIELD_NAME))
      firstInput.removeField(LOW_VISION_BAR_FIELD_NAME, true);
    if (block.getField(LOW_VISION_ICON_FIELD_NAME))
      firstInput.removeField(LOW_VISION_ICON_FIELD_NAME, true);
  }
}

function getWorkspaceAndFlyoutBlocks(workspace) {
  const blocks = workspace.getAllBlocks(false) || [];
  const flyoutWorkspace = workspace.getFlyout?.()?.getWorkspace?.();
  if (flyoutWorkspace) {
    blocks.push(...(flyoutWorkspace.getAllBlocks(false) || []));
  }
  return blocks;
}
