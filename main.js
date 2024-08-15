// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { registerFieldColour } from "@blockly/field-colour";
import { FieldGridDropdown } from "@blockly/field-grid-dropdown";
import { WorkspaceSearch } from "@blockly/plugin-workspace-search";
import { NavigationController } from "@blockly/keyboard-navigation";
import * as BABYLON from "@babylonjs/core";
import * as BABYLON_GUI from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { flock } from "./flock.js";
import { initialBlocksJson } from "./toolbox.js";
import { workspace, defineBlocks, initializeVariableIndexes } from "./blocks";
import { defineGenerators, meshMap } from "./generators";
import { FlowGraphLog10Block } from "babylonjs";

flock.BABYLON = BABYLON;
flock.GUI = BABYLON_GUI;

registerFieldColour();
Blockly.ContextMenuItems.registerCommentOptions();
const navigationController = new NavigationController();
navigationController.init();
navigationController.addWorkspace(workspace);
// Turns on keyboard navigation.
navigationController.enable(workspace);

const workspaceSearch = new WorkspaceSearch(workspace);
workspaceSearch.init();



flock.canvas = document.getElementById("renderCanvas");
let engine = null;
let hk = null;
flock.scene = null;
flock.document = document;
let havokInstance = null;
let engineReady = false;
let gizmoManager = null;
const gridKeyPressObservable = new flock.BABYLON.Observable();
const gridKeyReleaseObservable = new flock.BABYLON.Observable();
flock.gridKeyPressObservable = gridKeyPressObservable;
flock.gridKeyReleaseObservable = gridKeyReleaseObservable;
flock.canvas.pressedButtons = new Set();
flock.canvas.pressedKeys = new Set();
const displayScale = (window.devicePixelRatio || 1) * 0.75; // Get the device pixel ratio, default to 1 if not available
flock.displayScale = displayScale;
// Create an AdvancedDynamicTexture to hold the UI controls
let controlsTexture = null;

console.log("Welcome to Flock 🐑🐑🐑");

defineBlocks();
defineGenerators();

workspace.addChangeListener(function (event) {
	if (event.type === Blockly.Events.FINISHED_LOADING) {
		initializeVariableIndexes();
	}
});

workspace.addChangeListener(Blockly.Events.disableOrphans);

//Blockly.utils.colour.setHsvSaturation(0.20) // 0 (inclusive) to 1 (exclusive), defaulting to 0.45
//Blockly.utils.colour.setHsvValue(0.70) // 0 (inclusive) to 1 (exclusive), defaulting to 0.65

function createEngine() {
	if (engine) {
		engine.dispose();
		engine = null;
	}
	engine = new BABYLON.Engine(flock.canvas, true, { stencil: true });
	engine.enableOfflineSupport = false;
	engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
}

