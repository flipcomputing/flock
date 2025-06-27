import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { getHelpUrlFor } from "../blocks.js";

export function defineConditionBlocks() {
	Blockly.Blocks["controls_if"] = Blockly.Blocks["dynamic_if"];

	const oldInit = Blockly.Blocks["controls_if"].init;

	  Blockly.Blocks["controls_if"].init = function () {
		this.setHelpUrl(getHelpUrlFor(this.type));
		// Call the original init function
		oldInit.call(this);

		// Override the tooltip after the original init
		this.setTooltip(() => {
		  let tooltip = "Execute actions if a condition is true.";

		  tooltip += ` Drag additional conditions to create else if branches.`;

		  tooltip += " Drag a statement at the end to create an else branch.";

		  return tooltip;
		});
	  };

}
