import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	getHelpUrlFor,
} from "../blocks.js";

export function defineEffectsBlocks() {
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
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
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
				tooltip: "Configure the scene's fog.\nKeyword: fog",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};
}
