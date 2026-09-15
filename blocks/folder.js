import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import { getHelpUrlFor } from './blocks.js';
import { translate, getTooltip } from '../main/translation.js';
import { makeFolderIcon, getCurrentIconColor, BLOCK_ICON_FIELD_NAME } from './blockIcons.js';
import { toggleFolderCollapsed, FOLDER_DO_CHECK } from './folderContainment.js';

export function defineFolderBlock() {
  Blockly.Blocks['folder'] = {
    init: function () {
      this.containedBlockIds_ = [];
      this.folderCollapsed_ = false;
      this.desiredMouthHeight_ = 0;
      this.jsonInit({
        type: 'folder',
        message0: translate('folder'),
        message1: '%1',
        args0: [
          {
            type: 'field_input',
            name: 'NAME',
            text: translate('folder_default_name'),
          },
        ],
        args1: [
          {
            type: 'input_statement',
            name: 'DO',
            check: FOLDER_DO_CHECK,
          },
        ],
        colour: categoryColours['Control'],
        inputsInline: true,
        tooltip: getTooltip('folder'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('control_blocks');
      this.inputList[0].insertFieldAt(
        0,
        new Blockly.FieldImage(
          makeFolderIcon(getCurrentIconColor(), this.folderCollapsed_),
          18,
          18,
          translate('folder_toggle_alt'),
          () => this.toggleFolderCollapsed_()
        ),
        BLOCK_ICON_FIELD_NAME
      );
    },
    toggleFolderCollapsed_: function () {
      toggleFolderCollapsed(this);
      this.getField(BLOCK_ICON_FIELD_NAME)?.setValue(
        makeFolderIcon(getCurrentIconColor(), this.folderCollapsed_)
      );
    },
    saveExtraState: function () {
      return {
        contains: (this.containedBlockIds_ || []).slice(),
        collapsed: !!this.folderCollapsed_,
      };
    },
    loadExtraState: function (state) {
      this.containedBlockIds_ = Array.isArray(state?.contains) ? state.contains.slice() : [];
      this.folderCollapsed_ = !!state?.collapsed;
      this.getField(BLOCK_ICON_FIELD_NAME)?.setValue(
        makeFolderIcon(getCurrentIconColor(), this.folderCollapsed_)
      );
    },
  };
}
