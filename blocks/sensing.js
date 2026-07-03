import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
  getHelpUrlFor,
  addToggleButton,
  mutationToDom,
  domToMutation,
  nextVariableIndexes,
  handleBlockCreateEvent,
  updateShape,
  registerBlockHandler,
} from "./blocks.js";
import {
  translate,
  getTooltip,
  getOption,
  getDropdownOption,
} from "../main/translation.js";
import { ACTIONS } from "../input/bindings.js";
import { makeMicrobitStatusIcon } from './blockIcons.js';
import { getMicrobitManager, VariableStatus } from '../microbit/manager.js';
import { showBanner } from '../ui/notifications.js';

const MICROBIT_STATUS_FIELD = 'STATUS';
const MICROBIT_ANY_DEVICE = '__any__';

function microbitVariable(block) {
  const variableId = block.getFieldValue('MICROBIT_VAR');
  return block.workspace?.getVariableMap().getVariableById(variableId) ?? null;
}

function microbitVariableName(block) {
  return microbitVariable(block)?.name ?? null;
}

function microbitDeviceDropdownOptions(workspace, selectedVariableId) {
  const options = [[translate('microbit_any_option'), MICROBIT_ANY_DEVICE]];
  if (!workspace) return options;
  const seenVariableIds = new Set();
  for (const block of workspace.getBlocksByType('add_microbit', true)) {
    if (block.isInFlyout) continue;
    const variable = microbitVariable(block);
    if (!variable || seenVariableIds.has(variable.getId())) continue;
    seenVariableIds.add(variable.getId());
    options.push([variable.name, variable.getId()]);
  }
  // Keep the current selection listed while its variable still exists, even
  // when its add_microbit block is gone or hasn't loaded yet — the menu is
  // derived from add_microbit blocks, but the selection's validity is not.
  if (selectedVariableId && !seenVariableIds.has(selectedVariableId)) {
    const variable = workspace
      .getVariableMap()
      .getVariableById(selectedVariableId);
    if (variable) options.push([variable.name, variable.getId()]);
  }
  return options;
}

// The menu lists devices from add_microbit blocks, but the field must accept
// (and keep rendering) any existing variable regardless of menu state: on
// project load this field can be set before its add_microbit block exists,
// and a selection should survive its add_microbit block being deleted.
class MicrobitDeviceDropdown extends Blockly.FieldDropdown {
  constructor() {
    super(function () {
      const workspace = this.sourceBlock_?.workspace;
      return microbitDeviceDropdownOptions(
        workspace,
        this._candidateValue ?? this.getValue(),
      );
    });
    this._candidateValue = null;
  }

  doClassValidation_(newValue) {
    if (newValue && newValue !== MICROBIT_ANY_DEVICE) {
      const variableMap = this.sourceBlock_?.workspace?.getVariableMap();
      const variable =
        variableMap?.getVariableById(newValue) ??
        // Legacy saves stored the variable name rather than its id.
        variableMap
          ?.getAllVariables()
          .find((candidate) => candidate.name === newValue) ??
        null;
      if (variable) {
        // Refresh the cached options with the accepted value so the label
        // resolves even when no add_microbit block lists it.
        this._candidateValue = variable.getId();
        this.getOptions(false);
        this._candidateValue = null;
        return variable.getId();
      }
    }
    return super.doClassValidation_(newValue);
  }
}

function syncMicrobitDeviceField(block) {
  const field = block.getField('DEVICE');
  if (!field) return;
  const currentValue = field.getValue();
  if (!currentValue || currentValue === MICROBIT_ANY_DEVICE) return;
  const variableMap = block.workspace?.getVariableMap();
  if (!variableMap) return;
  if (variableMap.getVariableById(currentValue)) return;
  const matchingVariable = variableMap
    .getAllVariables()
    .find((variable) => variable.name === currentValue);
  if (matchingVariable) {
    field.setValue(matchingVariable.getId());
  } else {
    // The selected variable was deleted: fall back to "any" rather than
    // holding a dangling id.
    field.setValue(MICROBIT_ANY_DEVICE);
  }
}

// Channel as typed on the block, or null when a non-literal expression is
// plugged in (then only the runtime addMicrobit call knows the value).
function microbitChannel(block) {
  const target = block.getInput('CHANNEL')?.connection?.targetBlock();
  const value = Number(target?.getFieldValue?.('NUM'));
  return Number.isFinite(value) ? value : null;
}

