import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';
import { makeIconDataUrl, getCurrentIconColor, getWorkspaceAndFlyoutBlocks } from './blockIcons.js';

// Font Awesome Free 6.7.2 "table" (solid), as in images/tables.svg - https://fontawesome.com
// License - https://fontawesome.com/license/free
const TABLE_ICON_VIEW_BOX = '0 0 512 512';
const TABLE_ICON_PATH =
  'M64 256l0-96 160 0 0 96L64 256zm0 64l160 0 0 96L64 416l0-96zm224 96l0-96 160 0 0 96-160 0zM448 256l-160 0 0-96 160 0 0 96zM64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32z';
const FIELD_SIZE = 20;
export const TABLE_DATA_FIELD_NAME = 'EDIT_DATA';

const tableIcon = (color) => makeIconDataUrl(TABLE_ICON_VIEW_BOX, TABLE_ICON_PATH, color);

export function makeTableDataField(onClick) {
  return new Blockly.FieldImage(
    tableIcon(getCurrentIconColor()),
    FIELD_SIZE,
    FIELD_SIZE,
    translate('table_edit_data'),
    onClick
  );
}

export function updateTableDataFieldIcons(workspace, iconColor) {
  if (!workspace) return;
  const dataUrl = tableIcon(iconColor);
  for (const block of getWorkspaceAndFlyoutBlocks(workspace)) {
    if (block.type === 'table_create') block.getField(TABLE_DATA_FIELD_NAME)?.setValue(dataUrl);
  }
}
