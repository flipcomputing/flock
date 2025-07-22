import * as Blockly from "blockly";
//import { KeyboardNavigation } from "@blockly/keyboard-navigation";
import { javascriptGenerator } from "blockly/javascript";
import { FieldGridDropdown } from "@blockly/field-grid-dropdown";
import { WorkspaceSearch } from "@blockly/plugin-workspace-search";
import * as BlockDynamicConnection from "@blockly/block-dynamic-connection";
import { CrossTabCopyPaste } from "@blockly/plugin-cross-tab-copy-paste";
import { initializeTheme } from "./themes.js";
import {
	options,
	defineBlocks,
	initializeVariableIndexes,
	handleBlockSelect,
	handleBlockDelete,
	CustomZelosRenderer,
} from "../blocks";
import { defineBaseBlocks } from "../blocks/base";
import { defineShapeBlocks } from "../blocks/shapes";
import { defineSceneBlocks } from "../blocks/scene.js";
import { defineModelBlocks } from "../blocks/models.js";
import { defineEffectsBlocks } from "../blocks/effects.js";
import { defineCameraBlocks } from "../blocks/camera.js";
import { defineXRBlocks } from "../blocks/xr.js";
import { defineEventsBlocks } from "../blocks/events.js";
import { definePhysicsBlocks } from "../blocks/physics.js";
import { defineConnectBlocks } from "../blocks/connect.js";
import { defineCombineBlocks } from "../blocks/combine.js";
import { defineTransformBlocks } from "../blocks/transform.js";
import { defineControlBlocks } from "../blocks/control.js";
import { defineConditionBlocks } from "../blocks/condition.js";
import { defineAnimateBlocks } from "../blocks/animate.js";
import { defineSoundBlocks } from "../blocks/sound.js";
import { defineMaterialsBlocks } from "../blocks/materials.js";
import { defineSensingBlocks } from "../blocks/sensing.js";
import { defineTextBlocks } from "../blocks/text.js";
import { defineGenerators } from "../generators";

let workspace = null;
export { workspace };

export function initializeBlocks() {
	defineBaseBlocks();
	defineBlocks();
	defineSceneBlocks();
	defineModelBlocks();
	defineShapeBlocks();
	defineEffectsBlocks();
	defineCameraBlocks();
	defineXRBlocks();
	defineEventsBlocks();
	definePhysicsBlocks();
	defineConnectBlocks();
	defineCombineBlocks();
	defineTransformBlocks();
	defineControlBlocks();
	defineConditionBlocks();
	defineAnimateBlocks();
	defineSoundBlocks();
	defineMaterialsBlocks();
	defineSensingBlocks();
	defineTextBlocks();
	defineGenerators();
}

Blockly.utils.colour.setHsvSaturation(0.3); // 0 (inclusive) to 1 (exclusive), defaulting to 0.45
Blockly.utils.colour.setHsvValue(0.85); // 0 (inclusive) to 1 (exclusive), defaulting to 0.65

/*
function Mesh(id = "UNDEFINED") {
	this.id = id;
}
flock.Mesh = Mesh;
Mesh.prototype.toString = function MeshToString() {
	console.log("Mesh.toString", `${this.id}`);
	return `${this.id}`;
};injec
*/