function microbitStatusAlt(state) {
  return translate(`microbit_status_${state}`);
}

function handleMicrobitStatusClick(field) {
  const block = field.getSourceBlock();
  if (!block || block.isInFlyout) return; // inert in the flyout
  const variableName = microbitVariableName(block);
  if (!variableName) return;
  const manager = getMicrobitManager();
  const status = manager.getStatusForVariable(variableName);
  if (status.state !== VariableStatus.UNBOUND) return;
  // Called directly from the click (a user gesture), as requestDevice needs.
  manager.bindFromPicker(variableName).catch((error) => {
    console.warn('micro:bit connect failed:', error);
    // Cancelling the picker isn't an error worth announcing.
    if (error?.code === 'no-device-selected') return;
    const message = /NOT_SUPPORTED/.test(error?.message ?? '')
      ? translate('microbit_usb_unsupported')
      : translate('microbit_connect_failed').replace('%1', error?.message ?? String(error));
    showBanner('microbit-connect', { message });
  });
}

let refreshingMicrobitBlocks = false;

// Recompute status icons, warnings, and editor-side channel registration for
// every add_microbit block. Runs on workspace changes and on manager status
// changes (connect progress, heartbeat expiry, ...).
export function refreshMicrobitBlocks(workspace) {
  if (refreshingMicrobitBlocks) return;
  if (!workspace || typeof workspace.getBlocksByType !== 'function') return;
  refreshingMicrobitBlocks = true;
  try {
    const manager = getMicrobitManager();
    const seenVariables = new Set();
    for (const block of workspace.getBlocksByType('add_microbit', true)) {
      if (block.isInFlyout) continue;
      const variableName = microbitVariableName(block);
      const channel = microbitChannel(block);
      let warning = null;

      if (variableName) {
        if (seenVariables.has(variableName)) {
          // Duplicate add_microbit for the same variable: the first block wins.
          warning = translate('microbit_duplicate_warning');
        } else {
          seenVariables.add(variableName);
          if (channel !== null) {
            manager.setVariableChannel(variableName, channel);
          }
          const effectiveChannel = manager.getVariableChannel(variableName);
          if (
            manager.isVariableOnRadio(variableName) &&
            !manager.hasTetheredOnChannel(effectiveChannel)
          ) {
            warning = translate('microbit_no_listener_warning').replace(
              '%1',
              String(effectiveChannel)
            );
          }
        }
        const status = manager.getStatusForVariable(variableName);
        const field = block.getField(MICROBIT_STATUS_FIELD);
        if (field) {
          field.setValue(makeMicrobitStatusIcon(status.state));
          field.setAlt?.(microbitStatusAlt(status.state));
          field.setTooltip?.(
            status.state === VariableStatus.RADIO
              ? translate('microbit_channel_retether_tip')
              : microbitStatusAlt(status.state)
          );
        }
      }
      block.setWarningText(warning);
    }
  } finally {
    refreshingMicrobitBlocks = false;
  }
}

let microbitManagerWired = false;

function wireMicrobitManager() {
  if (microbitManagerWired) return;
  microbitManagerWired = true;
  const manager = getMicrobitManager();
  manager.variableExists = (name) => {
    const workspace = Blockly.getMainWorkspace?.();
    return !!workspace?.getVariableMap().getVariable(name);
  };
  manager.confirmFlash = (message) =>
    new Promise((resolve) => {
      if (Blockly.dialog?.confirm) {
        Blockly.dialog.confirm(message, resolve);
      } else {
        resolve(globalThis.confirm ? globalThis.confirm(message) : false);
      }
    });
  manager.onStatusChange(() => {
    refreshMicrobitBlocks(Blockly.getMainWorkspace?.());
  });
}

