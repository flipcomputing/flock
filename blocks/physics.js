import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	getHelpUrlFor,
} from "../blocks.js";

export function definePhysicsBlocks() {
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
			  "Add physics to the mesh. Options are dynamic, static, animated and none.\nKeyword:physics",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
			  "Add a physics shape to the mesh. Options are mesh or capsule.\nKeyword:physics",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["apply_force"] = {
		init: function () {
		  this.jsonInit({
			type: "apply_force",
			message0: "apply force to %1 x: %2 y: %3 z: %4",
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
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

}
