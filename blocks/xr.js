import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	getHelpUrlFor,
} from "../blocks.js";
import { translate, getTooltip, getDropdownOption } from "../main/translation.js";

export function defineXRBlocks() {
	  Blockly.Blocks["device_camera_background"] = {
		init: function () {
		  this.jsonInit({
			type: "device_camera_background",
			message0: translate("device_camera_background"),
			args0: [
			  {
				type: "field_dropdown",
				name: "CAMERA",
				options: [
				  getDropdownOption("user"),
				  getDropdownOption("environment"),
				],
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Scene"],
			tooltip: getTooltip("device_camera_background"),
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["set_xr_mode"] = {
		init: function () {
		  this.jsonInit({
			type: "set_xr_mode",
			message0: translate("set_xr_mode"),
			args0: [
			  {
				type: "field_dropdown",
				name: "MODE",
				options: [
				  getDropdownOption("VR"),
				  getDropdownOption("AR"),
				  getDropdownOption("MAGIC_WINDOW"),
				],
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Scene"],
			tooltip: getTooltip("set_xr_mode"),
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };
}