const createScene = function () {
	if (flock.scene) {
		removeEventListeners();
		flock.gridKeyPressObservable.clear();
		flock.gridKeyReleaseObservable.clear();
		flock.scene.dispose();
		flock.scene = null;
		controlsTexture.dispose();
		controlsTexture = null;
		hk.dispose();
		hk = null;
	}

	if (!engine) {
		createEngine();
	} else {
		engine.stopRenderLoop();
	}

	flock.scene = new BABYLON.Scene(engine);

	engine.runRenderLoop(function () {
		flock.scene.render();
	});

	flock.scene.eventListeners = [];

	hk = new BABYLON.HavokPlugin(true, havokInstance);
	flock.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), hk);
	flock.hk = hk;
	flock.highlighter = new BABYLON.HighlightLayer("highlighter", flock.scene);
	gizmoManager = new BABYLON.GizmoManager(flock.scene);

	/*
	flock.BABYLON.Effect.ShadersStore["customVertexShader"] = `
		precision highp float;

		attribute vec3 position;
		attribute vec3 normal;
		attribute vec2 uv;

		uniform mat4 worldViewProjection;
		uniform mat4 world; // Add the world matrix

		varying vec3 vWorldPosition; // Pass the world position
		varying vec2 vUV;

		void main() {
			vec4 worldPosition = world * vec4(position, 1.0);
			vWorldPosition = worldPosition.xyz; // Store the world position
			vUV = uv;

			gl_Position = worldViewProjection * vec4(position, 1.0);
		}
	`;
	BABYLON.Effect.ShadersStore["customFragmentShader"] = `
		precision highp float;

		varying vec3 vWorldPosition; // Receive the world position
		varying vec2 vUV;

		void main() {
			vec3 color;

			// Determine color based on the y-coordinate of the world position
			if (vWorldPosition.y > 10.0) {
				color = vec3(1.0, 1.0, 1.0); // Snow
			} else if (vWorldPosition.y > 8.0) {
				color = vec3(0.5, 0.5, 0.5); // Grey rocks
			} else if (vWorldPosition.y > 0.0) {
				color = vec3(0.13, 0.55, 0.13); // Grass
			} else if (vWorldPosition.y > -1.0) {
				color = vec3(0.55, 0.27, 0.07); // Brown rocks
			} else {
				color = vec3(0.96, 0.87, 0.20); // Beach
			}

			gl_FragColor = vec4(color, 1.0);
		}
	`;
*/
	/*
	  const ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap("heightmap", './textures/simple_height_map.png', {
		width: 100,
		height: 100,
		minHeight: -5,
		maxHeight: 5,
		subdivisions: 25,
		onReady: (groundMesh) => {
		   const groundAggregate = new BABYLON.PhysicsAggregate(groundMesh, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, flock.scene);
		}
	  }, flock.scene);*/

	const camera = new BABYLON.FreeCamera(
		"camera",
		new BABYLON.Vector3(0, 3, -10),
		flock.scene,
	);
	camera.setTarget(BABYLON.Vector3.Zero());
	camera.rotation.x = BABYLON.Tools.ToRadians(0);
	camera.angularSensibilityX = 2000;
	camera.angularSensibilityY = 2000;
	flock.scene.createDefaultLight();
	flock.scene.collisionsEnabled = true;

	controlsTexture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
	flock.controlsTexture = controlsTexture;
	flock.createArrowControls("white");
	flock.createButtonControls("white");

	const advancedTexture =
		flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

	// Create a stack panel to hold the text lines
	const stackPanel = new flock.GUI.StackPanel();
	stackPanel.isVertical = true;
	stackPanel.width = "100%";
	stackPanel.height = "100%";
	stackPanel.left = "0px";
	stackPanel.top = "0px";
	advancedTexture.addControl(stackPanel);

	// Function to print text with scrolling
	const textLines = []; // Array to keep track of text lines
	flock.printText = function (text, duration, color) {
		if (text === "" || !flock.scene) {
			// Ensure scene is valid
			return; // Return early if scene is invalid or text is empty
		}

		try {
			flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

			// Create a rectangle background
			const bg = new flock.GUI.Rectangle("textBackground");
			bg.background = "rgba(255, 255, 255, 0.5)";
			bg.adaptWidthToChildren = true; // Adjust width based on child elements
			bg.adaptHeightToChildren = true; // Adjust height based on child elements
			bg.cornerRadius = 2;
			bg.thickness = 0; // Remove border
			bg.horizontalAlignment =
				flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			bg.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
			bg.left = "5px"; // Position with some margin from left
			bg.top = "5px"; // Position with some margin from top

			// Create a text block
			const textBlock = new flock.GUI.TextBlock("textBlock", text);
			textBlock.color = color;
			textBlock.fontSize = "20";
			textBlock.height = "25px";
			textBlock.paddingLeft = "10px";
			textBlock.paddingRight = "10px";
			textBlock.paddingTop = "2px";
			textBlock.paddingBottom = "2px";
			textBlock.textVerticalAlignment =
				flock.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align text to top
			textBlock.textHorizontalAlignment =
				flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Align text to left
			textBlock.textWrapping = flock.GUI.TextWrapping.WordWrap;
			textBlock.resizeToFit = true;
			textBlock.forceResizeWidth = true;

			// Add the text block to the rectangle
			bg.addControl(textBlock);

			// Add the container to the stack panel
			stackPanel.addControl(bg);
			textLines.push(bg);

			// Remove the text after the specified duration
			setTimeout(() => {
				if (flock.scene) {
					// Ensure scene is still valid before removing
					stackPanel.removeControl(bg);
					textLines.splice(textLines.indexOf(bg), 1);
				}
			}, duration * 1000);
		} catch (error) {
			//console.warn("Unable to print text:", error);
		}
	};

	return flock.scene;
};
async function initialize() {
	BABYLON.Database.IDBStorageEnabled = true;
	BABYLON.Engine.CollisionsEpsilon = 0.00005;
	havokInstance = await HavokPhysics();

	engineReady = true;
	flock.scene = createScene();
	flock.scene.eventListeners = [];
}

