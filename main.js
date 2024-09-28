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
} from "./blocks";
import { defineGenerators, meshMap } from "./generators";

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

//let mousePos = { x: 0, y: 0 };
//flock.mousePos = mousePos;
let gizmoManager;
let toolboxVisible = false;

function executeCode() {
	if (flock.engineReady) {
		// Check if the debug layer is visible
		const debugLayerVisible = flock.scene.debugLayer.isVisible();

		// Recreate the scene
		flock.scene = flock.createScene();

		if (debugLayerVisible) {
			flock.scene.debugLayer.show();
		}

		gizmoManager = new flock.BABYLON.GizmoManager(flock.scene, 8);

		const code = javascriptGenerator.workspaceToCode(workspace);
		try {
			console.log(code);
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
	document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

	const canvas = document.getElementById("renderCanvas"); // Assuming your canvas has this ID

	const onClick = function (event) {
		const pickResult = flock.scene.pick(event.clientX, event.clientY);
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
				addShadowBlock(block, "SCALE", "math_number", 1); // Using 'math_number' block for scale

				// Add shadow block for COLOR
				addShadowBlock(
					block,
					"COLOR",
					"colour",
					objectColours[objectName],
				);

				// Create a new 'start' block and connect the load_object block to it
				const startBlock = workspace.newBlock("start");
				startBlock.initSvg();
				startBlock.render();

				// Connect the load_object block to the start block
				const connection = startBlock.getInput("DO").connection;
				if (connection) {
					connection.connect(block.previousConnection);
				}
			} finally {
				// End the event group to ensure everything can be undone/redone as a group
				Blockly.Events.setGroup(false);
			}
		}

		document.body.style.cursor = "default";
		canvas.removeEventListener("click", onClick);
		executeCode(); // Your function to execute the Blockly code
	};

	canvas.addEventListener("click", onClick);
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

// Handle model selection and add block to workspace
function selectModel(modelName) {
	// Close the shapes menu after selecting a model
	document.getElementById("shapes-dropdown").style.display = "none";

	document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

	// Add a delay to avoid immediate firing
	setTimeout(() => {
		const onPick = function (event) {
			const pickResult = flock.scene.pick(event.clientX, event.clientY);
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
					addShadowBlock(block, "SCALE", "math_number", 1); // Default scale value

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
				} finally {
					// End the event group to ensure undo/redo works properly
					Blockly.Events.setGroup(false);
				}
			}

			document.body.style.cursor = "default"; // Reset cursor after picking
			window.removeEventListener("click", onPick); // Remove the click listener after pick

			executeCode(); // Execute any code after the block is created
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
			const pickResult = flock.scene.pick(event.clientX, event.clientY); // Get pick result from the scene
			if (pickResult.hit) {
				const pickedPosition = pickResult.pickedPoint; // Get picked position

				addShapeToWorkspace(shapeType, pickedPosition); // Add the selected shape at this position
				document.body.style.cursor = "default"; // Reset cursor after picking
				window.removeEventListener("click", onPick); // Remove the click listener after pick
				executeCode();
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

	// Delay the pick listener to avoid firing immediately
	setTimeout(() => {
		const onPick = function (event) {
			const pickResult = flock.scene.pick(event.clientX, event.clientY);
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
					addShadowBlock(block, "SCALE", "math_number", 1); // Default scale value

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
				} finally {
					// End the event group to ensure everything can be undone/redone as a group
					Blockly.Events.setGroup(false);
				}
			}

			document.body.style.cursor = "default";
			window.removeEventListener("click", onPick);
			executeCode(); // Your function to execute the Blockly code
		};

		window.addEventListener("click", onPick);
	}, 300); // Small delay to avoid firing immediately from the menu click
}

window.selectCharacter = selectCharacter;

function updateCharacterColor(mesh, selectedColor) {
	// Step 1: Identify the ultimate parent mesh
	let parentMesh = mesh;
	while (parentMesh.parent) {
		parentMesh = parentMesh.parent; // Traverse up to the ultimate parent
	}

	// Step 2: Retrieve the corresponding Blockly block using the parent mesh's blockKey
	const block = meshMap[parentMesh.blockKey];
	if (!block) {
		console.error("Block not found for mesh:", parentMesh.blockKey);
		return;
	}

	// Step 3: Map material names to Blockly input field names
	const materialToFieldMap = {
		Hair: "HAIR_COLOR",
		Skin: "SKIN_COLOR",
		Eyes: "EYES_COLOR",
		Sleeves: "SLEEVES_COLOR",
		Shorts: "SHORTS_COLOR",
		"T-Shirt": "TSHIRT_COLOR",
	};

	// Step 4: Find the field name based on the mesh's material name
	const materialName = mesh.material.name; // Assumes the material name matches the part
	const fieldName = materialToFieldMap[materialName];

	if (!fieldName) {
		console.error("No matching field for material:", materialName);
		return;
	}

	// Step 5: Update the block's corresponding color field
	const colorInput = block.getInput(fieldName);
	if (colorInput && colorInput.connection.targetBlock()) {
		// Update the color value in the already existing shadow block
		colorInput.connection
			.targetBlock()
			.setFieldValue(selectedColor, "COLOR");
	}

	// Step 6: Re-render the block to apply the changes
	block.initSvg();
	block.render();
}

function onMeshPicked(pickedMesh, selectedColor) {
	// Check if the picked mesh is part of a character by examining its material
	const materialName = pickedMesh.material?.name;
	const characterMaterials = [
		"Hair",
		"Skin",
		"Eyes",
		"Sleeves",
		"Shorts",
		"T-Shirt",
	];

	if (characterMaterials.includes(materialName)) {
		// If the picked mesh is part of a character, update the Blockly block
		updateCharacterColor(pickedMesh, selectedColor);
	} else {
		// For non-character meshes, use another function
		applyColorToMeshOrDescendant(pickedMesh, selectedColor);
	}
}

function addShapeToWorkspace(shapeType, position) {
	Blockly.Events.setGroup(true);
	// Create the shape block in the Blockly workspace
	const block = workspace.newBlock(shapeType);

	// Set different fields based on the shape type
	switch (shapeType) {
		case "create_box":
			addShadowBlock(block, "COLOR", "colour", flock.randomColour()); // Using 'colour' block type
			addShadowBlock(block, "WIDTH", "math_number", 1);
			addShadowBlock(block, "HEIGHT", "math_number", 1);
			addShadowBlock(block, "DEPTH", "math_number", 1);
			break;

		case "create_sphere":
			addShadowBlock(block, "COLOR", "colour", flock.randomColour());
			addShadowBlock(block, "DIAMETER_X", "math_number", 1);
			addShadowBlock(block, "DIAMETER_Y", "math_number", 1);
			addShadowBlock(block, "DIAMETER_Z", "math_number", 1);
			break;

		case "create_cylinder":
			addShadowBlock(block, "COLOR", "colour", flock.randomColour());
			addShadowBlock(block, "HEIGHT", "math_number", 2);
			addShadowBlock(block, "DIAMETER_TOP", "math_number", 1);
			addShadowBlock(block, "DIAMETER_BOTTOM", "math_number", 1);
			break;

		case "create_capsule":
			addShadowBlock(block, "COLOR", "colour", flock.randomColour());
			addShadowBlock(block, "RADIUS", "math_number", 0.5);
			addShadowBlock(block, "HEIGHT", "math_number", 2);
			break;

		case "create_plane":
			addShadowBlock(block, "COLOR", "colour", flock.randomColour());
			addShadowBlock(block, "WIDTH", "math_number", 2);
			addShadowBlock(block, "HEIGHT", "math_number", 2);
			break;

		default:
			console.error("Unknown shape type: " + shapeType);
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

	// Connect the shape block to the start block
	const connection = startBlock.getInput("DO").connection;
	if (connection) {
		connection.connect(block.previousConnection);
	}

	Blockly.Events.setGroup(false);
}

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

function openColorPicker() {
	// Create a color picker input dynamically
	const colorInput = document.createElement("input");
	colorInput.type = "color";
	colorInput.value = window.selectedColor; // Set the default color

	// Trigger the color picker dialog
	colorInput.click();

	// Listen for color change
	colorInput.addEventListener("input", (event) => {
		window.selectedColor = event.target.value; // Store the selected color

		// Now allow the user to pick a mesh from the Babylon.js canvas
		pickMeshFromCanvas();
	});
}

window.openColorPicker = openColorPicker;

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

function stopCode() {
	flock.audioContext.close();
	flock.scene.dispose();
	flock.removeEventListeners();
	switchView(codeMode);
}

window.stopCode = stopCode;

function onResize() {
	Blockly.svgResize(workspace);
	resizeCanvas();
	if (flock.engine) flock.engine.resize();
}
window.onResize = onResize;

function toggleGizmo(gizmoType) {
	// Disable all gizmos
	gizmoManager.positionGizmoEnabled = false;
	gizmoManager.rotationGizmoEnabled = false;
	gizmoManager.scaleGizmoEnabled = false;
	gizmoManager.boundingBoxGizmoEnabled = false;
	gizmoManager.attachableMeshes = flock.scene.meshes.filter(
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
						mesh.physics.disablePreStep = true;
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
						mesh.physics.disablePreStep = true;
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
						mesh.physics.disablePreStep = true;
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
					mesh.physics.disablePreStep = true;
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
	if (!mesh && window.currentMesh) {
		console.log("currentMesh", window.currentMesh, window.currentBlock);

		//console.log("blockId", blockId, meshMap);
		mesh = flock.scene.getMeshByName(
			Object.keys(meshMap).find(
				(key) => meshMap[key] === window.currentBlock,
			),
		);
	}

	if (!mesh) return;

	const boundingInfo = mesh.getBoundingInfo();
	const newTarget = boundingInfo.boundingBox.centerWorld; // Center of the new mesh
	const camera = flock.scene.activeCamera;

	// If the camera is following a player (tracked via camera.metadata.following)
	if (camera.metadata && camera.metadata.following) {
		const player = camera.metadata.following; // The player (mesh) the camera is following

		// Maintain the player's Y position (on the ground)
		const originalPlayerY = player.position.y;

		// Set the player's position directly in front of the new target
		const playerDistance = camera.radius; // Distance the camera keeps from the player
		player.position.set(
			newTarget.x,
			originalPlayerY, // Maintain player's Y position
			newTarget.z + playerDistance, // Move the player in front of the target on the Z axis
		);

		flock.attachCamera(player.name, camera.radius);
		player.lookAt(newTarget);
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

	exampleSelect.value = "";
}
window.executeCode = executeCode;
window.exportCode = exportCode;
window.loadExample = loadExample;

const runCode = (code) => {
	if (codeMode === "blockly") {
		switchView("canvas");
	}
	// Create a new sandboxed environment
	try {
		// Create a sandboxed function by embedding code into a new Function
		flock.runCode(code);
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

// Function to be called once the app has fully loaded
function initializeApp() {
	console.log("Initializing app...");

	// Add event listeners for menu buttons and controls
	const runCodeButton = document.getElementById("runCodeButton");
	const toggleDesignButton = document.getElementById("toggleDesign");
	const stopCodeButton = document.getElementById("stopCodeButton");
	const fileInput = document.getElementById("fileInput");
	const exportCodeButton = document.getElementById("exportCodeButton");
	const bothViewButton = document.getElementById("bothViewButton");
	const blocklyViewButton = document.getElementById("blocklyViewButton");
	const canvasViewButton = document.getElementById("canvasViewButton");

	runCodeButton.addEventListener("click", executeCode);
	stopCodeButton.addEventListener("click", stopCode);
	toggleDesignButton.addEventListener("click", toggleDesign);
	exportCodeButton.addEventListener("click", exportCode);

	// Enable the file input after initialization
	fileInput.removeAttribute("disabled");

	// View switching buttons
	bothViewButton.addEventListener("click", () => switchView("both"));
	blocklyViewButton.addEventListener("click", () => switchView("blockly"));
	canvasViewButton.addEventListener("click", () => switchView("canvas"));

	// Add event listener to file input
	document
		.getElementById("importFile")
		.addEventListener("change", handleSnippetUpload);

	toggleDesignButton.addEventListener("click", function () {
		if (!flock.scene) return;

		const blocklyArea = document.getElementById("codePanel");
		const canvasArea = document.getElementById("rightArea");
		const menu = document.getElementById("menu");
		const gizmoButtons = document.getElementById("gizmoButtons");

		if (flock.scene.debugLayer.isVisible()) {
			console.log("Debug layer is visible");
			canvasArea.style.width = "100%";
			canvasArea.style.flexGrow = "1";
			switchView(viewMode);
			flock.scene.debugLayer.hide();
			onResize();
		} else {
			blocklyArea.style.display = "none";
			codeMode = "none";
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
	const aboutButton = document.getElementById("aboutButton");

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
	colorPickerButton.addEventListener("click", openColorPicker);
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

	// Enable buttons and dropdowns after initialization
	const toolboxControl = document.getElementById("toolboxControl");
	const runCodeButton2 = document.getElementById("runCodeButton2");
	const exampleSelect = document.getElementById("exampleSelect");
	const bothViewButton2 = document.getElementById("bothViewButton2");
	const blocklyViewButton2 = document.getElementById("blocklyViewButton2");
	const canvasViewButton2 = document.getElementById("canvasViewButton2");
	const fullscreenToggle = document.getElementById("fullscreenToggle");

	toolboxControl.removeAttribute("disabled");
	runCodeButton.removeAttribute("disabled");
	runCodeButton2.removeAttribute("disabled");
	exampleSelect.removeAttribute("disabled");
	bothViewButton.removeAttribute("disabled");
	blocklyViewButton.removeAttribute("disabled");
	canvasViewButton.removeAttribute("disabled");
	bothViewButton2.removeAttribute("disabled");
	blocklyViewButton2.removeAttribute("disabled");
	canvasViewButton2.removeAttribute("disabled");
	fullscreenToggle.removeAttribute("disabled");

	// Add event listeners for buttons and controls
	toolboxControl.addEventListener("mouseover", function () {
		toolboxControl.style.cursor = "pointer";
		toggleToolbox();
	});

	runCodeButton.addEventListener("click", executeCode);
	exampleSelect.addEventListener("change", loadExample);

	bothViewButton.addEventListener("click", () => switchView("both"));
	blocklyViewButton.addEventListener("click", () => switchView("blockly"));
	canvasViewButton.addEventListener("click", () => switchView("canvas"));

	bothViewButton2.addEventListener("click", () => switchView("both"));
	blocklyViewButton2.addEventListener("click", () => switchView("blockly"));
	canvasViewButton2.addEventListener("click", () => switchView("canvas"));
}

window.onload = function () {
	const scriptElement = document.getElementById("flock");
	if (scriptElement) {
		initializeFlock();
		console.log("Standalone Flock");
		return; // standalone flock
	}

	workspace = Blockly.inject("blocklyDiv", options);
	registerFieldColour();

	workspace.addChangeListener(handleBlockSelect);

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
	observeFlyoutVisibility(workspace);
	window.toolboxVisible = toolboxVisible;

	onResize();

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

	workspace.getToolbox().setVisible(false);

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
