import * as Blockly from "blockly";
//import "@blockly/block-plus-minus";
import * as BlockDynamicConnection from "@blockly/block-dynamic-connection";
import { categoryColours, toolbox } from "./toolbox.js";
import {
  audioNames,
  characterNames,
  objectNames,
  multiObjectNames,
  objectColours,
  mapNames,
  modelNames,
  animationNames,
  materialNames,
} from "./config.js";
import {
  deleteMeshFromBlock,
  updateOrCreateMeshFromBlock,
} from "./ui/designview.js";
import { flock } from "./flock.js";
import { registerFieldColour } from "@blockly/field-colour";

registerFieldColour();

export let nextVariableIndexes = {};

const inlineIcon =
  "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%3Csvg%20version%3D%221.1%22%20id%3D%22Layer_1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20x%3D%220px%22%20y%3D%220px%22%20width%3D%22122.88px%22%20height%3D%2280.593px%22%20viewBox%3D%220%200%20122.88%2080.593%22%20enable-background%3D%22new%200%200%20122.88%2080.593%22%20xml%3Aspace%3D%22preserve%22%3E%3Cg%3E%3Cpolygon%20fill%3D%22white%22%20points%3D%22122.88%2C80.593%20122.88%2C49.772%2061.44%2C0%200%2C49.772%200%2C80.593%2061.44%2C30.82%20122.88%2C80.593%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";

// Shared utility to add the toggle button to a block
export function addToggleButton(block) {
  const toggleButton = new Blockly.FieldImage(
    inlineIcon, // Custom icon
    30,
    30,
    "*", // Width, Height, Alt text
    () => {
      block.toggleDoBlock();
    },
  );

  block
    .appendDummyInput()
    .setAlign(Blockly.inputs.Align.RIGHT)
    .appendField(toggleButton, "TOGGLE_BUTTON");
}

// Shared utility for the mutationToDom function
export function mutationToDom(block) {
  const container = document.createElement("mutation");
  container.setAttribute("inline", block.isInline);
  return container;
}

// Shared utility for the domToMutation function
export function domToMutation(block, xmlElement) {
  const isInline = xmlElement.getAttribute("inline") === "true";
  block.updateShape_(isInline);
}

// Shared utility to update the shape of the block
function updateShape(block, isInline) {
  block.isInline = isInline;
  if (isInline) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  } else {
    block.setPreviousStatement(false);
    block.setNextStatement(false);
  }
}
export function handleBlockSelect(event) {
  if (event.type === Blockly.Events.SELECTED) {
    const block = Blockly.getMainWorkspace().getBlockById(event.newElementId); // Get the selected block

    if (
      block &&
      block.type !== "create_ground" &&
      block.type !== "create_map" &&
      (block.type.startsWith("create_") || block.type.startsWith("load_"))
    ) {
      // If the block is a create block, update the window.currentMesh variable
      window.updateCurrentMeshName(block, "ID_VAR");
    }
  }
}

export function handleBlockDelete(event) {
  if (event.type === Blockly.Events.BLOCK_DELETE) {
    // Recursively delete meshes for qualifying blocks
    function deleteMeshesRecursively(blockJson) {
      // Check if block type matches the prefixes
      if (
        blockJson.type.startsWith("load_") ||
        blockJson.type.startsWith("create_")
      ) {
        deleteMeshFromBlock(blockJson.id);
      }

      // Check inputs for child blocks
      if (blockJson.inputs) {
        for (const key in blockJson.inputs) {
          const inputBlock = blockJson.inputs[key].block;
          if (inputBlock) {
            deleteMeshesRecursively(inputBlock);
          }
        }
      }

      // Check 'next' for connected blocks
      if (blockJson.next && blockJson.next.block) {
        deleteMeshesRecursively(blockJson.next.block);
      }
    }

    // Process the main deleted block and its connections
    deleteMeshesRecursively(event.oldJson);
  }
}

export function findCreateBlock(block) {
  if (!block || typeof block.getParent !== "function") {
    //console.log("no id");
    return null;
  }

  let parent = block;

  while (parent) {
    if (parent.type === "scale" || parent.type === "rotate_to") {
      // Don't update parent if we're modifying a nested scale or rotate
      return null;
    }

    if (
      parent.type.startsWith("create_") ||
      parent.type.startsWith("load_") ||
      parent.type === "set_sky_color" ||
      parent.type === "set_background_color"
    ) {
      return parent;
    }

    // Move up the hierarchy
    parent = parent.getParent();
  }

  // No matching parent found
  return null;
}

/*
export default Blockly.Theme.defineTheme("flock", {
	base: Blockly.Themes.Modern,
	componentStyles: {
		workspaceBackgroundColour: "white",
		toolboxBackgroundColour: "#ffffff66",
		//'toolboxForegroundColour': '#fff',
		//'flyoutBackgroundColour': '#252526',
		//'flyoutForegroundColour': '#ccc',
		//'flyoutOpacity': 1,
		//'scrollbarColour': '#797979',
		insertionMarkerColour: "#defd6c",
		insertionMarkerOpacity: 0.3,
		scrollbarOpacity: 0.4,
		cursorColour: "#defd6c",
		//'blackBackground': '#333',
	},
});
*/

export class CustomConstantProvider extends Blockly.zelos.ConstantProvider {
  constructor() {
    super();

    this.NOTCH_OFFSET_LEFT = 2 * this.GRID_UNIT;
    this.NOTCH_HEIGHT = 2 * this.GRID_UNIT;
    this.FIELD_DROPDOWN_SVG_ARROW_DATAURI =
      "data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMi43MSIgaGVpZ2h0PSI4Ljc5IiB2aWV3Qm94PSIwIDAgMTIuNzEgOC43OSI+PHRpdGxlPmRyb3Bkb3duLWFycm93PC90aXRsZT48ZyBvcGFjaXR5PSIwLjEiPjxwYXRoIGQ9Ik0xMi43MSwyLjQ0QTIuNDEsMi40MSwwLDAsMSwxMiw0LjE2TDguMDgsOC4wOGEyLjQ1LDIuNDUsMCwwLDEtMy40NSwwTDAuNzIsNC4xNkEyLjQyLDIuNDIsMCwwLDEsMCwyLjQ0LDIuNDgsMi40OCwwLDAsMSwuNzEuNzFDMSwwLjQ3LDEuNDMsMCw2LjM2LDBTMTEuNzUsMC40NiwxMiwuNzFBMi40NCwyLjQ0LDAsMCwxLDEyLjcxLDIuNDRaIiBmaWxsPSIjMjMxZjIwIi8+PC9nPjxwYXRoIGQ9Ik02LjM2LDcuNzlhMS40MywxLjQzLDAsMCwxLTEtLjQyTDEuNDIsMy40NWExLjQ0LDEuNDQsMCwwLDEsMC0yYzAuNTYtLjU2LDkuMzEtMC41Niw5Ljg3LDBhMS40NCwxLjQ0LDAsMCwxLDAsMkw3LjM3LDcuMzdBMS40MywxLjQzLDAsMCwxLDYuMzYsNy43OVoiIGZpbGw9IiMwMDAiLz48L3N2Zz4=";
  }
}

class CustomRenderInfo extends Blockly.zelos.RenderInfo {
  constructor(renderer, block) {
    super(renderer, block);
  }

  adjustXPosition_() {}
}

export class CustomZelosRenderer extends Blockly.zelos.Renderer {
  constructor(name) {
    super(name);
  }

  // Override the method to return our custom constant provider
  makeConstants_() {
    return new CustomConstantProvider();
  }

  // Override the method to return our custom RenderInfo
  makeRenderInfo_(block) {
    return new CustomRenderInfo(this, block);
  }
}

const mediaPath = window.location.pathname.includes("/flock/")
  ? "/flock/blockly/media/" // For GitHub Pages
  : "/blockly/media/"; // For local dev

export const options = {
  theme: Blockly.Themes.Modern, // "flock"
  //theme: "flockTheme",
  //renderer: "zelos",
  renderer: "custom_zelos_renderer",
  media: mediaPath,
  modalInputs: false,
  zoom: {
    controls: true,
    wheel: false,
    startScale: 0.7,
    maxScale: 3,
    minScale: 0.3,
    scaleSpeed: 1.2,
  },
  move: {
    scrollbars: {
      horizontal: true,
      vertical: true,
    },
    drag: true,
    //dragSurface: false,
    wheel: true,
  },
  toolbox: toolbox,
  searchAllBlocks: false,
  plugins: {
    connectionPreviewer: BlockDynamicConnection.decoratePreviewer(),
  },
  // Double click the blocks to collapse/expand
  // them (A feature from MIT App Inventor).
  useDoubleClick: false,
  // Bump neighbours after dragging to avoid overlapping.
  bumpNeighbours: false,

  // Keep the fields of multiple selected same-type blocks with the same value
  // See note below.
  multiFieldUpdate: true,

  // Auto focus the workspace when the mouse enters.
  workspaceAutoFocus: true,

  // Use custom icon for the multi select controls.
  multiselectIcon: {
    hideIcon: true,
    weight: 3,
    enabledIcon:
      "https://github.com/mit-cml/workspace-multiselect/raw/main/test/media/select.svg",
    disabledIcon:
      "https://github.com/mit-cml/workspace-multiselect/raw/main/test/media/unselect.svg",
  },

  multiSelectKeys: ["Shift"],

  multiselectCopyPaste: {
    crossTab: true,
    menu: true,
  },
};

export function initializeVariableIndexes() {
  nextVariableIndexes = {
    model: 1,
    box: 1,
    sphere: 1,
    cylinder: 1,
    capsule: 1,
    plane: 1,
    wall: 1,
    text: 1,
    "3dtext": 1,
    sound: 1,
    character: 1,
    object: 1,
    instrument: 1,
    animation: 1,
    clone: 1,
  };

  const allVariables = Blockly.getMainWorkspace().getAllVariables(); // Retrieve all variables in the workspace

  // Process each type of variable
  Object.keys(nextVariableIndexes).forEach(function (type) {
    let maxIndex = 0; // To keep track of the highest index used so far
    // Regular expression to match variable names like 'type1', 'type2', etc.
    const varPattern = new RegExp(`^${type}(\\d+)$`);

    allVariables.forEach(function (variable) {
      const match = variable.name.match(varPattern);
      if (match) {
        const currentIndex = parseInt(match[1], 10);
        if (currentIndex > maxIndex) {
          maxIndex = currentIndex;
        }
      }
    });

    nextVariableIndexes[type] = maxIndex + 1;
  });

  // Optionally return the indexes if needed elsewhere
  return nextVariableIndexes;
}