initialize();

window.initialBlocksJson = initialBlocksJson;
/*
function Mesh(id = "UNDEFINED") {
	this.id = id;
}
flock.Mesh = Mesh;
Mesh.prototype.toString = function MeshToString() {
	console.log("Mesh.toString", `${this.id}`);
	return `${this.id}`;
};
*/
// Function to save the current workspace state
function saveWorkspace() {
	var state = Blockly.serialization.workspaces.save(workspace);

	const key = "flock_autosave.json";

	// Save today's workspace state
	localStorage.setItem(key, JSON.stringify(state));
}

// Function to load today's workspace state
function loadWorkspace() {
	const savedState = localStorage.getItem("flock_autosave.json");

	if (savedState) {
		console.log("Loading saved state...");
		Blockly.serialization.workspaces.load(
			JSON.parse(savedState),
			workspace,
		);
	} else {
		console.log("Loading default program");
		// Load the JSON into the workspace
		Blockly.serialization.workspaces.load(
			window.initialBlocksJson,
			workspace,
		);
	}

	executeCode();
}

// Call this function to autosave periodically
setInterval(saveWorkspace, 30000); // Autosave every 30 seconds

function stripFilename(inputString) {
	const removeEnd = inputString.replace(/\(\d+\)/g, "");
	// Find the last occurrence of '/' or '\'
	let lastIndex = Math.max(
		removeEnd.lastIndexOf("/"),
		removeEnd.lastIndexOf("\\"),
	);

	if (lastIndex === -1) {
		return removeEnd.trim();
	}

	return removeEnd.substring(lastIndex + 1).trim();
}

function exportCode() {
	const projectName =
		document.getElementById("projectName").value || "default_project";

	const json = Blockly.serialization.workspaces.save(workspace);
	const jsonString = JSON.stringify(json, null, 2); // Pretty-print the JSON

	const element = document.createElement("a");
	element.setAttribute(
		"href",
		"data:text/json;charset=utf-8," + encodeURIComponent(jsonString),
	);
	element.setAttribute("download", projectName + ".json");

	document.body.appendChild(element); // Required for Firefox
	element.click();
	document.body.removeChild(element);
}

function removeEventListeners() {
	flock.scene.eventListeners.forEach(({ event, handler }) => {
		document.removeEventListener(event, handler);
	});
	flock.scene.eventListeners.length = 0; // Clear the array
}

let mousePos = { x: 0, y: 0 };
flock.mousePos = mousePos;

