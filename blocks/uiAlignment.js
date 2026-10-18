import * as Blockly from 'blockly';
import { translate, getDropdownOption } from '../main/translation.js';

export function addUIAlignment(block) {
  const after = block.inputList.findIndex((input) => input.name === 'Y') + 1;
  block
    .appendDummyInput('ALIGN')
    .appendField(translate('ui_align'))
    .appendField(
      new Blockly.FieldDropdown([
        getDropdownOption('LEFT'),
        getDropdownOption('CENTER'),
        getDropdownOption('RIGHT'),
      ]),
      'H_ALIGN'
    )
    .appendField(
      new Blockly.FieldDropdown([
        getDropdownOption('TOP'),
        getDropdownOption('CENTER'),
        getDropdownOption('BOTTOM'),
      ]),
      'V_ALIGN'
    );
  const last = block.inputList.length - 1;
  if (after > 0 && after < last) block.moveNumberedInputBefore(last, after);
}
