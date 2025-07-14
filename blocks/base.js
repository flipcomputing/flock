import * as Blockly from "blockly";
import { categoryColours} from "../toolbox.js";
import { translate, getTooltip } from "../main/translation.js";

window.currentMesh = "mesh";
window.currentBlock = null;

export function defineBaseBlocks() {
	Blockly.Blocks["xyz"] = {
		init: function () {
			this.jsonInit({
				type: "xyz",
				message0: translate("xyz"),
				args0: [
					{ type: "input_value", name: "X", check: "Number" },
					{ type: "input_value", name: "Y", check: "Number" },
					{ type: "input_value", name: "Z", check: "Number" },
				],
				inputsInline: true,
				output: "Vector",
				colour: categoryColours["Transform"],
				tooltip: getTooltip("xyz"),
				helpUrl: "",
			});
		},
	};
}
