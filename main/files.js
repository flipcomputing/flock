
import * as Blockly from "blockly";
import { workspace } from "./blocklyinit.js";

// Function to save the current workspace state
export function saveWorkspace(workspace) {
	const state = Blockly.serialization.workspaces.save(workspace);
	const key = "flock_autosave.json";
	localStorage.setItem(key, JSON.stringify(state));
}

// Function to load workspace and execute callback
export function loadWorkspaceAndExecute(json, workspace, executeCallback) {
	try {
		if (!workspace || !json) {
			throw new Error("Invalid workspace or json data.");
		}

		Blockly.serialization.workspaces.load(json, workspace);

		workspace.scroll(0, 0);

		executeCallback();
	} catch (error) {
		console.error("Failed to load workspace:", error);

		if (error.message.includes("isDeadOrDying")) {
			console.warn("Workspace might be corrupted, attempting reset.");
			workspace.clear();
			localStorage.removeItem("flock_autosave.json");
		}
	}
}

// Function to load workspace from various sources
export function loadWorkspace(workspace, executeCallback) {
	const urlParams = new URLSearchParams(window.location.search);
	const projectUrl = urlParams.get("project");
	const reset = urlParams.get("reset");
	const savedState = localStorage.getItem("flock_autosave.json");
	const starter = "examples/starter.json";

	function loadStarter() {
		fetch(starter)
			.then((response) => response.json())
			.then((json) => {
				loadWorkspaceAndExecute(json, workspace, executeCallback);
			})
			.catch((error) => {
				console.error("Error loading starter example:", error);
			});
	}

	if (reset) {
		console.warn("Resetting workspace and clearing local storage.");
		workspace.clear();
		localStorage.removeItem("flock_autosave.json");
		loadStarter();
		return;
	}

	if (projectUrl) {
		if (projectUrl === "starter") {
			loadStarter();
		} else {
			fetch(projectUrl)
				.then((response) => {
					if (!response.ok) throw new Error("Invalid response");
					return response.json();
				})
				.then((json) => {
					loadWorkspaceAndExecute(json, workspace, executeCallback);
				})
				.catch((error) => {
					console.error("Error loading project from URL:", error);
					loadStarter();
				});
		}
	} else if (savedState) {
		loadWorkspaceAndExecute(JSON.parse(savedState), workspace, executeCallback);
	} else {
		loadStarter();
	}
}

// Function to strip filename from path
export function stripFilename(inputString) {
	const removeEnd = inputString.replace(/\(\d+\)/g, "");
	let lastIndex = Math.max(
		removeEnd.lastIndexOf("/"),
		removeEnd.lastIndexOf("\\"),
	);

	if (lastIndex === -1) {
		return removeEnd.trim();
	}

	return removeEnd.substring(lastIndex + 1).trim();
}

