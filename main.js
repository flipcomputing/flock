// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { registerFieldColour } from "@blockly/field-colour";
import { FieldGridDropdown } from "@blockly/field-grid-dropdown";
import { WorkspaceSearch } from "@blockly/plugin-workspace-search";
import { NavigationController } from "@blockly/keyboard-navigation";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { flock, initializeFlock } from "./flock.js";
import { initialBlocksJson } from "./toolbox.js";
import {
	modelNames,
	objectNames,
	characterNames,
	objectColours,
} from "./config.js";
import {
	options,
	defineBlocks,
	initializeVariableIndexes,
	handleBlockSelect,
	handleBlockDelete,
} from "./blocks";
import {
	defineGenerators,
	meshMap,
	meshBlockIdMap,
	generateUniqueId,
} from "./generators";

if (navigator.serviceWorker) {
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		window.location.reload();
	});
}

let workspace = null;

//Blockly.utils.colour.setHsvSaturation(0.2) // 0 (inclusive) to 1 (exclusive), defaulting to 0.45
//Blockly.utils.colour.setHsvValue(0.95) // 0 (inclusive) to 1 (exclusive), defaulting to 0.65

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
		Blockly.serialization.workspaces.load(
			JSON.parse(savedState),
			workspace,
		);
	} else {
		// Load the JSON into the workspace
		Blockly.serialization.workspaces.load(initialBlocksJson, workspace);
	}

	executeCode();
}

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

let gizmoManager;
let toolboxVisible = false;

let isExecuting = false;

async function executeCode() {
	// Check if the function is already running
	if (isExecuting) {
		console.log("Function already running, skipping execution.");
		return; // Exit if already running
	}

	// Set the flag to indicate the function is running
	isExecuting = true;

	// Utility function for delay
	const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	// Wait until the engine is ready using a loop with an async delay
	while (!flock.engineReady) {
		await delay(100);
	}

	console.log("Engine ready");

	// Cache DOM elements
	const container = document.getElementById("maincontent");
	const switchViewsBtn = document.getElementById("switchViews");
	const renderCanvas = document.getElementById("renderCanvas");

	// Switch to code view if currently in canvas view
	if (currentView === "canvas") {
		currentView = "code";
		container.style.transform = `translateX(0px)`; // Move to Code view
		switchViewsBtn.textContent = "Canvas >>"; // Update button text
	}

	// Dispose of the GizmoManager if it exists
	if (gizmoManager) {
		gizmoManager.dispose();
		gizmoManager = null; // Clear the global reference for garbage collection
	}

	// Generate the code from the workspace
	const code = javascriptGenerator.workspaceToCode(workspace);

	try {
		console.log(code);
		await flock.runCode(code);
		renderCanvas?.focus(); // Focus the render canvas safely if it exists
	} catch (error) {
		console.error("Error executing Blockly code:", error);
		isExecuting = false; // Reset the flag if there's an error
		return; // Exit if there's an error in running the code
	}

	// Check if the debug layer is visible and show it if necessary
	if (flock.scene?.debugLayer?.isVisible()) {
		try {
			await flock.scene.debugLayer.show({
				embedMode: true,
				enableClose: false,
				enablePopup: false,
			});
		} catch (error) {
			console.error("Error showing debug layer:", error);
		}
	}

	// Initialize a new GizmoManager for the scene
	gizmoManager = new flock.BABYLON.GizmoManager(flock.scene, 8);

	await delay(500);
	// Reset the flag to allow future executions
	isExecuting = false;
}

const characterMaterials = [
	"Hair",
	"Skin",
	"Eyes",
	"Sleeves",
	"Shorts",
	"TShirt",
];

function updateBlockColorAndHighlight(mesh, selectedColor) {
	let block = null;

	// Check if the picked mesh is part of a character by examining its material name
	const materialName = mesh?.material?.name;

	if (mesh && characterMaterials.includes(materialName)) {
		const ultimateParent = (mesh) =>
			mesh.parent ? ultimateParent(mesh.parent) : mesh;

		block = meshMap[ultimateParent(mesh).blockKey];
		// Update the corresponding character submesh color field (e.g., HAIR_COLOR, SKIN_COLOR)
		const materialToFieldMap = {
			Hair: "HAIR_COLOR",
			Skin: "SKIN_COLOR",
			Eyes: "EYES_COLOR",
			Sleeves: "SLEEVES_COLOR",
			Shorts: "SHORTS_COLOR",
			TShirt: "TSHIRT_COLOR",
		};

		const fieldName = materialToFieldMap[materialName];

		if (fieldName) {
			// Update the corresponding character color field in the block
			block
				.getInput(fieldName)
				.connection.targetBlock()
				.setFieldValue(selectedColor, "COLOR");
		} else {
			console.error("No matching field for material:", materialName);
		}
	} else {
		if (!mesh) {
			block = meshMap["sky"];
		} else {
			block = meshMap[mesh.blockKey];
		}

		if (!block) {
			console.error("Block not found for mesh:", mesh.blockKey);
			return;
		}
		// For non-character meshes, update the general "COLOR" field
		block
			.getInput("COLOR")
			.connection.targetBlock()
			.setFieldValue(selectedColor, "COLOR");
	}

	// Step 3: Update and render the block
	block.initSvg();
	block.render();

	// Step 4: Highlight the block in the Blockly workspace
	highlightBlockById(workspace, block);
}

// Function to load models into the menu
function loadModelImages() {
	const modelRow = document.getElementById("model-row");
	modelRow.innerHTML = ""; // Clear existing models

	modelNames.forEach((name) => {
		const baseName = name.replace(/\.[^/.]+$/, ""); // Remove extension
		const li = document.createElement("li");
		li.innerHTML = `<img src="./images/${baseName}.png" alt="${baseName}" onclick="selectModel('${name}')">`;
		modelRow.appendChild(li);
	});
}

// Function to load objects into the menu
function loadObjectImages() {
	const objectRow = document.getElementById("object-row");
	objectRow.innerHTML = ""; // Clear existing objects

	objectNames.forEach((name) => {
		const baseName = name.replace(/\.[^/.]+$/, ""); // Remove extension
		const li = document.createElement("li");
		li.innerHTML = `<img src="./images/${baseName}.png" alt="${baseName}" onclick="selectObject('${name}')">`;
		objectRow.appendChild(li);
	});
}

function selectObject(objectName) {
	document.getElementById("shapes-dropdown").style.display = "none";
	const canvas = flock.scene.getEngine().getRenderingCanvas(); // Get the Babylon.js canvas

	document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

	setTimeout(() => {
		const onPickMesh = function (event) {
			// Get the canvas bounds relative to the window
			const canvasRect = canvas.getBoundingClientRect();

			// Check if the click happened outside the canvas
			if (
				event.clientX < canvasRect.left ||
				event.clientX > canvasRect.right ||
				event.clientY < canvasRect.top ||
				event.clientY > canvasRect.bottom
			) {
				window.removeEventListener("click", onPickMesh);
				document.body.style.cursor = "default";
				return;
			}

			// Calculate the click position relative to the canvas, not the window
			const canvasX = event.clientX - canvasRect.left;
			const canvasY = event.clientY - canvasRect.top;

			// Create a picking ray using the adjusted canvas coordinates
			const pickRay = flock.scene.createPickingRay(
				canvasX,
				canvasY,
				BABYLON.Matrix.Identity(),
				flock.scene.activeCamera,
			);

			// Perform the picking
			const pickResult = flock.scene.pickWithRay(
				pickRay,
				(mesh) => mesh.isPickable,
			);

			if (pickResult.hit) {
				const pickedPosition = pickResult.pickedPoint;

				// Start a Blockly event group to ensure undo/redo tracks all changes
				Blockly.Events.setGroup(true);

				try {
					// Create the load_object block
					const block = workspace.newBlock("load_object");
					block.initSvg();
					block.render();
					highlightBlockById(workspace, block);

					// Set object name
					block.setFieldValue(objectName, "MODELS");

					// Set position values (X, Y, Z) from the picked position
					setPositionValues(block, pickedPosition, "load_object");

					// Add shadow block for SCALE
					const scale = 1; // Default scale
					addShadowBlock(block, "SCALE", "math_number", scale);

					// Add shadow block for COLOR
					const color = objectColours[objectName];
					addShadowBlock(block, "COLOR", "colour", color);

					// Create a new 'start' block and connect the load_object block to it
					const startBlock = workspace.newBlock("start");
					startBlock.initSvg();
					startBlock.render();

					// Connect the load_object block to the start block
					const connection = startBlock.getInput("DO").connection;
					if (connection) {
						connection.connect(block.previousConnection);
					}

					const meshId = objectName + "_" + generateUniqueId();
					meshMap[meshId] = block;

					flock.newObject(
						objectName,
						meshId,
						scale,
						pickedPosition.x,
						pickedPosition.y + 2,
						pickedPosition.z,
						color,
					);
				} finally {
					// End the event group to ensure everything can be undone/redone as a group
					Blockly.Events.setGroup(false);
				}
			}

			document.body.style.cursor = "default"; // Reset the cursor
			window.removeEventListener("click", onPickMesh); // Remove the event listener after picking
		};

		// Add event listener to pick the mesh on the next click
		window.addEventListener("click", onPickMesh);
	}, 200);
}
window.selectObject = selectObject;

