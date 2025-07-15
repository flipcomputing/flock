import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	getHelpUrlFor,
} from "../blocks.js";
import { translate, getTooltip, getDropdownOption } from "../main/translation.js";

export function defineCameraBlocks() {
	Blockly.Blocks["camera_control"] = {
		init: function () {
			this.jsonInit({
				type: "camera_control",
				message0: translate("camera_control"),
				args0: [
					{
						type: "field_dropdown",
						name: "ACTION",
						options: [
							getDropdownOption("rotateLeft"),
							getDropdownOption("rotateRight"),
							getDropdownOption("rotateUp"),
							getDropdownOption("rotateDown"),
							getDropdownOption("moveUp"),
							getDropdownOption("moveDown"),
							getDropdownOption("moveLeft"),
							getDropdownOption("moveRight"),
						],
					},
					{
						type: "field_dropdown",
						name: "KEY",
						options: [
							getDropdownOption("65"), // A key
							getDropdownOption("68"), // D key
							getDropdownOption("87"), // W key
							getDropdownOption("83"), // S key
							getDropdownOption("81"), // Q key
							getDropdownOption("69"), // E key
							getDropdownOption("70"), // F key
							getDropdownOption("32"), // Space key
							getDropdownOption("38"), // Up arrow key
							getDropdownOption("40"), // Down arrow key
							getDropdownOption("37"), // Left arrow key
							getDropdownOption("39"), // Right arrow key
						],
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("camera_control"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["camera_follow"] = {
		init: function () {
			this.jsonInit({
				type: "camera_follow",
				message0: translate("camera_follow"),
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
					{
						type: "field_checkbox",
						name: "FRONT",
						checked: false,
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("camera_follow"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["get_camera"] = {
		init: function () {
			this.jsonInit({
				type: "get_camera",
				message0: translate("get_camera"),
				args0: [
					{
						type: "field_variable",
						name: "VAR",
						variable: "camera", // Default variable is 'camera'
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("get_camera"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};
}