export function initializeWorkspace() {
	// Set Blockly color configuration
	Blockly.utils.colour.setHsvSaturation(0.3);
	Blockly.utils.colour.setHsvValue(0.85);

	// Register variable category callback
	workspace.registerToolboxCategoryCallback("VARIABLE", function (ws) {
		const xmlList = Blockly.Variables.flyoutCategory(ws);

		xmlList.forEach((xmlBlock) => {
			if (xmlBlock.getAttribute("type") === "variables_set") {
				const valueElement = document.createElement("value");
				valueElement.setAttribute("name", "VALUE");

				const shadowElement = document.createElement("shadow");
				shadowElement.setAttribute("type", "math_number");

				const fieldElement = document.createElement("field");
				fieldElement.setAttribute("name", "NUM");
				fieldElement.textContent = "0";

				shadowElement.appendChild(fieldElement);
				valueElement.appendChild(shadowElement);
				xmlBlock.appendChild(valueElement);
			}
		});

		const defaultBlock = xmlList.find(
			(xmlBlock) => xmlBlock.getAttribute("type") === "variables_set",
		);
		if (defaultBlock) {
			const xmlBlockText = defaultBlock.cloneNode(true);

			const valueElements = xmlBlockText.getElementsByTagName("value");
			for (let i = 0; i < valueElements.length; i++) {
				if (valueElements[i].getAttribute("name") === "VALUE") {
					while (valueElements[i].firstChild) {
						valueElements[i].removeChild(
							valueElements[i].firstChild,
						);
					}
					const shadowText = document.createElement("shadow");
					shadowText.setAttribute("type", "text");

					const fieldText = document.createElement("field");
					fieldText.setAttribute("name", "TEXT");
					fieldText.textContent = "";
					shadowText.appendChild(fieldText);
					valueElements[i].appendChild(shadowText);
					break;
				}
			}

			const defaultIndex = xmlList.indexOf(defaultBlock);
			if (defaultIndex !== -1) {
				xmlList.splice(defaultIndex + 1, 0, xmlBlockText);
			}
		}
		return xmlList;
	});

	// Add change listeners
	workspace.addChangeListener(BlockDynamicConnection.finalizeConnections);
	workspace.addChangeListener(handleBlockSelect);
	workspace.addChangeListener(handleBlockDelete);

	// Initialize workspace search
	const workspaceSearch = new WorkspaceSearch(workspace);
	workspaceSearch.init();

	// Set up auto value behavior
	setupAutoValueBehavior(workspace);

	return workspace;
}

export function createBlocklyWorkspace() {
	// Register the custom renderer
	Blockly.registry.register(
		Blockly.registry.Type.RENDERER,
		"custom_zelos_renderer",
		CustomZelosRenderer,
	);

	//KeyboardNavigation.registerKeyboardNavigationStyles();

	workspace = Blockly.inject("blocklyDiv", options);
	//const keyboardNav = new KeyboardNavigation(workspace);

	initializeTheme();
	const mainWorkspace = document.querySelector(
		".blocklyMainWorkspaceDiv .blocklyBlockCanvas",
	);
	const fallbackCanvas = document.querySelector(
		".blocklyBlockCanvas:not(.blocklyFlyout .blocklyBlockCanvas)",
	);
	const blockCanvas = mainWorkspace || fallbackCanvas;

	if (blockCanvas) {
		// Function to get current toolbox width with better debugging
		function getToolboxWidth() {
			// Try multiple selectors for different Blockly versions/configurations
			const selectors = [
				".blocklyToolboxDiv",
				".blocklyTreeRoot",
				".blocklyToolbox",
			];

			for (const selector of selectors) {
				const toolbox = document.querySelector(selector);
				if (toolbox) {
					const rect = toolbox.getBoundingClientRect();
					const computedStyle = window.getComputedStyle(toolbox);
					const isVisible =
						computedStyle.display !== "none" &&
						computedStyle.visibility !== "hidden";

					/*console.log(`Toolbox found with ${selector}:`, {
			 width: rect.width,
			 display: computedStyle.display,
			 visibility: computedStyle.visibility,
			 isVisible
			});*/

					if (rect.width > 0 && isVisible) {
						return rect.width;
					}
				}
			}

			// Check if we're in a flyout context by checking if this canvas is inside a flyout
			const flyout = blockCanvas.closest(".blocklyFlyout");
			if (flyout) {
				//console.log('Canvas is inside flyout - skipping transform fix');
				return null; // Signal that we shouldn't apply fixes in flyout
			}

			//console.log('No toolbox found, using fallback width of 150');
			return 150;
		}

		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (
					mutation.type === "attributes" &&
					mutation.attributeName === "transform"
				) {
					const currentTransform =
						blockCanvas.getAttribute("transform");
					const toolboxWidth = getToolboxWidth();

					// Skip if we're in flyout context or no valid toolbox width
					if (toolboxWidth === null) {
						// console.log('Skipping transform fix - in flyout or no valid toolbox');
						return;
					}

					// Only fix if it's the blocklyBlockCanvas and the translate X is not the current toolbox width
					if (
						currentTransform &&
						!currentTransform.startsWith(
							`translate(${toolboxWidth},`,
						)
					) {
						// Immediately restore the correct transform
						const newTransform = currentTransform.replace(
							/translate\(([^,]+),/,
							`translate(${toolboxWidth},`,
						);
						//console.log(`Fixing transform: ${currentTransform} → ${newTransform}`);
						blockCanvas.setAttribute("transform", newTransform);
					}
				}
			});
		});

		// Only observe the specific blocklyBlockCanvas element
		observer.observe(blockCanvas, {
			attributes: true,
			attributeFilter: ["transform"],
		});
	}

	workspace.addChangeListener((e) => {
		if (e.type === "toolbox_item_select") {
			//console.log('Toolbox item selected - MutationObserver will handle transform corrections');
		}
	});

	window.mainWorkspace = workspace;

	return workspace;
}

