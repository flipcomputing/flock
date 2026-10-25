import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import {
  getHelpUrlFor,
  addInlineOnDrag,
  mutationToDom,
  domToMutation,
  updateShape,
  fireLayoutMove,
  DO_MUTATOR_PLUS,
  DO_MUTATOR_MINUS,
} from './blocks.js';
import { translate, getTooltip, getDropdownOption, getOption } from '../main/translation.js';
import {
  makeStartIcon,
  makeRepeatIcon,
  makeClickIcon,
  makeCollisionIcon,
  makeKeyboardIcon,
  makePressIcon,
  makeOnEventIcon,
  getCurrentIconColor,
  BLOCK_ICON_FIELD_NAME,
  DecorativeFieldImage,
} from './blockIcons.js';
import { otherObjectName } from './variableNames.js';

export function defineEventsBlocks() {
  Blockly.Blocks['start'] = {
    init: function () {
      this.jsonInit({
        type: 'start',
        message0: translate('start'),
        message1: '%1',
        args1: [
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        colour: categoryColours['Events'],
        inputsInline: true,
        tooltip: getTooltip('start'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('events_blocks');
      this.inputList[0].insertFieldAt(
        0,
        new DecorativeFieldImage(makeStartIcon(getCurrentIconColor()), 18, 18, '', null),
        BLOCK_ICON_FIELD_NAME
      );
    },
  };

  // Define the forever block
  Blockly.Blocks['forever'] = {
    init: function () {
      this.jsonInit({
        type: 'forever',
        message0: translate('forever'),
        args0: [
          {
            type: 'input_statement',
            name: 'DO',
            check: null,
          },
        ],
        colour: categoryColours['Events'],
        tooltip: getTooltip('forever'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('events_blocks');
      this.isInline = false;
      this.inputList[0].insertFieldAt(
        0,
        new DecorativeFieldImage(makeRepeatIcon(getCurrentIconColor()), 32, 32, '', null),
        BLOCK_ICON_FIELD_NAME
      );
      addInlineOnDrag(this);
    },
    mutationToDom: function () {
      return mutationToDom(this);
    },
    domToMutation: function (xmlElement) {
      domToMutation(this, xmlElement);
    },
    updateShape_: function (isInline) {
      updateShape(this, isInline);
    },
  };

  Blockly.Blocks['when_clicked'] = {
    init: function () {
      this.jsonInit({
        type: 'when_clicked',
        message0: translate('when_clicked'),
        args0: [
          {
            type: 'field_variable',
            name: 'MODEL_VAR',
            variable: window.currentMesh,
          },
          {
            type: 'field_dropdown',
            name: 'TRIGGER',
            options: [
              getDropdownOption('OnPickTrigger'),
              getDropdownOption('OnPickDownTrigger'),
              getDropdownOption('OnPickUpTrigger'),
            ],
          },
          /*{
                                                        type: "field_dropdown",
                                                        name: "MODE",
                                                        options: [
                                                                ["wait", "wait"],
                                                                ["once", "once"],
                                                                ["every", "every"],
                                                        ],
                                                },*/
        ],
        message1: '%1',
        implicitAlign1: 'LEFT',
        args1: [
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        colour: categoryColours['Events'],
        tooltip: getTooltip('when_clicked'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('events_blocks');
      // Default to top-level mode
      this.isInline = false;
      this.setPreviousStatement(false);
      this.setNextStatement(false);
      this.inputList[0].insertFieldAt(
        0,
        new DecorativeFieldImage(makeClickIcon(getCurrentIconColor()), 22, 22, '', null),
        BLOCK_ICON_FIELD_NAME
      );

      this.thenCount_ = 0;
      const addThen = new Blockly.FieldImage(DO_MUTATOR_PLUS, 20, 20, 'add then', () =>
        this.addThen()
      );
      addThen.pinRight_ = true;
      this.appendDummyInput('BUTTONS').appendField(addThen, 'THEN_ADD');
      addInlineOnDrag(this);
    },

    mutationToDom: function () {
      const container = document.createElement('mutation');
      container.setAttribute('inline', this.isInline);
      if (this.thenCount_) container.setAttribute('then', this.thenCount_);
      return container;
    },

    domToMutation: function (xmlElement) {
      const isInline = xmlElement.getAttribute('inline') === 'true' || false;
      this.updateShape_(isInline);
      this.setThenCount_(parseInt(xmlElement.getAttribute('then')) || 0);
    },

    setThenCount_: function (count) {
      while (this.thenCount_ < count) {
        const i = this.thenCount_;
        const removeThen = new Blockly.FieldImage(DO_MUTATOR_MINUS, 20, 20, 'remove then', (field) =>
          this.removeThen(Number(field.getParentInput().name.slice('THEN_ROW'.length)))
        );
        removeThen.pinRight_ = true;
        this.appendDummyInput('THEN_ROW' + i)
          .appendField(translate('then_label'))
          .appendField(removeThen);
        this.appendStatementInput('THEN' + i);
        this.moveInputBefore('THEN_ROW' + i, 'BUTTONS');
        this.moveInputBefore('THEN' + i, 'BUTTONS');
        this.thenCount_++;
      }
      while (this.thenCount_ > count) {
        this.thenCount_--;
        this.removeInput('THEN' + this.thenCount_);
        this.removeInput('THEN_ROW' + this.thenCount_);
      }
    },

    changeThenCount_: function (change) {
      const oldState = Blockly.Xml.domToText(this.mutationToDom());
      const ownGroup = !Blockly.Events.getGroup();
      if (ownGroup) Blockly.Events.setGroup(true);
      try {
        const reattach = change();
        const newState = Blockly.Xml.domToText(this.mutationToDom());
        Blockly.Events.fire(
          new Blockly.Events.BlockChange(this, 'mutation', null, oldState, newState)
        );
        reattach?.();
      } finally {
        if (ownGroup) Blockly.Events.setGroup(false);
      }
      fireLayoutMove(this);
    },

    addThen: function () {
      this.changeThenCount_(() => this.setThenCount_(this.thenCount_ + 1));
    },

    removeThen: function (index) {
      this.changeThenCount_(() => {
        this.getInputTargetBlock('THEN' + index)?.unplug();
        const later = [];
        for (let i = index + 1; i < this.thenCount_; i++) {
          const child = this.getInputTargetBlock('THEN' + i);
          child?.unplug();
          later.push(child);
        }
        this.setThenCount_(this.thenCount_ - 1);
        return () =>
          later.forEach((child, i) => {
            if (child) this.getInput('THEN' + (index + i)).connection.connect(child.previousConnection);
          });
      });
    },

    updateShape_: function (isInline) {
      this.isInline = isInline;

      if (isInline) {
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      } else {
        this.setPreviousStatement(false);
        this.setNextStatement(false);
      }
    },
  };

  Blockly.Blocks['on_collision'] = {
    init: function () {
      this.jsonInit({
        type: 'when_touches',
        message0: translate('on_collision'),
        args0: [
          {
            type: 'field_variable',
            name: 'MODEL_VAR',
            variable: window.currentMesh,
          },
          {
            type: 'field_dropdown',
            name: 'TRIGGER',
            options: [
              getDropdownOption('OnIntersectionEnterTrigger'),
              getDropdownOption('OnIntersectionExitTrigger'),
            ],
          },
          {
            type: 'field_variable',
            name: 'OTHER_MODEL_VAR',
            variable: otherObjectName('object2'),
          },
        ],
        message1: '%1',
        args1: [
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        colour: categoryColours['Events'],
        tooltip: getTooltip('on_collision'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('events_blocks');
      // Set default state to top-level block
      this.isInline = false;
      this.callbackVar2Id = null;
      this.inputList[0].insertFieldAt(
        0,
        new DecorativeFieldImage(makeCollisionIcon(getCurrentIconColor()), 24, 24, '', null),
        BLOCK_ICON_FIELD_NAME
      );
      addInlineOnDrag(this);
    },
    onchange: function () {
      if (!this.workspace || this.isInFlyout) return;

      const modelVarId = this.getFieldValue('MODEL_VAR');
      const otherModelVarId = this.getFieldValue('OTHER_MODEL_VAR');

      if (!modelVarId || !otherModelVarId) return;

      const modelVar = this.workspace.getVariableById(modelVarId);
      const otherModelVar = this.workspace.getVariableById(otherModelVarId);

      if (!modelVar || !otherModelVar) return;

      if (modelVar.name === otherModelVar.name) {
        const newVarName = `${modelVar.name}_2`;
        let newVar = this.workspace.getVariable(newVarName);
        if (!newVar) {
          newVar = this.workspace.createVariable(newVarName);
        }
        this.callbackVar2Id = newVar.getId();
      } else {
        this.callbackVar2Id = null;
      }
    },
    mutationToDom: function () {
      const container = document.createElement('mutation');
      container.setAttribute('inline', this.isInline);
      if (this.callbackVar2Id) {
        container.setAttribute('callback_var_2', this.callbackVar2Id);
      }
      return container;
    },
    domToMutation: function (xmlElement) {
      const isInline = xmlElement.getAttribute('inline') === 'true';
      this.updateShape_(isInline);
      this.callbackVar2Id = xmlElement.getAttribute('callback_var_2') || null;
    },
    updateShape_: function (isInline) {
      this.isInline = isInline;
      if (isInline) {
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      } else {
        this.setPreviousStatement(false);
        this.setNextStatement(false);
      }
    },
  };

  // For backward compatibility
  Blockly.Blocks['when_touches'] = Blockly.Blocks['on_collision'];

  Blockly.Blocks['when_key_event'] = {
    init: function () {
      this.jsonInit({
        type: 'when_key_event',
        message0: translate('when_key_event'),
        args0: [
          {
            type: 'field_grid_dropdown',
            name: 'KEY',
            columns: 10,
            options: [
              getDropdownOption('0'),
              getDropdownOption('1'),
              getDropdownOption('2'),
              getDropdownOption('3'),
              getDropdownOption('4'),
              getDropdownOption('5'),
              getDropdownOption('6'),
              getDropdownOption('7'),
              getDropdownOption('8'),
              getDropdownOption('9'),
              getDropdownOption('a'),
              getDropdownOption('b'),
              getDropdownOption('c'),
              getDropdownOption('d'),
              getDropdownOption('e'),
              getDropdownOption('f'),
              getDropdownOption('g'),
              getDropdownOption('h'),
              getDropdownOption('i'),
              getDropdownOption('j'),
              getDropdownOption('k'),
              getDropdownOption('l'),
              getDropdownOption('m'),
              getDropdownOption('n'),
              getDropdownOption('o'),
              getDropdownOption('p'),
              getDropdownOption('q'),
              getDropdownOption('r'),
              getDropdownOption('s'),
              getDropdownOption('t'),
              getDropdownOption('u'),
              getDropdownOption('v'),
              getDropdownOption('w'),
              getDropdownOption('x'),
              getDropdownOption('y'),
              getDropdownOption('z'),
              getDropdownOption(' '),
              getDropdownOption(','),
              getDropdownOption('.'),
              getDropdownOption('/'),
              getDropdownOption('ArrowLeft'),
              getDropdownOption('ArrowUp'),
              getDropdownOption('ArrowRight'),
              getDropdownOption('ArrowDown'),
            ],
          },
          {
            type: 'field_dropdown',
            name: 'EVENT',
            options: [getDropdownOption('pressed'), getDropdownOption('released')],
          },
        ],
        message1: '%1',
        args1: [
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        colour: categoryColours['Events'],
        tooltip: getTooltip('when_key_event'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('events_blocks');
      this.inputList[0].insertFieldAt(
        0,
        new DecorativeFieldImage(makeKeyboardIcon(getCurrentIconColor()), 36, 36, '', null),
        BLOCK_ICON_FIELD_NAME
      );
      addInlineOnDrag(this);
    },
    mutationToDom: function () {
      return mutationToDom(this);
    },
    domToMutation: function (xmlElement) {
      domToMutation(this, xmlElement);
    },
    updateShape_: function (isInline) {
      updateShape(this, isInline);
    },
  };

  Blockly.Blocks['when_action_event'] = {
    init: function () {
      this.jsonInit({
        type: 'when_action_event',
        message0: translate('when_action_event'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'ACTION',
            options: [
              [getOption('ACTION_FORWARD'), 'FORWARD'],
              [getOption('ACTION_BACKWARD'), 'BACKWARD'],
              [getOption('ACTION_LEFT'), 'LEFT'],
              [getOption('ACTION_RIGHT'), 'RIGHT'],
              [getOption('ACTION_BUTTON1'), 'BUTTON1'],
              [getOption('ACTION_BUTTON2'), 'BUTTON2'],
              [getOption('ACTION_BUTTON3'), 'BUTTON3'],
              [getOption('ACTION_BUTTON4'), 'BUTTON4'],
            ],
          },
          {
            type: 'field_dropdown',
            name: 'EVENT',
            options: [getDropdownOption('pressed'), getDropdownOption('released')],
          },
        ],
        message1: '%1',
        args1: [
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        colour: categoryColours['Events'],
        tooltip: getTooltip('when_action_event'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('events_blocks');
      this.inputList[0].insertFieldAt(
        0,
        new DecorativeFieldImage(makePressIcon(getCurrentIconColor()), 32, 32, '', null),
        BLOCK_ICON_FIELD_NAME
      );
      addInlineOnDrag(this);
    },
    mutationToDom: function () {
      return mutationToDom(this);
    },
    domToMutation: function (xmlElement) {
      domToMutation(this, xmlElement);
    },
    updateShape_: function (isInline) {
      updateShape(this, isInline);
    },
  };

  Blockly.Blocks['broadcast_event'] = {
    init: function () {
      this.jsonInit({
        type: 'broadcast_event',
        message0: translate('broadcast_event'),
        args0: [
          {
            type: 'input_value',
            name: 'EVENT_NAME',
            check: 'String',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Events'],
        tooltip: getTooltip('broadcast_event'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('events_blocks');
    },
  };

  Blockly.Blocks['on_event'] = {
    init: function () {
      this.jsonInit({
        type: 'on_event',
        message0: translate('on_event'),
        args0: [
          {
            type: 'input_value',
            name: 'EVENT_NAME',
            check: 'String',
          },
        ],
        message1: '%1',
        args1: [
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        colour: categoryColours['Events'],
        tooltip: getTooltip('on_event'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('events_blocks');
      this.inputList[0].insertFieldAt(
        0,
        new DecorativeFieldImage(makeOnEventIcon(getCurrentIconColor()), 28, 28, '', null),
        BLOCK_ICON_FIELD_NAME
      );
      addInlineOnDrag(this);
    },
    mutationToDom: function () {
      return mutationToDom(this);
    },
    domToMutation: function (xmlElement) {
      domToMutation(this, xmlElement);
    },
    updateShape_: function (isInline) {
      updateShape(this, isInline);
    },
  };

  Blockly.Blocks['restart'] = {
    init: function () {
      this.jsonInit({
        type: 'restart',
        message0: translate('restart'),
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Events'],
        tooltip: getTooltip('restart'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('events_blocks');
    },
  };
}
