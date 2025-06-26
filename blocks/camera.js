import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	getHelpUrlFor,
} from "../blocks.js";

export function defineCameraBlocks() {
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
				colour: categoryColours["Scene"],
				tooltip: "Bind a specific key to a camera control action.",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	Blockly.Blocks["camera_follow"] = {
		init: function () {
			this.jsonInit({
				type: "camera_follow",
				message0: "camera follow %1 with radius %2 front %3",
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
				tooltip:
					"Make the camera follow a mesh with a customizable distance (radius) from the target.\nKeyword: follow",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
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
				colour: categoryColours["Scene"],
				tooltip: "Get the current scene camera",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};
}
