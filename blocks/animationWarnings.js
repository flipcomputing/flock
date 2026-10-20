import * as Blockly from 'blockly';
import { getOption, translate } from '../main/translation.js';
import { getModelDisplayName, modelAnimations, modelNames } from '../config.js';

const ANIMATION_WARNING = 'animation-support';
const ANIMATION_BLOCKS = ['switch_animation', 'play_animation'];
const OBJECT_TYPES = new Set(['load_object', 'load_multi_object']);
const SHAPE_TYPES = new Set([
  'create_box',
  'create_sphere',
  'create_cylinder',
  'create_capsule',
  'create_wedge',
  'create_freeform',
  'create_donut',
  'create_ring',
  'create_plane',
  'create_wall',
  'create_3d_text',
]);

function sourceFor(block) {
  if (SHAPE_TYPES.has(block.type)) return { shape: true, animations: [] };
  const modelName = block.getFieldValue('MODELS');
  if (OBJECT_TYPES.has(block.type)) {
    return { modelName, animations: modelAnimations[modelName] ?? [] };
  }
  if (block.type === 'load_model' && modelNames.includes(modelName)) {
    return { modelName, animations: modelAnimations[modelName] ?? [] };
  }
  return null;
}

function sourcesByVariable(workspace) {
  const sources = new Map();
  for (const block of workspace.getAllBlocks(false)) {
    if (block.isInsertionMarker?.()) continue;
    const varId = block.getField('ID_VAR') ? block.getFieldValue('ID_VAR') : null;
    const source = varId && sourceFor(block);
    if (!source) continue;
    if (!sources.has(varId)) sources.set(varId, []);
    sources.get(varId).push(source);
  }
  return sources;
}

function literalAnimationName(block) {
  const target = block.getInputTargetBlock('ANIMATION_NAME');
  if (target?.type === 'animation_name') return target.getFieldValue('ANIMATION_NAME');
  if (target?.type === 'text') return target.getFieldValue('TEXT');
  return null;
}

function messageFor(source, animationName) {
  if (source.shape) return translate('animation_shape_warning');
  const name = getModelDisplayName(source.modelName);
  if (!source.animations.length) return translate('animation_none_warning').replace('%1', name);
  if (!animationName || source.animations.includes(animationName)) return null;
  return translate('animation_missing_warning')
    .replace('%1', name)
    .replace('%2', getOption(animationName))
    .replace('%3', source.animations.map(getOption).join(', '));
}

export function animationWarningFor(block, sources = sourcesByVariable(block.workspace)) {
  const varId = block.getFieldValue('MODEL');
  const animationName = literalAnimationName(block);
  const messages = (sources.get(varId) ?? [])
    .map((source) => messageFor(source, animationName))
    .filter(Boolean);
  return messages.length ? [...new Set(messages)].join('\n') : null;
}

export function installAnimationWarnings(workspace) {
  const animationWarnings = new WeakMap();

  function warnUnsupportedAnimations() {
    const sources = sourcesByVariable(workspace);
    for (const type of ANIMATION_BLOCKS) {
      for (const block of workspace.getBlocksByType(type, false)) {
        const text = animationWarningFor(block, sources);
        if ((animationWarnings.get(block) ?? null) === text) continue;
        animationWarnings.set(block, text);
        block.setWarningText(text, ANIMATION_WARNING);
      }
    }
  }

  workspace.addChangeListener(function (event) {
    if (event.isUiEvent && event.type !== Blockly.Events.FINISHED_LOADING) return;
    if (
      event.type === Blockly.Events.BLOCK_MOVE ||
      event.type === Blockly.Events.BLOCK_CREATE ||
      event.type === Blockly.Events.BLOCK_DELETE ||
      event.type === Blockly.Events.BLOCK_CHANGE ||
      event.type === Blockly.Events.FINISHED_LOADING
    ) {
      warnUnsupportedAnimations();
    }
  });

  warnUnsupportedAnimations();
  return warnUnsupportedAnimations;
}