export function getWorkspace() {
	return workspace;
}

function setupAutoValueBehavior(workspace) {
	workspace.addChangeListener(function (event) {
		if (
			event.type === Blockly.Events.BLOCK_CHANGE ||
			event.type === Blockly.Events.BLOCK_CREATE
		) {
			var block = workspace.getBlockById(event.blockId);
			if (block && block.type === "lists_create_with") {
				var inputCount = 0;
				while (block.getInput("ADD" + inputCount)) {
					inputCount++;
				}
				if (inputCount >= 2) {
					var previousInput = block.getInput(
						"ADD" + (inputCount - 2),
					);
					var lastInput = block.getInput("ADD" + (inputCount - 1));
					if (
						previousInput &&
						previousInput.connection.targetConnection &&
						lastInput &&
						!lastInput.connection.targetConnection
					) {
						var sourceBlock =
							previousInput.connection.targetConnection
								.sourceBlock_;

						function deepCopyBlock(originalBlock) {
							var newBlock = workspace.newBlock(
								originalBlock.type,
							);

							if (originalBlock.isShadow()) {
								newBlock.setShadow(true);
							}

							var fieldMap = {
								math_number: "NUM",
								text: "TEXT",
								logic_boolean: "BOOL",
								variables_get: "VAR",
							};

							if (fieldMap[originalBlock.type]) {
								var fieldName = fieldMap[originalBlock.type];
								newBlock.setFieldValue(
									originalBlock.getFieldValue(fieldName),
									fieldName,
								);
							}

							for (
								var i = 0;
								i < originalBlock.inputList.length;
								i++
							) {
								var originalInput = originalBlock.inputList[i];
								var newInput = newBlock.getInput(
									originalInput.name,
								);

								if (
									originalInput.connection &&
									originalInput.connection.targetConnection
								) {
									var originalNestedBlock =
										originalInput.connection
											.targetConnection.sourceBlock_;

									var newNestedBlock =
										deepCopyBlock(originalNestedBlock);

									if (
										newInput &&
										newNestedBlock.outputConnection
									) {
										newInput.connection.connect(
											newNestedBlock.outputConnection,
										);
									}
								}
							}

							newBlock.initSvg();
							newBlock.render();

							return newBlock;
						}

						var newBlock = deepCopyBlock(sourceBlock);
						lastInput.connection.connect(newBlock.outputConnection);
					}
				}
			}
		}
	});
}