// Scroll function to move the object row left or right
function scrollObjects(direction) {
	const objectRow = document.getElementById("object-row");
	const scrollAmount = 100; // Adjust scroll amount as needed
	objectRow.scrollBy({
		left: direction * scrollAmount,
		behavior: "smooth",
	});
}
window.scrollObjects = scrollObjects;
// Function to load characters into the menu
function loadCharacterImages() {
	const characterRow = document.getElementById("character-row");
	characterRow.innerHTML = ""; // Clear existing characters

	characterNames.forEach((name) => {
		const baseName = name.replace(/\.[^/.]+$/, ""); // Remove extension
		const li = document.createElement("li");
		li.innerHTML = `<img src="./images/${baseName}.png" alt="${baseName}" onclick="selectCharacter('${name}')">`;
		characterRow.appendChild(li);
	});
}

// Scroll function to move the character row left or right
function scrollCharacters(direction) {
	const characterRow = document.getElementById("character-row");
	const scrollAmount = 100; // Adjust scroll amount as needed
	characterRow.scrollBy({
		left: direction * scrollAmount,
		behavior: "smooth",
	});
}
window.scrollCharacters = scrollCharacters;

// Call this function to initialize the characters when the menu is opened
function showShapes() {
	const dropdown = document.getElementById("shapes-dropdown");
	dropdown.style.display =
		dropdown.style.display === "none" ? "block" : "none";
	loadModelImages(); // Load the models into the menu
	loadObjectImages(); // Load the objects into the menu
	loadCharacterImages(); // Load the characters into the menu
}
window.showShapes = showShapes;

function scrollModels(direction) {
	const modelRow = document.getElementById("model-row");
	const scrollAmount = 100; // Adjust as needed
	modelRow.scrollBy({
		left: direction * scrollAmount,
		behavior: "smooth",
	});
}
window.scrollModels = scrollModels;

function selectModel(modelName) {
	// Close the shapes menu after selecting a model
	document.getElementById("shapes-dropdown").style.display = "none";

	document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

	// Add a delay to avoid immediate firing
	setTimeout(() => {
		const onPick = function (event) {
			const canvasRect = flock.canvas.getBoundingClientRect();
			const canvasX = event.clientX - canvasRect.left;
			const canvasY = event.clientY - canvasRect.top;

			const pickResult = flock.scene.pick(canvasX, canvasY);
			if (pickResult.hit) {
				const pickedPosition = pickResult.pickedPoint;

				// Start a Blockly event group to ensure undo/redo tracks all changes
				Blockly.Events.setGroup(true);

				try {
					// Add the load_model block to the workspace at the picked location
					const block = workspace.newBlock("load_model");
					block.setFieldValue(modelName, "MODELS"); // Set the selected model

					setPositionValues(block, pickedPosition, "load_model"); // Set X, Y, Z

					// Create shadow block for SCALE using the addShadowBlock helper function
					const scale = 1; // Default scale value
					addShadowBlock(block, "SCALE", "math_number", scale);

					block.initSvg();
					block.render();
					highlightBlockById(workspace, block);

					// Create a new start block and connect the model block to it
					const startBlock = workspace.newBlock("start");
					startBlock.initSvg();
					startBlock.render();
					const connection = startBlock.getInput("DO").connection;
					if (connection) {
						connection.connect(block.previousConnection);
					}

					// Generate a unique ID for the model
					const modelId = modelName + "_" + generateUniqueId();

					// Store the block reference in meshMap
					meshMap[modelId] = block;

					flock.newModel(
						modelName,
						modelId,
						scale,
						pickedPosition.x,
						pickedPosition.y,
						pickedPosition.z,
					);
				} finally {
					// End the event group to ensure undo/redo works properly
					Blockly.Events.setGroup(false);
				}
			}

			document.body.style.cursor = "default"; // Reset cursor after picking
			window.removeEventListener("click", onPick); // Remove the click listener after pick
		};

		// Attach the event listener to wait for the next click on the scene
		window.addEventListener("click", onPick);
	}, 300); // Delay to avoid firing from the menu click
}

window.selectModel = selectModel;

window.showShapes = showShapes;

function selectShape(shapeType) {
	document.getElementById("shapes-dropdown").style.display = "none";
	document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

	// Delay adding the click listener to avoid the immediate menu click issue
	setTimeout(() => {
		const onPick = function (event) {
			const canvasRect = flock.canvas.getBoundingClientRect();
			const canvasX = event.clientX - canvasRect.left;
			const canvasY = event.clientY - canvasRect.top;
			const pickResult = flock.scene.pick(canvasX, canvasY);

			if (pickResult.hit) {
				const pickedPosition = pickResult.pickedPoint; // Get picked position

				addShapeToWorkspace(shapeType, pickedPosition); // Add the selected shape at this position
				document.body.style.cursor = "default"; // Reset cursor after picking
				window.removeEventListener("click", onPick); // Remove the click listener after pick
			} else {
				console.log("No object was picked, please try again.");
			}
		};

		// Attach the event listener to wait for the next click on the scene
		window.addEventListener("click", onPick);
	}, 300); // Small delay (300ms) to avoid firing immediately
}

window.selectShape = selectShape;

function selectCharacter(characterName) {
	document.getElementById("shapes-dropdown").style.display = "none";
	document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

	setTimeout(() => {
		const onPick = function (event) {
			const canvasRect = flock.canvas.getBoundingClientRect();
			const canvasX = event.clientX - canvasRect.left;
			const canvasY = event.clientY - canvasRect.top;

			const pickResult = flock.scene.pick(canvasX, canvasY);
			if (pickResult.hit) {
				const pickedPosition = pickResult.pickedPoint;

				// Start a Blockly event group to ensure undo/redo tracks all changes
				Blockly.Events.setGroup(true);

				try {
					// Add the load_character block to the workspace at the picked location
					const block = workspace.newBlock("load_character");
					block.setFieldValue(characterName, "MODELS"); // Set the selected character

					// Set position values (X, Y, Z) from the picked position
					setPositionValues(block, pickedPosition, "load_character");

					// Add shadow block for SCALE using the addShadowBlock helper function
					const scale = 1; // Default scale value
					addShadowBlock(block, "SCALE", "math_number", scale);

					// Add shadow blocks for colour inputs with default values
					const colorFields = {
						HAIR_COLOR: "#000000", // Hair: black
						SKIN_COLOR: "#A15C33", // Skin: custom skin tone
						EYES_COLOR: "#000000", // Eyes: black
						SLEEVES_COLOR: "#008B8B", // Sleeves: dark cyan
						SHORTS_COLOR: "#00008B", // Shorts: dark blue
						TSHIRT_COLOR: "#FF8F60", // T-Shirt: light orange
					};

					Object.keys(colorFields).forEach((colorInputName) => {
						addShadowBlock(
							block,
							colorInputName,
							"colour",
							colorFields[colorInputName],
						);
					});

					block.initSvg();
					block.render();
					highlightBlockById(workspace, block);

					// Create a new start block and connect the character block to it
					const startBlock = workspace.newBlock("start");
					startBlock.initSvg();
					startBlock.render();
					const connection = startBlock.getInput("DO").connection;
					if (connection) {
						connection.connect(block.previousConnection);
					}

					// Generate a unique ID for the character
					const modelId = characterName + "_" + generateUniqueId();

					// Store the block reference in meshMap
					meshMap[modelId] = block;

					flock.newCharacter(
						characterName,
						modelId,
						scale,
						pickedPosition.x,
						pickedPosition.y,
						pickedPosition.z,
						colorFields.HAIR_COLOR,
						colorFields.SKIN_COLOR,
						colorFields.EYES_COLOR,
						colorFields.SLEEVES_COLOR,
						colorFields.SHORTS_COLOR,
						colorFields.TSHIRT_COLOR,
					);
				} finally {
					// End the event group to ensure everything can be undone/redone as a group
					Blockly.Events.setGroup(false);
				}
			}

			document.body.style.cursor = "default";
			window.removeEventListener("click", onPick);
		};

		window.addEventListener("click", onPick);
	}, 300); // Small delay to avoid firing immediately from the menu click
}

window.selectCharacter = selectCharacter;

