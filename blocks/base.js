import * as Blockly from "blockly";
import { categoryColours} from "../toolbox.js";

window.currentMesh = "mesh";
window.currentBlock = null;

export function defineBaseBlocks() {
	Blockly.Blocks["vector"] = {
		init: function () {
			this.jsonInit({
				type: "vector",
				message0: "x: %1 y: %2 z: %3",
				args0: [
					{ type: "input_value", name: "X", check: "Number" },
					{ type: "input_value", name: "Y", check: "Number" },
					{ type: "input_value", name: "Z", check: "Number" },
				],
				inputsInline: true,
				output: "Vector",
				colour: categoryColours["Transform"],
				tooltip: "Creates a vector with X, Y, Z coordinates",
				helpUrl: "",
			});
		},
	};
}