import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	getHelpUrlFor,
} from "../blocks.js";

export function defineControlBlocks() {
	  Blockly.Blocks["wait"] = {
		init: function () {
		  this.jsonInit({
			type: "wait",
			message0: "wait %1 ms",
			args0: [
			  {
				type: "input_value",
				name: "DURATION",
				check: "Number",
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Control"],
			tooltip: "Wait for a specified time in milliseconds.\nKeyword: milli",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["wait_seconds"] = {
		init: function () {
		  this.jsonInit({
			type: "wait",
			message0: "wait %1 seconds",
			args0: [
			  {
				type: "input_value",
				name: "DURATION",
				check: "Number",
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Control"],
			tooltip: "Wait for a specified time in seconds.\nKeyword: wait",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["wait_until"] = {
		init: function () {
		  this.jsonInit({
			type: "wait_until",
			message0: "wait until %1",
			args0: [
			  {
				type: "input_value",
				name: "CONDITION",
				check: "Boolean",
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Control"],
			tooltip: "Wait until the condition is true.\nKeyword:until",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["local_variable"] = {
		init: function () {
		  this.jsonInit({
		  type: "local_variable",
		  message0: "local %1",
		  args0: [
			{
			type: "field_variable",
			name: "VAR",
			variable: "item", // default variable name
			},
		  ],
		  previousStatement: null,
		  nextStatement: null,
		  colour: categoryColours["Control"],
		  tooltip: "Create a local version of a selected variable. This hides the global variable and can have a different value. \nKeyword: local",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
		};
}