function addShapeToWorkspace(shapeType, position) {
	Blockly.Events.setGroup(true);
	// Create the shape block in the Blockly workspace
	const block = workspace.newBlock(shapeType);

	let color,
		width,
		height,
		depth,
		diameterX,
		diameterY,
		diameterZ,
		radius,
		diameterTop,
		diameterBottom;

	// Set different fields based on the shape type and capture the actual values
	switch (shapeType) {
		case "create_box":
			color = flock.randomColour();
			width = 1;
			height = 1;
			depth = 1;
			addShadowBlock(block, "COLOR", "colour", color);
			addShadowBlock(block, "WIDTH", "math_number", width);
			addShadowBlock(block, "HEIGHT", "math_number", height);
			addShadowBlock(block, "DEPTH", "math_number", depth);
			break;

		case "create_sphere":
			color = flock.randomColour();
			diameterX = 1;
			diameterY = 1;
			diameterZ = 1;
			addShadowBlock(block, "COLOR", "colour", color);
			addShadowBlock(block, "DIAMETER_X", "math_number", diameterX);
			addShadowBlock(block, "DIAMETER_Y", "math_number", diameterY);
			addShadowBlock(block, "DIAMETER_Z", "math_number", diameterZ);
			break;

		case "create_cylinder":
			color = flock.randomColour();
			height = 2;
			diameterTop = 1;
			diameterBottom = 1;
			addShadowBlock(block, "COLOR", "colour", color);
			addShadowBlock(block, "HEIGHT", "math_number", height);
			addShadowBlock(block, "DIAMETER_TOP", "math_number", diameterTop);
			addShadowBlock(
				block,
				"DIAMETER_BOTTOM",
				"math_number",
				diameterBottom,
			);
			break;

		case "create_capsule":
			color = flock.randomColour();
			radius = 0.5;
			height = 2;
			addShadowBlock(block, "COLOR", "colour", color);
			addShadowBlock(block, "RADIUS", "math_number", radius);
			addShadowBlock(block, "HEIGHT", "math_number", height);
			break;

		case "create_plane":
			color = flock.randomColour();
			width = 2;
			height = 2;
			addShadowBlock(block, "COLOR", "colour", color);
			addShadowBlock(block, "WIDTH", "math_number", width);
			addShadowBlock(block, "HEIGHT", "math_number", height);
			break;

		default:
			Blockly.Events.setGroup(false);
			return;
	}

	// Set position values (X, Y, Z) from the picked position
	setPositionValues(block, position, shapeType);

	// Initialize and render the shape block
	block.initSvg();
	block.render();
	highlightBlockById(workspace, block);

	// Create a new 'start' block and connect the shape block to it
	const startBlock = workspace.newBlock("start");
	startBlock.initSvg();
	startBlock.render();

	const connection = startBlock.getInput("DO").connection;
	if (connection) {
		connection.connect(block.previousConnection);
	}

	let newMesh;
	switch (shapeType) {
		case "create_box":
			newMesh = flock.newBox(
				color,
				width,
				height,
				depth,
				position.x,
				position.y + height / 2,
				position.z,
				"box_",
			);

			break;

		case "create_sphere":
			newMesh = flock.newSphere(
				color,
				diameterX,
				diameterY,
				diameterZ,
				position.x,
				position.y + diameterY / 2,
				position.z,
				"sphere_",
			);
			break;

		case "create_cylinder":
			newMesh = flock.newCylinder(
				color,
				height,
				diameterTop,
				diameterBottom,
				position.x,
				position.y + height / 2,
				position.z,
				"cylinder_",
			);
			break;

		case "create_capsule":
			newMesh = flock.newCapsule(
				color,
				radius,
				height,
				position.x,
				position.y + height / 2,
				position.z,
				"capsule_",
			);
			break;

		case "create_plane":
			newMesh = flock.newPlane(
				color,
				width,
				height,
				position.x,
				position.y + height / 2,
				position.z,
				"plane_",
			);

			break;
	}

	const blockKey = flock.scene.getMeshByName(newMesh).blockKey;
	meshMap[blockKey] = block;
	meshBlockIdMap[blockKey] = block.id;

	Blockly.Events.setGroup(false);
}

function updateOrCreateMeshFromBlock(block) {
	if (!window.loadingCode) {
		const mesh = getMeshFromBlock(block);

		if (mesh) {
			updateMeshFromBlock(mesh, block);
		} else {
			createMeshOnCanvas(block);
		}
	}
}
window.updateOrCreateMeshFromBlock = updateOrCreateMeshFromBlock;

function getMeshFromBlock(block) {
	const blockKey = Object.keys(meshMap).find((key) => meshMap[key] === block);

	return flock.scene?.meshes?.find((mesh) => mesh.blockKey === blockKey);
}

function getMeshFromBlockId(blockId) {
	const blockKey = Object.keys(meshMap).find(
		(key) => meshBlockIdMap[key] === blockId,
	);

	return flock.scene?.meshes?.find((mesh) => mesh.blockKey === blockKey);
}

function createMeshOnCanvas(block) {
	Blockly.Events.setGroup(true);

	let shapeType = block.type;
	let color,
		width,
		height,
		depth,
		diameterX,
		diameterY,
		diameterZ,
		radius,
		diameterTop,
		diameterBottom,
		position;

	// Retrieve values from the block's fields
	switch (shapeType) {
		case "create_box":
			color = block
				.getInput("COLOR")
				.connection.targetBlock()
				.getFieldValue("COLOR");
			width = block
				.getInput("WIDTH")
				.connection.targetBlock()
				.getFieldValue("NUM");
			height = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			depth = block
				.getInput("DEPTH")
				.connection.targetBlock()
				.getFieldValue("NUM");
			break;

		case "create_sphere":
			color = block
				.getInput("COLOR")
				.connection.targetBlock()
				.getFieldValue("COLOR");
			diameterX = block
				.getInput("DIAMETER_X")
				.connection.targetBlock()
				.getFieldValue("NUM");
			diameterY = block
				.getInput("DIAMETER_Y")
				.connection.targetBlock()
				.getFieldValue("NUM");
			diameterZ = block
				.getInput("DIAMETER_Z")
				.connection.targetBlock()
				.getFieldValue("NUM");
			break;

		case "create_cylinder":
			color = block
				.getInput("COLOR")
				.connection.targetBlock()
				.getFieldValue("COLOR");
			height = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			diameterTop = block
				.getInput("DIAMETER_TOP")
				.connection.targetBlock()
				.getFieldValue("NUM");
			diameterBottom = block
				.getInput("DIAMETER_BOTTOM")
				.connection.targetBlock()
				.getFieldValue("NUM");
			break;

		case "create_capsule":
			color = block
				.getInput("COLOR")
				.connection.targetBlock()
				.getFieldValue("COLOR");
			radius = block
				.getInput("RADIUS")
				.connection.targetBlock()
				.getFieldValue("NUM");
			height = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			break;

		case "create_plane":
			color = block
				.getInput("COLOR")
				.connection.targetBlock()
				.getFieldValue("COLOR");
			width = block
				.getInput("WIDTH")
				.connection.targetBlock()
				.getFieldValue("NUM");
			height = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			break;

		default:
			Blockly.Events.setGroup(false);
			return;
	}

	// Get position values from the block
	position = {
		x: block.getInput("X").connection.targetBlock().getFieldValue("NUM"),
		y: block.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
		z: block.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
	};

	// Create the appropriate mesh based on shapeType
	let newMesh;
	switch (shapeType) {
		case "create_box":
			newMesh = flock.newBox(
				color,
				width,
				height,
				depth,
				position.x,
				position.y,
				position.z,
				"box_" + generateUniqueId(),
			);
			break;

		case "create_sphere":
			newMesh = flock.newSphere(
				color,
				diameterX,
				diameterY,
				diameterZ,
				position.x,
				position.y + diameterY / 2,
				position.z,
				"sphere_" + generateUniqueId(),
			);
			break;

		case "create_cylinder":
			newMesh = flock.newCylinder(
				color,
				height,
				diameterTop,
				diameterBottom,
				position.x,
				position.y + height / 2,
				position.z,
				"cylinder_" + generateUniqueId(),
			);
			break;

		case "create_capsule":
			newMesh = flock.newCapsule(
				color,
				radius,
				height,
				position.x,
				position.y + height / 2,
				position.z,
				"capsule_" + generateUniqueId(),
			);
			break;

		case "create_plane":
			newMesh = flock.newPlane(
				color,
				width,
				height,
				position.x,
				position.y + height / 2,
				position.z,
				"plane_" + generateUniqueId(),
			);
			break;
	}

	// Store the mesh in the meshMap
	if (newMesh) {
		const blockKey = flock.scene.getMeshByName(newMesh).blockKey;
		meshMap[blockKey] = block;
		meshBlockIdMap[blockKey] = block.id;
	}

	Blockly.Events.setGroup(false);
}

