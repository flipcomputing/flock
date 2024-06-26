// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from 'blockly';
import {javascriptGenerator} from 'blockly/javascript';
import {registerFieldColour} from '@blockly/field-colour';
import * as BABYLON from '@babylonjs/core';
import * as BABYLON_GUI from '@babylonjs/gui';
import HavokPhysics from "@babylonjs/havok";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

window.BABYLON = BABYLON;
window.GUI = BABYLON_GUI;

registerFieldColour();

const categoryColours = {
  "Scene": 100,
  "Motion": 240,
  "Looks": 300,
  "Control": "%{BKY_LOOPS_HUE}",
  "Logic": "%{BKY_LOGIC_HUE}",
  "Variables": "%{BKY_VARIABLES_HUE}",
  "Text": "%{BKY_TEXTS_HUE}",
  "Lists": "%{BKY_LISTS_HUE}",
  "Math": "%{BKY_MATH_HUE}",
  "Procedures": "%{BKY_PROCEDURES_HUE}"
};

const canvas = document.getElementById("renderCanvas");
window.canvas = canvas;
const engine = new BABYLON.Engine(canvas, true, { stencil: true });
engine.enableOfflineSupport = true;
let hk = null;
window.scene = null;
let havokInstance = null;
let engineReady = false;
let highlighter = null;
let gizmoManager = null;

const workspace = Blockly.inject('blocklyDiv', {
  theme: Blockly.Themes.Modern,
  renderer: 'zelos',
  zoom: {
	controls: true,  // Enables zoom controls (+, -, and home buttons)
	wheel: true,     // Enables zooming in/out using the mouse wheel
	startScale: 0.8, // Initial scale
	maxScale: 3,     // Max scale
	minScale: 0.3,   // Min scale
	scaleSpeed: 1.2  // How fast it zooms
  },
  toolbox: `
		<xml id="toolbox" style="display: none">
	  <category name="Flock 🐑🐑🐑"></category>
		  <category name="Scene" colour="${categoryColours["Scene"]}">		
	  <block type="set_sky_color"></block>
		  <block type="create_ground"></block>
	  <block type="set_fog">
	  <value name="DENSITY">
	  <shadow type="math_number">
		<field name="NUM">0.1</field>
	  </shadow>
	  </value>
	  </block>
	  <block type="create_box">
	  <field name="COLOR">#9932CC</field> <!-- Default color -->
	  <value name="WIDTH"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
	  <value name="HEIGHT"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
	  <value name="DEPTH"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
	  <value name="X"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
	  <value name="Y"><shadow type="math_number"><field name="NUM">0.5</field></shadow></value>
	  <value name="Z"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
	  </block>
	  <block type="create_sphere">
	  <field name="COLOR">#9932CC</field> <!-- Default color -->
	  <value name="DIAMETER_X">
		<shadow type="math_number">
		<field name="NUM">1</field>
		</shadow>
	  </value>
	  <value name="DIAMETER_Y">
		<shadow type="math_number">
		<field name="NUM">1</field>
		</shadow>
	  </value>
	  <value name="DIAMETER_Z">
		<shadow type="math_number">
		<field name="NUM">1</field>
		</shadow>
	  </value>
	  <value name="X">
		<shadow type="math_number">
		<field name="NUM">0</field>
		</shadow>
	  </value>
	  <value name="Y">
		<shadow type="math_number">
		<field name="NUM">0.5</field>
		</shadow>
	  </value>
	  <value name="Z">
		<shadow type="math_number">
		<field name="NUM">0</field>
		</shadow>
	  </value>
	  </block>
	  <block type="create_plane">
		<field name="COLOR">#9932CC</field> <!-- Default color for the plane -->
		<value name="WIDTH">
		  <shadow type="math_number">
			<field name="NUM">2</field> <!-- Default width -->
		  </shadow>
		</value>
		<value name="HEIGHT">
		  <shadow type="math_number">
			<field name="NUM">2</field> <!-- Default height -->
		  </shadow>
		</value>
		<value name="X">
		  <shadow type="math_number">
			<field name="NUM">0</field> <!-- Default x position -->
		  </shadow>
		</value>
		<value name="Y">
		  <shadow type="math_number">
			<field name="NUM">1</field> <!-- Default y position -->
		  </shadow>
		</value>
		<value name="Z">
		  <shadow type="math_number">
			<field name="NUM">0</field> <!-- Default z position -->
		  </shadow>
		</value>
	  </block>
	  <block type="set_background_color"></block>
</category>
<category name="Motion" colour="${categoryColours["Motion"]}">
<block type="move_by_vector">
  <value name="X">
  <shadow type="math_number">
	<field name="NUM">1</field>
  </shadow>
  </value>
  <value name="Y">
  <shadow type="math_number">
	<field name="NUM">0</field>
  </shadow>
  </value>
  <value name="Z">
  <shadow type="math_number">
	<field name="NUM">0</field>
  </shadow>
  </value>
</block>
<block type="rotate_model_xyz">
<value name="X">
  <shadow type="math_number">
  <field name="NUM">0</field>
  </shadow>
  </value>
  <value name="Y">
  <shadow type="math_number">
  <field name="NUM">45</field>
  </shadow>
  </value>
  <value name="Z">
  <shadow type="math_number">
  <field name="NUM">0</field>
  </shadow>
  </value>
</block>
<block type="glide_to">
<value name="X">
  <shadow type="math_number">
  <field name="NUM">0</field>
  </shadow>
  </value>
  <value name="Y">
  <shadow type="math_number">
  <field name="NUM">0</field>
  </shadow>
  </value>
  <value name="Z">
  <shadow type="math_number">
  <field name="NUM">0</field>
  </shadow>
  </value>
<value name="DURATION">
  <shadow type="math_number">
  <field name="NUM">1000</field>
  </shadow>
  </value>
</block>
<block type="move_forward">
	 <value name="SPEED">
  <shadow type="math_number">
  <field name="NUM">3</field>
  </shadow>
</value>
</block>
<block type="camera_follow"></block>
<block type="add_physics"></block>
</category>
<category name="Looks" colour="${categoryColours["Looks"]}">
<block type="show"></block>
<block type="hide"></block>
<block type="tint">
<field name="COLOR">#AA336A</field> <!-- Default color -->
</block>
<block type="highlight">
<field name="COLOR">#FFD700</field> <!-- Default color -->
</block>
<block type="set_alpha">
  <!-- Shadow block for the ALPHA input to provide a default value -->
  <value name="ALPHA">
  <shadow type="math_number">
	<field name="NUM">0.5</field>
  </shadow>
  </value>
</block>
<block type="clear_effects"></block>
</category>
<category name="Control" colour="${categoryColours["Control"]}">
<block type="start"></block>
<block type="on_each_update"></block>
<block type="wait"></block>
<!-- Loop Blocks -->
<block type="controls_repeat_ext">
  <value name="TIMES">
  <shadow type="math_number">
	<field name="NUM">10</field>
  </shadow>
  </value>
</block>
<block type="controls_whileUntil"></block>
<block type="controls_forEach"></block>
<block type="controls_for"></block>
</category>
<category name="Events" colour="#FFBF00">
  <block type="when_clicked"></block>
  <block type="when_key_pressed"></block>		
  <block type="when_key_released"></block>		
 </category>
<category name="Condition" colour="${categoryColours["Logic"]}">

<!-- Conditional Blocks -->
<block type="controls_if"></block>
<block type="controls_ifelse"></block>

<!-- Logical Operators -->
<block type="logic_compare"></block>
<block type="logic_operation"></block>
<block type="logic_negate"></block>
<block type="logic_boolean"></block>
<block type="logic_null"></block>
<block type="logic_ternary"></block>
</category>
<category name="Text" categorystyle="text_category">
 <block type="print_text"><value name="TEXT"><shadow type="text"><field name="TEXT">🌈 Hello</field></shadow></value><value name="DURATION"><shadow type="math_number"><field name="NUM">30</field></shadow></value></block>
 <block type="say">
   <value name="TEXT">
   <shadow type="text">
	 <field name="TEXT">Hello</field>
   </shadow>
   </value>
   <value name="DURATION">
   <shadow type="math_number">
	 <field name="NUM">3</field>
   </shadow>
   </value>
   <value name="ALPHA">
   <shadow type="math_number">
	 <field name="NUM">1</field>
   </shadow>
   </value>
   <value name="SIZE">
   <shadow type="math_number">
	 <field name="NUM">12</field>
   </shadow>
   </value>
   <field name="MESH">item</field>
   <field name="TEXT_COLOR">#000000</field>
   <field name="BACKGROUND_COLOR">#ffffff</field>
   <field name="MODE">ADD</field>
 </block>

  <block type="text"></block>
  <block type="text_print">
  <value name="TEXT">
	<shadow type="text">
	<field name="TEXT">abc</field>
	</shadow>
  </value>
  </block>
  <block type="text_join"></block>
  <block type="text_append">
  <value name="TEXT">
	<shadow type="text"></shadow>
  </value>
  </block>
  <block type="text_length">
  <value name="VALUE">
	<shadow type="text">
	<field name="TEXT">abc</field>
	</shadow>
  </value>
  </block>
  <block type="text_isEmpty">
  <value name="VALUE">
	<shadow type="text">
	<field name="TEXT"></field>
	</shadow>
  </value>
  </block>
  <block type="text_indexOf">
  <value name="VALUE">
	<block type="variables_get">
	<field name="VAR">text</field>
	</block>
  </value>
  <value name="FIND">
	<shadow type="text">
	<field name="TEXT">abc</field>
	</shadow>
  </value>
  </block>
  <block type="text_charAt">
  <value name="VALUE">
	<block type="variables_get">
	<field name="VAR">text</field>
	</block>
  </value>
  </block>
  <block type="text_getSubstring">
  <value name="STRING">
	<block type="variables_get">
	<field name="VAR">text</field>
	</block>
  </value>
  </block>
  <block type="text_changeCase">
  <value name="TEXT">
	<shadow type="text">
	<field name="TEXT">abc</field>
	</shadow>
  </value>
  </block>
  <block type="text_trim">
  <value name="TEXT">
	<shadow type="text">
	<field name="TEXT">abc</field>
	</shadow>
  </value>
  </block>
  <block type="text_count">
  <value name="SUB">
	<shadow type="text"></shadow>
  </value>
  <value name="TEXT">
	<shadow type="text"></shadow>
  </value>
  </block>
  <block type="text_replace">
  <value name="FROM">
	<shadow type="text"></shadow>
  </value>
  <value name="TO">
	<shadow type="text"></shadow>
  </value>
  <value name="TEXT">
	<shadow type="text"></shadow>
  </value>
  </block>
  <block type="text_reverse">
  <value name="TEXT">
	<shadow type="text"></shadow>
  </value>
  </block>
  <label text="Input/Output:" web-class="ioLabel"></label>
  <block type="text_prompt_ext">
  <value name="TEXT">
	<shadow type="text">
	<field name="TEXT">abc</field>
	</shadow>
  </value>
  </block>
</category>
 <category name="Variables" colour="${categoryColours["Variables"]}" custom="VARIABLE">
<block type="log_variable"></block> <!-- Your custom block -->
 </category>
 <category name="Sensing" colour="#ADD8E6">
   <block type="key_pressed"></block>
 </category>
 <category name="Lists" colour="${categoryColours["Lists"]}">
   <block type="lists_create_empty"></block>
   <block type="lists_create_with"></block>
   <block type="lists_repeat"></block>
   <block type="lists_length"></block>
   <block type="lists_isEmpty"></block>
   <block type="lists_indexOf"></block>
   <block type="lists_getIndex"></block>
   <block type="lists_setIndex"></block>
   <block type="lists_getSublist"></block>
   <block type="lists_split"></block>
   <block type="lists_sort"></block>
   <!-- Additional list blocks can be added here -->
 </category>
 <category name="Math" colour="${categoryColours["Math"]}">
   <!-- Basic arithmetic -->
   <block type="math_arithmetic">
   <field name="OP">ADD</field>
   <value name="A">
   <shadow type="math_number">
	 <field name="NUM">1</field>
   </shadow>
   </value>
   <value name="B">
   <shadow type="math_number">
	 <field name="NUM">1</field>
   </shadow>
   </value>
   </block>

   <!-- Random integer between two numbers -->
   <block type="math_random_int">
   <value name="FROM">
   <shadow type="math_number">
	 <field name="NUM">1</field>
   </shadow>
   </value>
   <value name="TO">
   <shadow type="math_number">
	 <field name="NUM">100</field>
   </shadow>
   </value>
   </block>

   <!-- A single number -->
   <block type="math_number">
   <field name="NUM">0</field>
   </block>

   <!-- More complex blocks -->
   <block type="math_constant"></block>
   <block type="math_number_property"></block>
   <block type="math_round"></block>
   <block type="math_on_list"></block>
   <block type="math_modulo"></block>
   <block type="math_constrain">
   <value name="LOW">
   <shadow type="math_number">
	 <field name="NUM">1</field>
   </shadow>
   </value>
   <value name="HIGH">
   <shadow type="math_number">
	 <field name="NUM">100</field>
   </shadow>
   </value>
   </block>
   <block type="math_random_float"></block>
   <!-- Add any additional math blocks you find necessary -->
   </category>
   <category name="Functions" custom="PROCEDURE" colour="%{BKY_PROCEDURES_HUE}"></category>
</xml>
	  `
});

