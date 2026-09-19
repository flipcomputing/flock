import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import { getHelpUrlFor, registerBlockHandler } from './blocks.js';
import { translate, getTooltip } from '../main/translation.js';
import { makeSectionIcon, getCurrentIconColor, BLOCK_ICON_FIELD_NAME } from './blockIcons.js';
import { toggleSectionCollapsed, SECTION_DO_CHECK } from './sectionContainment.js';

// Matches the DO input's left inset, so the comment row lines up with the
// contained blocks rather than the block's outer edge.
const COMMENT_INDENT_WIDTH = 8;
const TRANSPARENT_SPACER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7';

// Sections are identified by this plain name field, not a Blockly variable -
// the load/save section blocks (added later) will list section names the same
// way procedure call blocks list procedure names, scanning `section` blocks
// directly rather than offering a shared variable dropdown.
function usedSectionNames(workspace, excludeBlockId) {
  const used = new Set();
  for (const block of workspace.getBlocksByType('section', false)) {
    if (block.id === excludeBlockId) continue;
    used.add(block.getFieldValue('NAME'));
  }
  return used;
}

function nextAvailableSectionName(workspace, excludeBlockId) {
  const used = usedSectionNames(workspace, excludeBlockId);
  const prefix = translate('section_default_name');
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

// Renumbers a newly created section so it doesn't collide with an existing
// one - e.g. when a section block is duplicated/pasted, matching how
// duplicating a procedure definition also gives the copy a fresh name.
function ensureUniqueSectionName(block, changeEvent) {
  if (window.loadingCode) return; // Don't rename while code is loading
  if (block.isInFlyout) return;
  if (changeEvent.type !== Blockly.Events.BLOCK_CREATE) return;
  if (!changeEvent.ids?.includes(block.id)) return;
  if (!changeEvent.recordUndo) return; // Skip undo/redo

  const currentName = block.getFieldValue('NAME');
  if (usedSectionNames(block.workspace, block.id).has(currentName)) {
    block.setFieldValue(nextAvailableSectionName(block.workspace, block.id), 'NAME');
  }
}

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
        message2: '%1',
        args0: [
          {
            type: 'field_input',
            name: 'NAME',
            text: nextAvailableSectionName(this.workspace, this.id),
          },
          {
            type: 'field_checkbox',
            name: 'START',
            checked: true,
          },
        ],
        args1: [
          {
            type: 'field_multilinetext',
            name: 'COMMENT',
            text: '',
          },
        ],
        args2: [
          {
            type: 'input_statement',
            name: 'DO',
            check: SECTION_DO_CHECK,
          },
        ],
        colour: categoryColours['Control'],
        inputsInline: false,
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
      // Indent the comment row to line up with the DO mouth's contents below it.
      this.inputList[1].insertFieldAt(
        0,
        new Blockly.FieldImage(TRANSPARENT_SPACER, COMMENT_INDENT_WIDTH, 1, ''),
        'COMMENT_INDENT'
      );

      registerBlockHandler(this, (changeEvent) => ensureUniqueSectionName(this, changeEvent));
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
