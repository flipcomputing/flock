import * as Blockly from 'blockly';
import { normaliseEmoji } from './emoji.js';
import { createEmojiPicker } from '../ui/emojiPicker.js';
import { translate } from '../main/translation.js';

export const DEFAULT_EMOJI = '\u{1F600}';

export class FieldEmoji extends Blockly.Field {
  SERIALIZABLE = true;
  EDITABLE = true;
  CURSOR = 'pointer';

  constructor(value = DEFAULT_EMOJI, validator, config) {
    super(value, validator, config);
  }

  static fromJson(options) {
    return new this(options?.value ?? options?.emoji, undefined, options);
  }

  doClassValidation_(newValue) {
    return normaliseEmoji(newValue);
  }

  getAriaTypeName() {
    return translate('table_column_type_emoji');
  }

  getAriaValue() {
    return this.getValue();
  }

  showEditor_() {
    const close = () => Blockly.DropDownDiv.hideIfOwner(this);
    const picker = createEmojiPicker({
      value: this.getValue(),
      onPick: (emoji) => {
        this.setValue(emoji);
        close();
      },
      onCancel: close,
    });
    Blockly.DropDownDiv.getContentDiv().appendChild(picker.element);
    Blockly.DropDownDiv.showPositionedByField(this);
    picker.focus();
  }
}

Blockly.fieldRegistry.register('field_emoji', FieldEmoji);