function updateMeshFromBlock(mesh, block) {
	const shapeType = block.type;
	mesh.physics.disablePreStep = true;

	const color = block
		.getInput("COLOR")
		.connection.targetBlock()
		.getFieldValue("COLOR");

	// Retrieve the position values (X, Y, Z) from the connected blocks
	const position = {
		x: block.getInput("X").connection.targetBlock().getFieldValue("NUM"),
		y: block.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
		z: block.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
	};

	// Use flock API to change the color and position of the mesh
	if (color) flock.changeColour(mesh.name, color);

	flock.positionAt(mesh.name, position.x, position.y, position.z);

	// Shape-specific updates based on the block type
	switch (shapeType) {
		case "create_box":
			// Retrieve width, height, and depth from connected blocks
			const width = block
				.getInput("WIDTH")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const height = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const depth = block
				.getInput("DEPTH")
				.connection.targetBlock()
				.getFieldValue("NUM");

			// Set the absolute size of the box (not scaling)
			setAbsoluteSize(mesh, width, height, depth);
			break;

		case "create_sphere":
			// Retrieve diameter values for X, Y, Z from connected blocks
			const diameterX = block
				.getInput("DIAMETER_X")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const diameterY = block
				.getInput("DIAMETER_Y")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const diameterZ = block
				.getInput("DIAMETER_Z")
				.connection.targetBlock()
				.getFieldValue("NUM");

			// Set the absolute size of the sphere based on diameters
			setAbsoluteSize(mesh, diameterX, diameterY, diameterZ);
			break;

		case "create_cylinder":
			// Retrieve height, diameterTop, and diameterBottom from connected blocks
			const cylinderHeight = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const diameterTop = block
				.getInput("DIAMETER_TOP")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const diameterBottom = block
				.getInput("DIAMETER_BOTTOM")
				.connection.targetBlock()
				.getFieldValue("NUM");

			updateCylinderGeometry(
				mesh,
				diameterTop,
				diameterBottom,
				cylinderHeight,
			);
			break;

		case "create_capsule":
			// Retrieve radius and height from connected blocks
			const radius = block
				.getInput("RADIUS")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const capsuleHeight = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");

			// Set the absolute size of the capsule
			setAbsoluteSize(mesh, radius * 2, capsuleHeight, radius * 2);
			break;

		case "create_plane":
			// Retrieve width and height from connected blocks
			const planeWidth = block
				.getInput("WIDTH")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const planeHeight = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");

			// Set the absolute size of the plane
			setAbsoluteSize(mesh, planeWidth, planeHeight, 1); // Planes are usually flat in the Z dimension
			break;

		default:
			console.warn(`Unknown shape type: ${shapeType}`);
	}
}

function updateCylinderGeometry(mesh, diameterTop, diameterBottom, height) {
	// If the mesh has geometry, dispose of it before updating
	if (mesh.geometry) {
		mesh.geometry.dispose();
	}

	// Create a temporary mesh to generate the vertex data for the updated cylinder
	const tempMesh = BABYLON.MeshBuilder.CreateCylinder(
		"",
		{
			height: height,
			diameterTop: diameterTop,
			diameterBottom: diameterBottom,
			tessellation: 32,
			updatable: true,
		},
		mesh.getScene(),
	);

	// Extract vertex data from the temporary mesh
	const vertexData = BABYLON.VertexData.ExtractFromMesh(tempMesh);

	// Create new geometry for the mesh
	const newGeometry = new BABYLON.Geometry(
		mesh.name + "_geometry",
		mesh.getScene(),
		vertexData,
		true,
		mesh,
	);

	// Apply the new geometry to the mesh
	newGeometry.applyToMesh(mesh);
	mesh.makeGeometryUnique();
	// Dispose of the temporary mesh after extracting vertex data
	tempMesh.dispose();
}

function setAbsoluteSize(mesh, width, height, depth) {
	const boundingInfo = mesh.getBoundingInfo();
	const originalSize = boundingInfo.boundingBox.extendSize;

	mesh.scaling.x = width / (originalSize.x * 2);
	mesh.scaling.y = height / (originalSize.y * 2);
	mesh.scaling.z = depth / (originalSize.z * 2);

	let shapeType = null;

	if (mesh.metadata) shapeType = mesh.metadata.shapeType;

	if (mesh.physics && shapeType) {
		const shape = mesh.physics.shape;
		let newShape;

		// Create the new physics shape based on the type
		switch (shapeType) {
			case "Box":
				newShape = new BABYLON.PhysicsShapeBox(
					new BABYLON.Vector3(0, 0, 0),
					new BABYLON.Quaternion(0, 0, 0, 1),
					new BABYLON.Vector3(width, height, depth),
					mesh.getScene(),
				);
				break;

			case "Cylinder":
				const diameterBottom = Math.min(width, depth);
				const startPoint = new flock.BABYLON.Vector3(0, -height / 2, 0);
				const endPoint = new flock.BABYLON.Vector3(0, height / 2, 0);

				newShape = new flock.BABYLON.PhysicsShapeCylinder(
					startPoint,
					endPoint,
					diameterBottom / 2,
					mesh.getScene(),
				);
				break;

			case "Sphere":
				newShape = new flock.BABYLON.PhysicsShapeSphere(
					new flock.BABYLON.Vector3(0, 0, 0),
					Math.max(width, depth, height) / 2,
					mesh.getScene(),
				);
				break;

			case "Capsule":
				const radius = Math.min(width, depth) / 2;
				newShape = new flock.BABYLON.PhysicsShapeCapsule(
					new flock.BABYLON.Vector3(0, 0, 0),
					radius, // Radius of the spherical ends
					height / 2, // Half the height of the cylindrical part
					mesh.getScene(),
				);
				break;

			default:
				console.log(
					"Unknown or unsupported physics shape type: " + shapeType,
				);
				break;
		}

		if (newShape) {
			shape.dispose();
			const physicsBody = mesh.physics;
			physicsBody.shape = newShape;
			mesh.physics.disablePreStep;
			mesh.computeWorldMatrix(true);
		}
	}
}

window.updateMeshFromBlock = updateMeshFromBlock;

window.createMeshOnCanvas = createMeshOnCanvas;
// Helper function to create and attach shadow blocks
function addShadowBlock(block, inputName, blockType, defaultValue) {
	const shadowBlock = workspace.newBlock(blockType);

	// Determine the correct field based on block type
	const fieldName = blockType === "colour" ? "COLOR" : "NUM";

	shadowBlock.setFieldValue(String(defaultValue), fieldName);
	shadowBlock.initSvg();
	shadowBlock.render();

	block.getInput(inputName).connection.connect(shadowBlock.outputConnection);
}

function setPositionValues(block, position, shapeType) {
	let adjustedY = position.y;

	// Adjust Y based on the shape type
	switch (shapeType) {
		case "create_box":
			adjustedY += block.getInputTargetBlock("HEIGHT")
				? block.getInputTargetBlock("HEIGHT").getFieldValue("NUM") / 2
				: 0.5; // Default to 0.5 if undefined
			break;

		case "create_sphere":
			adjustedY += block.getInputTargetBlock("DIAMETER_Y")
				? block.getInputTargetBlock("DIAMETER_Y").getFieldValue("NUM") /
					2
				: 0.5;
			break;

		case "create_cylinder":
			adjustedY += block.getInputTargetBlock("HEIGHT")
				? block.getInputTargetBlock("HEIGHT").getFieldValue("NUM") / 2
				: 1;
			break;

		case "create_capsule":
			adjustedY += block.getInputTargetBlock("HEIGHT")
				? block.getInputTargetBlock("HEIGHT").getFieldValue("NUM") / 2
				: 1;
			break;

		case "create_plane":
			// Planes are flat, so no Y adjustment needed
			break;

		case "load_object":
			// Adjust Y based on SCALE input
			adjustedY += block.getInputTargetBlock("SCALE")
				? block.getInputTargetBlock("SCALE").getFieldValue("NUM") / 2
				: 2;
			break;

		default:
			console.error("Unknown shape type: " + shapeType);
	}

	// Set X, Y, Z values
	setNumberInput(block, "X", position.x);
	setNumberInput(block, "Y", adjustedY);
	setNumberInput(block, "Z", position.z);
}

// Helper function to set a numeric input value or create a shadow block if missing
function setNumberInput(block, inputName, value) {
	let inputConnection = block.getInput(inputName).connection;
	let targetBlock = inputConnection.targetBlock();

	if (!targetBlock) {
		// Create a shadow block for the input if none exists
		const shadowBlock = workspace.newBlock("math_number");
		shadowBlock.setFieldValue(String(Math.round(value * 10) / 10), "NUM");
		shadowBlock.initSvg();
		shadowBlock.render();
		inputConnection.connect(shadowBlock.outputConnection);
	} else {
		// Set the value if a block is already connected
		targetBlock.setFieldValue(String(Math.round(value * 10) / 10), "NUM");
	}
}

window.selectedColor = "#ffffff"; // Default color

document.addEventListener("DOMContentLoaded", function () {
	const colorInput = document.getElementById("colorPickerButton");

	// Attach the event listener to capture color changes when user interacts with the input
	colorInput.addEventListener("input", (event) => {
		window.selectedColor = event.target.value; // Store the selected color

		// Delay the blur to ensure the color selection is processed first
		setTimeout(() => {
			colorInput.blur(); // Close the picker after a brief delay
			colorInput.setAttribute("type", "text");
			colorInput.setAttribute("type", "color");
		}, 100); // Adjust the delay time as needed
		// Call a function to handle the selected color
		pickMeshFromCanvas();
	});
});