export function overrideSearchPlugin(workspace) {
	function getBlocksFromToolbox(workspace) {
		const toolboxBlocks = [];

		function processItem(item, categoryName = "") {
			const currentCategory = item.getName
				? item.getName()
				: categoryName;

			if (currentCategory === "Snippets") {
				return;
			}

			if (item.getContents) {
				const contents = item.getContents();
				const blocks = Array.isArray(contents) ? contents : [contents];

				blocks.forEach((block) => {
					if (block.kind === "block") {
						toolboxBlocks.push({
							type: block.type,
							text: block.type,
							full: block,
						});
					}
				});
			}

			if (item.getChildToolboxItems) {
				item.getChildToolboxItems().forEach((child) => {
					processItem(child, currentCategory);
				});
			}
		}

		workspace.getToolbox().getToolboxItems().forEach(processItem);
		return toolboxBlocks;
	}

	const SearchCategory = Blockly.registry.getClass(
		Blockly.registry.Type.TOOLBOX_ITEM,
		"search",
	);

	if (!SearchCategory) {
		console.error("Search category not found in registry!");
		return;
	}

	const toolboxBlocks = getBlocksFromToolbox(workspace);
	SearchCategory.prototype.initBlockSearcher = function () {
		this.blockSearcher.indexBlocks = function () {
			this.indexedBlocks_ = toolboxBlocks;
		};
		this.blockSearcher.indexBlocks();
	};

	SearchCategory.prototype.matchBlocks = function () {
		if (!this.hasInputStarted) {
			this.hasInputStarted = true;
			return;
		}

		const query = this.searchField?.value.toLowerCase().trim() || "";

		const matches = this.blockSearcher.indexedBlocks_.filter((block) => {
			if (block.text) {
				return block.text.toLowerCase().includes(query);
			}
			return false;
		});

		this.showMatchingBlocks(matches);
	};

	function createXmlFromJson(blockJson, isShadow = false, isTopLevel = true) {
		const blockXml = Blockly.utils.xml.createElement(
			isShadow ? "shadow" : "block",
		);
		blockXml.setAttribute("type", blockJson.type);

		if (isTopLevel && blockJson.type === "lists_create_with") {
			blockXml.setAttribute("inline", "true");
		}

		if (blockJson.type === "lists_create_with" && blockJson.extraState) {
			const mutation = Blockly.utils.xml.createElement("mutation");
			mutation.setAttribute("items", blockJson.extraState.itemCount);
			blockXml.appendChild(mutation);
		}

		if (blockJson.inputs) {
			Object.entries(blockJson.inputs).forEach(([name, input]) => {
				const valueXml = Blockly.utils.xml.createElement("value");
				valueXml.setAttribute("name", name);

				if (input.block) {
					const nestedXml = createXmlFromJson(
						input.block,
						false,
						false,
					);
					valueXml.appendChild(nestedXml);
				}

				if (input.shadow) {
					const shadowXml = createXmlFromJson(
						input.shadow,
						true,
						false,
					);
					valueXml.appendChild(shadowXml);
				}

				blockXml.appendChild(valueXml);
			});
		}

		if (blockJson.fields) {
			Object.entries(blockJson.fields).forEach(([name, value]) => {
				const fieldXml = Blockly.utils.xml.createElement("field");
				fieldXml.setAttribute("name", name);
				fieldXml.textContent = value;
				blockXml.appendChild(fieldXml);
			});
		}

		return blockXml;
	}

	SearchCategory.prototype.showMatchingBlocks = function (matches) {
		const flyout = this.workspace_.getToolbox().getFlyout();
		if (!flyout) {
			console.error("Flyout not found!");
			return;
		}

		flyout.hide();
		flyout.show([]);

		const xmlList = [];
		const mutations = [];

		matches.forEach((match) => {
			const blockJson = match.full;
			const blockXml = createXmlFromJson(blockJson);

			xmlList.push(blockXml);

			if (
				blockJson.type === "lists_create_with" &&
				blockJson.extraState
			) {
				const mutation = Blockly.utils.xml.createElement("mutation");
				mutation.setAttribute("items", blockJson.extraState.itemCount);
				mutations.push(mutation);
			} else {
				mutations.push(null);
			}
		});

		flyout.show(xmlList);

		const flyoutWorkspace = flyout.getWorkspace();
		flyoutWorkspace.getAllBlocks(false).forEach((block, index) => {
			const mutation = mutations[index];
			if (mutation) {
				block.domToMutation(mutation);
			}
		});
	};

	const toolboxDef = workspace.options.languageTree;
	workspace.updateToolbox(toolboxDef);
}