window.onload = function () {
	// Initial view setup
	window.loadingCode = true;

	workspace.addChangeListener(function (e) {
		if (e.type === Blockly.Events.MOUSE_MOVE) {
			const svgCoords = Blockly.mouseToSvg(e);
			flock.mousePos = { x: svgCoords.x, y: svgCoords.y };
		}
	});
	flock.canvas.addEventListener("keydown", function (event) {
		flock.canvas.currentKeyPressed = event.key;
		flock.canvas.pressedKeys.add(event.key);
	});

	flock.canvas.addEventListener("keyup", function (event) {
		flock.canvas.pressedKeys.delete(event.key);
	});

	loadWorkspace();
	switchView("both");

	workspace.addChangeListener(function (event) {
		if (
			event.type === Blockly.Events.TOOLBOX_ITEM_SELECT ||
			event.type === Blockly.Events.FLYOUT_SHOW
		) {
			const toolbox = workspace.getToolbox();
			const selectedItem = toolbox.getSelectedItem();

			if (selectedItem && selectedItem.getName() === "Snippets") {
				window.loadingCode = true;
			} else {
				window.loadingCode = false;
			}
		}
	});

	document
		.getElementById("fileInput")
		.addEventListener("change", function (event) {
			const reader = new FileReader();
			reader.onload = function () {
				const text = reader.result;
				const json = JSON.parse(text);

				// Set the project name as the value of the projectName input field
				document.getElementById("projectName").value = stripFilename(
					document
						.getElementById("fileInput")
						.value.replace(".json", ""),
				);

				Blockly.serialization.workspaces.load(json, workspace);

				executeCode();
			};
			reader.readAsText(event.target.files[0]);
		});

	// Add event listener to file input
	document
		.getElementById("importFile")
		.addEventListener("change", handleSnippetUpload);

	document
		.getElementById("toggleDebug")
		.addEventListener("click", function () {
			if (!flock.scene) return;

			const blocklyArea = document.getElementById("codePanel");
			const canvasArea = document.getElementById("rightArea");
			const menu = document.getElementById("menu");
			const gizmoButtons = document.getElementById("gizmoButtons");

			if (flock.scene.debugLayer.isVisible()) {
				canvasArea.style.width = "100%";
				canvasArea.style.flexGrow = "1";
				switchView(viewMode);
				flock.scene.debugLayer.hide();
				onResize();
			} else {
				blocklyArea.style.display = "none";
				canvasArea.style.display = "block";
				canvasArea.style.width = "50vw";
				canvasArea.style.flexGrow = "0";
				gizmoButtons.style.display = "block";
				menu.style.right = "unset";
				flock.scene.debugLayer.show();
				onResize();
			}
		});

	document
		.getElementById("fullscreenToggle")
		.addEventListener("click", function () {
			if (!document.fullscreenElement) {
				// Go fullscreen
				if (document.documentElement.requestFullscreen) {
					document.documentElement.requestFullscreen();
				} else if (document.documentElement.mozRequestFullScreen) {
					/* Firefox */
					document.documentElement.mozRequestFullScreen();
				} else if (document.documentElement.webkitRequestFullscreen) {
					/* Chrome, Safari & Opera */
					document.documentElement.webkitRequestFullscreen();
				} else if (document.documentElement.msRequestFullscreen) {
					/* IE/Edge */
					document.documentElement.msRequestFullscreen();
				}
			} else {
				// Exit fullscreen
				if (document.exitFullscreen) {
					document.exitFullscreen();
				} else if (document.mozCancelFullScreen) {
					/* Firefox */
					document.mozCancelFullScreen();
				} else if (document.webkitExitFullscreen) {
					/* Chrome, Safari & Opera */
					document.webkitExitFullscreen();
				} else if (document.msExitFullscreen) {
					/* IE/Edge */
					document.msExitFullscreen();
				}
			}
		});

	const blockTypesToCleanUp = [
		"start",
		"forever",
		"when_clicked",
		"when_touches",
		"when_key_pressed",
		"when_key_released",
		"on_event",
		"procedures_defnoreturn",
		"procedures_defreturn",
	];

	workspace.cleanUp = function () {
		const topBlocks = workspace.getTopBlocks(false); // Get all top-level blocks without sorting
		const spacing = 40; // Define spacing between blocks
		let cursorY = 10; // Starting y position
		let cursorX = 10; // Starting x position

		// Sort the blocks by their current y position (top to bottom)
		topBlocks.sort(
			(a, b) =>
				a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y,
		);

		topBlocks.forEach((block) => {
			// Check if the block is one of the specified types
			if (blockTypesToCleanUp.includes(block.type)) {
				const blockXY = block.getRelativeToSurfaceXY();
				block.moveBy(cursorX - blockXY.x, cursorY - blockXY.y);
				cursorY += block.getHeightWidth().height + spacing;
			}
		});
	};

	// Add change listener to handle cleanup after block move or delete
	workspace.addChangeListener(function (event) {
		try {
			if (event.type === Blockly.Events.BLOCK_MOVE) {
				const block = workspace.getBlockById(event.blockId);
				if (!block) return;
				workspace.cleanUp();
			}
		} catch (error) {
			console.error(
				"An error occurred during the Blockly workspace cleanup process:",
				error,
			);
		}
	});

	document.addEventListener("keydown", function (event) {
		if (event.ctrlKey && event.key === ".") {
			event.preventDefault();

			const workspace = Blockly.getMainWorkspace();

			// Create the placeholder block at the computed position
			const placeholderBlock = workspace.newBlock("keyword_block");
			placeholderBlock.initSvg();
			placeholderBlock.render();
			

			let workspaceCoordinates = workspace.getMetricsManager().getViewMetrics(true)
			let posx = workspaceCoordinates.left + (workspaceCoordinates.width / 2)
			let posy = workspaceCoordinates.top + (workspaceCoordinates.height / 2)
			let blockCoordinates = new Blockly.utils.Coordinate(posx, posy)

			placeholderBlock.initSvg()
			placeholderBlock.render()
			placeholderBlock.moveTo(blockCoordinates)
 
			// Select the block for immediate editing
			placeholderBlock.select();

			// Automatically focus on the text input field
			const textInputField = placeholderBlock.getField("KEYWORD");
			if (textInputField) {
				textInputField.showEditor_();
			}
		}
	});
};