function pickMeshFromCanvas() {
	const canvas = flock.scene.getEngine().getRenderingCanvas(); // Get the Babylon.js canvas

	document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

	const onPickMesh = function (event) {
		// Get the canvas bounds relative to the window
		const canvasRect = canvas.getBoundingClientRect();

		// Check if the click happened outside the canvas
		if (
			event.clientX < canvasRect.left ||
			event.clientX > canvasRect.right ||
			event.clientY < canvasRect.top ||
			event.clientY > canvasRect.bottom
		) {
			window.removeEventListener("click", onPickMesh);
			document.body.style.cursor = "default";
			return;
		}

		// Calculate the click position relative to the canvas, not the window
		const canvasX = event.clientX - canvasRect.left;
		const canvasY = event.clientY - canvasRect.top;

		// Create a picking ray using the adjusted canvas coordinates
		const pickRay = flock.scene.createPickingRay(
			canvasX,
			canvasY,
			BABYLON.Matrix.Identity(),
			flock.scene.activeCamera,
		);

		// Perform the picking
		const pickResult = flock.scene.pickWithRay(
			pickRay,
			(mesh) => mesh.isPickable,
		);

		function applyColorToMeshOrDescendant(mesh, selectedColor) {
			if (!mesh) {
				flock.scene.clearColor = BABYLON.Color3.FromHexString(
					flock.getColorFromString(selectedColor),
				);
				return;
			}
			const findMeshWithMaterial = (mesh) =>
				mesh.material
					? mesh
					: mesh.getDescendants().find((child) => child.material);

			const targetMesh = findMeshWithMaterial(mesh);
			// If a mesh with a material is found, apply the color
			if (targetMesh) {
				if (targetMesh.material && targetMesh.material.diffuseColor) {
					targetMesh.material.diffuseColor =
						new BABYLON.Color3.FromHexString(selectedColor);
				} else {
					targetMesh.material.albedoColor =
						new BABYLON.Color3.FromHexString(
							selectedColor,
						).toLinearSpace();
					targetMesh.material.emissiveColor =
						flock.BABYLON.Color3.FromHexString(
							flock.getColorFromString(selectedColor),
						).toLinearSpace();
					targetMesh.material.emissiveIntensity = 0.1;
				}
			}
		}

		applyColorToMeshOrDescendant(pickResult.pickedMesh, selectedColor);

		updateBlockColorAndHighlight(pickResult.pickedMesh, selectedColor);

		document.body.style.cursor = "default"; // Reset the cursor
		window.removeEventListener("click", onPickMesh); // Remove the event listener after picking
	};

	// Add event listener to pick the mesh on the next click
	window.addEventListener("click", onPickMesh);
}

window.pickMeshFromCanvas = pickMeshFromCanvas;

function deleteMeshFromBlock(blockId) {
	const mesh = getMeshFromBlockId(blockId);

	if (mesh) flock.dispose(mesh.name);
}
window.deleteMeshFromBlock = deleteMeshFromBlock;

function stopCode() {
	flock.audioContext.close();
	flock.scene.dispose();
	flock.removeEventListeners();
	switchView(codeMode);
}

window.stopCode = stopCode;

function onResize() {
	Blockly.svgResize(workspace);
	//document.body.style.zoom = "reset";
	resizeCanvas();
	if (flock.engine) flock.engine.resize();
}
window.onresize = onResize;

