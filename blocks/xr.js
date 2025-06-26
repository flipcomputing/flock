import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	getHelpUrlFor,
} from "../blocks.js";

export function defineXRBlocks() {
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
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
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
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };
}
