import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import { getHelpUrlFor } from './blocks.js';
import { translate, getTooltip } from '../main/translation.js';
import { makeSectionIcon, getCurrentIconColor, BLOCK_ICON_FIELD_NAME } from './blockIcons.js';
import { toggleSectionCollapsed, SECTION_DO_CHECK } from './sectionContainment.js';

export function defineSectionBlock() {
  Blockly.Blocks['section'] = {
    init: function () {
      this.containedBlockIds_ = [];
      this.sectionCollapsed_ = false;
      this.desiredMouthHeight_ = 0;
      this.jsonInit({
        type: 'section',
        message0: translate('section'),
        message1: '%1',
        args0: [
          {
            type: 'field_input',
            name: 'NAME',
            text: translate('section_default_name'),
          },
        ],
        args1: [
          {
            type: 'input_statement',
            name: 'DO',
            check: SECTION_DO_CHECK,
          },
        ],
        colour: categoryColours['Control'],
        inputsInline: true,
        tooltip: getTooltip('section'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('control_blocks');
      this.inputList[0].insertFieldAt(
        0,
        new Blockly.FieldImage(
          makeSectionIcon(getCurrentIconColor(), this.sectionCollapsed_),
          18,
          18,
          translate('section_toggle_alt'),
          () => this.toggleSectionCollapsed_()
        ),
        BLOCK_ICON_FIELD_NAME
      );
    },
    toggleSectionCollapsed_: function () {
      toggleSectionCollapsed(this);
      this.getField(BLOCK_ICON_FIELD_NAME)?.setValue(
        makeSectionIcon(getCurrentIconColor(), this.sectionCollapsed_)
      );
    },
    // Sections have their own fold (hiding the grouped blocks below them,
    // toggled by clicking the icon) rather than Blockly's native collapse,
    // which would hide the icon along with everything else. Routing the
    // generic collapse triggers (right-click menu, the 'C' shortcut, the
    // block toolbar's collapse button, workspace collapse-all) through the
    // same toggle keeps the icon visible and behaviour consistent no matter
    // how collapse is invoked.
    //
    // isCollapsed() is deliberately NOT overridden: Block.render() consults
    // it directly (not the private collapsed_ flag) to decide whether to
    // draw Blockly's own collapsed summary row. Making it return true for a
    // folded section would make every render() call - including the one
    // layoutSectionChildren does after folding - draw that native summary
    // row on top of our own layout, hiding the icon and every other field.
    setCollapsed: function (collapsed) {
      if (!!collapsed === !!this.sectionCollapsed_) return;
      this.toggleSectionCollapsed_();
    },
    saveExtraState: function () {
      return {
        contains: (this.containedBlockIds_ || []).slice(),
        collapsed: !!this.sectionCollapsed_,
      };
    },
    loadExtraState: function (state) {
      this.containedBlockIds_ = Array.isArray(state?.contains) ? state.contains.slice() : [];
      this.sectionCollapsed_ = !!state?.collapsed;
      this.getField(BLOCK_ICON_FIELD_NAME)?.setValue(
        makeSectionIcon(getCurrentIconColor(), this.sectionCollapsed_)
      );
    },
  };
}
