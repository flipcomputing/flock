import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
	getHelpUrlFor,
	addToggleButton,
	mutationToDom,
	domToMutation,
	inlineIcon,
	updateShape,
} from "../blocks.js";

export function defineEventsBlocks() {
	Blockly.Blocks["start"] = {
		init: function () {
			this.jsonInit({
				type: "start",
				message0: "start",
				message1: "%1",
				args1: [
					{
						type: "input_statement",
						name: "DO",
					},
				],
				colour: categoryColours["Events"],
				inputsInline: true,
				tooltip:
					"Run the blocks inside when the project starts. You can have multiple start blocks. \nKeyword: start",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},
	};

	// Define the forever block
	Blockly.Blocks["forever"] = {
		init: function () {
			this.jsonInit({
				type: "forever",
				message0: "forever\n%1",
				args0: [
					{
						type: "input_statement",
						name: "DO",
						check: null,
					},
				],
				colour: categoryColours["Events"],
				tooltip:
					"Run the blocks inside every frame or when the previous iteration finishes. \nKeyword: forever",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.isInline = false;
			addToggleButton(this);
		},
		mutationToDom: function () {
			return mutationToDom(this);
		},
		domToMutation: function (xmlElement) {
			domToMutation(this, xmlElement);
		},
		updateShape_: function (isInline) {
			updateShape(this, isInline);
		},
		toggleDoBlock: function () {
			const isInline = !this.isInline;

			if (!isInline) {
				this.unplug(true); // Ensures the block is disconnected when toggled to top-level
			}

			this.updateShape_(isInline);

			// Optional: Re-enable the block if it was disabled
			if (
				this.hasDisabledReason &&
				this.hasDisabledReason("ORPHANED_BLOCK")
			) {
				this.setDisabledReason(false, "ORPHANED_BLOCK");
			}

			Blockly.Events.fire(
				new Blockly.Events.BlockChange(this, "mutation", null, "", ""),
			);
			Blockly.Events.fire(new Blockly.Events.BlockMove(this));
		},
	};

	Blockly.Blocks["when_clicked"] = {
		init: function () {
			this.jsonInit({
				type: "when_clicked",
				message0: "when %1 %2",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
					{
						type: "field_dropdown",
						name: "TRIGGER",
						options: [
							["interact", "OnLeftPickTrigger"],
							["double interact", "OnDoublePickTrigger"],
							["interact start", "OnPickDownTrigger"],
							["interact end", "OnPickUpTrigger"],
						],
					},
					/*{
							type: "field_dropdown",
							name: "MODE",
							options: [
								["wait", "wait"],
								["once", "once"],
								["every", "every"],
							],
						},*/
				],
				message1: "%1",
				implicitAlign1: "LEFT",
				args1: [
					{
						type: "input_statement",
						name: "DO",
					},
				],
				colour: categoryColours["Events"],
				tooltip:
					"Run the blocks inside when the mesh trigger occurs.\nKeyword: click",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));

			// Default to top-level mode
			this.isInline = false;
			this.setPreviousStatement(false);
			this.setNextStatement(false);

			// Add inline toggle button
			const toggleButton = new Blockly.FieldImage(
				inlineIcon,
				30,
				30,
				"*",
				() => {
					this.toggleDoBlock();
				},
			);

			// Add toggle button to a separate input
			const input = this.appendDummyInput()
				.setAlign(Blockly.inputs.Align.RIGHT) // Align toggle button to the right
				.appendField(toggleButton, "TOGGLE_BUTTON");
		},

		mutationToDom: function () {
			const container = document.createElement("mutation");
			container.setAttribute("inline", this.isInline);
			return container;
		},

		domToMutation: function (xmlElement) {
			const isInline =
				xmlElement.getAttribute("inline") === "true" || false;
			this.updateShape_(isInline);
		},

		updateShape_: function (isInline) {
			this.isInline = isInline;

			if (isInline) {
				this.setPreviousStatement(true);
				this.setNextStatement(true);
			} else {
				this.setPreviousStatement(false);
				this.setNextStatement(false);
			}
		},

		toggleDoBlock: function () {
			const isInline = !this.isInline;

			if (!isInline) {
				this.unplug(true); // Disconnect blocks when switching to top-level
			}

			this.updateShape_(isInline);

			if (this.hasDisabledReason("ORPHANED_BLOCK")) {
				this.setDisabledReason(false, "ORPHANED_BLOCK");
			}

			Blockly.Events.fire(
				new Blockly.Events.BlockChange(this, "mutation", null, "", ""),
			);

			Blockly.Events.fire(new Blockly.Events.BlockMove(this));
		},
	};

	Blockly.Blocks["on_collision"] = {
		init: function () {
			this.jsonInit({
				type: "when_touches",
				message0: "on %1 collision %2 %3",
				args0: [
					{
						type: "field_variable",
						name: "MODEL_VAR",
						variable: window.currentMesh,
					},
					{
						type: "field_dropdown",
						name: "TRIGGER",
						options: [
							["enter", "OnIntersectionEnterTrigger"],
							["exit", "OnIntersectionExitTrigger"],
						],
					},
					{
						type: "field_variable",
						name: "OTHER_MODEL_VAR",
						variable: "mesh2",
					},
				],
				message1: "%1",
				args1: [
					{
						type: "input_statement",
						name: "DO",
					},
				],
				colour: categoryColours["Events"],
				tooltip:
					"Execute the blocks inside when the mesh intersects or no longer intersects with another mesh.\nKeyword: collide",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			// Set default state to top-level block
			this.isInline = false;

			// Add the toggle button
			const toggleButton = new Blockly.FieldImage(
				inlineIcon, // Custom icon
				30,
				30,
				"*", // Width, Height, Alt text
				() => {
					this.toggleDoBlock();
				},
			);

			// Append the toggle button to the block
			this.appendDummyInput()
				.setAlign(Blockly.inputs.Align.RIGHT)
				.appendField(toggleButton, "TOGGLE_BUTTON");
		},
		mutationToDom: function () {
			const container = document.createElement("mutation");
			container.setAttribute("inline", this.isInline);
			return container;
		},
		domToMutation: function (xmlElement) {
			const isInline = xmlElement.getAttribute("inline") === "true";
			this.updateShape_(isInline);
		},
		updateShape_: function (isInline) {
			this.isInline = isInline;
			if (isInline) {
				this.setPreviousStatement(true);
				this.setNextStatement(true);
			} else {
				this.setPreviousStatement(false);
				this.setNextStatement(false);
			}
		},
		toggleDoBlock: function () {
			const isInline = !this.isInline;

			if (!isInline) {
				this.unplug(true); // Ensures the block is disconnected when toggled to top-level
			}

			this.updateShape_(isInline);

			// Optional: Re-enable the block if it was disabled
			if (
				this.hasDisabledReason &&
				this.hasDisabledReason("ORPHANED_BLOCK")
			) {
				this.setDisabledReason(false, "ORPHANED_BLOCK");
			}

			Blockly.Events.fire(
				new Blockly.Events.BlockChange(this, "mutation", null, "", ""),
			);
			Blockly.Events.fire(new Blockly.Events.BlockMove(this));
		},
	};

	// For backward compatibility
	Blockly.Blocks["when_touches"] = Blockly.Blocks["on_collision"];

	Blockly.Blocks["when_key_event"] = {
		init: function () {
			this.jsonInit({
				type: "when_key_event",
				message0: "when key %1 %2",
				args0: [
					{
						type: "field_grid_dropdown",
						name: "KEY",
						columns: 10,
						options: [
							["0", "0"],
							["1", "1"],
							["2", "2"],
							["3", "3"],
							["4", "4"],
							["5", "5"],
							["6", "6"],
							["7", "7"],
							["8", "8"],
							["9", "9"],
							["A", "a"],
							["B", "b"],
							["C", "c"],
							["C", "d"],
							["E", "e"],
							["F", "f"],
							["G", "g"],
							["H", "h"],
							["I", "i"],
							["J", "j"],
							["K", "k"],
							["L", "l"],
							["M", "m"],
							["N", "n"],
							["O", "o"],
							["P", "p"],
							["Q", "q"],
							["R", "r"],
							["S", "s"],
							["T", "t"],
							["U", "u"],
							["V", "v"],
							["W", "w"],
							["X", "x"],
							["Y", "y"],
							["Z", "z"],
							[" ", " "],
							[",", ","],
							[".", "."],
							["/", "/"],
							["⯇", "ArrowLeft"],
							["⯅", "ArrowUp"],
							["⯈", "ArrowRight"],
							["⯆", "ArrowDown"],
						],
					},
					{
						type: "field_dropdown",
						name: "EVENT",
						options: [
							["pressed", "pressed"],
							["released", "released"],
						],
					},
				],
				message1: "%1",
				args1: [
					{
						type: "input_statement",
						name: "DO",
					},
				],
				colour: categoryColours["Events"],
				tooltip:
					"Execute the blocks inside when the specified key is pressed or released.",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			addToggleButton(this);
		},
		mutationToDom: function () {
			return mutationToDom(this);
		},
		domToMutation: function (xmlElement) {
			domToMutation(this, xmlElement);
		},
		updateShape_: function (isInline) {
			updateShape(this, isInline);
		},
		toggleDoBlock: function () {
			const isInline = !this.isInline;

			if (!isInline) {
				this.unplug(true); // Ensures the block is disconnected when toggled to top-level
			}

			this.updateShape_(isInline);

			// Optional: Re-enable the block if it was disabled
			if (
				this.hasDisabledReason &&
				this.hasDisabledReason("ORPHANED_BLOCK")
			) {
				this.setDisabledReason(false, "ORPHANED_BLOCK");
			}

			Blockly.Events.fire(
				new Blockly.Events.BlockChange(this, "mutation", null, "", ""),
			);
			Blockly.Events.fire(new Blockly.Events.BlockMove(this));
		},
	};

	function getEventNameValidationError(name) {
		if (!name || typeof name !== "string") {
			return "Event name must be a valid string.";
		}

		if (name.length > 30) {
			return "Event name must be 30 characters or fewer.";
		}

		const lower = name.toLowerCase();
		const reservedPrefixes = [
			"_",
			"on",
			"system",
			"internal",
			"babylon",
			"flock",
		];
		if (reservedPrefixes.some((prefix) => lower.startsWith(prefix))) {
			return "Event name must not start with reserved words like 'on', 'system', or 'flock'.";
		}

		const disallowedChars = /[!@#\$%\^&\*\(\)\+=\[\]\{\};:'"\\|,<>\?\/\n\r\t]/;
		if (disallowedChars.test(name)) {
			return "Event name must not include punctuation or special characters.";
		}

		return null; // valid
	}
	
	Blockly.Blocks["broadcast_event"] = {
		init: function () {
			this.jsonInit({
				type: "broadcast_event",
				message0: "broadcast event %1",
				args0: [
					{
						type: "input_value",
						name: "EVENT_NAME",
						check: "String",
					},
				],
				previousStatement: null,
				nextStatement: null,
				colour: categoryColours["Events"],
				tooltip:
					"Broadcast an event that is received by on event.\nKeyword: broadcast",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
		},

		/** Called whenever anything changes */
		onchange: function () {
			if (!this.workspace || this.isInFlyout) return;

			const inputBlock = this.getInputTargetBlock("EVENT_NAME");

			if (inputBlock && inputBlock.type === "text") {
				const value = inputBlock.getFieldValue("TEXT");
				const error = getEventNameValidationError(value);

				if (error) {
					this.setWarningText(error);
				} else {
					this.setWarningText(null);
				}
			} else {
				this.setWarningText(null);
			}
		},
	};

	Blockly.Blocks["on_event"] = {
		init: function () {
			this.jsonInit({
				type: "on_event",
				message0: "on event %1",
				args0: [
					{
						type: "input_value",
						name: "EVENT_NAME",
						check: "String",
					},
				],
				message1: "%1",
				args1: [
					{
						type: "input_statement",
						name: "DO",
					},
				],
				colour: categoryColours["Events"],
				tooltip: "Run code when a broadcast event is received.\nKeyword: on",
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			addToggleButton(this);
		},
		mutationToDom: function () {
			return mutationToDom(this);
		},
		domToMutation: function (xmlElement) {
			domToMutation(this, xmlElement);
		},
		updateShape_: function (isInline) {
			updateShape(this, isInline);
		},
		toggleDoBlock: function () {
			const isInline = !this.isInline;

			if (!isInline) {
				this.unplug(true); // Ensures the block is disconnected when toggled to top-level
			}

			this.updateShape_(isInline);

			// Optional: Re-enable the block if it was disabled
			if (
				this.hasDisabledReason &&
				this.hasDisabledReason("ORPHANED_BLOCK")
			) {
				this.setDisabledReason(false, "ORPHANED_BLOCK");
			}

			Blockly.Events.fire(
				new Blockly.Events.BlockChange(this, "mutation", null, "", ""),
			);
			Blockly.Events.fire(new Blockly.Events.BlockMove(this));
		},
		onchange: function () {
			if (!this.workspace || this.isInFlyout) return;

			const inputBlock = this.getInputTargetBlock("EVENT_NAME");

			if (inputBlock && inputBlock.type === "text") {
				const value = inputBlock.getFieldValue("TEXT");
				const error = getEventNameValidationError(value);

				if (error) {
					this.setWarningText(error);
				} else {
					this.setWarningText(null);
				}
			} else {
				this.setWarningText(null);
			}
		},
	};
}