function executeCode() {
	if (engineReady) {
		flock.scene = createScene();

		const code = javascriptGenerator.workspaceToCode(workspace);
		try {
			console.log(code);
			//new Function(`(async () => { ${code} })()`)();
			runCode(code);
			document.getElementById("renderCanvas").focus();
		} catch (error) {
			console.error("Error executing Blockly code:", error);
		}
	} else {
		// Check again in 100 milliseconds
		setTimeout(executeCode, 100);
	}
}

function stopCode() {
	flock.scene.dispose();
	removeEventListeners();
	switchView(codeMode);
}

window.stopCode = stopCode;

function toggleGizmo(gizmoType) {
	// Disable all gizmos
	gizmoManager.positionGizmoEnabled = false;
	gizmoManager.rotationGizmoEnabled = false;
	gizmoManager.scaleGizmoEnabled = false;
	gizmoManager.boundingBoxGizmoEnabled = false;

	// Enable the selected gizmo
	switch (gizmoType) {
		case "position":
			gizmoManager.positionGizmoEnabled = true;
			gizmoManager.gizmos.positionGizmo.snapDistance = 0.1;
			gizmoManager.gizmos.positionGizmo.updateGizmoPositionToMatchAttachedMesh = true;

			gizmoManager.gizmos.positionGizmo.onDragStartObservable.add(
				function () {
					const mesh = gizmoManager.attachedMesh;
					const motionType = mesh.physics.getMotionType();
					mesh.savedMotionType = motionType;
					//console.log(motionType);
					if (
						mesh.physics &&
						mesh.physics.getMotionType() !=
							BABYLON.PhysicsMotionType.STATIC
					) {
						mesh.physics.setMotionType(
							BABYLON.PhysicsMotionType.STATIC,
						);
						mesh.physics.disablePreStep = false;
					}

					const block = meshMap[mesh.blockKey];
					highlightBlockById(workspace, block);
				},
			);

			gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(
				function () {
					// Retrieve the mesh associated with the position gizmo
					const mesh = gizmoManager.attachedMesh;
					if (mesh.savedMotionType) {
						mesh.physics.setMotionType(mesh.savedMotionType);
						mesh.physics.disablePreStep = true;
					}

					const block = meshMap[mesh.blockKey];

					if (block) {
						block
							.getInput("X")
							.connection.targetBlock()
							.setFieldValue(
								String(Math.round(mesh.position.x * 10) / 10),
								"NUM",
							);
						block
							.getInput("Y")
							.connection.targetBlock()
							.setFieldValue(
								String(Math.round(mesh.position.y * 10) / 10),
								"NUM",
							);
						block
							.getInput("Z")
							.connection.targetBlock()
							.setFieldValue(
								String(Math.round(mesh.position.z * 10) / 10),
								"NUM",
							);
					}
				},
			);

			break;
		case "rotation":
			gizmoManager.rotationGizmoEnabled = true;
			break;
		case "scale":
			gizmoManager.scaleGizmoEnabled = true;
			break;
		case "boundingBox":
			gizmoManager.boundingBoxGizmoEnabled = true;
			break;
		default:
			break;
	}
}