function toggleGizmo(gizmoType) {
	// Disable all gizmos
	gizmoManager.positionGizmoEnabled = false;
	gizmoManager.rotationGizmoEnabled = false;
	gizmoManager.scaleGizmoEnabled = false;
	gizmoManager.boundingBoxGizmoEnabled = false;
	gizmoManager.attachableMeshes = flock.scene?.meshes?.filter(
		(s) => s.name !== "ground",
	);

	// Enable the selected gizmo
	switch (gizmoType) {
		case "bounds":
			gizmoManager.boundingBoxGizmoEnabled = true;
			gizmoManager.boundingBoxDragBehavior.onDragStartObservable.add(
				function () {
					const mesh = gizmoManager.attachedMesh;

					const motionType = mesh.physics.getMotionType();
					mesh.savedMotionType = motionType;

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

			gizmoManager.boundingBoxDragBehavior.onDragEndObservable.add(
				function () {
					// Retrieve the mesh associated with the bb gizmo
					const mesh = gizmoManager.attachedMesh;

					if (mesh.savedMotionType) {
						mesh.physics.setMotionType(mesh.savedMotionType);
					}

					mesh.computeWorldMatrix(true);

					const block = meshMap[mesh.blockKey];

					let meshY = mesh.position.y;

					if (
						mesh.metadata &&
						mesh.metadata.yOffset &&
						mesh.metadata.yOffset != 0
					) {
						const scale = block
							.getInput("SCALE")
							.connection.targetBlock()
							.getFieldValue("NUM");

						meshY -= scale * mesh.metadata.yOffset;
					}

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
								String(Math.round(meshY * 10) / 10),
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

		case "position":
			gizmoManager.positionGizmoEnabled = true;
			gizmoManager.gizmos.positionGizmo.snapDistance = 0.1;
			gizmoManager.gizmos.positionGizmo.updateGizmoPositionToMatchAttachedMesh = true;
			gizmoManager.gizmos.positionGizmo.onDragStartObservable.add(
				function () {
					const mesh = gizmoManager.attachedMesh;
					const motionType = mesh.physics.getMotionType();
					mesh.savedMotionType = motionType;

					if (
						mesh.physics &&
						mesh.physics.getMotionType() !=
							BABYLON.PhysicsMotionType.ANIMATED
					) {
						mesh.physics.setMotionType(
							BABYLON.PhysicsMotionType.ANIMATED,
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
					}
					mesh.computeWorldMatrix(true);

					const block = meshMap[mesh.blockKey];

					let meshY = mesh.position.y;

					if (
						mesh.metadata &&
						mesh.metadata.yOffset &&
						mesh.metadata.yOffset != 0
					) {
						const scale = block
							.getInput("SCALE")
							.connection.targetBlock()
							.getFieldValue("NUM");

						meshY -= scale * mesh.metadata.yOffset;
					}

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
								String(Math.round(meshY * 10) / 10),
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
			gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;

			gizmoManager.gizmos.rotationGizmo.onDragStartObservable.add(
				function () {
					const mesh = gizmoManager.attachedMesh;
					const motionType = mesh.physics.getMotionType();
					mesh.savedMotionType = motionType;

					if (
						mesh.physics &&
						mesh.physics.getMotionType() !=
							BABYLON.PhysicsMotionType.ANIMATED
					) {
						mesh.physics.setMotionType(
							BABYLON.PhysicsMotionType.ANIMATED,
						);
						mesh.physics.disablePreStep = false;
					}

					const block = meshMap[mesh.blockKey];
					highlightBlockById(workspace, block);
				},
			);

			gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(
				function () {
					const mesh = gizmoManager.attachedMesh;

					if (mesh.savedMotionType) {
						mesh.physics.setMotionType(mesh.savedMotionType);
					}

					const block = meshMap[mesh.blockKey];

					if (!block) {
						return;
					}

					if (!block.getInput("DO")) {
						block
							.appendStatementInput("DO")
							.setCheck(null)
							.appendField("then do");
					}

					// Check if the 'rotate_to' block already exists in the 'DO' section
					let rotateBlock = null;
					let modelVariable = block.getFieldValue("ID_VAR");
					const statementConnection = block.getInput("DO").connection;
					if (
						statementConnection &&
						statementConnection.targetBlock()
					) {
						// Iterate through the blocks in the 'do' section to find 'rotate_to'
						let currentBlock = statementConnection.targetBlock();
						while (currentBlock) {
							if (currentBlock.type === "rotate_to") {
								const modelField =
									currentBlock.getFieldValue("MODEL");
								if (modelField === modelVariable) {
									rotateBlock = currentBlock;
									break;
								}
							}
							currentBlock = currentBlock.getNextBlock();
						}
					}

					// Create a new 'rotate_to' block if it doesn't exist
					if (!rotateBlock) {
						rotateBlock = workspace.newBlock("rotate_to");
						rotateBlock.setFieldValue(modelVariable, "MODEL");
						rotateBlock.initSvg();
						rotateBlock.render();

						// Add shadow blocks for X, Y, Z inputs
						["X", "Y", "Z"].forEach((axis) => {
							const input = rotateBlock.getInput(axis);
							const shadowBlock =
								workspace.newBlock("math_number");
							shadowBlock.setShadow(true);
							shadowBlock.initSvg();
							shadowBlock.render();
							input.connection.connect(
								shadowBlock.outputConnection,
							);
						});

						rotateBlock.render(); // Render the new block
						// Connect the new 'rotate_to' block to the 'do' section
						block
							.getInput("DO")
							.connection.connect(rotateBlock.previousConnection);
					}

					function getEulerAnglesFromQuaternion(quaternion) {
						const euler = quaternion.toEulerAngles(); // Converts quaternion to Euler angles
						return {
							x: Math.round(euler.x * (180 / Math.PI) * 10) / 10,
							y: Math.round(euler.y * (180 / Math.PI) * 10) / 10,
							z: Math.round(euler.z * (180 / Math.PI) * 10) / 10,
						};
					}

					// Get the correct rotation values, checking for quaternion
					let rotationX = 0,
						rotationY = 0,
						rotationZ = 0;
					if (mesh.rotationQuaternion) {
						// If using quaternion, convert it to Euler angles
						const rotation = getEulerAnglesFromQuaternion(
							mesh.rotationQuaternion,
						);
						rotationX = rotation.x;
						rotationY = rotation.y;
						rotationZ = rotation.z;
					} else {
						// If using standard Euler rotation
						rotationX =
							Math.round(mesh.rotation.x * (180 / Math.PI) * 10) /
							10;
						rotationY =
							Math.round(mesh.rotation.y * (180 / Math.PI) * 10) /
							10;
						rotationZ =
							Math.round(mesh.rotation.z * (180 / Math.PI) * 10) /
							10;
					}

					// Helper to update the value of the connected block or shadow block
					function setRotationValue(inputName, value) {
						const input = rotateBlock.getInput(inputName);
						const connectedBlock = input.connection.targetBlock();

						if (connectedBlock) {
							connectedBlock.setFieldValue(String(value), "NUM");
						}
					}

					// Set the rotation values (X, Y, Z)
					setRotationValue("X", rotationX);
					setRotationValue("Y", rotationY);
					setRotationValue("Z", rotationZ);
				},
			);

			break;
		case "scale":
			gizmoManager.scaleGizmoEnabled = true;

			gizmoManager.gizmos.scaleGizmo.onDragStartObservable.add(
				function () {
					const mesh = gizmoManager.attachedMesh;
					const motionType = mesh.physics.getMotionType();
					mesh.savedMotionType = motionType;

					if (
						mesh.physics &&
						mesh.physics.getMotionType() !=
							BABYLON.PhysicsMotionType.ANIMATED
					) {
						mesh.physics.setMotionType(
							BABYLON.PhysicsMotionType.ANIMATED,
						);
						mesh.physics.disablePreStep = false;
					}

					const block = meshMap[mesh.blockKey];
					highlightBlockById(workspace, block);
				},
			);

			gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add(function () {
				const mesh = gizmoManager.attachedMesh;
				if (mesh.savedMotionType) {
					mesh.physics.setMotionType(mesh.savedMotionType);
				}

				const block = meshMap[mesh.blockKey];

				if (!block) {
					return;
				}

				if (!block.getInput("DO")) {
					block
						.appendStatementInput("DO")
						.setCheck(null)
						.appendField("then do");
				}

				// Check if the 'scale' block already exists in the 'DO' section
				let scaleBlock = null;
				let modelVariable = block.getFieldValue("ID_VAR");
				const statementConnection = block.getInput("DO").connection;
				if (statementConnection && statementConnection.targetBlock()) {
					let currentBlock = statementConnection.targetBlock();
					while (currentBlock) {
						if (currentBlock.type === "scale") {
							const modelField =
								currentBlock.getFieldValue("BLOCK_NAME");
							if (modelField === modelVariable) {
								scaleBlock = currentBlock;
								break;
							}
						}
						currentBlock = currentBlock.getNextBlock();
					}
				}

				// Create a new 'scale' block if it doesn't exist
				if (!scaleBlock) {
					scaleBlock = workspace.newBlock("scale");
					scaleBlock.setFieldValue(modelVariable, "BLOCK_NAME");
					scaleBlock.initSvg();
					scaleBlock.render();

					// Add shadow blocks for X, Y, Z inputs
					["X", "Y", "Z"].forEach((axis) => {
						const input = scaleBlock.getInput(axis);
						const shadowBlock = workspace.newBlock("math_number");
						shadowBlock.setShadow(true);
						shadowBlock.initSvg();
						shadowBlock.render();
						input.connection.connect(shadowBlock.outputConnection);
					});

					scaleBlock.render(); // Render the new block
					// Connect the new 'scale' block to the 'do' section
					block
						.getInput("DO")
						.connection.connect(scaleBlock.previousConnection);
				}

				// Helper to update the value of the connected block or shadow block
				function setScaleValue(inputName, value) {
					const input = scaleBlock.getInput(inputName);
					const connectedBlock = input.connection.targetBlock();

					if (connectedBlock) {
						connectedBlock.setFieldValue(String(value), "NUM");
					}
				}

				// Set the scale values (X, Y, Z)
				const scaleX = Math.round(mesh.scaling.x * 10) / 10;
				const scaleY = Math.round(mesh.scaling.y * 10) / 10;
				const scaleZ = Math.round(mesh.scaling.z * 10) / 10;

				setScaleValue("X", scaleX);
				setScaleValue("Y", scaleY);
				setScaleValue("Z", scaleZ);
			});

			break;
		case "boundingBox":
			gizmoManager.boundingBoxGizmoEnabled = true;

			break;
		case "focus":
			focusCameraOnMesh();
			break;
		default:
			break;
	}
}

window.toggleGizmo = toggleGizmo;

function turnOffAllGizmos() {
	gizmoManager.attachToMesh(null);
	gizmoManager.positionGizmoEnabled = false;
	gizmoManager.rotationGizmoEnabled = false;
	gizmoManager.scaleGizmoEnabled = false;
	gizmoManager.boundingBoxGizmoEnabled = false;
}

window.turnOffAllGizmos = turnOffAllGizmos;

function highlightBlockById(workspace, block) {
	if (block) {
		// Unselect all other blocks
		workspace.getAllBlocks().forEach((b) => b.unselect());

		// Select the new block
		if (window.codeMode === "both") block.select();

		const blockRect = block.getBoundingRectangle();
		const metrics = workspace.getMetrics();

		// Check if the block is outside the visible area
		const isOutsideViewport =
			blockRect.top < metrics.viewTop ||
			blockRect.bottom > metrics.viewTop + metrics.viewHeight ||
			blockRect.left < metrics.viewLeft ||
			blockRect.right > metrics.viewLeft + metrics.viewWidth;

		if (isOutsideViewport) {
			// Scroll the workspace to make the block visible without centering it
			workspace.scrollbar.set(blockRect.left - 10, blockRect.top - 10); // Adjust for padding
		}
	}
}

function focusCameraOnMesh() {
	let mesh = gizmoManager.attachedMesh;
	if (mesh.name === "ground") mesh = null;
	if (!mesh && window.currentMesh) {
		const blockKey = Object.keys(meshMap).find(
			(key) => meshMap[key] === window.currentBlock,
		);

		mesh = flock.scene?.meshes?.find((mesh) => mesh.blockKey === blockKey);
	}

	if (!mesh) return;

	mesh.computeWorldMatrix(true);
	const boundingInfo = mesh.getBoundingInfo();
	const newTarget = boundingInfo.boundingBox.centerWorld; // Center of the new mesh
	const camera = flock.scene.activeCamera;
	if (camera.metadata && camera.metadata.following) {
		const player = camera.metadata.following; // The player (mesh) the camera is following

		// Maintain the player's Y position (on the ground)
		const originalPlayerY = player.position.y;

		// Set the player's position directly in front of the new target
		const playerDistance = camera.radius; // Distance the camera keeps from the player (preserve this)

		// Calculate the player's forward direction (based on rotation)
		const forward = new flock.BABYLON.Vector3(0, 0, -1); // Default forward direction (Z axis)
		const playerRotationMatrix = flock.BABYLON.Matrix.RotationY(
			player.rotation.y,
		);
		const playerForward = flock.BABYLON.Vector3.TransformCoordinates(
			forward,
			playerRotationMatrix,
		);

		// Update the player's position (in front of the target)
		player.position.set(
			newTarget.x,
			originalPlayerY,
			newTarget.z + playerDistance,
		);

		player.lookAt(newTarget);

		const cameraPosition = player.position.subtract(
			playerForward.scale(playerDistance),
		);

		// Set the camera position behind the player
		camera.setPosition(cameraPosition);

		// Ensure the camera is still looking at the player
		camera.setTarget(player.position);
	} else {
		// For other types of cameras, retain the existing logic
		const currentPosition = camera.position;
		const currentTarget = camera.getTarget();
		const currentDistance = BABYLON.Vector3.Distance(
			currentPosition,
			currentTarget,
		);
		const currentYPosition = camera.position.y;

		// Move the camera in front of the mesh, keeping the current distance and Y position
		const frontDirection = new BABYLON.Vector3(0, 0, -1);
		const newCameraPositionXZ = new BABYLON.Vector3(
			newTarget.x + frontDirection.x * currentDistance,
			currentYPosition,
			newTarget.z + frontDirection.z * currentDistance,
		);

		camera.position = newCameraPositionXZ;
		camera.setTarget(newTarget);
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

/*
function toggleToolbox() {
	const toolboxControl = document.getElementById("toolboxControl");

	if (!workspace) return;
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
*/

async function loadExample() {
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

	exampleSelect.value = "";
}
window.executeCode = executeCode;
window.exportCode = exportCode;
window.loadExample = loadExample;

// Function to maintain a 16:9 aspect ratio for the canvas
function resizeCanvas() {
	const canvasArea = document.getElementById("rightArea");
	const canvas = document.getElementById("renderCanvas");

	const areaWidth = canvasArea.clientWidth;
	let areaHeight = canvasArea.clientHeight;

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

let viewMode = "both";
let codeMode = "both";
window.viewMode = viewMode;
window.codeMode = codeMode;

function switchView(view) {
	if (flock.scene) flock.scene.debugLayer.hide();
	const blocklyArea = document.getElementById("codePanel");
	const canvasArea = document.getElementById("rightArea");
	const gizmoButtons = document.getElementById("gizmoButtons");

	if (view === "both") {
		viewMode = "both";
		codeMode = "both";
		blocklyArea.style.display = "block";
		canvasArea.style.display = "block";
		blocklyArea.style.width = "0";
		canvasArea.style.width = "0";
		blocklyArea.style.flex = "2 1 0";   // 2/3 of the space
		canvasArea.style.flex = "1 1 0";    // 1/3 of the space		gizmoButtons.style.display = "flex";
	} else if (view === "canvas") {
		console.log("canvas");
		viewMode = "canvas";
		blocklyArea.style.display = "none";
		canvasArea.style.display = "block";
	}

	onResize(); // Ensure both Blockly and Babylon.js canvas resize correctly
}

window.switchView = switchView;

function toggleMenu() {
	const menu = document.getElementById("menu");
	const currentDisplay = window.getComputedStyle(menu).display;

	if (currentDisplay != "none") {
		menu.style.display = "none";
		document.removeEventListener("click", handleClickOutside);
	} else {
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
			// For Firefox
			elem.mozRequestFullScreen();
		} else if (elem.webkitRequestFullscreen) {
			// For Chrome, Safari, and Opera
			elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
		} else if (elem.msRequestFullscreen) {
			// For IE/Edge
			elem.msRequestFullscreen();
		}
	};

	const isMobile = () => {
		return /Mobi|Android/i.test(navigator.userAgent);
	};

	const isFullscreen = window.matchMedia(
		"(display-mode: fullscreen)",
	).matches;

	// Request fullscreen on mobile only when running as a PWA
	if (isMobile() && isFullscreen) {
		requestFullscreen();
		document.getElementById("fullscreenToggle").style.display = "none";
	}

	if (window.matchMedia("(display-mode: fullscreen)").matches) {
		// Adjust layout for fullscreen mode
		adjustViewport();
	}

	window
		.matchMedia("(display-mode: fullscreen)")
		.addEventListener("change", (e) => {
			if (e.matches) {
				// The app has entered fullscreen mode
				adjustViewport();
			}
		});

	if (isMobile()) {
		adjustViewport();
		//const dpr = window.devicePixelRatio || 1;
		// document.body.style.zoom = dpr;  // This adjusts the zoom based on DPR
	}

	// Additional adjustments for mobile UI in fullscreen mode
	const examples = document.getElementById("exampleSelect");
	if (examples) {
		examples.style.width = "55px";
	}
	const projectName = document.getElementById("projectName");
	if (projectName) {
		//projectName.style.minWidth = "5px";
		//projectName.style.maxWidth = "80px";
	}
});

let currentView = "start"; // Start with the code view
// Function to be called once the app has fully loaded

const container = document.getElementById("maincontent");
const bottomBar = document.getElementById("bottomBar");
const switchViewsBtn = document.getElementById("switchViews");
let startX = 0;
let currentTranslate = 0;
let previousTranslate = 0;
let isDragging = false;
const swipeThreshold = 50; // Minimum swipe distance

function showCanvasView() {
	const gizmoButtons = document.getElementById("gizmoButtons");

	gizmoButtons.style.display = "block";
	currentView = "canvas";
	container.style.transform = `translateX(0px)`; // Move to Code view
	switchViewsBtn.textContent = "Code >>"; // Update button text
	onResize();
}

function showCodeView() {
	const blocklyArea = document.getElementById("codePanel");
	blocklyArea.style.display = "block";
	const panelWidth = window.innerWidth;
	currentView = "code";
	container.style.transform = `translateX(-${panelWidth}px)`; // Move to Canvas view
	switchViewsBtn.textContent = "<< Canvas"; // Update button text
}

function togglePanels() {
	if (switchViewsBtn.textContent === "Code >>") {
		showCodeView();
	} else {
		showCanvasView();
	}
}

function setTranslateX(value) {
	container.style.transform = `translateX(${value}px)`;
}

// Function to add the swipe event listeners
function addSwipeListeners() {
	// Handle touch start (drag begins)
	bottomBar.addEventListener("touchstart", (e) => {
		startX = e.touches[0].clientX;
		isDragging = true;
	});

	// Handle touch move (drag in progress)
	bottomBar.addEventListener("touchmove", (e) => {
		if (!isDragging) return;
		const currentX = e.touches[0].clientX;
		const deltaX = currentX - startX;

		currentTranslate = previousTranslate + deltaX;

		// Ensure the container doesn't drag too far
		if (currentTranslate > 0) currentTranslate = 0;
		if (currentTranslate < -window.innerWidth)
			currentTranslate = -window.innerWidth;

		setTranslateX(currentTranslate);
	});

	// Handle touch end (drag ends, snap to nearest panel)
	bottomBar.addEventListener("touchend", () => {
		isDragging = false;

		// Calculate the total distance swiped
		const deltaX = currentTranslate - previousTranslate;

		// Snap to the next or previous panel based on swipe distance and direction
		if (deltaX < -swipeThreshold) {
			showCodeView(); // Swipe left to switch to the Canvas view
		} else if (deltaX > swipeThreshold) {
			showCanvasView(); // Swipe right to switch to the Code view
		}

		previousTranslate = currentTranslate; // Update the last translate value
	});
}

// Function to add the button event listener
function addButtonListener() {
	switchViewsBtn.addEventListener("click", togglePanels);
}

// Initialization function to set up everything
function initializeUI() {
	addSwipeListeners(); // Add swipe event listeners
	addButtonListener(); // Add button click listener
}

function initializeApp() {
	console.log("Initializing app...");

	// Add event listeners for menu buttons and controls
	const runCodeButton = document.getElementById("runCodeButton");
	const toggleDesignButton = document.getElementById("toggleDesign");
	const togglePlayButton = document.getElementById("togglePlay");
	const stopCodeButton = document.getElementById("stopCodeButton");
	const fileInput = document.getElementById("fileInput");
	const exportCodeButton = document.getElementById("exportCodeButton");

	runCodeButton.addEventListener("click", executeCode);
	stopCodeButton.addEventListener("click", stopCode);
	toggleDesignButton.addEventListener("click", toggleDesign);
	togglePlayButton.addEventListener("click", togglePlay);
	exportCodeButton.addEventListener("click", exportCode);

	// Enable the file input after initialization
	fileInput.removeAttribute("disabled");

	// Add event listener to file input
	document
		.getElementById("importFile")
		.addEventListener("change", handleSnippetUpload);

	toggleDesignButton.addEventListener("click", function () {
		if (!flock.scene) return;

		const blocklyArea = document.getElementById("codePanel");
		const canvasArea = document.getElementById("rightArea");
		const gizmoButtons = document.getElementById("gizmoButtons");

		if (flock.scene.debugLayer.isVisible()) {
			switchView("both");
			flock.scene.debugLayer.hide();
			onResize();
		} else {
			blocklyArea.style.display = "none";
			codeMode = "none";
			canvasArea.style.display = "block";
			canvasArea.style.width = "0";
			gizmoButtons.style.display = "block";
			// https://doc.babylonjs.com/typedoc/interfaces/BABYLON.IInspectorOptions
			flock.scene.debugLayer.show({
				embedMode: true,
				enableClose: false,
				enablePopup: false,
			});
			canvasArea.style.flex = "1 1 0";
			onResize();
		}
	});

	let savedView = "canvas";

	togglePlayButton.addEventListener("click", function () {
		if (!flock.scene) return;

		const blocklyArea = document.getElementById("codePanel");
		const canvasArea = document.getElementById("rightArea");
		const gizmoButtons = document.getElementById("gizmoButtons");
		const bottomBar = document.getElementById("bottomBar");

		const gizmosVisible =
			gizmoButtons &&
			getComputedStyle(gizmoButtons).display !== "none" &&
			getComputedStyle(gizmoButtons).visibility !== "hidden";

		if (gizmosVisible) {
			savedView = currentView;
			showCanvasView();
			flock.scene.debugLayer.hide();
			blocklyArea.style.display = "none";
			gizmoButtons.style.display = "none";
			bottomBar.style.display = "none";
			document.documentElement.style.setProperty(
				"--dynamic-offset",
				"40px",
			);
			onResize();
		} else {
			flock.scene.debugLayer.hide();
			blocklyArea.style.display = "block";
			canvasArea.style.display = "block";
			gizmoButtons.style.display = "block";
			bottomBar.style.display = "block";
			switchView("both");
			document.documentElement.style.setProperty(
				"--dynamic-offset",
				"65px",
			);
			if (savedView === "code") showCodeView();
			else showCanvasView();
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

	initializeUI();

	console.log("Enabling gizmos");

	// Enable gizmo buttons
	const positionButton = document.getElementById("positionButton");
	const rotationButton = document.getElementById("rotationButton");
	const scaleButton = document.getElementById("scaleButton");
	const boundsButton = document.getElementById("boundsButton");
	const focusButton = document.getElementById("focusButton");
	const hideButton = document.getElementById("hideButton");
	const showShapesButton = document.getElementById("showShapesButton");
	const colorPickerButton = document.getElementById("colorPickerButton");
	const aboutButton = document.getElementById("logo");

	const scrollModelsLeftButton = document.getElementById(
		"scrollModelsLeftButton",
	);
	const scrollModelsRightButton = document.getElementById(
		"scrollModelsRightButton",
	);
	const scrollObjectsLeftButton = document.getElementById(
		"scrollObjectsLeftButton",
	);
	const scrollObjectsRightButton = document.getElementById(
		"scrollObjectsRightButton",
	);
	const scrollCharactersLeftButton = document.getElementById(
		"scrollCharactersLeftButton",
	);
	const scrollCharactersRightButton = document.getElementById(
		"scrollCharactersRightButton",
	);

	// Enable the buttons
	positionButton.removeAttribute("disabled");
	rotationButton.removeAttribute("disabled");
	scaleButton.removeAttribute("disabled");
	boundsButton.removeAttribute("disabled");
	focusButton.removeAttribute("disabled");
	hideButton.removeAttribute("disabled");
	showShapesButton.removeAttribute("disabled");
	colorPickerButton.removeAttribute("disabled");
	aboutButton.removeAttribute("disabled");

	scrollModelsLeftButton.removeAttribute("disabled");
	scrollModelsRightButton.removeAttribute("disabled");
	scrollObjectsLeftButton.removeAttribute("disabled");
	scrollObjectsRightButton.removeAttribute("disabled");
	scrollCharactersLeftButton.removeAttribute("disabled");
	scrollCharactersRightButton.removeAttribute("disabled");

	// Attach event listeners
	positionButton.addEventListener("click", () => toggleGizmo("position"));
	rotationButton.addEventListener("click", () => toggleGizmo("rotation"));
	scaleButton.addEventListener("click", () => toggleGizmo("scale"));
	boundsButton.addEventListener("click", () => toggleGizmo("bounds"));
	focusButton.addEventListener("click", () => toggleGizmo("focus"));
	hideButton.addEventListener("click", turnOffAllGizmos);
	showShapesButton.addEventListener("click", showShapes);
	aboutButton.addEventListener("click", openAboutPage);

	scrollModelsLeftButton.addEventListener("click", () => scrollModels(-1));
	scrollModelsRightButton.addEventListener("click", () => scrollModels(1));
	scrollObjectsLeftButton.addEventListener("click", () => scrollObjects(-1));
	scrollObjectsRightButton.addEventListener("click", () => scrollObjects(1));
	scrollCharactersLeftButton.addEventListener("click", () =>
		scrollCharacters(-1),
	);
	scrollCharactersRightButton.addEventListener("click", () =>
		scrollCharacters(1),
	);

	const exampleSelect = document.getElementById("exampleSelect");

	const fullscreenToggle = document.getElementById("fullscreenToggle");

	//toolboxControl.removeAttribute("disabled");
	runCodeButton.removeAttribute("disabled");
	exampleSelect.removeAttribute("disabled");
	fullscreenToggle.removeAttribute("disabled");

	// Add event listeners for buttons and controls
	/*toolboxControl.addEventListener("mouseover", function () {
		toolboxControl.style.cursor = "pointer";
		toggleToolbox();
	});*/

	exampleSelect.addEventListener("change", loadExample);

	onResize();
}

// Function to enforce minimum font size and delay the focus to prevent zoom
function enforceMinimumFontSize(input) {
	const currentFontSize = parseFloat(input.style.fontSize);

	// Set font size immediately if it's less than 16px
	if (currentFontSize < 16) {
		input.style.fontSize = "16px";
		input.offsetHeight; // Force reflow to apply the font size change
	}

	// Delay focus to prevent zoom
	input.addEventListener(
		"focus",
		(event) => {
			event.preventDefault(); // Prevent the default focus action
			setTimeout(() => {
				input.focus(); // Focus the input after a short delay
			}, 50); // Adjust the delay as needed (50ms is usually enough)
		},
		{ once: true },
	); // Add the event listener once for each input
}

// Function to observe changes in the DOM for dynamically added blocklyHtmlInput elements
function observeBlocklyInputs() {
	const observer = new MutationObserver((mutationsList) => {
		mutationsList.forEach((mutation) => {
			if (mutation.type === "childList") {
				mutation.addedNodes.forEach((node) => {
					// Check if the added node is an INPUT element with the blocklyHtmlInput class
					if (
						node.nodeType === Node.ELEMENT_NODE &&
						node.classList.contains("blocklyHtmlInput")
					) {
						enforceMinimumFontSize(node); // Set font size and delay focus
					}
				});
			}
		});
	});

	// Start observing the entire document for added nodes (input fields may appear anywhere)
	observer.observe(document.body, { childList: true, subtree: true });
}

window.onload = function () {
	const scriptElement = document.getElementById("flock");
	if (scriptElement) {
		initializeFlock();
		console.log("Standalone Flock");
		return; // standalone flock
	}

	observeBlocklyInputs();

	workspace = Blockly.inject("blocklyDiv", options);
	registerFieldColour();

	workspace.addChangeListener(handleBlockSelect);
	workspace.addChangeListener(handleBlockDelete);

	// Resize Blockly workspace and Babylon.js canvas when the window is resized
	window.addEventListener("resize", onResize);

	Blockly.ContextMenuItems.registerCommentOptions();
	const navigationController = new NavigationController();
	navigationController.init();
	navigationController.addWorkspace(workspace);
	// Turns on keyboard navigation.
	//navigationController.enable(workspace);

	const workspaceSearch = new WorkspaceSearch(workspace);
	workspaceSearch.init();

	console.log("Welcome to Flock 🐑🐑🐑");

	defineBlocks();
	defineGenerators();
	// Initialize Blockly and add custom context menu options
	addExportContextMenuOption();
	addImportContextMenuOption();
	//observeFlyoutVisibility(workspace);
	window.toolboxVisible = toolboxVisible;

	// Call this function to autosave periodically
	setInterval(saveWorkspace, 30000); // Autosave every 30 seconds

	(async () => {
		await flock.initialize();

		window.addEventListener("keydown", (event) => {
			// Check if the dot key (.) is pressed (key code 190)
			if (event.code === "Period") {
				focusCameraOnMesh();
			}
		});
		window.initialBlocksJson = initialBlocksJson;
	})();

	//workspace.getToolbox().setVisible(false);

	workspace.addChangeListener(function (event) {
		if (event.type === Blockly.Events.FINISHED_LOADING) {
			initializeVariableIndexes();
			window.loadingCode = false;
		}
	});
	workspace.addChangeListener(Blockly.Events.disableOrphans);

	// Initial view setup
	window.loadingCode = true;

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
				window.loadingCode = true;
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

	let cleanupTimeout;

	// Get the canvas element
	const canvas = document.getElementById("renderCanvas");

	// Disable text selection on the body when the canvas is touched or clicked
	function disableSelection() {
		document.body.style.userSelect = "none"; // Disable text selection
	}

	// Enable text selection when touching or clicking outside the canvas
	function enableSelection(event) {
		// Check if the event target is outside the canvas
		if (!canvas.contains(event.target)) {
			document.body.style.userSelect = "auto"; // Enable text selection
		}
	}

	// For mouse events
	canvas.addEventListener("mousedown", disableSelection);
	document.addEventListener("mousedown", enableSelection);

	// For touch events (mobile)
	canvas.addEventListener("touchstart", disableSelection);
	document.addEventListener("touchstart", enableSelection);

	workspace.addChangeListener(function (event) {
		try {
			if (event.type === Blockly.Events.BLOCK_MOVE) {
				const block = workspace.getBlockById(event.blockId);
				if (!block) return;

				// Clear any existing cleanup timeout to avoid multiple calls
				clearTimeout(cleanupTimeout);

				// Set a new timeout to call cleanUp after block movement settles
				cleanupTimeout = setTimeout(() => {
					Blockly.Events.disable(); // Temporarily disable events
					workspace.cleanUp(); // Clean up the workspace
					Blockly.Events.enable(); // Re-enable events
				}, 500); // Delay cleanup by 500ms to ensure block moves have settled
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

			let workspaceCoordinates = workspace
				.getMetricsManager()
				.getViewMetrics(true);
			let posx =
				workspaceCoordinates.left + workspaceCoordinates.width / 2;
			let posy =
				workspaceCoordinates.top + workspaceCoordinates.height / 2;
			let blockCoordinates = new Blockly.utils.Coordinate(posx, posy);

			placeholderBlock.initSvg();
			placeholderBlock.render();
			placeholderBlock.moveTo(blockCoordinates);

			// Select the block for immediate editing
			placeholderBlock.select();

			// Automatically focus on the text input field
			const textInputField = placeholderBlock.getField("KEYWORD");
			if (textInputField) {
				textInputField.showEditor_();
			}
		}
	});

	initializeApp();
};

let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
	e.preventDefault(); // Prevent the mini-infobar from appearing
	deferredPrompt = e; // Save the event for later use

	// Prompt the user after interaction (scroll, click, etc.)
	window.addEventListener(
		"click",
		() => {
			if (deferredPrompt) {
				deferredPrompt.prompt();
				deferredPrompt.userChoice.then((choiceResult) => {
					if (choiceResult.outcome === "accepted") {
						console.log("User accepted the install prompt");
					} else {
						console.log("User dismissed the install prompt");
					}
					deferredPrompt = null; // Clear the event
				});
			}
		},
		{ once: true },
	);
});

const adjustViewport = () => {
	const vh = window.innerHeight * 0.01;
	document.documentElement.style.setProperty("--vh", `${vh}px`);
};

// Adjust viewport on page load and resize
window.addEventListener("load", adjustViewport);
window.addEventListener("resize", adjustViewport);
