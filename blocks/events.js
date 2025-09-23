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
import { translate, getTooltip, getDropdownOption } from "../main/translation.js";

export function defineEventsBlocks() {
	function handleCaseWhereSnippetLoadedFromToolbox(currentBlock, changeEvent) {
		let changeEventBlockIsCurrentBlock = Blockly.getMainWorkspace().getBlockById(changeEvent.blockId) === currentBlock;

		let createNewCreateEvent = (block, event) => {
			let newEvent = new Blockly.Events.BlockCreate();
			newEvent.blockId = block.id;
			newEvent.group = event.group;
			newEvent.isBlank = false;
			newEvent.isUiEvent = false;
			newEvent.recordUndo = true;
			// newEvent.type = Blockly.Events.BLOCK_CREATE;
			if (block.type === "load_character") {
				
			}
			newEvent.workspaceId = event.workspaceId;
			return newEvent;
		};

		let fireNewEventOnAllChildBlocks = (block, event) => {
			let newEvent = createNewCreateEvent(block, event);
			if (block.id !== currentBlock.id) Blockly.Events.fire(newEvent);
			let subBlocks = block.getChildren();
			if (subBlocks.length > 0) subBlocks.forEach(subBlock => fireNewEventOnAllChildBlocks(subBlock, event));
		}

		if (flock.blockDebug && changeEventBlockIsCurrentBlock)
			console.log(changeEvent.type);

		let blocks = currentBlock.getDescendants();

		if (
			blocks.length > 0
			&& changeEventBlockIsCurrentBlock
			&& changeEvent.type === Blockly.Events.BLOCK_MOVE
		) {
			blocks.forEach(block => fireNewEventOnAllChildBlocks(block, changeEvent));
		}
	}

	Blockly.Blocks["start"] = {
		init: function () {
			this.jsonInit({
				type: "start",
				message0: translate("start"),
				message1: "%1",
				args1: [
					{
						type: "input_statement",
						name: "DO",
					},
				],
				colour: categoryColours["Events"],
				inputsInline: true,
				tooltip: getTooltip("start"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('events_blocks');
			this.setOnChange((changeEvent) => handleCaseWhereSnippetLoadedFromToolbox(this, changeEvent));
		},
	};

	// Define the forever block
	Blockly.Blocks["forever"] = {
		init: function () {
			this.jsonInit({
				type: "forever",
				message0: translate("forever"),
				args0: [
					{
						type: "input_statement",
						name: "DO",
						check: null,
					},
				],
				colour: categoryColours["Events"],
				tooltip: getTooltip("forever"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('events_blocks');
			this.setOnChange((changeEvent) => handleCaseWhereSnippetLoadedFromToolbox(this, changeEvent));
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
				message0: translate("when_clicked"),
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
							getDropdownOption("OnPickTrigger"),
							getDropdownOption("OnLeftPickTrigger"),
							getDropdownOption("OnDoublePickTrigger"),
							getDropdownOption("OnPickDownTrigger"),
							getDropdownOption("OnPickUpTrigger"),
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
				tooltip: getTooltip("when_clicked"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('events_blocks');
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
				message0: translate("on_collision"),
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
							getDropdownOption("OnIntersectionEnterTrigger"),
							getDropdownOption("OnIntersectionExitTrigger"),
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
				tooltip: getTooltip("on_collision"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('events_blocks');
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
				message0: translate("when_key_event"),
				args0: [
					{
						type: "field_grid_dropdown",
						name: "KEY",
						columns: 10,
						options: [
							getDropdownOption("0"),
							getDropdownOption("1"),
							getDropdownOption("2"),
							getDropdownOption("3"),
							getDropdownOption("4"),
							getDropdownOption("5"),
							getDropdownOption("6"),
							getDropdownOption("7"),
							getDropdownOption("8"),
							getDropdownOption("9"),
							getDropdownOption("a"),
							getDropdownOption("b"),
							getDropdownOption("c"),
							getDropdownOption("d"),
							getDropdownOption("e"),
							getDropdownOption("f"),
							getDropdownOption("g"),
							getDropdownOption("h"),
							getDropdownOption("i"),
							getDropdownOption("j"),
							getDropdownOption("k"),
							getDropdownOption("l"),
							getDropdownOption("m"),
							getDropdownOption("n"),
							getDropdownOption("o"),
							getDropdownOption("p"),
							getDropdownOption("q"),
							getDropdownOption("r"),
							getDropdownOption("s"),
							getDropdownOption("t"),
							getDropdownOption("u"),
							getDropdownOption("v"),
							getDropdownOption("w"),
							getDropdownOption("x"),
							getDropdownOption("y"),
							getDropdownOption("z"),
							getDropdownOption(" "),
							getDropdownOption(","),
							getDropdownOption("."),
							getDropdownOption("/"),
							getDropdownOption("ArrowLeft"),
							getDropdownOption("ArrowUp"),
							getDropdownOption("ArrowRight"),
							getDropdownOption("ArrowDown"),
						],
					},
					{
						type: "field_dropdown",
						name: "EVENT",
						options: [
							getDropdownOption("pressed"),
							getDropdownOption("released"),
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
				tooltip: getTooltip("when_key_event"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('events_blocks');
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

		const disallowedChars =
			/[!@#\$%\^&\*\(\)\+=\[\]\{\};:'"\\|,<>\?\/\n\r\t]/;
		if (disallowedChars.test(name)) {
			return "Event name must not include punctuation or special characters.";
		}

		return null; // valid
	}

	Blockly.Blocks["broadcast_event"] = {
		init: function () {
			this.jsonInit({
				type: "broadcast_event",
				message0: translate("broadcast_event"),
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
				tooltip: getTooltip("broadcast_event"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('events_blocks');
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
				message0: translate("on_event"),
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
				tooltip: getTooltip("on_event"),
			});
			this.setHelpUrl(getHelpUrlFor(this.type));
			this.setStyle('events_blocks');
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

