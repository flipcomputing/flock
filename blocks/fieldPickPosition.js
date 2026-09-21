// Built on Blockly.FieldImage (like addToggleButton in blocks.js) rather than
// a bare Field subclass, so it gets a working keyboard-focus ring for free.
import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';
import { makeIconDataUrl, getCurrentIconColor, getWorkspaceAndFlyoutBlocks } from './blockIcons.js';
import { startPositionPick } from '../ui/pickposition.js';

// Font Awesome Free 6.7.2 "location-dot" (solid) - https://fontawesome.com
// License - https://fontawesome.com/license/free
const PIN_ICON_VIEW_BOX = '0 0 384 512';
const PIN_ICON_PATH =
  'M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z';
const FIELD_SIZE = 20;
const FIELD_NAME = 'PICK_POSITION';

export const PICK_POSITION_FIELD_TYPE = 'field_pick_position';

function makePinIconDataUrl(color) {
  return makeIconDataUrl(PIN_ICON_VIEW_BOX, PIN_ICON_PATH, color);
}

export class FieldPickPosition extends Blockly.FieldImage {
  constructor() {
    super(
      makePinIconDataUrl(getCurrentIconColor()),
      FIELD_SIZE,
      FIELD_SIZE,
      translate('pick_position_button_label'),
      (field) => startPositionPick(field.getSourceBlock())
    );
  }

  static fromJson() {
    return new FieldPickPosition();
  }
}

Blockly.fieldRegistry.register(PICK_POSITION_FIELD_TYPE, FieldPickPosition);

// Called alongside updateAllBlockIcons on a theme switch (main/themes.js).
export function updatePickPositionFieldIcons(workspace, iconColor) {
  if (!workspace) return;
  const dataUrl = makePinIconDataUrl(iconColor);
  for (const block of getWorkspaceAndFlyoutBlocks(workspace)) {
    block.getField?.(FIELD_NAME)?.setValue(dataUrl);
  }
}
