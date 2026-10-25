import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import { getHelpUrlFor } from './blocks.js';
import { getTooltip } from '../main/translation.js';

export function defineColourBlocks() {
  // Basic colour picker block
  Blockly.Blocks['colour_picker'] = {
    init: function () {
      this.jsonInit({
        type: 'colour_picker',
        message0: '%1',
        args0: [
          {
            type: 'field_colour',
            name: 'COLOUR',
            colour: '#ff0000',
          },
        ],
        output: 'Colour',
        colour: categoryColours['Materials'],
        tooltip: getTooltip('colour_picker'),
        helpUrl: '',
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('materials_blocks');
    },
  };
}