export function defineSensingBlocks() {
  Blockly.Blocks["key_pressed"] = {
    init: function () {
      this.jsonInit({
        type: "key_pressed",
        message0: translate("key_pressed"),
        args0: [
          {
            type: "field_dropdown",
            name: "KEY",
            options: [
              getDropdownOption("ANY"),
              getDropdownOption("NONE"),
              getDropdownOption("w"),
              getDropdownOption("a"),
              getDropdownOption("s"),
              getDropdownOption("d"),
              [getOption("space_infinity"), " "],
              [getOption("q_icon"), "q"],
              [getOption("e_icon"), "e"],
              [getOption("f_icon"), "f"],
            ],
          },
        ],
        output: "Boolean",
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("key_pressed"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["action_pressed"] = {
    init: function () {
      this.jsonInit({
        type: "action_pressed",
        message0: translate("action_pressed"),
        args0: [
          {
            type: "field_dropdown",
            name: "ACTION",
            options: ACTIONS.map((a) => [getOption(`ACTION_${a}`), a]),
          },
        ],
        output: "Boolean",
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("action_pressed"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["set_action_key"] = {
    init: function () {
      this.jsonInit({
        type: "set_action_key",
        message0: translate("set_action_key"),
        args0: [
          {
            type: "field_dropdown",
            name: "ACTION",
            options: ACTIONS.map((a) => [getOption(`ACTION_${a}`), a]),
          },
          {
            type: "field_grid_dropdown",
            name: "KEY",
            columns: 10,
            options: [
              getDropdownOption("0"),
              getDropdownOption("1"),
              getDropdownOption("2"),
              getDropdownOption("3"),
              getDropdownOption("4"),
              getDropdownOption("5"),
              getDropdownOption("6"),
              getDropdownOption("7"),
              getDropdownOption("8"),
              getDropdownOption("9"),
              getDropdownOption("a"),
              getDropdownOption("b"),
              getDropdownOption("c"),
              getDropdownOption("d"),
              getDropdownOption("e"),
              getDropdownOption("f"),
              getDropdownOption("g"),
              getDropdownOption("h"),
              getDropdownOption("i"),
              getDropdownOption("j"),
              getDropdownOption("k"),
              getDropdownOption("l"),
              getDropdownOption("m"),
              getDropdownOption("n"),
              getDropdownOption("o"),
              getDropdownOption("p"),
              getDropdownOption("q"),
              getDropdownOption("r"),
              getDropdownOption("s"),
              getDropdownOption("t"),
              getDropdownOption("u"),
              getDropdownOption("v"),
              getDropdownOption("w"),
              getDropdownOption("x"),
              getDropdownOption("y"),
              getDropdownOption("z"),
              getDropdownOption(" "),
              getDropdownOption(","),
              getDropdownOption("."),
              getDropdownOption("/"),
              getDropdownOption("ArrowLeft"),
              getDropdownOption("ArrowUp"),
              getDropdownOption("ArrowRight"),
              getDropdownOption("ArrowDown"),
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("set_action_key"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["meshes_touching"] = {
    init: function () {
      this.jsonInit({
        type: "meshes_are_touching",
        message0: translate("meshes_touching"),
        args0: [
          {
            type: "field_variable",
            name: "MESH1",
            variable: window.currentMesh,
          },
          {
            type: "field_variable",
            name: "MESH2",
            variable: "object2",
          },
        ],
        output: "Boolean",
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("meshes_touching"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["time"] = {
    init: function () {
      this.jsonInit({
        type: "time",
        message0: translate("time"),
        args0: [
          {
            type: "field_dropdown",
            name: "UNIT",
            options: [
              [getOption("seconds"), "seconds"],
              [getOption("milliseconds"), "milliseconds"],
              [getOption("minutes"), "minutes"],
            ],
          },
        ],
        output: "Number",
        colour: categoryColours["Sensing"],
        inputsInline: true,
        tooltip: getTooltip("time"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["ground_level"] = {
    init: function () {
      this.jsonInit({
        type: "ground_level",
        message0: translate("ground_level"),
        output: "Number",
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("ground_level"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["distance_to"] = {
    init: function () {
      this.jsonInit({
        type: "distance_to",
        message0: translate("distance_to"),
        args0: [
          {
            type: "field_variable",
            name: "MODEL1",
            variable: window.currentMesh,
          },
          {
            type: "field_variable",
            name: "MODEL2",
            variable: "object2",
          },
        ],
        output: "Number",
        colour: categoryColours["Sensing"],
        inputsInline: true,
        tooltip: getTooltip("distance_to"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["touching_surface"] = {
    init: function () {
      this.jsonInit({
        type: "touching_surface",
        message0: translate("touching_surface"),
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
        ],
        output: "Boolean",
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("touching_surface"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["mesh_exists"] = {
    init: function () {
      this.jsonInit({
        type: "mesh_exists",
        message0: translate("mesh_exists"),
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
        ],
        output: "Boolean",
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("mesh_exists"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["get_property"] = {
    init: function () {
      this.jsonInit({
        type: "get_property",
        message0: translate("get_property"),
        args0: [
          {
            type: "field_dropdown",
            name: "PROPERTY",
            options: [
              getDropdownOption("POSITION_X"),
              getDropdownOption("POSITION_Y"),
              getDropdownOption("POSITION_Z"),
              getDropdownOption("ROTATION_X"),
              getDropdownOption("ROTATION_Y"),
              getDropdownOption("ROTATION_Z"),
              getDropdownOption("MIN_X"),
              getDropdownOption("MAX_X"),
              getDropdownOption("MIN_Y"),
              getDropdownOption("MAX_Y"),
              getDropdownOption("MIN_Z"),
              getDropdownOption("MAX_Z"),
              getDropdownOption("SCALE_X"),
              getDropdownOption("SCALE_Y"),
              getDropdownOption("SCALE_Z"),
              getDropdownOption("SIZE_X"),
              getDropdownOption("SIZE_Y"),
              getDropdownOption("SIZE_Z"),
              getDropdownOption("SPEED_X"),
              getDropdownOption("SPEED_Y"),
              getDropdownOption("SPEED_Z"),
              getDropdownOption("SPEED"),
              getDropdownOption("VISIBLE"),
              getDropdownOption("ALPHA"),
              getDropdownOption("COLOUR"),
              getDropdownOption("DESCRIPTION"),
            ],
          },
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh,
          },
        ],
        output: null,
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("get_property"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["canvas_controls"] = {
    init: function () {
      this.jsonInit({
        type: "canvas_controls",
        message0: translate("canvas_controls"),
        args0: [
          {
            type: "field_checkbox",
            name: "CONTROLS",
            checked: true,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("canvas_controls"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["interact_indicator"] = {
    init: function () {
      this.jsonInit({
        type: "interact_indicator",
        message0: translate("interact_indicator"),
        args0: [
          {
            type: "field_checkbox",
            name: "ENABLED",
            checked: true,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("interact_indicator"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["button_controls"] = {
    init: function () {
      this.jsonInit({
        type: "button_controls",
        message0: translate("button_controls"),
        args0: [
          {
            type: "field_dropdown",
            name: "CONTROL",
            options: [
              getDropdownOption("BOTH"),
              getDropdownOption("ARROWS"),
              getDropdownOption("ACTIONS"),
            ],
          },
          {
            type: "field_dropdown",
            name: "ENABLED",
            options: [
              getDropdownOption("AUTO"),
              getDropdownOption("ENABLED"),
              getDropdownOption("DISABLED"),
            ],
          },
          {
            type: "input_value",
            name: "COLOR",
            check: "Colour",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("button_controls"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  Blockly.Blocks["on_screen_controls"] = {
    init: function () {
      this.jsonInit({
        type: "on_screen_controls",
        message0: translate("on_screen_controls"),
        args0: [
          {
            type: "field_dropdown",
            name: "MOVEMENT",
            options: [
              getDropdownOption("ARROWS"),
              getDropdownOption("JOYSTICK"),
              getDropdownOption("NONE"),
            ],
          },
          {
            type: "field_dropdown",
            name: "ACTIONS",
            options: [
              getDropdownOption("YES"),
              getDropdownOption("NO"),
            ],
          },
          {
            type: "field_dropdown",
            name: "ENABLED",
            options: [
              getDropdownOption("AUTO"),
              getDropdownOption("ENABLED"),
              getDropdownOption("DISABLED"),
            ],
          },
          {
            type: "input_value",
            name: "COLOR",
            check: "Colour",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("on_screen_controls"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");
    },
  };

  wireMicrobitManager();

  Blockly.Blocks['add_microbit'] = {
    init: function () {
      const variableNamePrefix = 'microbit';
      const nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'add_microbit',
        message0: translate('add_microbit'),
        args0: [
          {
            type: 'field_variable',
            name: 'MICROBIT_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'CHANNEL',
            check: 'Number',
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Sensing'],
        tooltip: getTooltip('add_microbit'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('sensing_blocks');

      // Clickable status icon: grey → opens the connect flow, otherwise it
      // just reflects the board's state. Inert in the flyout.
      this.inputList[0].insertFieldAt(
        0,
        new Blockly.FieldImage(
          makeMicrobitStatusIcon(VariableStatus.UNBOUND),
          24,
          24,
          microbitStatusAlt(VariableStatus.UNBOUND),
          handleMicrobitStatusClick
        ),
        MICROBIT_STATUS_FIELD
      );

      registerBlockHandler(this, (changeEvent) => {
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          'MICROBIT_VAR'
        );
        if (
          changeEvent.type === Blockly.Events.BLOCK_CREATE ||
          changeEvent.type === Blockly.Events.BLOCK_CHANGE ||
          changeEvent.type === Blockly.Events.BLOCK_DELETE
        ) {
          refreshMicrobitBlocks(this.workspace);
        }
      });
    },
  };

  Blockly.Blocks["microbit_input"] = {
    init: function () {
      this.jsonInit({
        type: "microbit_input",
        message0: translate("microbit_input"),
        args0: [
          {
            type: "field_dropdown",
            name: "EVENT",
            options: [
              [getOption("pin_0"), "0"],
              [getOption("pin_1"), "1"],
              [getOption("pin_2"), "2"],
              [getOption("pin_l"), "l"],
              [getOption("pin_j"), "j"],
              [getOption("pin_h"), "h"],
              [getOption("pin_k"), "k"],
              [getOption("pin_space"), " "],
              [getOption("pin_q"), "q"],
              [getOption("pin_r"), "r"],
              [getOption("pin_t"), "t"],
              [getOption("pin_o"), "o"],
              [getOption("pin_p"), "p"],
              [getOption("pin_a"), "a"],
              [getOption("pin_d"), "d"],
              [getOption("pin_y"), "y"],
              [getOption("pin_g"), "g"],
              [getOption("pin_i"), "i"],
            ],
          },
        ],
        message1: "%1",
        args1: [
          {
            type: "input_statement",
            name: "DO",
          },
        ],
        colour: categoryColours["Sensing"],
        tooltip: getTooltip("microbit_input"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sensing_blocks");

      // Device dropdown (dynamic_mesh_dropdown style): "any" plus the
      // micro:bit variables defined via add_microbit blocks. Appended outside
      // message0 so legacy XML — which has no DEVICE field — loads unchanged
      // and defaults to "any".
      this.inputList[0].appendField(new MicrobitDeviceDropdown(), "DEVICE");
      syncMicrobitDeviceField(this);
      this.setOnChange((changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.VAR_RENAME ||
          changeEvent.type === Blockly.Events.VAR_DELETE
        ) {
          syncMicrobitDeviceField(this);
        }
      });

      addToggleButton(this);
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
    toggleDoBlock: function () {
      this.updateShape_(!this.isInline);
    },
  };
  Blockly.Blocks["ui_slider"] = {
    init: function () {
      const variableNamePrefix = "slider";
      const nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: "ui_slider",
        message0: translate("ui_slider"),
        args0: [
          {
            type: "field_variable",
            name: "SLIDER_VAR",
            variable: nextVariableName,
          },
          {
            type: "input_value",
            name: "MIN",
            check: "Number",
          },
          {
            type: "input_value",
            name: "MAX",
            check: "Number",
          },
          {
            type: "input_value",
            name: "VALUE",
            check: "Number",
          },
          {
            type: "input_value",
            name: "X",
            check: "Number",
          },
          {
            type: "input_value",
            name: "Y",
            check: "Number",
          },
          {
            type: "input_value",
            name: "COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "BACKGROUND",
            check: "Colour",
          },
          {
            type: "field_dropdown",
            name: "SIZE",
            options: [
              getDropdownOption("SMALL"),
              getDropdownOption("MEDIUM"),
              getDropdownOption("LARGE"),
            ],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Text"],
        tooltip: getTooltip("ui_slider"),
      });

      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("text_blocks");
      registerBlockHandler(this, (changeEvent) =>
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          "SLIDER_VAR",
        ),
      );
    },
  };
}
