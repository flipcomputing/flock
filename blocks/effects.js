import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { getHelpUrlFor } from "../blocks.js";
import {
	translate,
	getTooltip,
	getDropdownOption,
} from "../main/translation.js";

export function defineEffectsBlocks() {
	Blockly.Blocks["light_intensity"] = {
		init: function () {
			this.jsonInit({
				type: "light_intensity",
				message0: translate("light_intensity"),
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
				tooltip: getTooltip("light_intensity"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
		},
	};

	Blockly.Blocks["hemispheric_light"] = {
		init: function () {
			this.jsonInit({
				type: "hemispheric_light",
				message0: translate("hemispheric_light"),
				args0: [
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
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Scene"],
				tooltip: getTooltip("hemispheric_light"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
		},
	};

	Blockly.Blocks["set_fog"] = {
		init: function () {
			this.jsonInit({
				type: "set_fog",
				message0: translate("set_fog"),
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
							getDropdownOption("LINEAR"),
							getDropdownOption("NONE"),
							getDropdownOption("EXP"),
							getDropdownOption("EXP2"),
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
				tooltip: getTooltip("set_fog"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle("scene_blocks");
		},
	};
}
