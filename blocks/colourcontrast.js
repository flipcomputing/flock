import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';
import { isValidColourInput } from './colourvalidation.js';

export const MIN_CONTRAST = 4.5;
const CONTRAST_WARNING = 'colour-contrast';

const CONTRAST_BLOCKS = {
  say: { text: 'TEXT_COLOR', background: 'BACKGROUND_COLOR', alpha: 'ALPHA' },
  ui_text: { text: 'COLOR', background: 'BACKGROUND_COLOR', alpha: 'ALPHA' },
  ui_button: { text: 'TEXT_COLOR', background: 'BACKGROUND_COLOR' },
  ui_input: { text: 'TEXT_COLOR', background: 'BACKGROUND_COLOR' },
};

let probeContext;

function cssToRgb(value) {
  if (!isValidColourInput(value)) return null;
  const trimmed = value.trim();
  const css = /^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? `#${trimmed}` : trimmed;
  probeContext ??= document.createElement('canvas').getContext('2d');
  probeContext.fillStyle = '#000000';
  probeContext.fillStyle = css;
  const resolved = probeContext.fillStyle;
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(resolved);
  if (!hex) return null;
  return hex.slice(1).map((part) => parseInt(part, 16));
}

function literalNumber(block) {
  if (block?.type !== 'math_number') return null;
  const value = Number(block.getFieldValue('NUM'));
  return Number.isFinite(value) ? value : null;
}

export function literalColour(block) {
  switch (block?.type) {
    case 'colour':
      return cssToRgb(block.getFieldValue('COLOR'));
    case 'colour_picker':
      return cssToRgb(block.getFieldValue('COLOUR'));
    case 'colour_from_string':
      return cssToRgb(block.getFieldValue('COLOR'));
    default:
      return null;
  }
}

function relativeLuminance([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrastRatio(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export function contrastWarningFor(block) {
  const inputs = CONTRAST_BLOCKS[block.type];
  if (!inputs) return null;
  if (inputs.alpha) {
    const alphaBlock = block.getInputTargetBlock(inputs.alpha);
    if (alphaBlock && !(literalNumber(alphaBlock) >= 1)) return null;
  }
  const text = literalColour(block.getInputTargetBlock(inputs.text));
  const background = literalColour(block.getInputTargetBlock(inputs.background));
  if (!text || !background) return null;
  const ratio = contrastRatio(text, background);
  if (ratio >= MIN_CONTRAST) return null;
  return translate('colour_contrast_warning')
    .replace('%1', (Math.floor(ratio * 10) / 10).toString())
    .replace('%2', MIN_CONTRAST.toString());
}

export function installContrastWarnings(workspace) {
  const contrastWarnings = new WeakMap();

  function warnLowContrast() {
    for (const type of Object.keys(CONTRAST_BLOCKS)) {
      for (const block of workspace.getBlocksByType(type, false)) {
        const text = contrastWarningFor(block);
        if ((contrastWarnings.get(block) ?? null) === text) continue;
        contrastWarnings.set(block, text);
        block.setWarningText(text, CONTRAST_WARNING);
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
      warnLowContrast();
    }
  });

  warnLowContrast();
  return warnLowContrast;
}