// Function to export project code
export async function exportCode(workspace) {
	try {
		const projectName =
			document.getElementById("projectName").value || "default_project";

		// Ensure we have a valid workspace
		const ws = workspace && workspace.getAllBlocks ? workspace : Blockly.getMainWorkspace();
		if (!ws || !ws.getAllBlocks) {
			throw new Error("No valid workspace found");
		}

		let usedModels = Blockly.Variables.allUsedVarModels(ws);
		let allModels = ws.getVariableMap().getAllVariables();
		for (const model of allModels) {
			if (
				!usedModels.find((element) => element.getId() === model.getId())
			) {
				ws.deleteVariableById(model.getId());
			}
		}

		const json = Blockly.serialization.workspaces.save(ws);
		const jsonString = JSON.stringify(json, null, 2);

		if ("showSaveFilePicker" in window) {
			const options = {
				suggestedName: `${projectName}.json`,
				types: [
					{
						description: "JSON Files",
						accept: { "application/json": [".json"] },
					},
				],
			};

			const fileHandle = await window.showSaveFilePicker(options);
			const writable = await fileHandle.createWritable();
			await writable.write(jsonString);
			await writable.close();
		} else {
			const blob = new Blob([jsonString], { type: "application/json" });
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${projectName}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	} catch (e) {
		console.error("Error exporting project:", e);
	}
}

// Function to import snippet from file
export function importSnippet() {
	const fileInput = document.getElementById("importFile");
	fileInput.click();

	fileInput.onchange = (event) => {
		const file = event.target.files[0];
		if (file) {
			const fileType = file.type;
			const reader = new FileReader();
			
			reader.onload = () => {
				const content = reader.result;

				if (fileType === "image/svg+xml") {
					handleSVGImport(content);
				} else if (fileType === "image/png") {
					handlePNGImport(content);
				} else if (fileType === "application/json") {
					handleJSONImport(content);
				} else {
					console.error("Unsupported file type:", fileType);
				}
			};
			
			if (fileType === "image/png") {
				reader.readAsArrayBuffer(file);
			} else {
				reader.readAsText(file);
			}
		}
	};
}

// Handle SVG import
function handleSVGImport(content) {
	try {
		const parser = new DOMParser();
		const svgDoc = parser.parseFromString(content, "image/svg+xml");
		const metadataElement = svgDoc.querySelector("metadata");
		
		if (!metadataElement) {
			console.error("No <metadata> tag found in the SVG file.");
			return;
		}

		const metadataContent = metadataElement.textContent.trim();
		const parsedData = JSON.parse(metadataContent);
		
		if (!parsedData.blockJson) {
			console.error("Metadata JSON does not contain 'blockJson'.");
			return;
		}

		const blockJson = JSON.parse(parsedData.blockJson);
		const workspace = Blockly.getMainWorkspace();
		Blockly.serialization.blocks.append(blockJson, workspace);
	} catch (error) {
		console.error("Error processing SVG file:", error);
	}
}

// Handle PNG import
function handlePNGImport(content) {
	try {
		const arrayBuffer = new Uint8Array(content);
		const encodedMetadata = getMetadata(arrayBuffer, "blockJson");

		if (!encodedMetadata) {
			console.error("No metadata found in the PNG file.");
			return;
		}

		const decodedMetadata = JSON.parse(decodeURIComponent(encodedMetadata));
		const workspace = Blockly.getMainWorkspace();
		Blockly.serialization.blocks.append(decodedMetadata, workspace);
	} catch (error) {
		console.error("Error processing PNG metadata:", error);
	}
}

// Handle JSON import
function handleJSONImport(content) {
	try {
		const blockJson = JSON.parse(content);
		const workspace = Blockly.getMainWorkspace();
		Blockly.serialization.blocks.append(blockJson, workspace);
	} catch (error) {
		console.error("Error processing JSON file:", error);
	}
}

// Function to set up file input handler
export function setupFileInput(workspace, executeCallback) {
	document.getElementById("fileInput").addEventListener("change", function (event) {
		const file = event.target.files[0];
		if (!file) return;

		const maxSize = 5 * 1024 * 1024;
		if (file.size > maxSize) {
			alert("File too large. Maximum size is 5MB.");
			return;
		}

		if (!file.name.toLowerCase().endsWith(".json")) {
			alert("Only JSON files are allowed.");
			return;
		}

		const reader = new FileReader();
		reader.onload = function () {
			window.loadingCode = true;

			try {
				const text = reader.result;

				if (typeof text !== "string" || text.length > 1024 * 1024) {
					throw new Error("File content is invalid or too large");
				}

				const json = JSON.parse(text);

				if (
					!json ||
					typeof json !== "object" ||
					!json.blocks ||
					typeof json.blocks !== "object" ||
					!json.blocks.blocks
				) {
					throw new Error("Invalid Blockly project file structure");
				}

				const rawName = file.name || "untitled";
				const sanitizedName =
					rawName
						.replace(/[^a-zA-Z0-9_-]/g, "")
						.substring(0, 50) || "untitled";
				document.getElementById("projectName").value =
					stripFilename(sanitizedName.replace("json", ""));

				loadWorkspaceAndExecute(json, workspace, executeCallback);
			} catch (e) {
				console.error("Error loading Blockly project:", e);
				alert("This file isn't a valid Blockly project.");
				window.loadingCode = false;
			}
		};

		reader.onerror = function () {
			alert("Failed to read file.");
			window.loadingCode = false;
		};

		reader.readAsText(file);
	});
}

// Function to load example projects
export function loadExample(workspace, executeCallback) {
	window.loadingCode = true;

	const exampleSelect = document.getElementById("exampleSelect");
	const exampleFile = exampleSelect.value;
	const projectNameElement = document.getElementById("projectName");

	if (exampleFile) {
		const selectedOption = exampleSelect.options[exampleSelect.selectedIndex].text;
		projectNameElement.value = selectedOption;

		fetch(exampleFile)
			.then((response) => response.json())
			.then((json) => {
				console.log("Loading:", selectedOption);
				loadWorkspaceAndExecute(json, workspace, executeCallback);
			})
			.catch((error) => {
				console.error("Error loading example:", error);
			});
	}

	exampleSelect.value = "";
}

export function loadExampleWrapper() {
	loadExample(workspace, executeCode);
}
window.loadExample = loadExampleWrapper;

export function newProject() {
  // Set project name
  const projectNameElement = document.getElementById("projectName");
  if (projectNameElement) {
	projectNameElement.value = "New";
  }

  // Load the empty project template
  fetch("examples/new.json")
	.then((response) => response.json())
	.then((json) => {
	  loadWorkspaceAndExecute(json, workspace, executeCode);
	})
	.catch((error) => {
	  console.error("Error loading new project:", error);
	});
}

window.newProject = newProject;