export function defineBlocks() {
  //BlockDynamicConnection.overrideOldBlockDefinitions();
  //Blockly.Blocks['dynamic_list_create'].minInputs = 1;

  //	 Blockly.Blocks['lists_create_with'] = Blockly.Blocks['dynamic_list_create'];

  //	 Blockly.Blocks['text_join'] = Blockly.Blocks['dynamic_text_join'];
  Blockly.Blocks["controls_if"] = Blockly.Blocks["dynamic_if"];

  Blockly.Blocks["start"] = {
    init: function () {
      this.jsonInit({
        type: "start",
        message0: "start\n%1",
        args0: [
          {
            type: "input_statement",
            name: "DO",
          },
        ],
        colour: categoryColours["Events"],
        tooltip:
          "Run the attached blocks when the project starts.\nKeyword: start",
      });
    },
  };

  Blockly.Blocks["create_ground"] = {
    init: function () {
      this.jsonInit({
        type: "create_ground",
        message0: "ground %1",
        args0: [
          {
            type: "input_value",
            name: "COLOR",
            colour: "#71BC78",
            check: "Colour",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip:
          "Adds a ground plane with collisions enabled to the scene, with specified color.\nKeyword: ground",
        helpUrl: "",
      });

      this.setOnChange((changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.BLOCK_CREATE ||
          changeEvent.type === Blockly.Events.BLOCK_CHANGE
        ) {
          const parent = findCreateBlock(
            Blockly.getMainWorkspace().getBlockById(changeEvent.blockId),
          );

          if (parent === this) {
            const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
              this.id,
            );

            if (blockInWorkspace) {
              updateOrCreateMeshFromBlock(this, changeEvent);
              //window.updateCurrentMeshName(this, "ID_VAR");
            }
          }
        }
      });
    },
  };

  Blockly.Blocks["create_custom_map"] = {
    init: function () {
      this.jsonInit({
        type: "create_custom_map",
        message0: `custom map\n%1 %2 %3 %4 %5\n%6 %7 %8 %9 %10\n%11 %12 %13 %14 %15\n%16 %17 %18 %19 %20\n%21 %22 %23 %24 %25`,
        args0: [
          { type: "input_value", name: "COLOR_1", check: "Colour" },
          { type: "input_value", name: "COLOR_2", check: "Colour" },
          { type: "input_value", name: "COLOR_3", check: "Colour" },
          { type: "input_value", name: "COLOR_4", check: "Colour" },
          { type: "input_value", name: "COLOR_5", check: "Colour" },
          { type: "input_value", name: "COLOR_6", check: "Colour" },
          { type: "input_value", name: "COLOR_7", check: "Colour" },
          { type: "input_value", name: "COLOR_8", check: "Colour" },
          { type: "input_value", name: "COLOR_9", check: "Colour" },
          { type: "input_value", name: "COLOR_10", check: "Colour" },
          { type: "input_value", name: "COLOR_11", check: "Colour" },
          { type: "input_value", name: "COLOR_12", check: "Colour" },
          { type: "input_value", name: "COLOR_13", check: "Colour" },
          { type: "input_value", name: "COLOR_14", check: "Colour" },
          { type: "input_value", name: "COLOR_15", check: "Colour" },
          { type: "input_value", name: "COLOR_16", check: "Colour" },
          { type: "input_value", name: "COLOR_17", check: "Colour" },
          { type: "input_value", name: "COLOR_18", check: "Colour" },
          { type: "input_value", name: "COLOR_19", check: "Colour" },
          { type: "input_value", name: "COLOR_20", check: "Colour" },
          { type: "input_value", name: "COLOR_21", check: "Colour" },
          { type: "input_value", name: "COLOR_22", check: "Colour" },
          { type: "input_value", name: "COLOR_23", check: "Colour" },
          { type: "input_value", name: "COLOR_24", check: "Colour" },
          { type: "input_value", name: "COLOR_25", check: "Colour" },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip:
          "Creates a 5x5 ground map with specified elevation colors.\nKeyword:map",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["get_property"] = {
    init: function () {
      this.jsonInit({
        type: "get_property",
        message0: "get %1 of %2",
        args0: [
          {
            type: "field_dropdown",
            name: "PROPERTY",
            options: [
              ["position x", "POSITION_X"],
              ["position y", "POSITION_Y"],
              ["position z", "POSITION_Z"],
              ["rotation x", "ROTATION_X"],
              ["rotation y", "ROTATION_Y"],
              ["rotation z", "ROTATION_Z"],
              ["min x", "MIN_X"],
              ["max x", "MAX_X"],
              ["min y", "MIN_Y"],
              ["max y", "MAX_Y"],
              ["min z", "MIN_Z"],
              ["max z", "MAX_Z"],
              ["scale x", "SCALE_X"],
              ["scale y", "SCALE_Y"],
              ["scale z", "SCALE_Z"],
              ["size x", "SIZE_X"],
              ["size y", "SIZE_Y"],
              ["size z", "SIZE_Z"],
              ["visible", "VISIBLE"],
              ["alpha", "ALPHA"],
              ["colour", "COLOUR"],
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
        tooltip:
          "Gets the value of the selected property of a mesh.\nKeyword: get",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["canvas_controls"] = {
    init: function () {
      this.jsonInit({
        type: "canvas_controls",
        message0: "canvas controls %1",
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
        tooltip: "Add or removes canvas motion controls.\nKeyword: canvas",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["button_controls"] = {
    init: function () {
      this.jsonInit({
        type: "button_controls",
        message0: "button controls %1 enabled %2 color %3",
        args0: [
          {
            type: "field_dropdown",
            name: "CONTROL",
            options: [
              ["both", "BOTH"],
              ["arrows", "ARROWS"],
              ["actions", "ACTIONS"],
            ],
          },
          {
            type: "field_checkbox",
            name: "ENABLED",
            checked: true,
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
        tooltip: "Configure button controls.\nKeyword: button",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["wait"] = {
    init: function () {
      this.jsonInit({
        type: "wait",
        message0: "wait %1 ms",
        args0: [
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Control"],
        tooltip: "Wait for a specified time in milliseconds.\nKeyword: wait",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["wait_until"] = {
    init: function () {
      this.jsonInit({
        type: "wait_until",
        message0: "wait until %1",
        args0: [
          {
            type: "input_value",
            name: "CONDITION",
            check: "Boolean",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Control"],
        tooltip: "Wait until the condition is true.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["glide_to"] = {
    init: function () {
      this.jsonInit({
        type: "glide_to",
        message0:
          "glide %1 to x %2 y %3 z %4 in %5 ms\n%6 return? %7 loop? %8 %9",
        args0: [
          {
            type: "field_variable",
            name: "MESH_VAR",
            variable: window.currentMesh,
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
            name: "Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
          {
            type: "field_dropdown",
            name: "MODE",
            options: [
              ["await", "AWAIT"],
              ["start", "START"],
            ],
          },
          {
            type: "field_checkbox",
            name: "REVERSE",
            checked: false,
            text: "reverse",
          },
          {
            type: "field_checkbox",
            name: "LOOP",
            checked: false,
            text: "loop",
          },
          {
            type: "field_dropdown",
            name: "EASING",
            options: [
              ["Linear", "Linear"],
              ["SineEase", "SineEase"],
              ["CubicEase", "CubicEase"],
              ["QuadraticEase", "QuadraticEase"],
              ["ExponentialEase", "ExponentialEase"],
              ["BounceEase", "BounceEase"],
              ["ElasticEase", "ElasticEase"],
              ["BackEase", "BackEase"],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip:
          "Glide to a specified position over a duration with options for reversing, looping, and easing.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["glide_to_seconds"] = {
    init: function () {
      this.jsonInit({
        type: "glide_to",
        message0:
          "glide %1 to x %2 y %3 z %4 in %5 seconds \n%6 return? %7 loop? %8 %9",
        args0: [
          {
            type: "field_variable",
            name: "MESH_VAR",
            variable: window.currentMesh,
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
            name: "Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
          {
            type: "field_dropdown",
            name: "MODE",
            options: [
              ["await", "AWAIT"],
              ["start", "START"],
            ],
          },
          {
            type: "field_checkbox",
            name: "REVERSE",
            checked: false,
            text: "reverse",
          },
          {
            type: "field_checkbox",
            name: "LOOP",
            checked: false,
            text: "loop",
          },
          {
            type: "field_dropdown",
            name: "EASING",
            options: [
              ["Linear", "Linear"],
              ["SineEase", "SineEase"],
              ["CubicEase", "CubicEase"],
              ["QuadraticEase", "QuadraticEase"],
              ["ExponentialEase", "ExponentialEase"],
              ["BounceEase", "BounceEase"],
              ["ElasticEase", "ElasticEase"],
              ["BackEase", "BackEase"],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip:
          "Glide to a specified position over a duration with options for reversing, looping, and easing.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["rotate_anim"] = {
    init: function () {
      this.jsonInit({
        type: "rotate_anim",
        message0:
          "rotate %1 to x %2 y %3 z %4 in %5 ms\n%6 reverse? %7 loop? %8  %9",
        args0: [
          {
            type: "field_variable",
            name: "MESH_VAR",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "ROT_X",
            check: "Number",
          },
          {
            type: "input_value",
            name: "ROT_Y",
            check: "Number",
          },
          {
            type: "input_value",
            name: "ROT_Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
          {
            type: "field_dropdown",
            name: "MODE",
            options: [
              ["await", "AWAIT"],
              ["start", "START"],
            ],
          },
          {
            type: "field_checkbox",
            name: "REVERSE",
            checked: false,
            text: "reverse",
          },
          {
            type: "field_checkbox",
            name: "LOOP",
            checked: false,
            text: "loop",
          },
          {
            type: "field_dropdown",
            name: "EASING",
            options: [
              ["Linear", "Linear"],
              ["SineEase", "SineEase"],
              ["CubicEase", "CubicEase"],
              ["QuadraticEase", "QuadraticEase"],
              ["ExponentialEase", "ExponentialEase"],
              ["BounceEase", "BounceEase"],
              ["ElasticEase", "ElasticEase"],
              ["BackEase", "BackEase"],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip:
          "Rotate a mesh to specified angles over a duration with options for reverse, looping, and easing.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["animate_property"] = {
    init: function () {
      this.jsonInit({
        type: "animate_property",
        message0: "animate %1 %2 to %3 in %4 ms reverse? %5 loop? %6 %7",
        args0: [
          {
            type: "field_variable",
            name: "MESH_VAR",
            variable: window.currentMesh,
          },
          {
            type: "field_dropdown",
            name: "PROPERTY",
            options: [
              ["diffuse color", "diffuseColor"],
              ["emissive color", "emissiveColor"],
              ["ambient color", "ambientColor"],
              ["specular color", "specularColor"],
              ["alpha", "alpha"],
            ],
          },
          {
            type: "input_value",
            name: "TO",
          },
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
          {
            type: "field_checkbox",
            name: "REVERSE",
            checked: false,
            text: "reverse",
          },
          {
            type: "field_checkbox",
            name: "LOOP",
            checked: false,
            text: "loop",
          },
          {
            type: "field_dropdown",
            name: "START_AWAIT",
            options: [
              ["start", "start"],
              ["await", "await"],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip: "Animates a material property of the mesh and its children.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["colour_keyframe"] = {
    init: function () {
      this.jsonInit({
        type: "colour_keyframe",
        message0: "at %1 color: %2",
        args0: [
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
          {
            type: "input_value",
            name: "VALUE",
            check: "Colour", // Reusing your existing colour block
          },
        ],
        colour: categoryColours["Animate"],
        inputsInline: true,
        output: "Keyframe",
        tooltip: "Set a colour and duration for a keyframe.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["number_keyframe"] = {
    init: function () {
      this.jsonInit({
        type: "number_keyframe",
        message0: "at: %1 value: %2",
        args0: [
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
          {
            type: "input_value",
            name: "VALUE",
            check: "Number", // Reusing your existing colour block
          },
        ],
        colour: categoryColours["Animate"],
        inputsInline: true,
        output: "Keyframe",
        tooltip: "Set a number and duration for a keyframe.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["xyz_keyframe"] = {
    init: function () {
      this.jsonInit({
        type: "xyz_keyframe",
        message0: "at: %1 x: %2 y: %3 z: %4",
        args0: [
          {
            type: "input_value",
            name: "DURATION",
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
            name: "Z",
            check: "Number",
          },
        ],
        colour: categoryColours["Animate"],
        inputsInline: true,
        output: "Keyframe",
        tooltip: "Set an XYZ keyframe with duration.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["animate_keyframes"] = {
    init: function () {
      this.jsonInit({
        type: "animate_keyframes",
        message0:
          "animate keyframes on %1 property %2\nkeyframes %3\neasing %4 loop %5 reverse %6 %7",
        args0: [
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh, // Assuming current mesh is stored here
          },
          {
            type: "field_dropdown",
            name: "PROPERTY",
            options: [
              ["color", "color"],
              ["alpha", "alpha"],
              ["position", "position"],
              ["rotation", "rotation"],
              ["scaling", "scaling"],
            ],
          },
          {
            type: "input_value",
            name: "KEYFRAMES",
            check: "Array", // Accepts an array of keyframes
          },
          {
            type: "field_dropdown",
            name: "EASING",
            options: [
              ["linear", "LINEAR"],
              ["ease-in", "EASEIN"],
              ["ease-out", "EASEOUT"],
              ["ease-in-out", "EASEINOUT"],
            ],
          },
          {
            type: "field_checkbox",
            name: "LOOP",
            checked: false, // Checkbox for looping
          },
          {
            type: "field_checkbox",
            name: "REVERSE",
            checked: false, // Checkbox for reversing the animation
          },
          {
            type: "field_dropdown",
            name: "MODE",
            options: [
              ["await", "AWAIT"],
              ["start", "START"],
            ],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip:
          "Animates an array of keyframes on the selected mesh, with easing, optional looping, and reversing.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["animation"] = {
    init: function () {
      const variableNamePrefix = "animation";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        type: "animation",
        message0:
          "animate keyframes on %1 property %2 group %3\nkeyframes %4\neasing %5 loop %6 reverse %7 mode %8",
        args0: [
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh, // Assuming current mesh is stored here
          },
          {
            type: "field_dropdown",
            name: "PROPERTY",
            options: [
              ["color", "color"],
              ["alpha", "alpha"],
              ["position", "position"],
              ["rotation", "rotation"],
              ["scaling", "scaling"],
              ["position.x", "position.x"],
              ["position.y", "position.y"],
              ["position.z", "position.z"],
              ["rotation.x", "rotation.x"],
              ["rotation.y", "rotation.y"],
              ["rotation.z", "rotation.z"],
              ["scaling.x", "scaling.x"],
              ["scaling.y", "scaling.y"],
              ["scaling.z", "scaling.z"],
            ],
          },
          {
            type: "field_variable",
            name: "ANIMATION_GROUP",
            variable: nextVariableName, // Use the dynamic variable name
          },
          {
            type: "input_value",
            name: "KEYFRAMES",
            check: "Array",
          },
          {
            type: "field_dropdown",
            name: "EASING",
            options: [
              ["linear", "LINEAR"],
              ["ease-in", "EASEIN"],
              ["ease-out", "EASEOUT"],
              ["ease-in-out", "EASEINOUT"],
            ],
          },
          {
            type: "field_checkbox",
            name: "LOOP",
            checked: false,
          },
          {
            type: "field_checkbox",
            name: "REVERSE",
            checked: false,
          },
          {
            type: "field_dropdown",
            name: "MODE",
            options: [
              ["start", "START"],
              ["await", "AWAIT"],
              ["create", "CREATE"],
            ],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip:
          "Creates an animation group for the selected mesh and property, with keyframes, easing, optional looping, and reversing. Choose create, start, or await to control behaviour.",
        helpUrl: "",
      });

      this.setOnChange((changeEvent) => {
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          "ANIMATION_GROUP",
        );

        if (window.loadingCode) return;
      });
    },
  };

  Blockly.Blocks["control_animation_group"] = {
    init: function () {
      this.jsonInit({
        type: "animation_group_control",
        message0: "animation group %1 %2",
        args0: [
          {
            type: "field_variable",
            name: "GROUP_NAME",
            variable: "animation1",
          },
          {
            type: "field_dropdown",
            name: "ACTION",
            options: [
              ["▶️ Play", "play"],
              ["⏸️ Pause", "pause"],
              ["⏹️ Stop", "stop"],
            ],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip:
          "Controls the animation group by playing, pausing, or stopping it.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["animate_from"] = {
    init: function () {
      this.jsonInit({
        type: "animate_from",
        message0: "animate group %1 from %2 seconds",
        args0: [
          {
            type: "field_variable",
            name: "GROUP_NAME",
            variable: "animation1",
          },
          {
            type: "input_value",
            name: "TIME",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip:
          "Starts animating the group from the specified time (in seconds).",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["stop_animations"] = {
    init: function () {
      this.jsonInit({
        type: "stop_animations",
        message0: "stop animations %1",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip:
          "Stop all keyframe animations on the selected model.\nKeyword: stop",
        helpUrl: "",
      });
    },
  };

 

  Blockly.Blocks["set_pivot"] = {
    init: function () {
      this.jsonInit({
        type: "set_pivot",
        message0: "set pivot of %1 x: %2 y: %3 z: %4",
        args0: [
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh, // Assuming the mesh is stored here
          },
          {
            type: "input_value",
            name: "X_PIVOT",
            check: ["Number", "String"],
          },
          {
            type: "input_value",
            name: "Y_PIVOT",
            check: ["Number", "String"],
          },
          {
            type: "input_value",
            name: "Z_PIVOT",
            check: ["Number", "String"], 
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip: "Sets the pivot point for a mesh on the X, Y, and Z axes",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["min_centre_max"] = {
    init: function () {
      this.jsonInit({
        type: "min_centre_max",
        message0: "%1",
        args0: [
          {
            type: "field_dropdown",
            name: "PIVOT_OPTION",
            options: [
              ["min", "MIN"],
              ["center", "CENTER"],
              ["max", "MAX"],
            ],
          },
        ],
        output: "String", // Now returns a symbolic string
        colour: categoryColours["Transform"],
        tooltip: "Choose min, center, or max for the pivot point",
        helpUrl: "",
      });
    },
  };

  const oldInit = Blockly.Blocks["controls_if"].init;

  Blockly.Blocks["controls_if"].init = function () {
    // Call the original init function
    oldInit.call(this);

    // Override the tooltip after the original init
    this.setTooltip(() => {
      let tooltip = "Executes actions if a condition is true.";

      tooltip += ` Drag additional conditions to create else if branches.`;

      tooltip += " Drag a statement at the end to create an else branch.";

      return tooltip;
    });
  };

  Blockly.Blocks["set_sky_color"] = {
    init: function () {
      this.jsonInit({
        type: "set_sky_color",
        message0: "sky %1",
        args0: [
          {
            type: "input_value",
            name: "COLOR",
            colour: "#6495ED",
            check: ["Colour", "Array", "Material"],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip: "Sets the sky color of the scene.\nKeyword: sky",
        helpUrl: "",
      });

      this.setOnChange((changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.BLOCK_CREATE ||
          changeEvent.type === Blockly.Events.BLOCK_CHANGE
        ) {
          const parent = findCreateBlock(
            Blockly.getMainWorkspace().getBlockById(changeEvent.blockId),
          );
          if (parent === this) {
            const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
              this.id,
            );

            if (blockInWorkspace) {
              updateOrCreateMeshFromBlock(this, changeEvent);
              //window.updateCurrentMeshName(this, "ID_VAR");
            }
          }
        }
      });
    },
  };

  Blockly.Blocks["light_intensity"] = {
    init: function () {
      this.jsonInit({
        type: "light_intensity",
        message0: "set light intensity to %1",
        args0: [
          {
            type: "input_value",
            name: "INTENSITY",
            check: "Number",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip:
          "Set the intensity of the main light.\nKeyword: light intensity",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["set_fog"] = {
    init: function () {
      this.jsonInit({
        type: "set_fog",
        message0: "set fog color %1 mode %2 density %3",
        args0: [
          {
            type: "input_value",
            name: "FOG_COLOR",
            colour: "#ffffff",
            check: "Colour",
          },
          {
            type: "field_dropdown",
            name: "FOG_MODE",
            options: [
              ["Linear", "LINEAR"],
              ["None", "NONE"],
              ["Exp", "EXP"],
              ["Exp2", "EXP2"],
            ],
          },
          {
            type: "input_value",
            name: "DENSITY",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip: "Configures the scene's fog.\nKeyword: fog",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["load_character"] = {
    init: function () {
      const variableNamePrefix = "character";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        message0: `set %1 to %2 scale: %3 x: %4 y: %5 z: %6
				Hair: %7 Skin: %8 Eyes: %9 T-Shirt: %10 Shorts: %11 Detail: %12`,
        args0: [
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: nextVariableName,
          },
          {
            type: "field_grid_dropdown",
            name: "MODELS",
            columns: 6,
            options: characterNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, "");
              return [
                {
                  src: `${flock.imagePath}${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: baseName,
                },
                name,
              ];
            }),
          },
          {
            type: "input_value",
            name: "SCALE",
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
            name: "Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "HAIR_COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "SKIN_COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "EYES_COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "TSHIRT_COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "SHORTS_COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "SLEEVES_COLOR",
            check: "Colour",
          },
        ],
        inputsInline: true,
        colour: categoryColours["Scene"],
        tooltip: "Create a configurable character.\nKeyword: character",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });

      this.setOnChange((changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.BLOCK_CREATE ||
          changeEvent.type === Blockly.Events.BLOCK_CHANGE
        ) {
          const parent = findCreateBlock(
            Blockly.getMainWorkspace().getBlockById(changeEvent.blockId),
          );

          if (parent === this) {
            const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
              this.id,
            ); // Check if block is in the main workspace

            if (blockInWorkspace) {
              updateOrCreateMeshFromBlock(this, changeEvent);
              window.updateCurrentMeshName(this, "ID_VAR"); // Call the function to update window.currentMesh
            }
          }
        }
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
        );
      });

      addDoMutatorWithToggleBehavior(this);
    },
  };

  Blockly.Blocks["load_object"] = {
    init: function () {
      const defaultObject = "Star.glb";
      const defaultColour = objectColours[defaultObject] || "#000000";
      const variableNamePrefix = "object";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      // Add the main inputs of the block
      this.jsonInit({
        message0: `set %1 to %2 %3 scale: %4 x: %5 y: %6 z: %7`,
        args0: [
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: nextVariableName,
          },
          {
            type: "field_grid_dropdown",
            name: "MODELS",
            columns: 6,
            options: objectNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, "");
              return [
                {
                  src: `${flock.imagePath}${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: baseName,
                },
                name,
              ];
            }),
          },
          {
            type: "input_value",
            name: "COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "SCALE",
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
            name: "Z",
            check: "Number",
          },
        ],
        inputsInline: true,
        colour: categoryColours["Scene"],
        tooltip: "Create an object.\nKeyword: object",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });

      // Function to update the COLOR field based on the selected model
      const updateColorField = () => {
        const selectedObject = this.getFieldValue("MODELS");
        const colour = objectColours[selectedObject] || defaultColour;
        const colorInput = this.getInput("COLOR");
        const colorField = colorInput.connection.targetBlock();
        if (colorField) {
          colorField.setFieldValue(colour, "COLOR"); // Update COLOR field
        }
      };

      updateColorField();

      this.setOnChange((changeEvent) => {
        // Handle BLOCK_CREATE events on the container.
        if (changeEvent.type === Blockly.Events.BLOCK_CREATE) {
          if (changeEvent.blockId === this.id) {
            const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
              this.id,
            );
            if (blockInWorkspace) {
              if (window.loadingCode) return;
              updateOrCreateMeshFromBlock(this, changeEvent);
            }
          }
        }
        // Handle field changes.
        else if (
          changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
          changeEvent.element === "field"
        ) {
          const changedBlock = Blockly.getMainWorkspace().getBlockById(
            changeEvent.blockId,
          );
          if (!changedBlock) return;

          // If the event originates on the container itself, update.
          if (changedBlock.id === this.id) {
            updateOrCreateMeshFromBlock(this, changeEvent);
            return;
          }

          // Otherwise, if the changed block is directly attached to the container,
          // check its block definition.
          const parent = changedBlock.getParent();
          if (parent && parent.id === this.id) {
            // If the block has a next or previous connection defined, ignore its change events.
            // Note: Many blocks have these defined even if they aren’t connected, so this test
            // simply means “this block is chainable.”
            if (
              changedBlock.nextConnection ||
              changedBlock.previousConnection
            ) {
              return;
            }
            // Otherwise, update.
            updateOrCreateMeshFromBlock(this, changeEvent);
            return;
          }
        }

        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
        );
      });

      addDoMutatorWithToggleBehavior(this);
    },
  };

  Blockly.Blocks["load_multi_object"] = {
    init: function () {
      const variableNamePrefix = "object";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        message0: "set %1 to %2 scale: %3 x: %4 y: %5 z: %6\ncolors: %7",
        args0: [
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: nextVariableName,
          },
          {
            type: "field_grid_dropdown",
            name: "MODELS",
            columns: 6,
            options: multiObjectNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, "");
              return [
                {
                  src: `${flock.imagePath}/${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: baseName,
                },
                name,
              ];
            }),
          },
          {
            type: "input_value",
            name: "SCALE",
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
            name: "Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "COLORS",
            check: "Array",
          },
        ],
        inputsInline: true,
        colour: categoryColours["Scene"],
        tooltip: "Create an object with colours.\nKeyword: object",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });

      // Change from a local constant to a method on the block prototype
      Blockly.Blocks["load_multi_object"].updateColorsField = function () {
        const selectedObject = this.getFieldValue("MODELS");
        const colours = objectColours[selectedObject] || [
          "#000000",
          "#FFFFFF",
          "#CCCCCC",
        ];
        const requiredItemCount = colours.length;
        const colorsInput = this.getInput("COLORS");
        let listBlock = colorsInput.connection?.targetBlock();

        // Create a mutation element with the correct number of items.
        const mutation = document.createElement("mutation");
        mutation.setAttribute("items", requiredItemCount);

        if (listBlock && listBlock.type === "lists_create_with") {
          // Apply the mutation to update the block's inputs.
          listBlock.domToMutation(mutation);

          // Remove any extra inputs beyond the required count.
          listBlock.inputList
            .filter((input) => input.name && input.name.startsWith("ADD"))
            .forEach((input) => {
              const index = parseInt(input.name.substring(3));
              if (index >= requiredItemCount) {
                listBlock.removeInput(input.name);
              }
            });

          // For each required input, update or create its shadow colour block.
          for (let i = 0; i < requiredItemCount; i++) {
            let input = listBlock.getInput("ADD" + i);
            if (!input) {
              input = listBlock.appendValueInput("ADD" + i).setCheck("Colour");
            }
            let shadowBlock = input.connection?.targetBlock();
            if (!shadowBlock || !shadowBlock.isShadow()) {
              shadowBlock = listBlock.workspace.newBlock("colour");
              shadowBlock.setFieldValue(colours[i] || "#000000", "COLOR");
              shadowBlock.setShadow(true);
              shadowBlock.initSvg();
              input.connection.connect(shadowBlock.outputConnection);
            } else {
              shadowBlock.setFieldValue(colours[i] || "#000000", "COLOR");
            }
          }
          listBlock.initSvg();
          listBlock.render();
        } else if (!listBlock) {
          // Create a new list block.
          listBlock = this.workspace.newBlock("lists_create_with");
          listBlock.setShadow(true);
          listBlock.domToMutation(mutation);
          for (let i = 0; i < requiredItemCount; i++) {
            let input = listBlock.getInput("ADD" + i);
            if (!input) {
              input = listBlock.appendValueInput("ADD" + i).setCheck("Colour");
            }
            const shadowBlock = listBlock.workspace.newBlock("colour");
            shadowBlock.setFieldValue(colours[i] || "#000000", "COLOR");
            shadowBlock.setShadow(true);
            shadowBlock.initSvg();
            input.connection.connect(shadowBlock.outputConnection);
          }
          listBlock.setInputsInline(true);
          listBlock.setTooltip(
            Blockly.Msg["LISTS_CREATE_WITH_TOOLTIP"] ||
              "Create a list of colours.",
          );
          listBlock.setHelpUrl(
            "https://developers.google.com/blockly/guides/create-custom-blocks/define-blocks",
          );
          listBlock.initSvg();
          listBlock.render();
          colorsInput.connection.connect(listBlock.outputConnection);
        }
      };

      Blockly.Blocks["load_multi_object"].updateColorAtIndex = function (
        colour,
        colourIndex,
      ) {
        //console.log("Update colour", colour, colourIndex);
        const colorsInput = this.getInput("COLORS");
        if (!colorsInput || !colorsInput.connection) {
          return;
        }
        const listBlock = colorsInput.connection.targetBlock();
        if (!listBlock || listBlock.type !== "lists_create_with") {
          console.log("List block not found or of incorrect type.");
          return;
        }

        const inputName = "ADD" + colourIndex;
        let input = listBlock.getInput(inputName);
        if (!input) {
          //input = listBlock.appendValueInput(inputName).setCheck("Colour");
          return;
        }

        let shadowBlock = input.connection?.targetBlock();
        if (!shadowBlock || !shadowBlock.isShadow()) {
          shadowBlock = listBlock.workspace.newBlock("colour");
          shadowBlock.setShadow(true);
          shadowBlock.initSvg();
          input.connection.connect(shadowBlock.outputConnection);
        }

        shadowBlock.setFieldValue(colour, "COLOR");
        shadowBlock.render();
        listBlock.render();
      };

      this.setOnChange((changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.BLOCK_CREATE ||
          changeEvent.type === Blockly.Events.BLOCK_CHANGE
        ) {
          const parent = findCreateBlock(
            Blockly.getMainWorkspace().getBlockById(changeEvent.blockId),
          );

          if (parent === this) {
            const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
              this.id,
            ); // Check if block is in the main workspace

            if (blockInWorkspace) {
              if (window.loadingCode) return;
              updateOrCreateMeshFromBlock(this, changeEvent);
            }
          }

          if (changeEvent.type === Blockly.Events.BLOCK_CREATE) {
            handleBlockCreateEvent(
              this,
              changeEvent,
              variableNamePrefix,
              nextVariableIndexes,
            );
          }
        }

        if (
          changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
          changeEvent.element === "field" &&
          changeEvent.name === "MODELS" &&
          changeEvent.blockId === this.id
        ) {
          const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
            this.id,
          );
          if (blockInWorkspace) {
            this.updateColorsField();
          }
        }
      });

      addDoMutatorWithToggleBehavior(this);
    },
  };

  Blockly.Blocks["load_model"] = {
    init: function () {
      const variableNamePrefix = "model";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "model1"

      this.jsonInit({
        message0: "set %1 to %2 scale: %3 x: %4 y: %5 z: %6",
        args0: [
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: nextVariableName,
          },
          {
            type: "field_grid_dropdown",
            name: "MODELS",
            columns: 6,
            options: modelNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, "");
              return [
                {
                  src: `${flock.imagePath}${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: baseName,
                },
                name,
              ];
            }),
          },
          {
            type: "input_value",
            name: "SCALE",
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
            name: "Z",
            check: "Number",
          },
        ],
        inputsInline: true,
        colour: categoryColours["Scene"],
        tooltip: "Load a model.\nKeyword: model",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });

      this.setOnChange((changeEvent) => {
        if (this.id != changeEvent.blockId) return;

        if (
          changeEvent.type === Blockly.Events.BLOCK_CREATE ||
          changeEvent.type === Blockly.Events.BLOCK_CHANGE
        ) {
          const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
            this.id,
          ); // Check if block is in the main workspace

          if (blockInWorkspace) {
            updateOrCreateMeshFromBlock(this, changeEvent);
          }
        }

        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
        );
      });

      addDoMutatorWithToggleBehavior(this);
    },
  };

  Blockly.Blocks["clone_mesh"] = {
    init: function () {
      const variableNamePrefix = "clone";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "clone1"

      this.jsonInit({
        message0: "set %1 to clone of %2",
        args0: [
          {
            type: "field_variable",
            name: "CLONE_VAR",
            variable: nextVariableName, // Dynamic variable name
          },
          {
            type: "field_variable",
            name: "SOURCE_MESH",
            variable: "mesh1", // Default mesh reference
          },
        ],
        inputsInline: true,
        colour: categoryColours["Scene"],
        tooltip: "Clone a mesh and assign it to a variable.\nKeyword: clone",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });

      // Set dynamic variable name handling
      this.setOnChange((changeEvent) => {
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
        );
      });

      // Add mutator for "constructor-like" initialisation
      addDoMutatorWithToggleBehavior(this);
    },
  };

  Blockly.Blocks["create_3d_text"] = {
    init: function () {
      const variableNamePrefix = "text";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        message0: `set %1 to 3D text: %2 font: %3 size: %4 color: %5
				depth: %6 x: %7 y: %8 z: %9 `,
        args0: [
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: nextVariableName,
          },
          {
            type: "input_value",
            name: "TEXT",
            check: "String",
          },
          {
            type: "field_dropdown",
            name: "FONT",
            options: [["Sans Bold", "./fonts/FreeSans_Bold.json"]],
          },
          {
            type: "input_value",
            name: "SIZE",
            check: "Number",
          },
          {
            type: "input_value",
            name: "COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "DEPTH",
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
            name: "Z",
            check: "Number",
          },
        ],
        inputsInline: true,
        colour: categoryColours["Text"],
        tooltip: "Creates 3D text in the scene.",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });
    },
  };

  function updateCurrentMeshName(block, variableFieldName) {
    const variableName = block.getField(variableFieldName).getText(); // Get the selected variable name

    if (variableName) {
      window.currentMesh = variableName;
      window.currentBlock = block;
    }
  }

  window.updateCurrentMeshName = updateCurrentMeshName;

  Blockly.Blocks["merge_meshes"] = {
    init: function () {
      this.jsonInit({
        message0: "set %1 to merge %2",
        args0: [
          {
            type: "field_variable",
            name: "RESULT_VAR",
            variable: "result",
          },
          {
            type: "input_value",
            name: "MESH_LIST",
            check: "Array",
          },
        ],
        colour: categoryColours["Transform"],
        tooltip: "Merge a list of meshes into one and store the result.",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });
    },
  };

  Blockly.Blocks["subtract_meshes"] = {
    init: function () {
      this.jsonInit({
        message0: "set %1 to %2 subtract %3",
        args0: [
          {
            type: "field_variable",
            name: "RESULT_VAR",
            variable: "result",
          },
          {
            type: "field_variable",
            name: "BASE_MESH",
            variable: "Mesh",
          },
          {
            type: "input_value",
            name: "MESH_LIST",
            check: "Array",
          },
        ],
        colour: categoryColours["Transform"],
        tooltip:
          "Subtract a list of meshes from a base mesh and store the result.",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });
    },
  };
  Blockly.Blocks["intersection_meshes"] = {
    init: function () {
      this.jsonInit({
        message0: "set %1 to intersect %2",
        args0: [
          {
            type: "field_variable",
            name: "RESULT_VAR",
            variable: "result",
          },
          {
            type: "input_value",
            name: "MESH_LIST",
            check: "Array",
          },
        ],
        colour: categoryColours["Transform"],
        tooltip: "Intersect a list of meshes and store the resulting geometry.",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });
    },
  };

  Blockly.Blocks["hull_meshes"] = {
    init: function () {
      this.jsonInit({
        message0: "set %1 to hull of %2",
        args0: [
          {
            type: "field_variable",
            name: "RESULT_VAR",
            variable: "result",
          },
          {
            type: "input_value",
            name: "MESH_LIST",
            check: "Array",
          },
        ],
        colour: categoryColours["Transform"],
        tooltip:
          "Create a convex hull from a list of meshes and store the result.",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });
    },
  };

  Blockly.Blocks["create_wall"] = {
    init: function () {
      const variableNamePrefix = "wall";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "wall1";
      this.jsonInit({
        type: "create_wall",
        message0:
          "new wall %1 type %2 colour %3 \n start x %4 z %5 end x %6 z %7 y position %8",
        args0: [
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: nextVariableName,
          },
          {
            type: "field_dropdown",
            name: "WALL_TYPE",
            options: [
              ["solid", "SOLID_WALL"],
              ["door", "WALL_WITH_DOOR"],
              ["window", "WALL_WITH_WINDOW"],
              ["floor/roof", "FLOOR"],
            ],
          },
          {
            type: "input_value",
            name: "COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "START_X",
            check: "Number",
          },
          {
            type: "input_value",
            name: "START_Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "END_X",
            check: "Number",
          },
          {
            type: "input_value",
            name: "END_Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "Y_POSITION",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip:
          "Creates a wall with the selected type and color between specified start and end positions.\nKeyword: wall",
        helpUrl: "",
      });

      this.setOnChange((changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.BLOCK_CREATE ||
          changeEvent.type === Blockly.Events.BLOCK_CHANGE
        ) {
          const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
            this.id,
          ); // Check if block is in the main workspace

          if (blockInWorkspace) {
            window.updateCurrentMeshName(this, "ID_VAR"); // Call the function to update window.currentMesh
          }
        }

        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
        );
      });
    },
  };

  Blockly.Blocks["set_background_color"] = {
    init: function () {
      this.jsonInit({
        type: "set_background_color",
        message0: "set background color %1",
        args0: [
          {
            type: "input_value",
            name: "COLOR",
            colour: "#6495ED",
            check: ["Colour", "Array", "Material"],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip: "Set the scene's background color.\nKeyword: background",
        helpUrl: "",
      });

      this.setOnChange((changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.BLOCK_CREATE ||
          changeEvent.type === Blockly.Events.BLOCK_CHANGE
        ) {
          const parent = findCreateBlock(
            Blockly.getMainWorkspace().getBlockById(changeEvent.blockId),
          );

          if (parent === this) {
            const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
              this.id,
            );

            if (blockInWorkspace) {
              updateOrCreateMeshFromBlock(this, changeEvent);
              //window.updateCurrentMeshName(this, "ID_VAR");
            }
          }
        }
      });
    },
  };

  Blockly.Blocks["device_camera_background"] = {
    init: function () {
      this.jsonInit({
        type: "device_camera_background",
        message0: "use %1 camera as background",
        args0: [
          {
            type: "field_dropdown",
            name: "CAMERA",
            options: [
              ["front", "user"],
              ["back", "environment"],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip:
          "Use the device camera as the background for the scene. Works on both mobile and desktop.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["set_xr_mode"] = {
    init: function () {
      this.jsonInit({
        type: "set_xr_mode",
        message0: "set XR mode to %1",
        args0: [
          {
            type: "field_dropdown",
            name: "MODE",
            options: [
              ["VR (Oculus Quest or phone viewer)", "VR"],
              ["AR (Augmented Reality)", "AR"],
              ["Magic Window (look-around)", "MAGIC_WINDOW"],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip:
          "Set the XR mode for the scene.\nOptions: VR, AR, Magic Window.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["comment"] = {
    init: function () {
      this.jsonInit({
        type: "comment",
        message0: "// %1",
        args0: [
          {
            type: "input_value",
            name: "COMMENT",
            check: "String",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: "#d3d3d3",
        tooltip: "A comment line.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["print_text"] = {
    init: function () {
      this.jsonInit({
        type: "print_text",
        message0: "print %1 for %2 seconds %3",
        args0: [
          {
            type: "input_value",
            name: "TEXT",
            check: "String",
          },
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
          {
            type: "input_value",
            name: "COLOR",
            colour: "#000080",
            check: "Colour",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: 160,
        tooltip: "A text to the output panel.\nKeyword: print",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["say"] = {
    init: function () {
      this.jsonInit({
        type: "say",
        message0: "say %1 for %2 s %3 \ntext %4 on %5 alpha %6 size %7 %8 %9",
        args0: [
          {
            type: "input_value",
            name: "TEXT",
            check: "String",
          },
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
          {
            type: "field_variable",
            name: "MESH_VAR",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "TEXT_COLOR",
            colour: "#000000",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "BACKGROUND_COLOR",
            colour: "#ffffff",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "ALPHA",
            check: "Number",
          },
          {
            type: "input_value",
            name: "SIZE",
            check: "Number",
          },
          {
            type: "field_dropdown",
            name: "MODE",
            options: [
              ["add", "ADD"],
              ["replace", "REPLACE"],
            ],
          },
          {
            type: "field_dropdown",
            name: "ASYNC",
            options: [
              ["start", "START"],
              ["await", "AWAIT"],
            ],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: 160,
        tooltip:
          "Displays a piece of text as a billboard on a mesh.\nKeyword: say",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["switch_animation"] = {
    init: function () {
      this.jsonInit({
        type: "switch_model_animation",
        message0: "switch animation of %1 to %2",
        args0: [
          {
            type: "field_variable",
            name: "MODEL",
            variable: window.currentMesh,
          },
          {
            type: "field_dropdown",
            name: "ANIMATION_NAME",
            options: animationNames,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip:
          "Changes the animation of the specified model to the given animation.\nKeyword: switch",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["ui_text"] = {
    init: function () {
      this.jsonInit({
        type: "ui_text",
        message0:
          "ui text %1 %2 at x: %3 y: %4\nsize: %5 for %6 seconds color: %7",
        args0: [
          {
            type: "input_value",
            name: "TEXT",
            check: "String",
          },
          {
            type: "field_variable",
            name: "TEXTBLOCK_VAR", // Variable to store the TextBlock reference
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
            name: "FONT_SIZE",
            check: "Number",
          },
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
          {
            type: "input_value",
            name: "COLOR",
            check: "Colour",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Text"],
        tooltip:
          "Add text to the UI screen, and store control in a variable for later use or disposal.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["ui_button"] = {
    init: function () {
      this.jsonInit({
        type: "ui_button",
        message0:
          "ui button %1 %2 at x: %3 y: %4\nsize: %5 text size: %6 text color: %7 background color: %8",
        args0: [
          {
            type: "input_value",
            name: "TEXT",
            check: "String",
          },
          {
            type: "field_variable",
            name: "BUTTON_VAR", // Variable to store the Button reference
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
            type: "field_dropdown",
            name: "SIZE",
            options: [
              ["small", "SMALL"],
              ["medium", "MEDIUM"],
              ["large", "LARGE"],
            ],
          },
          {
            type: "field_dropdown",
            name: "TEXT_SIZE",
            options: [
              ["small", "14px"],
              ["medium", "18px"],
              ["large", "24px"],
            ],
          },
          {
            type: "input_value",
            name: "TEXT_COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "BACKGROUND_COLOR",
            check: "Colour",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Text"],
        tooltip:
          "Add a button to the UI screen with a preset size, and store control in a variable for later use or disposal.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["create_map"] = {
    init: function () {
      this.jsonInit({
        type: "create_map",
        message0: "map %1 with material %2",
        args0: [
          {
            type: "field_dropdown",
            name: "MAP_NAME",
            options: [["Flat", "NONE"]].concat(mapNames),
          },
          {
            type: "input_value",
            name: "MATERIAL",
            check: ["Material", "Array"],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours["Scene"],
        tooltip: "Creates a map with the specified material.",
        helpUrl: "",
      });

      this.setOnChange((changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.BLOCK_CREATE ||
          changeEvent.type === Blockly.Events.BLOCK_CHANGE
        ) {
          const parent = findCreateBlock(
            Blockly.getMainWorkspace().getBlockById(changeEvent.blockId),
          );

          if (parent === this) {
            const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
              this.id,
            );

            if (blockInWorkspace) {
              updateOrCreateMeshFromBlock(this, changeEvent);
              //window.updateCurrentMeshName(this, "ID_VAR");
            }
          }
        }
      });
    },
  };

  Blockly.Blocks["play_animation"] = {
    init: function () {
      this.jsonInit({
        type: "play_model_animation_once",
        message0: "play animation %1 on %2",
        args0: [
          {
            type: "field_dropdown",
            name: "ANIMATION_NAME",
            options: animationNames,
          },
          {
            type: "field_variable",
            name: "MODEL",
            variable: window.currentMesh,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Animate"],
        tooltip:
          "Plays a selected animation once on the specified model.\nKeyword: play",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["move_by_xyz"] = {
    init: function () {
      this.jsonInit({
        type: "move_by_xyz",
        message0: "move %1 by x: %2 y: %3 z: %4",
        args0: [
          {
            type: "field_variable",
            name: "BLOCK_NAME",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "X",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "Y",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "Z",
            check: "Number",
            align: "RIGHT",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Moves a mesh a given amount in x y and z directions.\nKeyword: move",
      });
    },
  };

  Blockly.Blocks["parent"] = {
    init: function () {
      this.jsonInit({
        type: "parent",
        message0: "parent %1 child %2",
        args0: [
          {
            type: "field_variable",
            name: "PARENT_MESH",
            variable: "parent",
          },
          {
            type: "field_variable",
            name: "CHILD_MESH",
            variable: window.currentMesh,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Sets a parent-child relationship between two meshes and keeps the child in its world position",
      });
    },
  };

  Blockly.Blocks["parent_child"] = {
    init: function () {
      this.jsonInit({
        type: "parent_child",
        message0: "parent %1 child %2\noffset x: %3 y: %4 z: %5",
        args0: [
          {
            type: "field_variable",
            name: "PARENT_MESH",
            variable: "parent",
          },
          {
            type: "field_variable",
            name: "CHILD_MESH",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "X_OFFSET",
            check: "Number",
          },
          {
            type: "input_value",
            name: "Y_OFFSET",
            check: "Number",
          },
          {
            type: "input_value",
            name: "Z_OFFSET",
            check: "Number",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Sets a parent-child relationship between two meshes with a specified offset in x, y, and z directions.\nKeyword: parent, child, offset, remove",
      });
    },
  };

  Blockly.Blocks["remove_parent"] = {
    init: function () {
      this.jsonInit({
        type: "remove_parent",
        message0: "remove parent from %1",
        args0: [
          {
            type: "field_variable",
            name: "CHILD_MESH",
            variable: window.currentMesh,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip:
          "Removes the parent relationship from the specified mesh.\nKeyword: remove, parent, child",
      });
    },
  };

  Blockly.Blocks["stop_follow"] = {
    init: function () {
      this.jsonInit({
        type: "stop_follow",
        message0: "stop following %1",
        args0: [
          {
            type: "field_variable",
            name: "FOLLOWER_MESH",
            variable: window.currentMesh,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip: "Stops the specified mesh from following another.\nKeyword: ",
      });
    },
  };

  Blockly.Blocks["hold"] = {
    init: function () {
      this.jsonInit({
        type: "hold",
        message0: "make %1 hold %2\noffset x: %3 y: %4 z: %5",
        args0: [
          {
            type: "field_variable",
            name: "TARGET_MESH",
            variable: "target",
          },
          {
            type: "field_variable",
            name: "MESH_TO_ATTACH",
            variable: "mesh",
          },
          {
            type: "input_value",
            name: "X_OFFSET",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "Y_OFFSET",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "Z_OFFSET",
            check: "Number",
            align: "RIGHT",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Attaches a mesh to the specified bone of another mesh with a specified offset in x, y, and z directions.\nKeyword: attach, bone, mesh, offset",
      });
    },
  };

  Blockly.Blocks["drop"] = {
    init: function () {
      this.jsonInit({
        type: "drop",
        message0: "drop %1",
        args0: [
          {
            type: "field_variable",
            name: "MESH_TO_DETACH",
            variable: "mesh",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Detaches a mesh from its currently attached bone.\nKeyword: detach, bone, mesh",
      });
    },
  };

  Blockly.Blocks["follow"] = {
    init: function () {
      this.jsonInit({
        type: "follow",
        message0: "make %1 follow %2 at %3\noffset x: %4 y: %5 z: %6",
        args0: [
          {
            type: "field_variable",
            name: "FOLLOWER_MESH",
            variable: "follower",
          },
          {
            type: "field_variable",
            name: "TARGET_MESH",
            variable: "target",
          },
          {
            type: "field_dropdown",
            name: "FOLLOW_POSITION",
            options: [
              ["top", "TOP"],
              ["center", "CENTER"],
              ["bottom", "BOTTOM"],
            ],
          },
          {
            type: "input_value",
            name: "X_OFFSET",
            check: "Number",
          },
          {
            type: "input_value",
            name: "Y_OFFSET",
            check: "Number",
          },
          {
            type: "input_value",
            name: "Z_OFFSET",
            check: "Number",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Makes one mesh follow another at a specified position (top, center, or bottom) with offset in x, y, and z directions.",
      });
    },
  };

  Blockly.Blocks["scale"] = {
    init: function () {
      this.jsonInit({
        type: "scale",
        message0: "scale %1 x: %2 y: %3 z: %4\norigin x: %5 y: %6 z: %7",
        args0: [
          {
            type: "field_variable",
            name: "BLOCK_NAME",
            variable: window.currentMesh,
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
            name: "Z",
            check: "Number",
          },
          {
            type: "field_dropdown",
            name: "X_ORIGIN",
            options: [
              ["center", "CENTRE"],
              ["left", "LEFT"],
              ["right", "RIGHT"],
            ],
          },
          {
            type: "field_dropdown",
            name: "Y_ORIGIN",
            options: [
              ["base", "BASE"],
              ["center", "CENTRE"],
              ["top", "TOP"],
            ],
          },
          {
            type: "field_dropdown",
            name: "Z_ORIGIN",
            options: [
              ["center", "CENTRE"],
              ["front", "FRONT"],
              ["back", "BACK"],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Resizes a mesh to the given x, y, and z and controls the origin of scaling.",
      });
    },
  };

  Blockly.Blocks["resize"] = {
    init: function () {
      this.jsonInit({
        type: "resize",
        message0: "resize %1 x: %2 y: %3 z: %4\norigin x: %5 y: %6 z: %7",
        args0: [
          {
            type: "field_variable",
            name: "BLOCK_NAME",
            variable: window.currentMesh,
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
            name: "Z",
            check: "Number",
          },
          {
            type: "field_dropdown",
            name: "X_ORIGIN",
            options: [
              ["center", "CENTRE"],
              ["left", "LEFT"],
              ["right", "RIGHT"],
            ],
          },
          {
            type: "field_dropdown",
            name: "Y_ORIGIN",
            options: [
              ["base", "BASE"],
              ["center", "CENTRE"],
              ["top", "TOP"],
            ],
          },
          {
            type: "field_dropdown",
            name: "Z_ORIGIN",
            options: [
              ["center", "CENTRE"],
              ["front", "FRONT"],
              ["back", "BACK"],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Resizes a mesh to the given x, y, and z and controls the origin of scaling.",
      });
    },
  };
  Blockly.Blocks["rotate_model_xyz"] = {
    init: function () {
      this.jsonInit({
        type: "rotate_model_xyz",
        message0: "rotate %1 by x: %2 y: %3 z: %4",
        args0: [
          {
            type: "field_variable",
            name: "MODEL",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "X",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "Y",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "Z",
            check: "Number",
            align: "RIGHT",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Rotates the model based on its current rotation plus additional x, y, z values.\nKeyword: rotate",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["look_at"] = {
    init: function () {
      this.jsonInit({
        type: "look_at",
        message0: "look %1 at %2 y? %3",
        args0: [
          {
            type: "field_variable",
            name: "MODEL1",
            variable: window.currentMesh,
          },
          {
            type: "field_variable",
            name: "MODEL2",
            variable: "mesh2",
          },
          {
            type: "field_checkbox",
            name: "USE_Y",
            checked: false,
            text: "Use Y axis",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Rotates the first model towards the position of the second model.\nKeyword: look",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["move_to"] = {
    init: function () {
      this.jsonInit({
        type: "move_to",
        message0: "move %1 to %2 y? %3",
        args0: [
          {
            type: "field_variable",
            name: "MODEL1",
            variable: window.currentMesh,
          },
          {
            type: "field_variable",
            name: "MODEL2",
            variable: "mesh2",
          },
          {
            type: "field_checkbox",
            name: "USE_Y",
            checked: false,
            text: "Use Y axis",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Teleports the first model to the location of the second model.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["rotate_to"] = {
    init: function () {
      this.jsonInit({
        type: "rotate_to",
        message0: "rotate %1 to x: %2 y: %3 z: %4",
        args0: [
          {
            type: "field_variable",
            name: "MODEL",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "X",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "Y",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "Z",
            check: "Number",
            align: "RIGHT",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip: "Rotates the model to face the specified coordinates.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["move_to_xyz"] = {
    init: function () {
      this.jsonInit({
        type: "move_to_xyz",
        message0: "move %1 to x: %2 y: %3 z: %4 y? %5",
        args0: [
          {
            type: "field_variable",
            name: "MODEL",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "X",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "Y",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "Z",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "field_checkbox",
            name: "USE_Y",
            checked: true,
            text: "Use Y axis",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        inputsInline: true,
        tooltip:
          "Positions the model at the specified coordinates. Optionally, use the Y axis.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["time"] = {
    init: function () {
      this.jsonInit({
        type: "time",
        message0: "time in s",
        args0: [],
        output: "Number",
        colour: categoryColours["Sensing"], // Adjust the colour category as necessary
        inputsInline: true,
        tooltip: "Returns the current time in seconds.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["distance_to"] = {
    init: function () {
      this.jsonInit({
        type: "distance_to",
        message0: "distance from %1 to %2",
        args0: [
          {
            type: "field_variable",
            name: "MODEL1",
            variable: window.currentMesh,
          },
          {
            type: "field_variable",
            name: "MODEL2",
            variable: "mesh2",
          },
        ],
        output: "Number",
        colour: categoryColours["Sensing"],
        inputsInline: true,
        tooltip: "Calculates the distance between two meshes.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["camera_control"] = {
    init: function () {
      this.jsonInit({
        type: "camera_control",
        message0: "camera %1 %2",
        args0: [
          {
            type: "field_dropdown",
            name: "ACTION",
            options: [
              ["Rotate Left", "rotateLeft"],
              ["Rotate Right", "rotateRight"],
              ["Look Up", "rotateUp"],
              ["Look Down", "rotateDown"],
              ["Move Up", "moveUp"],
              ["Move Down", "moveDown"],
              ["Move Left", "moveLeft"],
              ["Move Right", "moveRight"],
            ],
          },
          {
            type: "field_dropdown",
            name: "KEY",
            options: [
              ["A ◁", "65"], // A key
              ["D", "68"], // D key
              ["W", "87"], // W key
              ["S", "83"], // S key
              ["Q", "81"], // Q key
              ["E", "69"], // E key
              ["F", "70"], // F key
              ["Space", "32"], // Space key
              ["Up Arrow", "38"], // Up arrow key
              ["Down Arrow", "40"], // Down arrow key
              ["Left Arrow", "37"], // Left arrow key
              ["Right Arrow", "39"], // Right arrow key
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip: "Bind a specific key to a camera control action.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["get_camera"] = {
    init: function () {
      this.jsonInit({
        type: "get_camera",
        message0: "get camera as %1",
        args0: [
          {
            type: "field_variable",
            name: "VAR",
            variable: "camera", // Default variable is 'camera'
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip: "Gets the current scene camera",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["play_sound"] = {
    init: function () {
      let nextVariableName = "sound" + nextVariableIndexes["sound"];
      this.jsonInit({
        type: "play_sound",
        message0:
          "set %1 to play sound %2 from %3 \nspeed %4 volume %5 mode %6 async %7",
        args0: [
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: nextVariableName,
          },
          {
            type: "field_dropdown",
            name: "SOUND_NAME",
            options: function () {
              return audioNames.map((name) => [name, name]);
            },
          },
          {
            type: "input_dummy",
            name: "MESH_INPUT", // Dummy input for the dropdown
          },
          {
            type: "input_value",
            name: "SPEED",
            value: 1,
            min: 0.1,
            max: 3,
            precision: 0.1,
          },
          {
            type: "input_value",
            name: "VOLUME",
            value: 1,
            min: 0,
            max: 1,
            precision: 0.1,
          },
          {
            type: "field_dropdown",
            name: "MODE",
            options: [
              ["once", "ONCE"],
              ["loop", "LOOP"],
            ],
          },
          {
            type: "field_dropdown",
            name: "ASYNC",
            options: [
              ["start", "START"],
              ["await", "AWAIT"],
            ],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip:
          "Plays the selected sound on a mesh with adjustable speed, volume, and mode.\nKeyword: sound",
        helpUrl: "",
        extensions: ["dynamic_mesh_dropdown"], // Attach the extension
      });
    },
  };

  Blockly.Extensions.register("dynamic_mesh_dropdown", function () {
    const dropdown = new Blockly.FieldDropdown(function () {
      const options = [["everywhere", "__everywhere__"]];
      const workspace = this.sourceBlock_ && this.sourceBlock_.workspace;
      if (workspace) {
        const variables = workspace.getAllVariables();
        variables.forEach((v) => {
          options.push([v.name, v.name]);
        });
      }
      return options;
    });

    // Attach the dropdown to the block
    this.getInput("MESH_INPUT").appendField(dropdown, "MESH_NAME");
  });

  Blockly.Blocks["stop_all_sounds"] = {
    init: function () {
      this.jsonInit({
        message0: "stop all sounds",
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip:
          "Stops all sounds currently playing in the scene.\nKeyword:nosound",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["midi_note"] = {
    init: function () {
      this.jsonInit({
        type: "midi_note",
        message0: "MIDI note %1",
        args0: [
          {
            type: "field_number",
            name: "NOTE",
            value: 60, // Default is Middle C
            min: 0,
            max: 127,
            precision: 1,
          },
        ],
        output: "Number",
        colour: categoryColours["Sound"],
        tooltip: "Represents a MIDI note value between 0 and 127.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["rest"] = {
    init: function () {
      this.jsonInit({
        type: "rest",
        message0: "rest",
        output: "Null",
        colour: categoryColours["Sound"],
        tooltip: "Represents a rest (silence) in a musical sequence.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["play_notes"] = {
    init: function () {
      this.jsonInit({
        type: "play_notes",
        message0:
          "play notes on %1\nnotes %2 durations %3\ninstrument %4 mode %5",
        args0: [
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "NOTES",
            check: "Array",
          },
          {
            type: "input_value",
            name: "DURATIONS",
            check: "Array",
          },
          {
            type: "input_value",
            name: "INSTRUMENT",
            check: "Instrument",
          },
          {
            type: "field_dropdown",
            name: "ASYNC",
            options: [
              ["start", "START"],
              ["await", "AWAIT"],
            ],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip:
          "Plays a sequence of MIDI notes and rests with corresponding durations, using mesh for panning. Can return immediately or after the notes have finished playing.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["set_scene_bpm"] = {
    init: function () {
      this.jsonInit({
        type: "set_scene_bpm",
        message0: "set scene BPM to %1",
        args0: [
          {
            type: "input_value",
            name: "BPM",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"], // Assuming "Sound" category
        tooltip: "Sets the BPM for the entire scene",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["set_mesh_bpm"] = {
    init: function () {
      this.jsonInit({
        type: "set_mesh_bpm",
        message0: "set BPM of %1 to %2",
        args0: [
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "BPM",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"], // Assuming "Sound" category
        tooltip: "Sets the BPM for a selected mesh",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["create_instrument"] = {
    init: function () {
      const variableNamePrefix = "instrument";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: "create_instrument",
        message0:
          "instrument %1 wave %2 frequency %3 attack %4 decay %5 sustain %6 release %7",
        args0: [
          {
            type: "field_variable",
            name: "INSTRUMENT",
            variable: nextVariableName,
          },
          {
            type: "field_dropdown",
            name: "TYPE",
            options: [
              ["sine", "sine"],
              ["square", "square"],
              ["sawtooth", "sawtooth"],
              ["triangle", "triangle"],
            ],
          },
          {
            type: "field_number",
            name: "FREQUENCY",
            value: 440,
            min: 20,
            max: 20000,
            precision: 1,
          },
          {
            type: "field_number",
            name: "ATTACK",
            value: 0.1,
            min: 0,
            max: 5,
            precision: 0.01,
          },
          {
            type: "field_number",
            name: "DECAY",
            value: 0.5,
            min: 0,
            max: 5,
            precision: 0.01,
          },
          {
            type: "field_number",
            name: "SUSTAIN",
            value: 0.7,
            min: 0,
            max: 1,
            precision: 0.01,
          },
          {
            type: "field_number",
            name: "RELEASE",
            value: 1.0,
            min: 0,
            max: 5,
            precision: 0.01,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip:
          "Creates an instrument and assigns it to the selected variable.",
        helpUrl: "",
      });

      this.setOnChange((changeEvent) => {
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
        );
      });
    },
  };

  Blockly.Blocks["instrument"] = {
    init: function () {
      this.jsonInit({
        type: "instrument",
        message0: "instrument %1",
        args0: [
          {
            type: "field_dropdown",
            name: "INSTRUMENT_TYPE",
            options: [
              ["Default Instrument (Sine)", "default"],
              ["Piano (Square)", "piano"],
              ["Guitar (Sawtooth)", "guitar"],
              ["Violin (Triangle)", "violin"],
            ],
          },
        ],
        output: "Instrument",
        colour: categoryColours["Sound"],
        tooltip: "Select an instrument to use for playing notes.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["when_clicked"] = {
    init: function () {
      this.jsonInit({
        type: "when_clicked",
        message0: "when %1 is %2",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: "model",
          },
          {
            type: "field_dropdown",
            name: "TRIGGER",
            options: [
              ["clicked", "OnPickTrigger"],
              ["double-clicked", "OnDoublePickTrigger"],
              ["mouse down", "OnPickDownTrigger"],
              ["mouse up", "OnPickUpTrigger"],
              ["mouse out", "OnPickOutTrigger"],
              ["left-clicked", "OnLeftPickTrigger"],
              ["right-clicked / long pressed", "OnRightOrLongPressTrigger"],
              ["pointer over", "OnPointerOverTrigger"],
              ["pointer out", "OnPointerOutTrigger"],
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
        message1: "%1",
        implicitAlign1: "LEFT",
        args1: [
          {
            type: "input_statement",
            name: "DO",
          },
        ],
        colour: categoryColours["Events"],
        tooltip:
          "Executes the blocks inside when the specified model trigger occurs.\nKeyword: click",
        helpUrl: "",
      });

      // Default to top-level mode
      this.isInline = false;
      this.setPreviousStatement(false);
      this.setNextStatement(false);

      // Add inline toggle button
      const toggleButton = new Blockly.FieldImage(
        inlineIcon,
        30,
        30,
        "*",
        () => {
          this.toggleDoBlock();
        },
      );

      // Add toggle button to a separate input
      const input = this.appendDummyInput()
        .setAlign(Blockly.inputs.Align.RIGHT) // Align toggle button to the right
        .appendField(toggleButton, "TOGGLE_BUTTON");
    },

    mutationToDom: function () {
      const container = document.createElement("mutation");
      container.setAttribute("inline", this.isInline);
      return container;
    },

    domToMutation: function (xmlElement) {
      const isInline = xmlElement.getAttribute("inline") === "true" || false;
      this.updateShape_(isInline);
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

    toggleDoBlock: function () {
      const isInline = !this.isInline;

      if (!isInline) {
        this.unplug(true); // Disconnect blocks when switching to top-level
      }

      this.updateShape_(isInline);

      if (this.hasDisabledReason("ORPHANED_BLOCK")) {
        this.setDisabledReason(false, "ORPHANED_BLOCK");
      }

      Blockly.Events.fire(
        new Blockly.Events.BlockChange(this, "mutation", null, "", ""),
      );

      Blockly.Events.fire(new Blockly.Events.BlockMove(this));
    },
  };

  // Define the forever block
  Blockly.Blocks["forever"] = {
    init: function () {
      this.jsonInit({
        type: "forever",
        message0: "forever\n%1",
        args0: [
          {
            type: "input_statement",
            name: "DO",
            check: null,
          },
        ],
        colour: categoryColours["Events"],
        tooltip:
          "Executes the enclosed blocks each frame in the render loop.\nKeyword: ever",
        helpUrl: "",
      });

      this.isInline = false;
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

  Blockly.Blocks["when_touches"] = {
    init: function () {
      this.jsonInit({
        type: "when_touches",
        message0: "on %1 collision %2 %3",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
          {
            type: "field_dropdown",
            name: "TRIGGER",
            options: [
              ["enter", "OnIntersectionEnterTrigger"],
              ["exit", "OnIntersectionExitTrigger"],
            ],
          },
          {
            type: "field_variable",
            name: "OTHER_MODEL_VAR",
            variable: "mesh2",
          },
        ],
        message1: "%1",
        args1: [
          {
            type: "input_statement",
            name: "DO",
          },
        ],
        colour: categoryColours["Events"],
        tooltip:
          "Executes the blocks inside when the mesh intersects or no longer intersects with another mesh.\nKeyword: touches",
        helpUrl: "",
      });

      // Set default state to top-level block
      this.isInline = false;

      // Add the toggle button
      const toggleButton = new Blockly.FieldImage(
        inlineIcon, // Custom icon
        30,
        30,
        "*", // Width, Height, Alt text
        () => {
          this.toggleDoBlock();
        },
      );

      // Append the toggle button to the block
      this.appendDummyInput()
        .setAlign(Blockly.inputs.Align.RIGHT)
        .appendField(toggleButton, "TOGGLE_BUTTON");
    },
    mutationToDom: function () {
      const container = document.createElement("mutation");
      container.setAttribute("inline", this.isInline);
      return container;
    },
    domToMutation: function (xmlElement) {
      const isInline = xmlElement.getAttribute("inline") === "true";
      this.updateShape_(isInline);
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
    toggleDoBlock: function () {
      this.updateShape_(!this.isInline);
    },
  };

  Blockly.Blocks["local_variable"] = {
    init: function () {
      this.jsonInit({
        type: "local_variable",
        message0: "local %1",
        args0: [
          {
            type: "field_variable",
            name: "VAR",
            variable: "item", // default variable name
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Control"],
        tooltip: "Declare a local version of a selected variable",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["when_key_event"] = {
    init: function () {
      this.jsonInit({
        type: "when_key_event",
        message0: "when key %1 %2",
        args0: [
          {
            type: "field_grid_dropdown",
            name: "KEY",
            columns: 10,
            options: [
              ["0", "0"],
              ["1", "1"],
              ["2", "2"],
              ["3", "3"],
              ["4", "4"],
              ["5", "5"],
              ["6", "6"],
              ["7", "7"],
              ["8", "8"],
              ["9", "9"],
              ["a", "a"],
              ["b", "b"],
              ["c", "c"],
              ["d", "d"],
              ["e", "e"],
              ["f", "f"],
              ["g", "g"],
              ["h", "h"],
              ["i", "i"],
              ["j", "j"],
              ["k", "k"],
              ["l", "l"],
              ["m", "m"],
              ["n", "n"],
              ["o", "o"],
              ["p", "p"],
              ["q", "q"],
              ["r", "r"],
              ["s", "s"],
              ["t", "t"],
              ["u", "u"],
              ["v", "v"],
              ["w", "w"],
              ["x", "x"],
              ["y", "y"],
              ["z", "z"],
              [" ", " "],
              [",", ","],
              [".", "."],
              ["/", "/"],
              ["⯇", "ArrowLeft"],
              ["⯅", "ArrowUp"],
              ["⯈", "ArrowRight"],
              ["⯆", "ArrowDown"],
            ],
          },
          {
            type: "field_dropdown",
            name: "EVENT",
            options: [
              ["pressed", "pressed"],
              ["released", "released"],
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
        colour: categoryColours["Events"],
        tooltip:
          "Executes the blocks inside when the specified key is pressed or released.",
        helpUrl: "",
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

  Blockly.Blocks["broadcast_event"] = {
    init: function () {
      this.jsonInit({
        type: "broadcast_event",
        message0: "broadcast event %1",
        args0: [
          {
            type: "input_value",
            name: "EVENT_NAME",
            check: "String",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Events"],
        tooltip:
          "Broadcast an event that can be handled with on event.\nKeyword: broadcast",
        helpUrl: "",
      });
    },
  };
  // Block definition for on_event
  Blockly.Blocks["on_event"] = {
    init: function () {
      this.jsonInit({
        type: "on_event",
        message0: "on event %1",
        args0: [
          {
            type: "input_value",
            name: "EVENT_NAME",
            check: "String",
          },
        ],
        message1: "%1",
        args1: [
          {
            type: "input_statement",
            name: "DO",
          },
        ],
        colour: categoryColours["Events"],
        tooltip: "Handle a broadcast event.\nKeyword: on",
        helpUrl: "",
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

  Blockly.Blocks["show"] = {
    init: function () {
      this.jsonInit({
        type: "show",
        message0: "show %1",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip: "Shows the selected model.\nKeyword: show",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["hide"] = {
    init: function () {
      this.jsonInit({
        type: "hide",
        message0: "hide %1",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip: "Hides the selected model.\nKeyword: hide",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["change_color"] = {
    init: function () {
      this.jsonInit({
        type: "change_color",
        message0: "color %1 to %2",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "COLOR",
            check: ["Colour", "Array"], // Accepts either Colour or Array
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Materials"],
        tooltip: "Changes the color of the selected model.\nKeyword: colour",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["change_material"] = {
    init: function () {
      this.jsonInit({
        message0: "apply material %1 to %2 with colour %3",
        args0: [
          {
            type: "field_grid_dropdown",
            name: "MATERIALS",
            columns: 4,
            options: materialNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, "");
              return [
                {
                  src: `./textures/${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: baseName,
                },
                name,
              ];
            }),
          },
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "COLOR",
            check: ["Colour", "Array"], // Accepts either Colour or Array
          },
        ],
        inputsInline: true,
        colour: categoryColours["Materials"],
        tooltip:
          "Apply a selected material with a colour tint to the specified object.\nKeyword: material",
        helpUrl: "",
        previousStatement: null,
        nextStatement: null,
      });
    },
  };

  Blockly.Blocks["text_material"] = {
    init: function () {
      this.jsonInit({
        type: "text_material",
        message0:
          "material %1 text %2 color %3 background %4\nwidth %5 height %6 size %7",
        args0: [
          {
            type: "field_variable",
            name: "MATERIAL_VAR",
            variable: "material",
          },
          {
            type: "input_value",
            name: "TEXT",
            check: "String",
          },
          {
            type: "input_value",
            name: "COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "BACKGROUND_COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "WIDTH",
            check: "Number",
          },
          {
            type: "input_value",
            name: "HEIGHT",
            check: "Number",
          },
          {
            type: "input_value",
            name: "TEXT_SIZE",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Materials"],
        tooltip:
          "Create a material with text or emoji, specifying width, height, background color, and text size.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["place_decal"] = {
    init: function () {
      this.jsonInit({
        message0: "decal %1 angle %2",
        args0: [
          {
            type: "field_variable",
            name: "MATERIAL",
            variable: "material",
          },
          {
            type: "input_value",
            name: "ANGLE",
            check: "Number",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Materials"],
        tooltip: "Place a decal on a mesh using the selected material.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["decal"] = {
    init: function () {
      this.jsonInit({
        type: "decal",
        message0:
          "decal on %1 from x %2 y %3 z %4 \nangle x %5 y %6 z %7\nsize x %8 y %9 z %10 material %11",
        args0: [
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "POSITION_X",
            check: "Number",
          },
          {
            type: "input_value",
            name: "POSITION_Y",
            check: "Number",
          },
          {
            type: "input_value",
            name: "POSITION_Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "NORMAL_X",
            check: "Number",
          },
          {
            type: "input_value",
            name: "NORMAL_Y",
            check: "Number",
          },
          {
            type: "input_value",
            name: "NORMAL_Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "SIZE_X",
            check: "Number",
          },
          {
            type: "input_value",
            name: "SIZE_Y",
            check: "Number",
          },
          {
            type: "input_value",
            name: "SIZE_Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "MATERIAL",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Materials"],
        tooltip:
          "Create a decal on a mesh with position, normal, size, and material.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["highlight"] = {
    init: function () {
      this.jsonInit({
        type: "highlight",
        message0: "highlight %1 %2",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "COLOR",
            colour: "#FFD700",
            check: "Colour",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Materials"],
        tooltip: "Highlights the selected model.\nKeyword: highlight",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["glow"] = {
    init: function () {
      this.jsonInit({
        type: "glow",
        message0: "glow %1",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Materials"],
        tooltip: "Adds a glow effect to the selected model.\nKeyword: glow",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["tint"] = {
    init: function () {
      this.jsonInit({
        type: "tint",
        message0: "tint %1 %2",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "COLOR",
            colour: "#AA336A",
            check: "Colour",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Materials"],
        tooltip: "Add colour tint effect.\nKeyword: tint",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["set_alpha"] = {
    init: function () {
      this.jsonInit({
        type: "set_mesh_material_alpha",
        message0: "set alpha of %1 to %2",
        args0: [
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "ALPHA",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Materials"],
        tooltip:
          "Sets the alpha (transparency) of the material(s) on a specified mesh. Values should be 0 to 1.\nKeyword:alpha",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["clear_effects"] = {
    init: function () {
      this.jsonInit({
        type: "clear_effects",
        message0: "clear effects %1",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Materials"],
        tooltip: "Clear visual effects from selected model.\nKeyword: clear",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["camera_follow"] = {
    init: function () {
      this.jsonInit({
        type: "camera_follow",
        message0: "camera follow %1 with radius %2",
        args0: [
          {
            type: "field_variable",
            name: "MESH_VAR",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "RADIUS",
            check: "Number",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip:
          "Makes the camera follow a model with a customizable distance (radius) from the target.\nKeyword: follow",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["add_physics"] = {
    init: function () {
      this.jsonInit({
        type: "add_physics",
        message0: "add physics %1 type %2",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
          {
            type: "field_dropdown",
            name: "PHYSICS_TYPE",
            options: [
              ["dynamic", "DYNAMIC"],
              ["animated", "ANIMATED"],
              ["static", "STATIC"],
              ["none", "NONE"],
            ],
            default: "DYNAMIC",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip:
          "Adds physics to the mesh. Choose between static, dynamic, and animated.\nKeyword:physics",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["add_physics_shape"] = {
    init: function () {
      this.jsonInit({
        type: "add_physics_shape",
        message0: "add physics shape %1 type %2",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
          {
            type: "field_dropdown",
            name: "SHAPE_TYPE",
            options: [
              ["mesh", "MESH"],
              ["capsule", "CAPSULE"],
            ],
            default: "MESH",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip:
          "Add a physics shape to the mesh. Options are capsule or mesh.\nKeyword:physics",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["dispose"] = {
    init: function () {
      this.jsonInit({
        type: "dispose",
        message0: "dispose %1",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"], // Use appropriate category color
        tooltip: "Removes the specified mesh from the scene.\nKeyword: dispose",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["key_pressed"] = {
    init: function () {
      this.jsonInit({
        type: "key_pressed",
        message0: "key pressed is %1",
        args0: [
          {
            type: "field_dropdown",
            name: "KEY",
            options: [
              ["any", "ANY"],
              ["none", "NONE"],
              ["W", "w"],
              ["A", "a"],
              ["S", "s"],
              ["D", "d"],
              ["space ∞", " "],
              ["Q ■", "q"],
              ["E ✿", "e"],
              ["F ✱", "f"],
            ],
          },
        ],
        output: "Boolean",
        colour: categoryColours["Sensing"],
        tooltip:
          "Returns true if the specified key is pressed.\nKeyword:ispressed",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["meshes_touching"] = {
    init: function () {
      this.jsonInit({
        type: "meshes_are_touching",
        message0: "%1 touching %2",
        args0: [
          {
            type: "field_variable",
            name: "MESH1",
            variable: window.currentMesh,
          },
          {
            type: "field_variable",
            name: "MESH2",
            variable: "mesh2",
          },
        ],
        output: "Boolean",
        colour: categoryColours["Sensing"],
        tooltip:
          "Returns true if the two selected meshes are touching, with retries for loading.\nKeyword: istouching",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["move_forward"] = {
    init: function () {
      this.jsonInit({
        type: "move",
        message0: "move %1 %2 speed %3",
        args0: [
          {
            type: "field_variable",
            name: "MODEL",
            variable: window.currentMesh,
          },
          {
            type: "field_dropdown",
            name: "DIRECTION",
            options: [
              ["forward", "forward"],
              ["sideways", "sideways"],
              ["strafe", "strafe"],
            ],
          },
          {
            type: "input_value",
            name: "SPEED",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip:
          "Moves the model in the specified direction. 'Forward' moves it in the direction it's pointing, 'sideways' moves it relative to the camera's direction, and 'strafe' moves it sideways relative to the camera's direction.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["rotate_camera"] = {
    init: function () {
      this.jsonInit({
        type: "rotate_camera",
        message0: "rotate camera by %1 degrees",
        args0: [
          {
            type: "input_value",
            name: "DEGREES",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip:
          "Rotates the camera left or right by the given degrees.\nKeyword: rotate",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["apply_force"] = {
    init: function () {
      this.jsonInit({
        type: "apply_force",
        message0: "apply force to %1 by x: %2 y: %3 z: %4",
        args0: [
          {
            type: "field_variable",
            name: "MESH_VAR",
            variable: window.currentMesh,
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
            name: "Z",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip: "Apply a force to a mesh in XYZ directions.\nKeyword: force",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["up"] = {
    init: function () {
      this.jsonInit({
        type: "up",
        message0: "up %1 force %2",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "UP_FORCE",
            check: "Number",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip: "Apply the specified upwards force.\nKeyword: up",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["touching_surface"] = {
    init: function () {
      this.jsonInit({
        type: "touching_surface",
        message0: "is %1 touching surface",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
        ],
        output: "Boolean",
        colour: categoryColours["Sensing"],
        tooltip: "Check if the model is touching a surface.\nKeyword: surface",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["colour"] = {
    init: function () {
      this.jsonInit({
        type: "colour",
        message0: "%1",
        args0: [
          {
            type: "field_colour",
            name: "COLOR",
            colour: "#9932CC",
          },
        ],
        output: "Colour",
        colour: categoryColours["Materials"],
        tooltip: "Pick a colour.\nKeyword: color",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["skin_colour"] = {
    init: function () {
      this.jsonInit({
        type: "skin_colour",
        message0: "%1",
        args0: [
          {
            type: "field_colour",
            name: "COLOR",
            colour: "#FFE0BD",
            colourOptions: [
              "#3F2A1D",
              "#5C4033",
              "#6F4E37",
              "#7A421D",
              "#8D5524",
              "#A86B38",
              "#C68642",
              "#D1A36A",
              "#E1B899",
              "#F0D5B1",
              "#FFDFC4",
              "#FFF5E1",
            ],
            colourTitles: [
              "color 1",
              "color 2",
              "color 3",
              "color 4",
              "color 5",
              "color 6",
              "color 7",
              "color 8",
              "color 9",
              "color 10",
              "color 11",
              "color 12",
            ],
            columns: 4,
          },
        ],
        output: "Colour",
        colour: categoryColours["Materials"],
        tooltip: "Pick a skin colour.\nKeyword: skin",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["greyscale_colour"] = {
    init: function () {
      this.jsonInit({
        type: "greyscale_colour",
        message0: "%1",
        args0: [
          {
            type: "field_colour",
            name: "COLOR",
            colour: "#808080", // A neutral starting color (grey)
            colourOptions: [
              "#000000", // Black
              "#1a1a1a",
              "#333333",
              "#4d4d4d",
              "#666666",
              "#808080", // Middle grey
              "#999999",
              "#b3b3b3",
              "#cccccc",
              "#e6e6e6",
              "#ffffff", // White
            ],
            colourTitles: [
              "Black",
              "Dark Grey 1",
              "Dark Grey 2",
              "Dark Grey 3",
              "Grey 1",
              "Middle Grey",
              "Grey 2",
              "Light Grey 1",
              "Light Grey 2",
              "Light Grey 3",
              "White",
            ],
            columns: 4,
          },
        ],
        output: "Colour",
        colour: categoryColours["Materials"], // You can set this to any colour category you prefer
        tooltip: "Pick a greyscale colour for elevation.\nKeyword: grey",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["colour_from_string"] = {
    init: function () {
      this.jsonInit({
        message0: "- %1 -",
        args0: [
          {
            type: "field_input",
            name: "COLOR",
            text: "#800080",
          },
        ],
        output: "Colour",
      });

      this.getField("COLOR").setValidator(function (newVal) {
        const validatedVal = flock.getColorFromString(newVal) || "#000000";
        this.sourceBlock_.setColour(validatedVal);
        return newVal;
      });
    },
  };

  Blockly.Blocks["random_colour"] = {
    init: function () {
      this.jsonInit({
        type: "random_colour_block",
        message0: "random color",
        output: "Colour",
        colour: categoryColours["Materials"],
        tooltip: "Generate a random colour.\nKeyword: randcol",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["material"] = {
    init: function () {
      this.jsonInit({
        type: "material",
        message0: "material %1 %2 alpha %3",

        args0: [
          {
            type: "field_grid_dropdown",
            name: "TEXTURE_SET",
            columns: 4,
            options: materialNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, "");
              return [
                {
                  src: `./textures/${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: baseName,
                },
                name,
              ];
            }),
          },
          {
            type: "input_value",
            name: "BASE_COLOR",
            colour: "#ffffff", // Default to white
          },
          {
            type: "input_value",
            name: "ALPHA",
            value: 1,
            min: 0,
            max: 1,
            precision: 0.01,
          },
        ],
        output: "Material",
        inputsInline: true,
        colour: categoryColours["Materials"],
        tooltip: "Define material properties",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["gradient_material"] = {
    init: function () {
      this.jsonInit({
        type: "material",
        message0: "material %1 alpha %2",
        args0: [
          {
            type: "input_value",
            name: "COLOR",
            colour: "#6495ED",
            check: ["Colour", "Array"],
          },
          {
            type: "input_value",
            name: "ALPHA",
            value: 1,
            min: 0,
            max: 1,
            precision: 0.01,
          },
        ],
        output: "Material",
        inputsInline: true,
        colour: categoryColours["Materials"],
        tooltip: "Define material properties",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["material2"] = {
    init: function () {
      this.jsonInit({
        type: "material",
        message0:
          "material %1 emissive %2 texture %3 \nmetallic %4 roughness %5 alpha %6",
        args0: [
          {
            type: "input_value",
            name: "BASE_COLOR",
            colour: "#ffffff", // Default to white
          },
          {
            type: "input_value",
            name: "EMISSIVE_COLOR",
            colour: "#000000", // Default to black (no emission)
          },
          {
            type: "field_grid_dropdown",
            name: "TEXTURE_SET",
            columns: 4,
            options: materialNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, "");
              return [
                {
                  src: `./textures/${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: baseName,
                },
                name,
              ];
            }),
          },
          {
            type: "input_value",
            name: "METALLIC",
            value: 0,
            min: 0,
            max: 1,
            precision: 0.01,
          },
          {
            type: "input_value",
            name: "ROUGHNESS",
            value: 1,
            min: 0,
            max: 1,
            precision: 0.01,
          },
          {
            type: "input_value",
            name: "ALPHA",
            value: 1,
            min: 0,
            max: 1,
            precision: 0.01,
          },
        ],
        output: "Material",
        inputsInline: true,
        colour: categoryColours["Materials"],
        tooltip: "Define material properties",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["set_material"] = {
    init: function () {
      this.jsonInit({
        type: "set_material",
        message0: "set material of %1 to %2",
        args0: [
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "MATERIAL",
            check: ["Material", "Array"], // Ensure it only accepts blocks that output a Material
          },
        ],
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours["Materials"],
        tooltip: "Set the specified material on the given mesh.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["random_seeded_int"] = {
    init: function () {
      this.jsonInit({
        type: "random_seeded_int",
        message0: "random integer from %1 to %2 seed: %3",
        args0: [
          {
            type: "input_value",
            name: "FROM",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "TO",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "SEED",
            check: "Number",
            align: "RIGHT",
          },
        ],
        inputsInline: true,
        output: "Number",
        colour: 230,
        tooltip: "Generate a random integer with a seed.\n Keyword: seed",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["to_number"] = {
    init: function () {
      this.jsonInit({
        type: "to_number",
        message0: "convert %1 to %2",
        args0: [
          {
            type: "input_value",
            name: "STRING",
            check: "String",
          },
          {
            type: "field_dropdown",
            name: "TYPE",
            options: [
              ["integer", "INT"],
              ["float", "FLOAT"],
            ],
          },
        ],
        inputsInline: true,
        output: "Number",
        colour: 230,
        tooltip: "Converts a string to an integer or float.",
        helpUrl: "",
      });
    },
  };

  Blockly.Blocks["keyword_block"] = {
    init: function () {
      this.appendDummyInput().appendField(
        new Blockly.FieldTextInput("type a keyword to add a block"),
        "KEYWORD",
      );
      this.setTooltip("Type a keyword to change this block.");
      this.setHelpUrl("");

      this.setOnChange(function (changeEvent) {
        // Prevent infinite loops or multiple replacements.
        if (this.isDisposed() || this.isReplaced) {
          return;
        }
        // Get the entered keyword.
        const keyword = this.getFieldValue("KEYWORD").trim();
        // Lookup the new block type based on the keyword.
        const blockType = findBlockTypeByKeyword(keyword);
        if (blockType) {
          // Mark the block as replaced.
          this.isReplaced = true;
          const workspace = this.workspace;
          // Create the new block.
          const newBlock = workspace.newBlock(blockType);

          // Apply toolbox settings if defined.
          const blockDefinition = findBlockDefinitionInToolbox(blockType);
          if (blockDefinition && blockDefinition.inputs) {
            applyToolboxSettings(newBlock, blockDefinition.inputs);
          }

          newBlock.initSvg();
          newBlock.render();

          // Position the new block where the old keyword block is.
          const pos = this.getRelativeToSurfaceXY();
          newBlock.moveBy(pos.x, pos.y);

          if (
            this.previousConnection &&
            this.previousConnection.isConnected()
          ) {
            const parentConnection = this.previousConnection.targetConnection;
            if (parentConnection) {
              parentConnection.disconnect();
              parentConnection.connect(newBlock.previousConnection);
            }
          }

          // Reattach any block that was connected to the keyword block's next connection.
          const nextBlock = this.getNextBlock();
          if (nextBlock && newBlock.nextConnection) {
            newBlock.nextConnection.connect(nextBlock.previousConnection);
          }

          // Select the new block for immediate editing.
          const selectedBlock = Blockly.getSelected();
          if (selectedBlock) {
            selectedBlock.unselect();
          }
          newBlock.select();
          window.currentBlock = newBlock;

          // Dispose of the old keyword block.
          this.dispose();
        }
      });
    },
  };

  Blockly.Blocks["keyword"] = {
    init: function () {
      // Call the original keyword_block init method.
      Blockly.Blocks["keyword_block"].init.call(this);
      // Add chaining connections.
      this.setPreviousStatement(true);
      this.setNextStatement(true);
    },
  };

  function findBlockTypeByKeyword(keyword) {
    // Recursive helper to search through a contents array.
    function searchContents(contents) {
      if (!Array.isArray(contents)) {
        return null;
      }
      for (const item of contents) {
        // If this item is a block with the matching keyword, return its type.
        if (item.kind === "block" && item.keyword === keyword) {
          return item.type;
        }
        // If the item is a category with its own contents, search recursively.
        if (item.kind === "category" && Array.isArray(item.contents)) {
          const result = searchContents(item.contents);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    }
    return searchContents(toolbox.contents);
  }

  // Function to find block definition in the toolbox by block type
  function findBlockDefinitionInToolbox(blockType) {
    // Recursive helper to search through a contents array.
    function searchContents(contents) {
      if (!Array.isArray(contents)) {
        return null;
      }
      for (const item of contents) {
        // If this item is a block with the matching type, return its definition.
        if (item.kind === "block" && item.type === blockType) {
          return item;
        }
        // If the item is a category with its own contents, search recursively.
        if (item.kind === "category" && Array.isArray(item.contents)) {
          const result = searchContents(item.contents);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    }
    return searchContents(toolbox.contents);
  }

  // Function to apply settings from the toolbox definition to the new block
  function applyToolboxSettings(newBlock, inputs) {
    for (const inputName in inputs) {
      const input = inputs[inputName];
      if (input.shadow) {
        const shadowBlock = Blockly.getMainWorkspace().newBlock(
          input.shadow.type,
        );
        shadowBlock.setShadow(true);
        // Apply fields (default values) to the shadow block
        for (const fieldName in input.shadow.fields) {
          shadowBlock.setFieldValue(input.shadow.fields[fieldName], fieldName);
        }
        shadowBlock.initSvg();
        shadowBlock.render();
        newBlock
          .getInput(inputName)
          .connection.connect(shadowBlock.outputConnection);

        Blockly.getMainWorkspace().cleanUp();
      }
    }
  }
}

Blockly.Blocks["export_mesh"] = {
  init: function () {
    this.jsonInit({
      type: "export_mesh",
      message0: "export %1 as %2",
      args0: [
        {
          type: "field_variable",
          name: "MESH_VAR",
          variable: window.currentMesh,
        },
        {
          type: "field_dropdown",
          name: "FORMAT",
          options: [
            ["STL", "STL"],
            ["OBJ", "OBJ"],
            ["GLB", "GLB"],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: categoryColours["Scene"],
      tooltip: "Exports a mesh as STL, OBJ, or GLB.",
      helpUrl: "",
    });
  },
};

// Remove 'do' text to save space
Blockly.Msg["TEXT_JOIN_TITLE_CREATEWITH"] = "text";
Blockly.Msg["CONTROLS_REPEAT_INPUT_DO"] = "";
Blockly.Msg["CONTROLS_WHILEUNTIL_INPUT_DO"] = "";
Blockly.Msg["CONTROLS_FOR_INPUT_DO"] = "";
Blockly.Msg["CONTROLS_FOREACH_INPUT_DO"] = "";
Blockly.Msg["CONTROLS_IF_MSG_THEN"] = "";
Blockly.Msg["CONTROLS_IF_MSG_ELSE"] = "else\n";

Blockly.Msg["CONTROLS_FOR_TITLE"] = "for each %1 from %2 to %3 by %4";

class FieldLexicalVariable extends Blockly.FieldDropdown {
  constructor(opt_value, opt_validator) {
    // Force a default value of "count" if none is provided.
    if (opt_value === null || opt_value === undefined || opt_value === "") {
      opt_value = "count";
    }
    super(opt_value, opt_validator);
    // Always use our custom options generator.
    this.menuGenerator_ = this.generateOptions.bind(this);
    this.variableId_ = Blockly.utils.genUid
      ? Blockly.utils.genUid()
      : Math.random().toString(36).substring(2, 15);
    this.cachedOptions_ = null;

    // Ensure that the value is set (if somehow still null).
    if (!this.getValue()) {
      super.setValue("count");
    }
  }

  // Always show the current variable (only one) plus the extra options.
  computeOptions() {
    // If the field's value is null-ish, force it to "count".
    let current = super.getValue();
    if (current === null || current === undefined || current === "") {
      current = "count";
      super.setValue(current);
    } else {
      current = String(current);
    }
    return [
      [current, current],
      ["Rename variable…", "__RENAME__"],
      ["Get variable", "__GET__"],
    ];
  }

  // Return our cached options if available.
  generateOptions() {
    if (this.cachedOptions_) {
      return this.cachedOptions_;
    }
    this.cachedOptions_ = this.computeOptions();
    return this.cachedOptions_;
  }

  // Ensure that any caller asking for options gets our cached copy.
  getOptions() {
    return this.cachedOptions_ || this.computeOptions();
  }

  // Bypass default class validation so our new value is always accepted.
  doClassValidation_(newValue) {
    return newValue;
  }

  setValue(value) {
    if (value === "__RENAME__") {
      setTimeout(() => {
        const currentName = String(super.getValue());

        const newName = window.prompt("Rename variable", currentName);
        if (newName && newName !== currentName) {
          if (
            this.sourceBlock_ &&
            typeof this.sourceBlock_.setLexicalVariable === "function"
          ) {
            this.sourceBlock_.setLexicalVariable(String(newName));
          }
          // Recompute and "lock in" our options with the new variable.
          this.cachedOptions_ = [
            [String(newName), String(newName)],
            ["Rename variable…", "__RENAME__"],
            ["Get variable", "__GET__"],
          ];
          // Force our generator to return the updated options.
          this.menuGenerator_ = () => this.cachedOptions_;
          // Update any getter blocks that reference this variable.
          if (this.sourceBlock_ && this.sourceBlock_.workspace) {
            const workspace = this.sourceBlock_.workspace;
            const allBlocks = workspace.getAllBlocks(false);
            allBlocks.forEach((block) => {
              if (
                block.type === "get_lexical_variable" &&
                block.variableSourceId === this.variableId_
              ) {
                if (typeof block.updateVariable === "function") {
                  block.updateVariable(newName);
                } else {
                  block.setFieldValue(String(newName), "VAR");
                }
              }
            });
          }
          // Finally, update the field's value.
          super.setValue(String(newName));
          if (this.sourceBlock_) {
            this.sourceBlock_.render();
          }
        } else {
        }
      }, 0);
      return null;
    } else if (value === "__GET__") {
      setTimeout(() => {
        const variableName = String(super.getValue());
        const workspace = this.sourceBlock_.workspace;
        const newBlock = workspace.newBlock("get_lexical_variable");
        newBlock.initSvg();
        newBlock.render();
        newBlock.setFieldValue(String(variableName), "VAR");
        newBlock.variableSourceId = this.variableId_;

        const xy = this.sourceBlock_.getRelativeToSurfaceXY();
        newBlock.moveBy(xy.x + 20, xy.y + 20);
      }, 0);
      return null;
    } else {
      return super.setValue(String(value));
    }
  }

  doValueValidation_(newValue) {
    return newValue;
  }

  saveExtraState() {
    return {
      variableId: this.variableId_,
      value: this.getValue(),
    };
  }

  loadExtraState(state) {
    this.variableId_ = state.variableId;
    super.setValue(state.value);
    this.cachedOptions_ = [
      [state.value, state.value],
      ["Rename variable…", "__RENAME__"],
      ["Get variable", "__GET__"],
    ];
    this.menuGenerator_ = () => this.cachedOptions_;
  }
}

Blockly.fieldRegistry.register("field_lexical_variable", FieldLexicalVariable);

Blockly.Blocks["for_loop2"] = {
  init: function () {
    this.jsonInit({
      type: "for_loop",
      message0: "for each %1 from %2 to %3 by %4 do %5",
      args0: [
        {
          type: "field_lexical_variable",
          name: "VAR",
          text: "count", // Default variable name is "count"
          options: [["count", "count"]],
        },
        {
          type: "input_value",
          name: "FROM",
          check: "Number",
        },
        {
          type: "input_value",
          name: "TO",
          check: "Number",
        },
        {
          type: "input_value",
          name: "BY",
          check: "Number",
        },
        {
          type: "input_statement",
          name: "DO",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: categoryColours["Control"],
      inputsInline: true,
      tooltip:
        "Loop from a starting number to an ending number by a given step.",
      helpUrl: "",
    });
  },

  // Returns an array of local variable names.
  getLexicalVariables: function () {
    return [this.getFieldValue("VAR")];
  },

  // Update the variable name on this block.
  setLexicalVariable: function (newName) {
    this.setFieldValue(String(newName), "VAR");
  },

  // Save the current variable name in a mutation.
  mutationToDom: function () {
    const container = document.createElement("mutation");
    container.setAttribute("var", this.getFieldValue("VAR"));
    return container;
  },

  // Restore the variable name from a mutation.
  domToMutation: function (xmlElement) {
    const variableName = xmlElement.getAttribute("var");
    this.setFieldValue(variableName, "VAR");
  },
};

Blockly.Blocks["for_loop"] = {
  init: function () {
    this.jsonInit({
      type: "for_loop",
      message0: "for each %1 from %2 to %3 by %4 do %5",
      args0: [
        {
          type: "field_lexical_variable",
          name: "VAR",
          text: "count", // Default variable name is "count"
          options: [["count", "count"]],
        },
        {
          type: "input_value",
          name: "FROM",
          check: "Number",
        },
        {
          type: "input_value",
          name: "TO",
          check: "Number",
        },
        {
          type: "input_value",
          name: "BY",
          check: "Number",
        },
        {
          type: "input_statement",
          name: "DO",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: categoryColours["Control"],
      inputsInline: true,
      tooltip:
        "Loop from a starting number to an ending number by a given step. Click on the dropdown to get the loop variable to use in your code.",
      helpUrl: "",
    });
  },

  // Returns an array of local variable names.
  getLexicalVariables: function () {
    return [this.getFieldValue("VAR")];
  },

  // Update the variable name on this block.
  setLexicalVariable: function (newName) {
    this.setFieldValue(String(newName), "VAR");
  },

  onchange: function (event) {
    if (
      event.type === Blockly.Events.BLOCK_CREATE &&
      event.ids.includes(this.id)
    ) {
      const field = this.getField("VAR");
      if (field && field.variableId_) {
        const oldId = field.variableId_;
        const newId = Blockly.utils.idGenerator.genUid();
        field.variableId_ = newId;

        // Recursively update nested getter blocks.
        const updateNestedBlocks = (block) => {
          if (
            block.type === "get_lexical_variable" &&
            block.variableSourceId === oldId
          ) {
            block.variableSourceId = newId;
          }
          block.getChildren(false).forEach(updateNestedBlocks);
        };

        // Update getter blocks inside the DO input.
        const doConnection = this.getInput("DO")?.connection;
        if (doConnection && doConnection.targetBlock()) {
          updateNestedBlocks(doConnection.targetBlock());
        }
      }
    }
  },

  // Save the current variable name and its unique id in a mutation.
  mutationToDom: function () {
    const container = document.createElement("mutation");
    const field = this.getField("VAR");

    if (field && field.saveExtraState) {
      const extraState = field.saveExtraState();
      container.setAttribute("var", extraState.value);
      container.setAttribute("variableid", extraState.variableId);
    } else {
      container.setAttribute("var", this.getFieldValue("VAR"));
    }
    return container;
  },

  // Restore the variable name and unique id from the mutation.
  domToMutation: function (xmlElement) {
    const varName = xmlElement.getAttribute("var");
    const variableId = xmlElement.getAttribute("variableid");
    const field = this.getField("VAR");
    if (field && field.loadExtraState) {
      field.loadExtraState({
        value: varName,
        variableId: variableId,
      });
    } else {
      this.setFieldValue(varName, "VAR");
    }
  },
};

Blockly.Blocks["get_lexical_variable"] = {
  init: function () {
    this.jsonInit({
      message0: "%1",
      args0: [
        {
          type: "field_label",
          name: "VAR",
          text: "count",
        },
      ],
      output: null,
      colour: categoryColours["Variables"],
      tooltip: "Get the value of a lexical variable",
      helpUrl: "",
    });

    // Initialize with a null variable source ID.
    this.variableSourceId = null;
  },
  updateVariable: function (newName) {
    this.setFieldValue(String(newName), "VAR");
  },
  // Save the current variable name and source ID to the XML mutation.
  mutationToDom: function () {
    const container = document.createElement("mutation");
    container.setAttribute("var", this.getFieldValue("VAR"));
    if (this.variableSourceId) {
      container.setAttribute("sourceid", this.variableSourceId);
    }
    return container;
  },
  // Restore the variable name and source ID from the XML mutation.
  domToMutation: function (xmlElement) {
    const variableName = xmlElement.getAttribute("var");
    this.setFieldValue(variableName, "VAR");
    const sourceId = xmlElement.getAttribute("sourceid");
    if (sourceId) {
      this.variableSourceId = sourceId;
    }
  },
};

Blockly.Blocks["get_lexical_variable"].onchange = function (event) {
  // Only process if this is a move, create, or similar event that might affect scoping
  if (
    event.type === Blockly.Events.BLOCK_MOVE ||
    event.type === Blockly.Events.BLOCK_CREATE ||
    event.type === Blockly.Events.BLOCK_CHANGE
  ) {
    if (!this.workspace) return; // Skip if no workspace

    const variableName = this.getFieldValue("VAR");
    let currentBlock = this;
    let found = false;

    // Traverse up the block hierarchy to find the closest for_loop with matching variable
    while ((currentBlock = currentBlock.getParent())) {
      if (currentBlock.type === "for_loop") {
        const loopVarName = currentBlock.getFieldValue("VAR");
        const field = currentBlock.getField("VAR");

        if (loopVarName === variableName && field) {
          // Found a matching for_loop parent
          const variableId = field.variableId_ || "";

          // Update this getter's source ID
          this.variableSourceId = variableId;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // No matching for_loop found, disconnect if connected to anything
      const parentConnection = this.outputConnection.targetConnection;
      if (parentConnection) {
        parentConnection.disconnect();
      }
    }
  }
};

export function addDoMutatorWithToggleBehavior(block) {
  // Custom function to toggle the "do" block mutation
  block.toggleDoBlock = function () {
    const hasDo = this.getInput("DO") ? true : false;
    if (hasDo) {
      this.removeInput("DO");
    } else {
      this.appendStatementInput("DO").setCheck(null).appendField("");
    }
  };

  // Add the toggle button to the block
  const toggleButton = new Blockly.FieldImage(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4gPHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xNSA2djloLTl2M2g5djloM3YtOWg5di0zaC05di05eiIvPjwvc3ZnPg==", // Custom icon
    30,
    30,
    "*", // Width, Height, Alt text
    block.toggleDoBlock.bind(block), // Bind the event handler to the block
  );

  // Add the button to the block
  block
    .appendDummyInput()
    .setAlign(Blockly.inputs.Align.RIGHT)
    .appendField(toggleButton, "TOGGLE_BUTTON");

  // Save the mutation state
  block.mutationToDom = function () {
    const container = document.createElement("mutation");
    container.setAttribute("has_do", this.getInput("DO") ? "true" : "false");
    return container;
  };

  // Restore the mutation state
  block.domToMutation = function (xmlElement) {
    const hasDo = xmlElement.getAttribute("has_do") === "true";
    if (hasDo) {
      this.appendStatementInput("DO").setCheck(null).appendField("");
    }
  };
}

export function handleBlockCreateEvent(
  blockInstance,
  changeEvent,
  variableNamePrefix,
  nextVariableIndexes,
  fieldName = "ID_VAR", // Default field name to handle
) {
  if (window.loadingCode) return; // Don't rename variables during code loading

  if (blockInstance.id !== changeEvent.blockId) return;
  // Check if this is an undo/redo operation
  const isUndo = !changeEvent.recordUndo;

  if (
    !blockInstance.isInFlyout &&
    changeEvent.type === Blockly.Events.BLOCK_CREATE &&
    changeEvent.ids.includes(blockInstance.id)
  ) {
    // Skip renaming variables if this is an undo
    if (isUndo /*&& !handleBlockCreateEvent.group === "duplicate"*/) return;
    // Add this back in when have 'this' support or can rename the variables in the constructor

    // Check if the specified field already has a value
    const variableField = blockInstance.getField(fieldName);
    if (variableField) {
      const variableId = variableField.getValue();
      const variable = blockInstance.workspace.getVariableById(variableId);

      // Check if the variable name matches the pattern "prefixn"
      const variableNamePattern = new RegExp(`^${variableNamePrefix}\\d+$`);
      const variableName = variable ? variable.name : "";

      if (!variableNamePattern.test(variableName)) {
        // Don't change if the variable name doesn't match the expected pattern
      } else {
        // Create and set a new variable if necessary
        if (!nextVariableIndexes[variableNamePrefix]) {
          nextVariableIndexes[variableNamePrefix] = 1; // Initialise if not already present
        }
        let newVariableName =
          variableNamePrefix + nextVariableIndexes[variableNamePrefix];
        let newVariable = blockInstance.workspace.getVariable(newVariableName);
        if (!newVariable) {
          newVariable = blockInstance.workspace.createVariable(
            newVariableName,
            null,
          );
        }
        variableField.setValue(newVariable.getId());

        // Increment the variable index for the next variable name
        nextVariableIndexes[variableNamePrefix] += 1;
      }
    }
  }
}

// Extend the built-in Blockly procedures_defreturn block to add custom toggle functionality

// Reference to the original init function of the procedures_defreturn block
Blockly.Blocks["procedures_defreturn"].init = (function (originalInit) {
  return function () {
    // Call the original initialization function to ensure the block retains its default behaviour
    originalInit.call(this);

    // Use the existing addToggleButton helper to add the button to the block
    addToggleButton(this);
  };
})(Blockly.Blocks["procedures_defreturn"].init);

// Create an extension that adds extra UI logic without modifying the core mutator methods
Blockly.Extensions.register("custom_procedure_ui_extension", function () {
  // Add the toggle behaviour method using your helper
  this.toggleDoBlock = function () {
    // Update the shape when toggled without interfering with mutator methods
    updateShape(this, !this.isInline);
  };
});

// Apply the extension to the built-in 'procedures_defreturn' block
Blockly.Extensions.apply(
  "custom_procedure_ui_extension",
  Blockly.Blocks["procedures_defreturn"],
);

// Extend the built-in Blockly procedures_defnoreturn block to add custom toggle functionality

// Reference to the original init function of the procedures_defnoreturn block
Blockly.Blocks["procedures_defnoreturn"].init = (function (originalInit) {
  return function () {
    // Call the original initialization function to ensure the block retains its default behaviour
    originalInit.call(this);

    // Use the existing addToggleButton helper to add the button to the block
    addToggleButton(this);
  };
})(Blockly.Blocks["procedures_defnoreturn"].init);

// Apply the extension to the built-in 'procedures_defnoreturn' block
Blockly.Extensions.apply(
  "custom_procedure_ui_extension",
  Blockly.Blocks["procedures_defnoreturn"],
);

// Define unique IDs for each option
Blockly.FieldVariable.ADD_VARIABLE_ID = "ADD_VARIABLE_ID";
Blockly.FieldVariable.RENAME_VARIABLE_ID = "RENAME_VARIABLE_ID";
Blockly.FieldVariable.DELETE_VARIABLE_ID = "DELETE_VARIABLE_ID";

// Extend `getOptions` to include "New variable..." at the top of the dropdown
const originalGetOptions = Blockly.FieldVariable.prototype.getOptions;
Blockly.FieldVariable.prototype.getOptions = function () {
  // Retrieve the default options
  const options = originalGetOptions.call(this);

  // Add the "New variable..." option at the beginning
  options.unshift(["New variable...", Blockly.FieldVariable.ADD_VARIABLE_ID]);

  return options;
};

// Save a reference to the original `onItemSelected_` method
const originalOnItemSelected = Blockly.FieldVariable.prototype.onItemSelected_;
Blockly.FieldVariable.prototype.onItemSelected_ = function (menu, menuItem) {
  const id = menuItem.getValue();

  if (id === Blockly.FieldVariable.ADD_VARIABLE_ID) {
    // Open the variable creation dialog, receiving the new variable name
    Blockly.Variables.createVariableButtonHandler(
      this.sourceBlock_.workspace,
      (newVariableName) => {
        if (newVariableName) {
          // Find the variable by its name to get the full variable object
          const newVariable =
            this.sourceBlock_.workspace.getVariable(newVariableName);

          if (newVariable) {
            // Set the new variable as selected
            this.doValueUpdate_(newVariable.getId());
            this.forceRerender(); // Refresh the UI to show the new selection
          } else {
            console.log("New variable not found in workspace.");
          }
        } else {
          console.log("Variable creation was cancelled.");
        }
      },
    );
  } else {
    // Use the stored reference to avoid recursion
    originalOnItemSelected.call(this, menu, menuItem);
  }
};

Blockly.Msg["LISTS_CREATE_WITH_INPUT_WITH"] = "list";

Blockly.Blocks["microbit_input"] = {
  init: function () {
    this.jsonInit({
      type: "microbit_input",
      message0: "when micro:bit event %1",
      args0: [
        {
          type: "field_dropdown",
          name: "EVENT",
          options: [
            ["Pin P0 released", "0"],
            ["Pin P1 released", "1"],
            ["Pin P2 released", "2"],
            ["Logo long pressed", "l"],
            ["Logo touched", "j"],
            ["Logo pressed", "h"],
            ["Logo released", "k"],
            ["Button A pressed", " "],
            ["Button B pressed", "q"],
            ["Button A+B pressed", "r"],
            ["Gesture: FreeFall", "t"],
            ["Gesture: LogoUp", "o"],
            ["Gesture: LogoDown", "p"],
            ["Gesture: TiltLeft", "a"],
            ["Gesture: TiltRight", "d"],
            ["Gesture: ScreenUp", "y"],
            ["Gesture: ScreenDown", "h"],
            ["Gesture: Shake", "i"],
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
      tooltip:
        "Executes the blocks inside when a specified micro:bit event is triggered.",
      helpUrl: "",
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

(function () {
  const dynamicIf = Blockly.Blocks["dynamic_if"];
  if (!dynamicIf) return;

  const originalFinalize = dynamicIf.finalizeConnections;
  const originalMutationToDom = dynamicIf.mutationToDom;

  dynamicIf.mutationToDom = function () {
    if (this._skipFinalizeInMutationToDom) {
      if (!this.elseifCount && !this.elseCount) return null;
      const container = Blockly.utils.xml.createElement("mutation");
      if (this.elseifCount) {
        container.setAttribute("elseif", `${this.elseifCount}`);
      }
      if (this.elseCount) {
        container.setAttribute("else", "1");
      }
      return container;
    }
    return originalMutationToDom.call(this);
  };

  dynamicIf.finalizeConnections = function () {
    // Capture the old state without causing recursion.
    this._skipFinalizeInMutationToDom = true;
    const oldStateDOM = this.mutationToDom();
    const oldState = oldStateDOM ? Blockly.Xml.domToText(oldStateDOM) : null;
    this._skipFinalizeInMutationToDom = false;

    // Disable events during the rebuild so extra events aren’t recorded.
    Blockly.Events.disable();
    try {
      originalFinalize.call(this);
    } finally {
      Blockly.Events.enable();
    }

    // Capture the new state.
    this._skipFinalizeInMutationToDom = true;
    const newStateDOM = this.mutationToDom();
    const newState = newStateDOM ? Blockly.Xml.domToText(newStateDOM) : null;
    this._skipFinalizeInMutationToDom = false;

    // Fire one synthetic mutation event to represent the entire rebuild.
    let mutationEvent;
    if (typeof Blockly.Events.Mutation === "function") {
      mutationEvent = new Blockly.Events.Mutation(this, oldState, newState);
    } else {
      mutationEvent = new Blockly.Events.BlockChange(
        this,
        "mutation",
        "",
        oldState,
        newState,
      );
    }
    Blockly.Events.fire(mutationEvent);
  };
})();

// Listen for changes to blocks in the workspace