window.toggleGizmo = toggleGizmo;

function turnOffAllGizmos() {
	gizmoManager.positionGizmoEnabled = false;
	gizmoManager.rotationGizmoEnabled = false;
	gizmoManager.scaleGizmoEnabled = false;
	gizmoManager.boundingBoxGizmoEnabled = false;
}

window.turnOffAllGizmos = turnOffAllGizmos;

function highlightBlockById(workspace, block) {
	if (block) {
		block.select();
		workspace.centerOnBlock(block.id, true);
	}
}

async function exportBlockSnippet(block) {
	try {
		// Save the block and its children to a JSON object
		const blockJson = Blockly.serialization.blocks.save(block);

		// Convert the JSON object to a pretty-printed JSON string
		const jsonString = JSON.stringify(blockJson, null, 2);

		// Check if the File System Access API is available
		if ("showSaveFilePicker" in window) {
			// Define the options for the file picker
			const options = {
				suggestedName: "blockly_snippet.json",
				types: [
					{
						description: "JSON Files",
						accept: {
							"application/json": [".json"],
						},
					},
				],
			};

			// Show the save file picker
			const fileHandle = await window.showSaveFilePicker(options);

			// Create a writable stream
			const writable = await fileHandle.createWritable();

			// Write the JSON string to the file
			await writable.write(jsonString);

			// Close the writable stream
			await writable.close();
		} else {
			// Fallback for browsers that don't support the File System Access API
			const filename =
				prompt(
					"Enter a filename for the snippet:",
					"blockly_snippet",
				) || "blockly_snippet";
			const blob = new Blob([jsonString], { type: "application/json" });
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${filename}.json`;
			link.click();
		}
	} catch (e) {
		console.error("Error exporting block:", e);
	}
}

// Function to handle file upload and import JSON snippet into workspace
function handleSnippetUpload(event) {
	window.loadingCode = true;
	const file = event.target.files[0];
	const reader = new FileReader();
	reader.onload = function (event) {
		const jsonText = event.target.result;

		try {
			const json = JSON.parse(jsonText);
			Blockly.serialization.blocks.append(json, workspace);
		} catch (e) {
			console.error("Error importing JSON:", e);
		}
	};
	reader.readAsText(file);
}

// Function to trigger file input for importing snippet
function importSnippet() {
	document.getElementById("importFile").click();
}

function addExportContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "exportBlock",
		weight: 200,
		displayText: function () {
			return "Export block as JSON snippet";
		},
		preconditionFn: function (scope) {
			return scope.block ? "enabled" : "hidden";
		},
		callback: function (scope) {
			exportBlockSnippet(scope.block);
		},
		scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
		checkbox: false,
	});
}

// Initialize Blockly and add custom context menu options
addExportContextMenuOption();

// Extend Blockly with custom context menu for importing snippets in the workspace
function addImportContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "importSnippet",
		weight: 100,
		displayText: function () {
			return "Import snippet";
		},
		preconditionFn: function (scope) {
			return "enabled";
		},
		callback: function (scope) {
			importSnippet();
		},
		scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
		checkbox: false,
	});
}

function openAboutPage() {
	window.open("https://github.com/flipcomputing/flock/", "_blank");
}

window.openAboutPage = openAboutPage;

addImportContextMenuOption();

function loadExample() {
	window.loadingCode = true;

	const exampleSelect = document.getElementById("exampleSelect");
	const exampleFile = exampleSelect.value;
	const projectNameElement = document.getElementById("projectName");

	if (exampleFile) {
		// Set the project name based on the selected option's text
		const selectedOption =
			exampleSelect.options[exampleSelect.selectedIndex].text;
		projectNameElement.value = selectedOption;

		fetch(exampleFile)
			.then((response) => response.json())
			.then((json) => {
				Blockly.serialization.workspaces.load(json, workspace);
				executeCode();
			})
			.catch((error) => {
				console.error("Error loading example:", error);
			});
	}
}
window.executeCode = executeCode;
window.exportCode = exportCode;
window.loadExample = loadExample;

const runCode = (code) => {
	if (codeMode == "blockly") {
		switchView("canvas");
	}
	// Create a new sandboxed environment
	try {
		// Create a sandboxed function by embedding code into a new Function
		const sandboxedFunction = new Function(
			"flock",
			`
			"use strict";

			const {
				playAnimation,
				switchAnimation,
				highlight,
				newCharacter,
				newObject,
				newModel,
				newBox,
				newSphere,
				newCylinder,
				newCapsule,
				newPlane,
				createGround,
				createMap,
				createCustomMap,
				setSky,
				buttonControls,
				up,
				applyForce,
				moveByVector,
				glideTo,
				rotate,
				wait,
				show,
				hide,
				clearEffects,
				tint,
				setAlpha,
				setFog,
				keyPressed,
				isTouchingSurface,
				seededRandom,
				randomColour,
				scaleMesh,
				changeColour,
				changeMaterial,
				moveForward,
				attachCamera,
				canvasControls,
				setPhysics,
				checkMeshesTouching,
				say,
				onTrigger,
				onEvent,
				broadcastEvent,
				Mesh,
				forever,
				whenKeyPressed,
				whenKeyReleased,
				printText,
				onIntersect,
				getProperty,
			} = flock;
			

			// The code should be executed within the function context
			return function() {
				${code}
			};
		`,
		)(flock);

		// Execute the sandboxed function
		sandboxedFunction();
	} catch (error) {
		console.error("Error executing sandboxed code:", error);
	}
};

// Function to maintain a 16:9 aspect ratio for the canvas
function resizeCanvas() {
	const canvasArea = document.getElementById("rightArea");
	const canvas = document.getElementById("renderCanvas");

	const areaWidth = canvasArea.clientWidth;
	let areaHeight = canvasArea.clientHeight - 45;

	const gizmoButtons = document.getElementById("gizmoButtons");
	if (gizmoButtons.style.display != "none") {
		areaHeight -= 60; //Gizmos visible
	}

	const aspectRatio = 16 / 9;

	let newWidth, newHeight;

	if (areaWidth / areaHeight > aspectRatio) {
		newHeight = areaHeight;
		newWidth = newHeight * aspectRatio;
	} else {
		newWidth = areaWidth;
		newHeight = newWidth / aspectRatio;
	}

	canvas.style.width = `${newWidth}px`;
	canvas.style.height = `${newHeight}px`;
}

// Resize Blockly workspace and Babylon.js canvas when the window is resized
window.addEventListener("resize", onResize);
function onResize() {
	Blockly.svgResize(workspace);
	resizeCanvas();
	if (engine) engine.resize();
}

let viewMode = "both";
let codeMode = "both";
window.viewMode = viewMode;
window.codeMode = codeMode;

function switchView(view) {
	if (flock.scene) flock.scene.debugLayer.hide();
	const blocklyArea = document.getElementById("codePanel");
	const blocklyDiv = document.getElementById("blocklyDiv");
	const canvasArea = document.getElementById("rightArea");
	const menu = document.getElementById("menu");
	const gizmoButtons = document.getElementById("gizmoButtons");

	if (view === "both") {
		viewMode = "both";
		codeMode = "both";
		blocklyArea.style.display = "block";
		canvasArea.style.display = "block";
		gizmoButtons.style.display = "flex";
		menu.style.display = "flex";
	} else if (view === "blockly") {
		viewMode = "blockly";
		codeMode = "blockly";
		blocklyArea.style.display = "block";
		canvasArea.style.display = "none";
		gizmoButtons.style.display = "none";
		menu.style.display = "none";
	} else if (view === "canvas") {
		viewMode = "canvas";
		blocklyArea.style.display = "none";
		canvasArea.style.display = "block";
		gizmoButtons.style.display = "none";
		menu.style.display = "flex";
	}

	onResize(); // Ensure both Blockly and Babylon.js canvas resize correctly
}

window.switchView = switchView;
window.onResize = onResize;

let toolboxVisible = false;
window.toolboxVisible = toolboxVisible;
workspace.getToolbox().setVisible(false);
onResize();

function toggleToolbox() {
	const toolboxControl = document.getElementById("toolboxControl");

	if(!workspace) return;
	if (toolboxVisible) {
		toolboxVisible = false;
		workspace.getToolbox().setVisible(false);
		//onResize();
	} else {
		toolboxVisible = true;
		workspace.getToolbox().setVisible(true);
		// Delay binding the click event listener
		setTimeout(() => {
			document.addEventListener("click", handleClickOutside);
		}, 100); // Small delay to ensure the menu is shown before adding the listener
	}

	function handleClickOutside(event) {
		if (!toolboxControl.contains(event.target)) {
			workspace.getToolbox().setVisible(false);
			document.removeEventListener("click", handleClickOutside);
		}
	}
}

window.toggleToolbox = toggleToolbox;

function observeFlyoutVisibility(workspace) {
	// Access the flyout using Blockly's API
	const flyout = workspace.getToolbox().getFlyout();
	const flyoutSvgGroup = flyout.svgGroup_;

	// Check if the flyout SVG group is available
	if (!flyoutSvgGroup) {
		console.error("Flyout SVG group not found.");
		return;
	}

	// Create a MutationObserver to watch for style changes
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.attributeName === "style") {
				const displayStyle =
					window.getComputedStyle(flyoutSvgGroup).display;
				if (displayStyle != "none") {
					// Flyout is hidden
					const toolboxControl =
						document.getElementById("toolboxControl");
					toolboxControl.style.zIndex = "2";
					workspace.getToolbox().setVisible(false);
					// Trigger any resize or UI adjustments if necessary
					onResize();
				}
			}
		});
	});

	// Start observing the flyout SVG group for attribute changes
	observer.observe(flyoutSvgGroup, {
		attributes: true,
		attributeFilter: ["style"],
	});
}

observeFlyoutVisibility(workspace);

function runMenu() {
	switchView("canvas");
	executeCode();
}

window.runMenu = runMenu;

function toggleMenu() {
	const menu = document.getElementById("menu");
	const currentDisplay = window.getComputedStyle(menu).display;

	console.log("Current display:", currentDisplay);

	if (currentDisplay != "none") {
		menu.style.display = "none";
		document.removeEventListener("click", handleClickOutside);
	} else {
		console.log("Showing menu");
		menu.style.display = "flex";

		// Delay binding the click event listener
		setTimeout(() => {
			document.addEventListener("click", handleClickOutside);
		}, 100); // Small delay to ensure the menu is shown before adding the listener
	}

	function handleClickOutside(event) {
		if (!menu.contains(event.target)) {
			menu.style.display = "none";
			document.removeEventListener("click", handleClickOutside);
		}
	}
}

window.toggleMenu = toggleMenu;

document.addEventListener("DOMContentLoaded", () => {
	const requestFullscreen = () => {
		const elem = document.documentElement;

		if (elem.requestFullscreen) {
			elem.requestFullscreen();
		} else if (elem.mozRequestFullScreen) {
			// Firefox
			elem.mozRequestFullScreen();
		} else if (elem.webkitRequestFullscreen) {
			// Chrome, Safari and Opera
			elem.webkitRequestFullscreen();
		} else if (elem.msRequestFullscreen) {
			// IE/Edge
			elem.msRequestFullscreen();
		}
	};

	function isMobile() {
		return /Mobi|Android/i.test(navigator.userAgent);
	}

	// Only trigger fullscreen if on a mobile device
	if (isMobile()) {
		if (
			document.fullscreenEnabled ||
			document.webkitFullscreenEnabled ||
			document.mozFullScreenEnabled ||
			document.msFullscreenEnabled
		) {
			requestFullscreen();
		}
		const examples = document.getElementById("exampleSelect");
		examples.style.width = "55px";
		const projectName = document.getElementById("projectName");
		projectName.style.width = "80px";
	}
});