console.log("Welcome to Flock 🐑🐑🐑");

workspace.addChangeListener(function(event) {
  if (event.type === Blockly.Events.FINISHED_LOADING) {
	initializeVariableIndexes();
  }
});

Blockly.Blocks['start'] = {
  init: function() {
	this.jsonInit({
	  "type": "start",
	  "message0": "script %1",
	  "args0": [
		{
		  "type": "input_statement",
		  "name": "DO"
		}
	  ],
	  "nextStatement": null,
	  "colour": categoryColours["Control"],
	  "tooltip": "Run the attached block when the project starts.",
	  "style": {
		"hat": "cap"
	  }
	});
  }
};


Blockly.Blocks['create_ground'] = {
  init: function() {
	this.jsonInit({
	  "type": "create_ground",
	  "message0": "add ground with color %1",
	  "args0": [
		{
		  "type": "field_colour",
		  "name": "COLOR",
		  "colour": "#71BC78"
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Scene"],
	  "tooltip": "Adds a ground plane with collisions enabled to the scene, with specified color.",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['wait'] = {
  init: function() {
	this.jsonInit({
	  "type": "wait",
	  "message0": "wait %1 ms",
	  "args0": [
		{
		  "type": "field_number",
		  "name": "DURATION",
		  "value": 1000,
		  "min": 0
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Control"],
	  "tooltip": "Wait for a specified time in milliseconds",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['glide_to'] = {
  init: function() {
	this.jsonInit({
	  "type": "glide_to",
	  "message0": "glide %1 to x %2 y %3 z %4 in %5 ms %6",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MESH_VAR",
		  "variable": "mesh1"
		}
		,
		{
		  "type": "input_value",
		  "name": "X",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "Y",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "Z",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "DURATION",
		  "check": "Number"
		},
		{
		  "type": "field_dropdown",
		  "name": "MODE",
		  "options": [
			["await", "AWAIT"],
			["start", "START"]
		  ]
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Motion"],
	  "tooltip": "Glide to a specified position over a duration",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['set_sky_color'] = {
  init: function() {
	this.jsonInit({
	  "type": "set_sky_color",
	  "message0": "set sky color %1",
	  "args0": [
		{
		  "type": "field_colour",
		  "name": "COLOR",
		  "colour": "#6495ED" // Default sky color
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Scene"],
	  "tooltip": "Sets the sky color of the scene.",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['set_fog'] = {
  init: function() {
	this.jsonInit({
	  "type": "set_fog",
	  "message0": "set fog color %1 mode %2 density %3",
	  "args0": [
		{
		  "type": "field_colour",
		  "name": "FOG_COLOR",
		  "colour": "#ffffff"  // Default fog color
		},
		{
		  "type": "field_dropdown",
		  "name": "FOG_MODE",
		  "options": [
			["Linear", "LINEAR"],
			["None", "NONE"],
			["Exp", "EXP"],
			["Exp2", "EXP2"]
		  ]
		},
		{
		  "type": "input_value",
		  "name": "DENSITY",
		  "check": "Number"
		}
	  ],
	  "inputsInline": true,
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Scene"],
	  "tooltip": "Configures the scene's fog.",
	  "helpUrl": ""
	});
  }
};


Blockly.Blocks['create_box'] = {
  init: function() {
	let nextVariableName = "box" + nextVariableIndexes['box'];
	this.jsonInit({
	  "type": "create_box",
	  "message0": "create box as %1 %2 width %3 height %4 depth %5 x %6 y %7 z %8",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "ID_VAR",
		  "variable": nextVariableName
		},
		{
		  "type": "field_colour",
		  "name": "COLOR",
		  "colour": "#9932CC"
		},
		{
		  "type": "input_value",
		  "name": "WIDTH",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "HEIGHT",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "DEPTH",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "X",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "Y",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "Z",
		  "check": "Number"
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "inputsInline": true,
	  "colour": categoryColours["Scene"],
	  "tooltip": "Creates a colored box with specified dimensions and position.",
	  "helpUrl": ""
	});

	this.setOnChange(function(changeEvent) {
	  if (!this.isInFlyout && changeEvent.type === Blockly.Events.BLOCK_CREATE && changeEvent.ids.includes(this.id)) {

		let variable = this.workspace.getVariable(nextVariableName);
		if (!variable) {
		  variable = this.workspace.createVariable(nextVariableName, null);
		  this.getField('ID_VAR').setValue(variable.getId());
		}

		nextVariableIndexes['box'] += 1;
	  }

	});
  }
};

Blockly.Blocks['create_sphere'] = {
  init: function() {
	let nextVariableName = "sphere" + nextVariableIndexes['sphere'];
	this.jsonInit({
	  "type": "create_sphere",
	  "message0": "create sphere as %1 %2 diameter x %3 diameter y %4 diameter z %5 x %6 y %7 z %8",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "ID_VAR",
		  "variable": nextVariableName
		},
		{
		  "type": "field_colour",
		  "name": "COLOR",
		  "colour": "#9932CC"
		},
		{
		  "type": "input_value",
		  "name": "DIAMETER_X",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "DIAMETER_Y",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "DIAMETER_Z",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "X",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "Y",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "Z",
		  "check": "Number"
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "inputsInline": true,
	  "colour": categoryColours["Scene"],
	  "tooltip": "Creates a colored sphere with specified dimensions and position.",
	  "helpUrl": ""
	});

	this.setOnChange(function(changeEvent) {
	  if (!this.isInFlyout && changeEvent.type === Blockly.Events.BLOCK_CREATE && changeEvent.ids.includes(this.id)) {
		let variable = this.workspace.getVariable(nextVariableName);
		if (!variable) {
		  variable = this.workspace.createVariable(nextVariableName, null);
		  this.getField('ID_VAR').setValue(variable.getId());
		}

		nextVariableIndexes['sphere'] += 1;
	  }
	});
  }
};

Blockly.Blocks['create_plane'] = {
  init: function() {
	let nextVariableName = "plane" + nextVariableIndexes['plane']; // Ensure 'plane' is managed in your nextVariableIndexes
	this.jsonInit({
	  "type": "create_plane",
	  "message0": "create plane as %1 %2 width %3 height %4 x %5 y %6 z %7",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "ID_VAR",
		  "variable": nextVariableName
		},
		{
		  "type": "field_colour",
		  "name": "COLOR",
		  "colour": "#9932CC"  // Default color for the plane
		},
		{
		  "type": "input_value",
		  "name": "WIDTH",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "HEIGHT",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "X",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "Y",
		  "check": "Number"
		},
		{
		  "type": "input_value",
		  "name": "Z",
		  "check": "Number"
		}
	  ],
	  "inputsInline": true,
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Scene"],
	  "tooltip": "Creates a colored 2D plane with specified width, height, and position.",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['set_background_color'] = {
  init: function() {
	this.jsonInit({
	  "type": "set_background_color",
	  "message0": "set background color %1",
	  "args0": [
		{
		  "type": "field_colour",
		  "name": "COLOR",
		  "colour": "#6495ED"  // Default background color
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Scene"],
	  "tooltip": "Set the scene's background color",
	  "helpUrl": ""
	});
  }
};


Blockly.Blocks['print_text'] = {
  init: function() {
	this.jsonInit({
	  "type": "print_text",
	  "message0": "print %1 for %2 seconds in color %3",
	  "args0": [
		{
		  "type": "input_value",
		  "name": "TEXT",
		  "check": "String"
		},
		{
		  "type": "input_value",
		  "name": "DURATION",
		  "check": "Number"
		},
		{
		  "type": "field_colour",
		  "name": "COLOR",
		  "colour": "#000080"
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": 160,
	  "tooltip": "",
	  "helpUrl": ""
	});
  }
};


Blockly.Blocks['say'] = {
  init: function() {
	this.jsonInit(
	  {
		"type": "say",
		"message0": "say %1 for %2 s %3 text %4 and background %5 alpha %6 size %7 %8 %9",
		"args0": [
		  {
			"type": "input_value",
			"name": "TEXT",
			"check": "String"
		  },
		  {
			"type": "input_value",
			"name": "DURATION",
			"check": "Number"
		  },
		  {
			"type": "field_variable",
			"name": "MESH_VAR",
			"variable": "item"
		  },
		  {
			"type": "field_colour",
			"name": "TEXT_COLOR",
			"colour": "#000000"
		  },
		  {
			"type": "field_colour",
			"name": "BACKGROUND_COLOR",
			"colour": "#ffffff"
		  },
		  {
			"type": "input_value",
			"name": "ALPHA",
			"check": "Number"
		  },
		  {
			"type": "input_value",
			"name": "SIZE",
			"check": "Number"
		  },
		  {
			"type": "field_dropdown",
			"name": "MODE",
			"options": [
			  ["add", "ADD"],
			  ["replace", "REPLACE"]
			]
		  },
		  {
			"type": "field_dropdown",
			"name": "ASYNC",
			"options": [
			  ["start", "START"],
			  ["await", "AWAIT"]
			]
		  }
		],
		"inputsInline": true,
		"previousStatement": null,
		"nextStatement": null,
		"colour": 160,
		"tooltip": "Displays a piece of text as a billboard on a mesh.",
		"helpUrl": ""
	  });
  }
};


Blockly.Blocks['move_by_vector'] = {
  init: function() {
	this.jsonInit({
	  "type": "move_by_vector",
	  "message0": "move %1 by x: %2 y: %3 z: %4",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "BLOCK_NAME",
		  "variable": "mesh"
		},
		{
		  "type": "input_value",
		  "name": "X",
		  "check": "Number",
		  "align": "RIGHT"
		},
		{
		  "type": "input_value",
		  "name": "Y",
		  "check": "Number",
		  "align": "RIGHT"
		},
		{
		  "type": "input_value",
		  "name": "Z",
		  "check": "Number",
		  "align": "RIGHT"
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Motion"],
	  "inputsInline": true
	});
  }
};

Blockly.Blocks['rotate_model_xyz'] = {
  init: function() {
	this.jsonInit({
	  "type": "rotate_model_xyz",
	  "message0": "rotate %1 by x: %2 y: %3 z: %4",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MODEL",
		  "variable": "mesh"  // Default variable name
		},
		{
		  "type": "input_value",
		  "name": "X",
		  "check": "Number",
		  "align": "RIGHT"
		},
		{
		  "type": "input_value",
		  "name": "Y",
		  "check": "Number",
		  "align": "RIGHT"
		},
		{
		  "type": "input_value",
		  "name": "Z",
		  "check": "Number",
		  "align": "RIGHT"
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Motion"],
	  "inputsInline": true,
	  "tooltip": "Rotates the model based on its current rotation plus additional x, y, z values.",
	  "helpUrl": ""
	});
  }
};


Blockly.Blocks['on_each_update'] = {
  init: function() {
	this.jsonInit({
	  "type": "on_each_update",
	  "message0": "on each update %1",
	  "args0": [
		{
		  "type": "input_statement",
		  "name": "DO",
		  "check": null
		}
	  ],
	  "colour": categoryColours["Control"],
	  "tooltip": "Executes the enclosed blocks each frame in the render loop.",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['when_clicked'] = {
  init: function() {
	this.jsonInit({
	  "type": "model_clicked",
	  "message0": "when %1 is clicked",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MODEL_VAR",
		  "variable": "mesh"  // Default variable name
		}
	  ],
	  "message1": "do %1",
	  "args1": [
		{
		  "type": "input_statement",
		  "name": "DO"
		}
	  ],
	  "colour": 120,
	  "tooltip": "Executes the blocks inside when the specified model is clicked.",
	  "helpUrl": ""
	});

  }
};

Blockly.Blocks['when_key_pressed'] = {
  init: function() {
	this.jsonInit({
	  "type": "when_key_pressed",
	  "message0": "when key pressed %1",
	  "args0": [
		{
		  "type": "field_dropdown",
		  "name": "KEY",
		  "options": [
			["space", "SPACE"]
		  ]
		}
	  ],
	  "message1": "do %1",
	  "args1": [
		{
		  "type": "input_statement",
		  "name": "DO"
		}
	  ],
	  "nextStatement": null,
	  "colour": 120,
	  "tooltip": "Executes the blocks inside when the specified key is pressed.",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['when_key_released'] = {
  init: function() {
	this.jsonInit({
	  "type": "when_key_released",
	  "message0": "when key released %1",
	  "args0": [
		{
		  "type": "field_dropdown",
		  "name": "KEY",
		  "options": [
			["space", "SPACE"]
		  ]
		}
	  ],
	  "message1": "do %1",
	  "args1": [
		{
		  "type": "input_statement",
		  "name": "DO"
		}
	  ],
	  "nextStatement": null,
	  "colour": 120,
	  "tooltip": "Executes the blocks inside when the specified key is released.",
	  "helpUrl": "",
	});
  }
};



Blockly.Blocks['show'] = {
  init: function() {
	this.jsonInit({
	  "type": "show",
	  "message0": "show %1",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MODEL_VAR",
		  "variable": "mesh"
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Looks"],
	  "tooltip": "Shows the selected model.",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['hide'] = {
  init: function() {
	this.jsonInit({
	  "type": "hide",
	  "message0": "hide %1",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MODEL_VAR",
		  "variable": "mesh"
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Looks"],
	  "tooltip": "Hides the selected model.",
	  "helpUrl": ""
	});
  }
};


Blockly.Blocks['highlight'] = {
  init: function() {
	this.jsonInit({
	  "type": "highlight",
	  "message0": "highlight %1 color %2",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MODEL_VAR",
		  "variable": "mesh"  // Default variable name, ensure it's defined in your environment
		},
		{
		  "type": "field_colour",
		  "name": "COLOR",
		  "colour": "#9932CC"
		}
	  ],
	  "inputsInline": true,
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Looks"],
	  "tooltip": "Highlights the selected model.",
	  "helpUrl": ""
	});
  }
};


Blockly.Blocks['tint'] = {
  init: function() {
	this.jsonInit({
	  "type": "tint",
	  "message0": "tint %1 color %2",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MODEL_VAR",
		  "variable": "mesh"
		},
		{
		  "type": "field_colour",
		  "name": "COLOR",
		  "colour": "#9932CC"
		}
	  ],
	  "inputsInline": true,
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Looks"],
	  "tooltip": "Add colour tint effect.",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['set_alpha'] = {
  init: function() {
	this.jsonInit({
	  "type": "set_mesh_material_alpha",
	  "message0": "set alpha of %1 to %2",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MESH",
		  "variable": "mesh"
		},
		{
		  "type": "input_value",
		  "name": "ALPHA",
		  "check": "Number"
		}
	  ],
	  "inputsInline": true,
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Looks"],
	  "tooltip": "Sets the alpha (transparency) of the material(s) on a specified mesh. Values should be 0 to 1.",
	  "helpUrl": ""
	});
  }
};


Blockly.Blocks['clear_effects'] = {
  init: function() {
	this.jsonInit({
	  "type": "clear_effects",
	  "message0": "clear effects %1",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MODEL_VAR",
		  "variable": "mesh"
		}
	  ],
	  "inputsInline": true,
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Looks"],
	  "tooltip": "Clear visual effects from selected model.",
	  "helpUrl": ""
	});
  }
};


Blockly.Blocks['camera_follow'] = {
  init: function() {
	this.jsonInit({
	  "type": "camera_follow",
	  "message0": "camera follow %1",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MESH_VAR",
		  "variable": "mesh1"
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Motion"],
	  "tooltip": "Makes the camera follow a model specified by the variable.",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['add_physics'] = {
  init: function() {
	this.jsonInit({
	  "type": "add_physics",
	  "message0": "add physics %1",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MODEL_VAR",
		  "variable": "mesh"
		}
	  ],
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Motion"],
	  "tooltip": "Adds dynamic physics so the mesh reacts to forces including gravity.",
	  "helpUrl": ""
	});
  }
};


Blockly.Blocks['key_pressed'] = {
  init: function() {
	this.jsonInit({
	  "type": "key_pressed",
	  "message0": "key pressed is %1",
	  "args0": [
		{
		  "type": "field_dropdown",
		  "name": "KEY",
		  "options": [
			["any", "ANY"],
			["none", "NONE"],
			["space", "SPACE"],
			["W", "KeyW"],
			["A", "KeyA"],
			["S", "KeyS"],
			["D", "KeyD"]
		  ]
		}
	  ],
	  "output": "Boolean",
	  "colour": 160,
	  "tooltip": "Returns true if the specified key is pressed.",
	  "helpUrl": ""
	});
  }
};

Blockly.Blocks['move_forward'] = {
  init: function() {
	this.jsonInit({
	  "type": "move_forward",
	  "message0": "forward %1 speed %2",
	  "args0": [
		{
		  "type": "field_variable",
		  "name": "MODEL",
		  "variable": "mesh"
		},
		{
		  "type": "input_value",
		  "name": "SPEED",
		  "check": "Number"
		}
	  ],
	  "inputsInline": true,
	  "previousStatement": null,
	  "nextStatement": null,
	  "colour": categoryColours["Motion"],
	  "tooltip": "Moves the model forward in the direction it's pointing.",
	  "helpUrl": ""
	});
  }
};

javascriptGenerator.forBlock['show'] = function(block) {
  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MODEL_VAR'), Blockly.Names.NameType.VARIABLE);

  return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
	 mesh.setEnabled(true);
	 hk._hknp.HP_World_AddBody(hk.world, mesh.physics._pluginData.hpBodyId, mesh.physics.startAsleep);
	}
	else{
	 console.log("Model not loaded:", ${modelName});
	}
	});\n`;
};

javascriptGenerator.forBlock['hide'] = function(block) {
  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MODEL_VAR'), Blockly.Names.NameType.VARIABLE);

  return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
	 mesh.setEnabled(false);
	 hk._hknp.HP_World_RemoveBody(hk.world, mesh.physics._pluginData.hpBodyId);
	}
	else{
	 console.log("Mesh not loaded:", ${modelName});
	}

	});\n`;

};

function wrapCode(modelName, innerCodeBlock) {
  return `
  (function() {
	window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
	  ${innerCodeBlock}
	}
	else {
	  console.log("Model not loaded:", modelName);
	}
	});
  })();
  `;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
	return v.toString(16);
  });
}

function getFieldValue(block, fieldName, defaultValue) {
  return javascriptGenerator.valueToCode(block, fieldName, javascriptGenerator.ORDER_ATOMIC) || defaultValue;
}

function whenModelReady(meshId, callback, attempt = 1) {
  const maxAttempts = 10; // Maximum number of attempts before giving up
  const attemptInterval = 1000; // Time in milliseconds between attempts

  // Early exit if meshId is not provided
  if (!meshId) {
	console.log("Undefined model requested.", meshId);
	return;
  }

  const mesh = window.scene.getMeshByName(meshId);

  // If mesh is found, execute the callback
  if (mesh) {
	callback(mesh);
	//console.log(`Action performed on ${meshId}`);
	return;
  }

  // Retry logic if mesh not found and max attempts not reached
  if (attempt <= maxAttempts) {
	console.log(`Retrying model with ID '${meshId}'. Attempt ${attempt}`);
	setTimeout(() => window.whenModelReady(meshId, callback, attempt + 1), attemptInterval);
  } else {
	// Log error if maximum attempts are reached
	console.error(`Model with ID '${meshId}' not found after ${maxAttempts} attempts.`);
  }
}

window.whenModelReady = whenModelReady;

javascriptGenerator.forBlock['wait'] = function(block) {
  const duration = block.getFieldValue('DURATION');
  return `await new Promise(resolve => setTimeout(resolve, ${duration}));\n`;
};

javascriptGenerator.forBlock['glide_to'] = function(block) {
  const x = getFieldValue(block, 'X', '0');
  const y = getFieldValue(block, 'Y', '0');
  const z = getFieldValue(block, 'Z', '0');
  const meshName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MESH_VAR'), Blockly.Names.NameType.VARIABLE);
  const duration = block.getFieldValue('DURATION');
  const mode = block.getFieldValue('MODE');

  return `
	await (async () => {
	  const mesh = window.scene.getMeshByName(${meshName});

if (mesh) {

const startPosition = mesh.position.clone();
const endPosition = new BABYLON.Vector3(${x}, ${y}, ${z});
const fps = 30;
const frames = 30 * (${duration}/1000);

const anim = BABYLON.Animation.CreateAndStartAnimation("anim", mesh, "position", fps, 100, startPosition, endPosition, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);

${mode === 'AWAIT' ? `
await new Promise(resolve => {
  anim.onAnimationEndObservable.add(() => {
  resolve();
  });
});
` : ''}


}
  })();
	`;
};


javascriptGenerator.forBlock['start'] = function(block) {
  const branch = javascriptGenerator.statementToCode(block, 'DO');
  return `(async () => {\n${branch}})();\n`;
};

javascriptGenerator.forBlock['create_ground'] = function(block) {
  const color = block.getFieldValue('COLOR');

  return `
	(function() {
	const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 100, height: 100, subdivisions: 2}, window.scene);
	const groundAggregate = new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, window.scene);
	ground.receiveShadows = true;
	const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", window.scene);
	groundMaterial.diffuseColor = BABYLON.Color3.FromHexString("${color}");
	ground.material = groundMaterial;
	})();
	`;

};

javascriptGenerator.forBlock['set_sky_color'] = function(block) {
  const color = block.getFieldValue('COLOR');
  return `window.scene.clearColor = window.BABYLON.Color3.FromHexString("${color}");\n`;
};

javascriptGenerator.forBlock['print_text'] = function(block) {
  const text = javascriptGenerator.valueToCode(block, 'TEXT', javascriptGenerator.ORDER_ATOMIC) || '\'\'';
  const duration = javascriptGenerator.valueToCode(block, 'DURATION', javascriptGenerator.ORDER_ATOMIC) || '0';
  const color = block.getFieldValue('COLOR');
  return `printText(${text}, ${duration}, '${color}');\n`;
};


function hexToRgba(hex, alpha) {
  hex = hex.replace(/^#/, '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
window.hexToRgba = hexToRgba;

// Register the block in Blockly
javascriptGenerator.forBlock['say'] = // Function to handle the 'say' block
  function(block) {
	const text = javascriptGenerator.valueToCode(block, 'TEXT', javascriptGenerator.ORDER_ATOMIC) || '""';
	const duration = javascriptGenerator.valueToCode(block, 'DURATION', javascriptGenerator.ORDER_ATOMIC) || '0';
	const meshVariable = javascriptGenerator.nameDB_.getName(block.getFieldValue('MESH_VAR'), Blockly.Names.NameType.VARIABLE);
	const textColor = block.getFieldValue('TEXT_COLOR');
	const backgroundColor = block.getFieldValue('BACKGROUND_COLOR');
	const alpha = javascriptGenerator.valueToCode(block, 'ALPHA', javascriptGenerator.ORDER_ATOMIC) || '1';
	const size = javascriptGenerator.valueToCode(block, 'SIZE', javascriptGenerator.ORDER_ATOMIC) || '24';
	const mode = block.getFieldValue('MODE');
	const asyncMode = block.getFieldValue('ASYNC');


	return `
	  await (async function() {


		function displayText(mesh) {
		  return new Promise((resolve, reject) => {
			if (mesh) {
			  // Create or get the stack panel plane
			   let plane = mesh.getChildren().find(child => child.name === "textPlane");
			  let advancedTexture;
			  if (!plane) {
				plane = BABYLON.MeshBuilder.CreatePlane("textPlane", { width: 1.5, height: 1.5 }, window.scene);
				plane.name = "textPlane";
				plane.parent = mesh;
				plane.alpha = 1;
				plane.checkCollisions = false;
				plane.isPickable = false;
				advancedTexture = window.GUI.AdvancedDynamicTexture.CreateForMesh(plane);
				plane.advancedTexture = advancedTexture;

				const stackPanel = new window.GUI.StackPanel();
				stackPanel.name = "stackPanel";
				stackPanel.horizontalAlignment = window.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
				stackPanel.verticalAlignment = window.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
				stackPanel.isVertical = true;
				stackPanel.width = "100%";
				stackPanel.adaptHeightToChildren = true;
				stackPanel.resizeToFit = true;
				stackPanel.forceResizeWidth = true;
				stackPanel.forceResizeHeight = true;
				advancedTexture.addControl(stackPanel);

			  } else {
				advancedTexture = plane.advancedTexture;
			  }

			  const stackPanel = advancedTexture.getControlByName("stackPanel");

			  // Handle REPLACE mode
			  if ("${mode}" === "REPLACE") {
				stackPanel.clearControls();
			  }

			  // Only add new text if the text value is not empty
			  if (${text}) {
				// Create a new background rectangle for the text
				const bg = new window.GUI.Rectangle("textBackground");
				bg.background = window.hexToRgba("${backgroundColor}", ${alpha});
				bg.adaptWidthToChildren = true;
				bg.adaptHeightToChildren = true;
				bg.cornerRadius = 30;
				bg.thickness = 0; // Remove border
				bg.resizeToFit = true;
				bg.forceResizeWidth = true;
				stackPanel.addControl(bg);

				const textBlock = new window.GUI.TextBlock();
				textBlock.text =  ${text};
				textBlock.color =  "${textColor}";
				textBlock.fontSize = ${size} * 10;
				textBlock.alpha = 1;
				textBlock.textWrapping =                                                                 window.GUI.TextWrapping.WordWrap;
				textBlock.resizeToFit = true;
				textBlock.forceResizeWidth = true;
				textBlock.paddingLeft = 50;
				textBlock.paddingRight = 50;
				 textBlock.paddingTop = 25;
				 textBlock.paddingBottom = 25;
				 textBlock.textVerticalAlignment = window.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align text to top
				 textBlock.textHorizontalAlignment = window.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER; // Align text to left
				bg.addControl(textBlock);   

				// Calculate the bounding box height of the mesh
				const boundingInfo = mesh.getBoundingInfo();
				const meshHeight = boundingInfo.boundingBox.maximumWorld.y - boundingInfo.boundingBox.minimumWorld.y;
				plane.position.y = meshHeight / 2 + 0.85;
				plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

				// Remove the text after the specified duration if duration is greater than 0
				if (${duration} * 1000 > 0) {
				  setTimeout(function() {
					stackPanel.removeControl(bg);
					bg.dispose();
					textBlock.dispose();
					resolve();
				  }, ${duration} * 1000);
				} else {
				  resolve();
				}
			  } else {
				resolve();
			  }
			} else {
			  console.error("Mesh is not defined.");
			  reject("Mesh is not defined.");
			}
		  });
		}

		if ("${asyncMode}" === "AWAIT") {
		  await new Promise((resolve, reject) => {
			window.whenModelReady(${meshVariable}, async function(mesh) {
			  try {
				await displayText(mesh);
				resolve();
			  } catch (error) {
				reject(error);
			  }
			});
		  });
		} else {
		  window.whenModelReady(${meshVariable}, function(mesh) {
			displayText(mesh);
		  });
		}
	  })();
	`;




  }


javascriptGenerator.forBlock['set_fog'] = function(block) {
  const fogColorHex = block.getFieldValue('FOG_COLOR');
  const fogMode = block.getFieldValue('FOG_MODE');
  const fogDensity = javascriptGenerator.valueToCode(block, 'FOG_DENSITY', javascriptGenerator.ORDER_ATOMIC) || '0.1'; // Default density

  // Convert hex color to RGB values for Babylon.js
  const fogColorRgb = `BABYLON.Color3.FromHexString('${fogColorHex}')`;

  // Generate the code for setting fog mode
  let fogModeCode = '';
  switch (fogMode) {
	case 'NONE':
	  fogModeCode = 'window.scene.fogMode = BABYLON.Scene.FOGMODE_NONE;\n';
	  break;
	case 'EXP':
	  fogModeCode = 'window.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;\n';
	  break;
	case 'EXP2':
	  fogModeCode = 'window.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;\n';
	  break;
	case 'LINEAR':
	  fogModeCode = 'window.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;\n';
	  break;
  }

  return `
  ${fogModeCode}
  window.scene.fogColor = ${fogColorRgb};
  window.scene.fogDensity = ${fogDensity};
  window.scene.fogStart = 50;
  window.scene.fogEnd = 100;
  `;
};



javascriptGenerator.forBlock['create_box'] = function(block) {
  const color = block.getFieldValue('COLOR');
  const width = getFieldValue(block, 'WIDTH', '1');
  const height = getFieldValue(block, 'HEIGHT', '1');
  const depth = getFieldValue(block, 'DEPTH', '1');
  const posX = getFieldValue(block, 'X', '0');
  const posY = getFieldValue(block, 'Y', '0');
  const posZ = getFieldValue(block, 'Z', '0');

  let variable_name =
	javascriptGenerator.nameDB_.getName(block.getFieldValue('ID_VAR'), Blockly.Names.NameType.VARIABLE);

  const boxId = `box_${generateUUID()}`;
  meshMap[boxId] = block;

  return `(function() {
	const newBox = BABYLON.MeshBuilder.CreateBox("${boxId}", {width: ${width}, height: ${height}, depth: ${depth}, scene: window.scene});
	newBox.position = new BABYLON.Vector3(${posX}, ${posY}, ${posZ});

	const boxBody = new BABYLON.PhysicsBody(newBox, BABYLON.PhysicsMotionType.STATIC, false, window.scene);

	const boxShape = new BABYLON.PhysicsShapeBox(
	  new BABYLON.Vector3(0, 0, 0),
	  new BABYLON.Quaternion(0, 0, 0, 1), 
	  new BABYLON.Vector3(${width}, ${height}, ${depth}),
	  window.scene
	);

	boxBody.setMassProperties({inertia: BABYLON.Vector3.ZeroReadOnly});

	boxBody.shape = boxShape;
	boxBody.setMassProperties({mass: 1, restitution: 0.5});

	//boxBody.setAngularDamping(1000);
	//boxBody.setLinearDamping(10);
	newBox.physics = boxBody;

	const material = new BABYLON.StandardMaterial("boxMaterial", window.scene);
	material.diffuseColor = BABYLON.Color3.FromHexString("${color}");
	newBox.material = material;
	${variable_name} = "${boxId}";
	\n
	})();
	`;

};

javascriptGenerator.forBlock['create_sphere'] = function(block) {
  const color = block.getFieldValue('COLOR');
  const diameterX = getFieldValue(block, 'DIAMETER_X', '1');
  const diameterY = getFieldValue(block, 'DIAMETER_Y', '1');
  const diameterZ = getFieldValue(block, 'DIAMETER_Z', '1');
  const posX = getFieldValue(block, 'X', '0');
  const posY = getFieldValue(block, 'Y', '0.5');
  const posZ = getFieldValue(block, 'Z', '0');
  const variableName = javascriptGenerator.nameDB_.getName(block.getFieldValue('ID_VAR'), Blockly.Names.NameType.VARIABLE);

  const sphereId = `sphere_${generateUUID()}`;
  meshMap[sphereId] = block;

  return `(function() {
	  const newSphere = BABYLON.MeshBuilder.CreateSphere("${sphereId}", {
	  diameterX: ${diameterX},
	  diameterY: ${diameterY},
	  diameterZ: ${diameterZ},
	  scene: window.scene
	  });
	  newSphere.position = new BABYLON.Vector3(${posX}, ${posY}, ${posZ});

	  const sphereBody = new BABYLON.PhysicsBody(newSphere, BABYLON.PhysicsMotionType.STATIC, false, window.scene);

	  const sphereShape = new BABYLON.PhysicsShapeSphere(
	  new BABYLON.Vector3(0, 0, 0),
	  Math.max(${diameterX}, ${diameterY}, ${diameterZ}) / 2, // Approximation for irregular diameters
	  window.scene
	  );

	  sphereBody.shape = sphereShape;
	  sphereBody.setMassProperties({mass: 1, restitution: 0.5});
	  sphereBody.setAngularDamping(100);
	  sphereBody.setLinearDamping(10);
	  newSphere.physics = sphereBody;

	  const material = new BABYLON.StandardMaterial("sphereMaterial", window.scene);
	  material.diffuseColor = BABYLON.Color3.FromHexString("${color}");
	  newSphere.material = material;
	  ${variableName} = "${sphereId}";
	  \n
	})();
	`;
};

javascriptGenerator.forBlock['create_plane'] = function(block) {
  const color = block.getFieldValue('COLOR');
  const width = getFieldValue(block, 'WIDTH', '1');
  const height = getFieldValue(block, 'HEIGHT', '1');
  const posX = getFieldValue(block, 'X', '0');
  const posY = getFieldValue(block, 'Y', '0');
  const posZ = getFieldValue(block, 'Z', '0');

  let variable_name = javascriptGenerator.nameDB_.getName(block.getFieldValue('ID_VAR'), Blockly.Names.NameType.VARIABLE);

  const planeId = `plane_${generateUUID()}`;
  meshMap[planeId] = block;

  return `(function() {
	  const newPlane = BABYLON.MeshBuilder.CreatePlane("${planeId}", {width: ${width}, height: ${height}, sideOrientation: BABYLON.Mesh.DOUBLESIDE, scene: window.scene});
	  newPlane.position = new BABYLON.Vector3(${posX}, ${posY}, ${posZ});

	  const material = new BABYLON.StandardMaterial("planeMaterial", scene);
	  material.diffuseColor = BABYLON.Color3.FromHexString("${color}");
	  newPlane.material = material;

	  // Assuming there's no need to set up physics for the plane, but if needed:
	  // Setup physics properties here if the plane also needs to interact physically

	  ${variable_name} = "${planeId}";
	})();`;
};


javascriptGenerator.forBlock['set_background_color'] = function(block) {
  const color = block.getFieldValue('COLOR');
  return `window.scene.clearColor = BABYLON.Color4.FromHexString("${color}FF");\n`;

};

javascriptGenerator.forBlock['move_by_vector'] = function(block) {

  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('BLOCK_NAME'), Blockly.Names.NameType.VARIABLE);

  const x = getFieldValue(block, 'X', '0');
  const y = getFieldValue(block, 'Y', '0');
  const z = getFieldValue(block, 'Z', '0');

  return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {\n` +
	`  
	mesh.position.addInPlace(new BABYLON.Vector3(${x}, ${y}, ${z}));
	mesh.physics.disablePreStep = false;
	mesh.physics.setTargetTransform(mesh.position, mesh.rotationQuaternion);

	// Optionally, force an immediate update if needed
	//mesh.physicsImpostor.forceUpdate();
	}
	else{
	console.log("Model not loaded:", ${modelName});
	}

	});\n`;
};


javascriptGenerator.forBlock['rotate_model_xyz'] = function(block) {
  const meshName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MODEL'), Blockly.Names.NameType.VARIABLE);

  const x = getFieldValue(block, 'X', '0');
  const y = getFieldValue(block, 'Y', '0');
  const z = getFieldValue(block, 'Z', '0');

  return `
	window.whenModelReady(${meshName}, function(mesh) {
	if (mesh) {

if(mesh.physics.getMotionType() != BABYLON.PhysicsMotionType.DYNAMIC){
mesh.physics.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
}

	const incrementalRotation = BABYLON.Quaternion.RotationYawPitchRoll(BABYLON.Tools.ToRadians(${y}), BABYLON.Tools.ToRadians(${x}), BABYLON.Tools.ToRadians(${z}));
	mesh.rotationQuaternion.multiplyInPlace(incrementalRotation).normalize();
	mesh.physics.disablePreStep = false;
	mesh.physics.setTargetTransform(mesh.absolutePosition, mesh.rotationQuaternion);
	//mesh.physics.setAngularVelocity(BABYLON.Vector3.Zero());

	} else {
	console.warn('Mesh named ' + ${meshName} + ' not found.');
	}
	});`;
};

javascriptGenerator.forBlock['on_each_update'] = function(block) {
  const branch = javascriptGenerator.statementToCode(block, 'DO');
  return 'window.scene.onBeforeRenderObservable.add(() => {\n' + branch + '});\n';
};

javascriptGenerator.forBlock['set_alpha'] = function(block) {
  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MESH'), Blockly.Names.NameType.VARIABLE);

  const alphaValue = javascriptGenerator.valueToCode(block, 'ALPHA', javascriptGenerator.ORDER_ATOMIC);

  const code = `let allMeshes = [mesh].concat(mesh.getChildMeshes(false));

	allMeshes.forEach(nextMesh => {
		if (nextMesh.material) {
		nextMesh.material.alpha = ${alphaValue};
		}
	  });`

  return wrapCode(modelName, code);

};

javascriptGenerator.forBlock['when_clicked'] = function(block) {

  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MODEL_VAR'), Blockly.Names.NameType.VARIABLE);

  const doCode = javascriptGenerator.statementToCode(block, 'DO');

  return `
	window.whenModelReady(${modelName}, function(_mesh) {

	if (_mesh) {
	console.log("Registering click action for", _mesh.name);

	 _mesh.actionManager = new BABYLON.ActionManager(window.scene);
	 //_mesh.actionManager.isRecursive = true;
	_mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function() {
	console.log("Model clicked:", _mesh.name);
	${doCode}
	}));


	} else {
	  console.log("No pickable parent or child found.");
	}
	});
	`;

};

// Mapping key names to key codes, including space
const keyCodeMap = {
  'SPACE': '32'
};

javascriptGenerator.forBlock['when_key_pressed'] = function(block) {
  const key = block.getFieldValue('KEY');
  const statements_do = javascriptGenerator.statementToCode(block, 'DO');

  const keyCode = keyCodeMap[key];

  return `
	window.scene.onKeyboardObservable.add((kbInfo) => {
	switch (kbInfo.type) {
	  case BABYLON.KeyboardEventTypes.KEYDOWN:
	  if (kbInfo.event.keyCode === ${keyCode}) {
		${statements_do}
	  }
	  break;
	}
	});
	`

};

javascriptGenerator.forBlock['when_key_released'] = function(block) {
  const key = block.getFieldValue('KEY');
  const statements_do = javascriptGenerator.statementToCode(block, 'DO');
  const keyCode = keyCodeMap[key];

  return `
	window.scene.onKeyboardObservable.add((kbInfo) => {
	switch (kbInfo.type) {
	  case BABYLON.KeyboardEventTypes.KEYUP:
	  if (kbInfo.event.keyCode === ${keyCode}) {
		${statements_do}
	  }
	  break;
	}
	});
	`

};


javascriptGenerator.forBlock['tint'] = function(block) {
  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MODEL_VAR'), Blockly.Names.NameType.VARIABLE);
  const color = block.getFieldValue('COLOR');

  return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
  if (mesh.material) {
  mesh.renderOverlay = true;
  mesh.overlayAlpha = 0.5;
  mesh.overlayColor = BABYLON.Color3.FromHexString("${color}");
  }
  mesh.getChildMeshes().forEach(function(childMesh) {
	if (childMesh.material) {
	childMesh.renderOverlay = true;
	childMesh.overlayAlpha = 0.5;
	childMesh.overlayColor = BABYLON.Color3.FromHexString("${color}");
	//console.log("Setting overlay color:", childMesh.name)
	}
  });

	}
	else{

	console.log("Model not loaded:", ${modelName});
	}

	});\n`;

};

javascriptGenerator.forBlock['highlight'] = function(block) {
  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MODEL_VAR'), Blockly.Names.NameType.VARIABLE);
  const color = block.getFieldValue('COLOR');

  return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {
  if (mesh.material){
  highlighter.addMesh(mesh, BABYLON.Color3.FromHexString("${color}"));
  }

  mesh.getChildMeshes().forEach(function(childMesh) {
	if (childMesh.material) {
	highlighter.addMesh(childMesh, BABYLON.Color3.FromHexString("${color}"));
	}
  });
	}
	else{

	console.log("Model not loaded:", ${modelName});
	}

	});\n`;
};

javascriptGenerator.forBlock['clear_effects'] = function(block) {
  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MODEL_VAR'), Blockly.Names.NameType.VARIABLE);

  return `window.whenModelReady(${modelName}, function(mesh) {
	if (mesh) {

	console.log("Removing effects");

	highlighter.removeMesh(mesh);
	mesh.renderOverlay = false;

	mesh.getChildMeshes().forEach(function(childMesh) {
	if (childMesh.material) {
	  highlighter.removeMesh(childMesh);
	}

	childMesh.renderOverlay = false;

	});
	}
	else{
	console.log("Model not loaded:", ${modelName});
	}

	});\n`;
};

javascriptGenerator.forBlock['move_forward'] = function(block) {

  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MODEL'), Blockly.Names.NameType.VARIABLE);
  const speed = javascriptGenerator.valueToCode(block, 'SPEED', javascriptGenerator.ORDER_ATOMIC) || '0';
  return `
	(function() {
	  const model = window.scene.getMeshByName(${modelName});
	  if (model) {

	  if (${speed} === 0){ return; }

	  const forwardSpeed = -${speed};  
	  const cameraForward = window.scene.activeCamera.getForwardRay().direction.normalize();

	  // Forward direction adjusted to move away from the camera
	  const moveDirection = cameraForward.scale(-forwardSpeed); 
	  const currentVelocity = model.physics.getLinearVelocity();
	  model.physics.setLinearVelocity(
		  new BABYLON.Vector3(
		  moveDirection.x,
		  currentVelocity.y,
		  moveDirection.z
		)
  );

  // Decide the facing direction based on whether steps is positive or negative
	let facingDirection;
	if (${speed} >= 0) {
	  // Face away from the camera when moving forward
	  facingDirection = new BABYLON.Vector3(-cameraForward.x, 0, -cameraForward.z).normalize();
	} else {
	  // Face towards the camera when moving backward
	  facingDirection = new BABYLON.Vector3(cameraForward.x, 0, cameraForward.z).normalize();
	}

	// Calculate the target rotation from the facing direction
	const targetRotation = BABYLON.Quaternion.FromLookDirectionLH(facingDirection, BABYLON.Vector3.Up());
	const currentRotation = model.rotationQuaternion;
	const deltaRotation = targetRotation.multiply(currentRotation.conjugate());
	const deltaEuler = deltaRotation.toEulerAngles();
	const scaledAngularVelocityY = new BABYLON.Vector3(0, deltaEuler.y * 5, 0); // Adjust the scalar as needed

	// Update angular velocity for rotation
	model.physics.setAngularVelocity(scaledAngularVelocityY);

	model.rotationQuaternion.x = 0;
	model.rotationQuaternion.z = 0;
	model.rotationQuaternion.normalize(); // Re-normalize the quaternion to maintain a valid rotation

  }

	})();
	`;

};

javascriptGenerator.forBlock['camera_follow'] = function(block) {
  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MESH_VAR'), Blockly.Names.NameType.VARIABLE);

  return `window.whenModelReady(${modelName}, function(mesh) {
	  if (mesh) {\n` +
	`  
  console.log("Attaching camera");

// Reset linear and angular velocity after physics render
window.scene.onAfterPhysicsObservable.add(() => {
  mesh.physics.setLinearVelocity(BABYLON.Vector3.Zero());
  mesh.physics.setAngularVelocity(BABYLON.Vector3.Zero());
});

	   const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 4, -20, mesh.position, window.scene);
	   camera.checkCollisions = true;

   // Adjust Beta limits to control the vertical angle
	camera.lowerBetaLimit = Math.PI / 2.5; // Lower angle
	camera.upperBetaLimit = Math.PI / 2; // Upper angle, prevent it from being too high
	  camera.lowerRadiusLimit = 2;
	  camera.upperRadiusLimit = 7;
	  // This targets the camera to scene origin
	  camera.setTarget(BABYLON.Vector3.Zero());
	  // This attaches the camera to the canvas
	  camera.attachControl(canvas, true);
	  camera.setTarget(mesh);
	  window.scene.activeCamera = camera;

	  }
	  else{
	   console.log("Model not loaded:", ${modelName});
	  }

	  });\n`;

};

javascriptGenerator.forBlock['add_physics'] = function(block) {
  const modelName = javascriptGenerator.nameDB_.getName(block.getFieldValue('MODEL_VAR'), Blockly.Names.NameType.VARIABLE);

  return `window.whenModelReady(${modelName}, function(mesh) {
	  if (mesh) {

		   mesh.physics.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
	  }
	  else{

	   console.log("Model not loaded:", ${modelName});
	  }

	  });\n`;
};


javascriptGenerator.forBlock['key_pressed'] = function(block) {
  const key = block.getFieldValue('KEY');
  // Code to check if the key is pressed
  let code;
  if (key === "ANY") {
	code = 'window.currentKeyPressed !== null';
  } else if (key === "NONE") {
	code = 'window.currentKeyPressed === null';
  } else {
	code = `window.currentKeyPressed === "${key}"`;
  }
  return [code, javascriptGenerator.ORDER_NONE];
};

const createScene = function() {
  window.scene = new BABYLON.Scene(engine);
  hk = new BABYLON.HavokPlugin(true, havokInstance);
  window.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), hk);
  highlighter = new BABYLON.HighlightLayer("highlighter", window.scene);
  gizmoManager = new BABYLON.GizmoManager(window.scene);

  const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 4, -20), window.scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);
  window.scene.createDefaultLight();
  window.scene.collisionsEnabled = true;

  const advancedTexture = window.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

  // Create a stack panel to hold the text lines
  const stackPanel = new window.GUI.StackPanel();
  stackPanel.isVertical = true;
  stackPanel.width = "100%";
  stackPanel.height = "100%";
  stackPanel.left = "0px";
  stackPanel.top = "0px";
  advancedTexture.addControl(stackPanel);

  // Function to print text with scrolling
  const textLines = []; // Array to keep track of text lines
  window.printText = function(text, duration, color) {
	if (text !== '') {
	  window.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

	  // Create a rectangle background
	  const bg = new window.GUI.Rectangle("textBackground");
	  bg.background = "rgba(255, 255, 255, 0.5)";
	  bg.adaptWidthToChildren = true; // Adjust width based on child elements
	  bg.adaptHeightToChildren = true; // Adjust height based on child elements
	  bg.cornerRadius = 2;
	  bg.thickness = 0; // Remove border
	  bg.horizontalAlignment = window.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
	  bg.verticalAlignment = window.GUI.Control.VERTICAL_ALIGNMENT_TOP;
	  bg.left = "5px"; // Position with some margin from left
	  bg.top = "5px"; // Position with some margin from top


	  // Create a text block
	  const textBlock = new window.GUI.TextBlock("textBlock", text);
	  textBlock.color = color;
	  textBlock.fontSize = "12";
	  textBlock.height = "20px";
	  textBlock.paddingLeft = "10px";
	  textBlock.paddingRight = "10px";
	  textBlock.paddingTop = "2px";
	  textBlock.paddingBottom = "2px";
	  textBlock.textVerticalAlignment = window.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align text to top
	  textBlock.textHorizontalAlignment = window.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Align text to left
	  textBlock.textWrapping = window.GUI.TextWrapping.WordWrap;
	  textBlock.resizeToFit = true;
	  textBlock.forceResizeWidth = true;

	  // Add the text block to the rectangle
	  bg.addControl(textBlock);

	  // Add the container to the stack panel
	  stackPanel.addControl(bg);
	  textLines.push(bg);

	  // Remove the text after the specified duration
	  setTimeout(() => {
		stackPanel.removeControl(bg);
		textLines.splice(textLines.indexOf(bg), 1);
	  }, duration * 1000);
	}
  };

  return window.scene;
};


async function initialize() {
  BABYLON.Database.IDBStorageEnabled = true
  BABYLON.Engine.CollisionsEpsilon = 0.00005;
  havokInstance = await HavokPhysics();
  engineReady = true;
  window.scene = createScene();

  engine.runRenderLoop(function() {
	window.scene.render();
  });
}

initialize();
const meshMap = {};

let nextVariableIndexes = {
  mesh: 1,
  box: 1,
  sphere: 1,
  plane: 1,
  text: 1
};

function initializeVariableIndexes() {

  nextVariableIndexes = {
	mesh: 1,
	box: 1,
	sphere: 1,
	plane: 1,
	text: 1
  };

  const workspace = Blockly.getMainWorkspace(); // Get the current Blockly workspace
  const allVariables = workspace.getAllVariables(); // Retrieve all variables in the workspace

  // Process each type of variable
  Object.keys(nextVariableIndexes).forEach(function(type) {
	let maxIndex = 0; // To keep track of the highest index used so far
	// Regular expression to match variable names like 'type1', 'type2', etc.
	const varPattern = new RegExp(`^${type}(\\d+)$`);

	allVariables.forEach(function(variable) {
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

window.addEventListener("resize", function() {
  engine.resize();
});

// Define your starter blocks XML string
const initialBlocks = `
  <xml xmlns="http://www.w3.org/1999/xhtml">
	<block type="start">
	<statement name="DO">
	  <block type="set_sky_color">
	  <next>
		<block type="create_ground">
		<next>
		  <block type="print_text">
		  <value name="TEXT">
			<shadow type="text">
			<field name="TEXT">🌈 Hello</field>
			</shadow>
		  </value>
		  <value name="DURATION">
			<shadow type="math_number">
			<field name="NUM">30</field>
			</shadow>
		  </value>
		  </block>
		</next>
		</block>
	  </next>
	  </block>
	</statement>
	</block>
  </xml>`;


// Convert the XML string to a DOM element
const xml = Blockly.utils.xml.textToDom(initialBlocks);

// Load the XML into the workspace
Blockly.Xml.domToWorkspace(xml, workspace);
executeCode();

function stripFilename(inputString) {

  const removeEnd = inputString.replace(/\(\d+\)/g, '');
  // Find the last occurrence of '/' or '\'
  let lastIndex = Math.max(removeEnd.lastIndexOf('/'), removeEnd.lastIndexOf('\\'));

  if (lastIndex === -1) {
	return removeEnd.trim();
  }

  return removeEnd.substring(lastIndex + 1).trim();
}


function exportCode() {

  const projectName = document.getElementById("projectName").value || "default_project";

  const json = Blockly.serialization.workspaces.save(workspace);
  const jsonString = JSON.stringify(json, null, 2); // Pretty-print the JSON

  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonString));
  element.setAttribute('download', projectName + '.json');

  document.body.appendChild(element); // Required for Firefox
  element.click();
  document.body.removeChild(element);
}


window.onload = function() {
  document.getElementById('fileInput').addEventListener('change', function(event) {
	const reader = new FileReader();
	reader.onload = function() {
	  const text = reader.result;
	  const json = JSON.parse(text);

	  // Set the project name as the value of the projectName input field
	  document.getElementById('projectName').value = stripFilename(document.getElementById('fileInput').value.replace('.json', ''));

	  Blockly.serialization.workspaces.load(json, workspace);
	  executeCode();

	};
	reader.readAsText(event.target.files[0]);

  });
}


function executeCode() {
  if (engineReady) {
	if (window.scene) window.scene.dispose();
	window.scene = createScene();
	const code = javascriptGenerator.workspaceToCode(workspace);
	try {
	  //eval(code);
	  new Function(`(async () => { ${code} })()`)();
	} catch (error) {
	  console.error("Error executing Blockly code:", error);
	}
  } else {
	// Check again in 100 milliseconds
	setTimeout(executeCode, 100);
  }
}

function toggleGizmo(gizmoType) {

  // Disable all gizmos
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.boundingBoxGizmoEnabled = false;

  // Enable the selected gizmo
  switch (gizmoType) {
	case 'position':
	  gizmoManager.positionGizmoEnabled = true;
	  gizmoManager.gizmos.positionGizmo.snapDistance = 0.1;
	  gizmoManager.gizmos.positionGizmo.updateGizmoPositionToMatchAttachedMesh = true;

	  gizmoManager.gizmos.positionGizmo.onDragStartObservable.add(function() {

		const mesh = gizmoManager.attachedMesh;
		const motionType = mesh.physics.getMotionType();
		mesh.savedMotionType = motionType;
		console.log(motionType);
		if (mesh.physics && mesh.physics.getMotionType() != BABYLON.PhysicsMotionType.STATIC) {
		  mesh.physics.setMotionType(BABYLON.PhysicsMotionType.STATIC);
		  mesh.physics.disablePreStep = false;
		}

		const block = meshMap[mesh.name];
		highlightBlockById(workspace, block)

	  });

	  gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(function() {

		// Retrieve the mesh associated with the position gizmo
		const mesh = gizmoManager.attachedMesh;
		if (mesh.savedMotionType) {
		  mesh.physics.setMotionType(mesh.savedMotionType);
		  mesh.physics.disablePreStep = true;
		  console.log("Restoring motion type", mesh.savedMotionType);
		}

		const block = meshMap[mesh.name];

		if (block) {
		  block.getInput("X").connection.targetBlock().setFieldValue(String(Math.round(mesh.position.x * 10) / 10), "NUM");
		  block.getInput("Y").connection.targetBlock().setFieldValue(String(Math.round(mesh.position.y * 10) / 10), "NUM");
		  block.getInput("Z").connection.targetBlock().setFieldValue(String(Math.round(mesh.position.z * 10) / 10), "NUM");
		}
	  });

	  break;
	case 'rotation':
	  gizmoManager.rotationGizmoEnabled = true;
	  break;
	case 'scale':
	  gizmoManager.scaleGizmoEnabled = true;
	  break;
	case 'boundingBox':
	  gizmoManager.boundingBoxGizmoEnabled = true;
	  break;
	default:
	  break;
  }
}

function turnOffAllGizmos() {
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.boundingBoxGizmoEnabled = false;
}

function highlightBlockById(workspace, block) {
  if (block) {
	block.select();
	workspace.scrollCenter(block.getRelativeToSurfaceXY().x, block.getRelativeToSurfaceXY().y);
  }
}

document.getElementById('fullscreenToggle').addEventListener('click', function() {
  if (!document.fullscreenElement) {
	// Go fullscreen
	if (document.documentElement.requestFullscreen) {
	  document.documentElement.requestFullscreen();
	} else if (document.documentElement.mozRequestFullScreen) { /* Firefox */
	  document.documentElement.mozRequestFullScreen();
	} else if (document.documentElement.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
	  document.documentElement.webkitRequestFullscreen();
	} else if (document.documentElement.msRequestFullscreen) { /* IE/Edge */
	  document.documentElement.msRequestFullscreen();
	}
  } else {
	// Exit fullscreen
	if (document.exitFullscreen) {
	  document.exitFullscreen();
	} else if (document.mozCancelFullScreen) { /* Firefox */
	  document.mozCancelFullScreen();
	} else if (document.webkitExitFullscreen) { /* Chrome, Safari & Opera */
	  document.webkitExitFullscreen();
	} else if (document.msExitFullscreen) { /* IE/Edge */
	  document.msExitFullscreen();
	}
  }
});

document.getElementById('toggleDebug').addEventListener('click', function() {
  if (window.scene.debugLayer.isVisible()) {
	document.getElementById('rightArea').style.width = '50%';
	document.getElementById('blocklyDiv').style.width = '50%';

	window.scene.debugLayer.hide();
  } else {
	document.getElementById('rightArea').style.width = '100%';
	document.getElementById('blocklyDiv').style.width = '0%';

	window.scene.debugLayer.show();

  }
});

window.currentKeyPressed = null;

document.addEventListener('keydown', function(event) {
  window.currentKeyPressed = event.code;
});

document.addEventListener('keyup', function(event) {
  window.currentKeyPressed = null;
});

async function exportBlockSnippet(block) {
  try {
	// Save the block and its children to a JSON object
	const blockJson = Blockly.serialization.blocks.save(block);

	// Convert the JSON object to a pretty-printed JSON string
	const jsonString = JSON.stringify(blockJson, null, 2);

	// Check if the File System Access API is available
	if ('showSaveFilePicker' in window) {
	  // Define the options for the file picker
	  const options = {
		suggestedName: 'blockly_snippet.json',
		types: [{
		  description: 'JSON Files',
		  accept: {
			'application/json': ['.json']
		  }
		}]
	  };

	  // Show the save file picker
	  const fileHandle = await window.showSaveFilePicker(options);

	  // Create a writable stream
	  const writable = await fileHandle.createWritable();

	  // Write the JSON string to the file
	  await writable.write(jsonString);

	  // Close the writable stream
	  await writable.close();
	} else {
	  // Fallback for browsers that don't support the File System Access API
	  const filename = prompt("Enter a filename for the snippet:", "blockly_snippet") || "blockly_snippet";
	  const blob = new Blob([jsonString], { type: 'application/json' });
	  const link = document.createElement('a');
	  link.href = URL.createObjectURL(blob);
	  link.download = `${filename}.json`;
	  link.click();
	}
  } catch (e) {
	console.error('Error exporting block:', e);
  }
}


// Function to handle file upload and import JSON snippet into workspace
function handleSnippetUpload(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function(event) {
	const jsonText = event.target.result;

	try {
	  const json = JSON.parse(jsonText);
	  Blockly.serialization.blocks.append(json, workspace);
	} catch (e) {
	  console.error("Error importing JSON:", e);
	}
  };
  reader.readAsText(file);
}

// Function to trigger file input for importing snippet
function importSnippet() {
  document.getElementById('importFile').click();
}

function addExportContextMenuOption() {
  Blockly.ContextMenuRegistry.registry.register({
	id: 'exportBlock',
	weight: 200,
	displayText: function() {
	  return 'Export block as JSON snippet';
	},
	preconditionFn: function(scope) {
	  return scope.block ? 'enabled' : 'hidden';
	},
	callback: function(scope) {
	  exportBlockSnippet(scope.block);
	},
	scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
	checkbox: false
  });
}

// Initialize Blockly and add custom context menu options
addExportContextMenuOption();


// Extend Blockly with custom context menu for importing snippets in the workspace
function addImportContextMenuOption() {
  Blockly.ContextMenuRegistry.registry.register({
	id: 'importSnippet',
	weight: 100,
	displayText: function() {
	  return 'Import snippet';
	},
	preconditionFn: function(scope) {
	  return 'enabled';
	},
	callback: function(scope) {
	  importSnippet();
	},
	scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
	checkbox: false
  });
}


addImportContextMenuOption();

window.executeCode = executeCode;

