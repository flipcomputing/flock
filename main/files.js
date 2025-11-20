import * as Blockly from "blockly";
import { workspace } from "./blocklyinit.js";
import { translate } from "./translation.js";

// Function to save the current workspace state
export function saveWorkspace(workspace) {
	const state = Blockly.serialization.workspaces.save(workspace);
	const key = "flock_autosave.json";
	localStorage.setItem(key, JSON.stringify(state));
}

function validateBlocklyJson(json) {
	// 1. Parse JSON safely
	let data;
	try {
		data = typeof json === "string" ? JSON.parse(json) : json;
	} catch (e) {
		throw new Error("Invalid JSON format");
	}

	// 2. Check for dangerous properties that could execute code
	const dangerousKeys = [
		"__proto__",
		"constructor",
		"prototype",
		"eval",
		"Function",
		"setTimeout",
		"setInterval",
		"innerHTML",
		"outerHTML",
		"onclick",
		"onerror",
		"onload",
	];

	function checkForDangerousContent(obj, path = "") {
		if (obj === null || obj === undefined) return;

		// Check primitive values for suspicious patterns
		if (typeof obj === "string") {
			// Skip validation for block IDs - they can contain random characters
			if (path.endsWith(".id") || path.endsWith(".ID_VAR.id")) {
				return;
			}

			// Allow newlines in specific safe contexts:
			// - extraState (for Blockly mutation XML)
			// - comment text (for block comments and workspace comments)
			const allowNewlines =
				path.includes("extraState") ||
				path.includes("icons.comment") ||
				path.includes("workspaceComments");

			// Block newlines everywhere else as they could be code
			if (/[\r\n]/.test(obj) && !allowNewlines) {
				throw new Error(
					`Newline characters not allowed at ${path}: potential code injection`,
				);
			}

			// Normalize string by removing/reducing whitespace for pattern matching
			const normalized = obj.replace(/\s+/g, " ").trim();

			// Look for script tags, event handlers, or javascript: protocol
			const suspiciousPatterns = [
				/<\s*script/i,
				/javascript\s*:/i,
				/on\w+\s*=/i, // Event handlers like onclick=
				/\beval\s*\(/i,
				/\bFunction\s*\(/i,
				/\bnew\s+Function/i,
				/\bimport\s*\(/i, // Dynamic imports
				/\bimport\s+.*from/i,
				/\brequire\s*\(/i,
				/\bexec\s*\(/i,
				/\bspawn\s*\(/i,
				/\bsetTimeout\s*\(/i,
				/\bsetInterval\s*\(/i,
				/\bsetImmediate\s*\(/i,
				/\bexecScript/i,
				/\bexpression\s*\(/i, // IE expression()
				/vbscript:/i,
				/data:text\/html/i,
				/<\s*iframe/i,
				/<\s*object/i,
				/<\s*embed/i,
				/\.innerHTML\s*=/i,
				/\.outerHTML\s*=/i,
				/\bdocument\s*\.\s*write/i,
				/\bwindow\s*\.\s*location/i,
			];

			if (
				suspiciousPatterns.some((pattern) => pattern.test(normalized))
			) {
				throw new Error(
					`Suspicious content found at ${path}: potential code injection. Content: "${obj.substring(0, 50)}${obj.length > 50 ? "..." : ""}"`,
				);
			}

			// Check for suspicious character sequences that might indicate obfuscation
			const obfuscationPatterns = [
				/\\x[0-9a-f]{2}/i, // Hex escape sequences
				/\\u[0-9a-f]{4}/i, // Unicode escape sequences
				/&#x?[0-9a-f]+;/i, // HTML entities
				/%[0-9a-f]{2}/i, // URL encoded characters
			];

			// Count suspicious patterns - allow a few for legitimate use, but flag excessive use
			const suspiciousCount = obfuscationPatterns.filter((pattern) =>
				pattern.test(obj),
			).length;
			if (suspiciousCount >= 2) {
				throw new Error(`Potential obfuscation detected at ${path}`);
			}
		}

		if (typeof obj === "object") {
			// Check for dangerous keys
			for (const key of Object.keys(obj)) {
				if (dangerousKeys.includes(key)) {
					throw new Error(
						`Dangerous property found: ${key} at ${path}`,
					);
				}
				checkForDangerousContent(
					obj[key],
					path ? `${path}.${key}` : key,
				);
			}
		}
	}

	// 3. Validate it's actually a Blockly workspace structure
	function validateBlocklyStructure(data) {
		// Empty workspace is valid
		if (Object.keys(data).length === 0) {
			return;
		}

		// Blockly workspace JSON should have specific structure
		// Check if data.blocks exists and is a non-null object (not an array)
		if (
			!data.blocks ||
			typeof data.blocks !== "object" ||
			Array.isArray(data.blocks)
		) {
			throw new Error(
				"Invalid Blockly structure: missing or invalid blocks object",
			);
		}

		// Whitelist allowed properties at root level
		const allowedRootKeys = ["blocks", "variables", "workspaceComments"];
		const rootKeys = Object.keys(data);

		for (const key of rootKeys) {
			if (!allowedRootKeys.includes(key)) {
				console.warn(`Unexpected property in Blockly JSON: ${key}`);
			}
		}

		// Whitelist allowed properties in blocks object
		const allowedBlocksKeys = ["languageVersion", "blocks"];
		if (data.blocks) {
			for (const key of Object.keys(data.blocks)) {
				if (!allowedBlocksKeys.includes(key)) {
					console.warn(
						`Unexpected property in blocks object: ${key}`,
					);
				}
			}
		}

		// Validate blocks array if present
		if (data.blocks.blocks) {
			if (!Array.isArray(data.blocks.blocks)) {
				throw new Error(
					"Invalid Blockly structure: blocks.blocks must be an array",
				);
			}
			data.blocks.blocks.forEach((block, index) => {
				validateBlock(block, `blocks.blocks[${index}]`);
			});
		}

		// Validate variables if present
		if (data.variables) {
			if (!Array.isArray(data.variables)) {
				throw new Error(
					"Invalid Blockly structure: variables must be an array",
				);
			}
			data.variables.forEach((variable, index) => {
				if (!variable.name || !variable.id) {
					throw new Error(
						`Invalid variable at variables[${index}]: must have name and id`,
					);
				}
			});
		}
	}

	// 4. Validate individual block structure
	function validateBlock(block, path) {
		if (!block || typeof block !== "object") {
			throw new Error(`Invalid block at ${path}`);
		}

		// Whitelist allowed block properties
		const allowedBlockKeys = [
			"type",
			"id",
			"x",
			"y",
			"collapsed",
			"disabled",
			"deletable",
			"movable",
			"editable",
			"inline",
			"data",
			"extraState",
			"icons",
			"fields",
			"inputs",
			"next",
			"shadow",
			"disabledReasons",
		];

		for (const key of Object.keys(block)) {
			if (!allowedBlockKeys.includes(key)) {
				throw new Error(`Unexpected block property: ${key} at ${path}`);
			}
		}

		// Validate field values (but skip extraState - it can contain XML)
		if (block.fields) {
			Object.entries(block.fields).forEach(([fieldName, fieldValue]) => {
				if (fieldValue && typeof fieldValue === "object") {
					// Field values can be objects with 'id' property for variables
					if (!fieldValue.id && fieldName !== "extraState") {
						checkForDangerousContent(
							fieldValue,
							`${path}.fields.${fieldName}`,
						);
					}
				} else if (typeof fieldValue === "string") {
					// Check string field values for dangerous content
					checkForDangerousContent(
						fieldValue,
						`${path}.fields.${fieldName}`,
					);
				}
			});
		}

		// Recursively validate nested blocks
		if (block.inputs) {
			Object.entries(block.inputs).forEach(([inputName, input]) => {
				if (input.block) {
					validateBlock(
						input.block,
						`${path}.inputs.${inputName}.block`,
					);
				}
				if (input.shadow) {
					validateBlock(
						input.shadow,
						`${path}.inputs.${inputName}.shadow`,
					);
				}
			});
		}

		if (block.next?.block) {
			validateBlock(block.next.block, `${path}.next.block`);
		}
	}

	// Run all validations
	checkForDangerousContent(data);
	validateBlocklyStructure(data);

	return data;
}

export function loadWorkspaceAndExecute(json, workspace, executeCallback) {
	try {
		if (!workspace || !json) {
			throw new Error("Invalid workspace or json data.");
		}

		// Validate JSON before loading into workspace
		const validatedJson = validateBlocklyJson(json);

		// Load the validated JSON
		Blockly.serialization.workspaces.load(validatedJson, workspace);
		workspace.scroll(0, 0);
		executeCallback();
	} catch (error) {
		console.error("Failed to load workspace:", error);

		// Handle validation errors
		if (
			error.message.includes("Suspicious content") ||
			error.message.includes("Dangerous property") ||
			error.message.includes("Invalid Blockly structure")
		) {
			console.error(
				"Security validation failed - JSON may contain malicious content",
			);
			throw error; // Re-throw security errors - don't try to recover
		}

		// Handle corruption errors
		if (error.message.includes("isDeadOrDying")) {
			console.warn("Workspace might be corrupted, attempting reset.");
			workspace.clear();
			// Note: localStorage usage - be aware this won't work in Claude artifacts
			if (typeof localStorage !== "undefined") {
				localStorage.removeItem("flock_autosave.json");
			}
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
		loadWorkspaceAndExecute(
			JSON.parse(savedState),
			workspace,
			executeCallback,
		);
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
		const ws =
			workspace && workspace.getAllBlocks
				? workspace
				: Blockly.getMainWorkspace();
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

		// Custom MIME type for Flock project files
		const FLOCK_MIME = "application/vnd.flock+json";
		const FLOCK_EXT = ".flock";

		if ("showSaveFilePicker" in window) {
			const options = {
				suggestedName: `${projectName}${FLOCK_EXT}`,
				types: [
					{
                                            description: translate(
                                                    "project_file_description",
                                            ),
						accept: {
							[FLOCK_MIME]: [FLOCK_EXT],
						},
					},
				],
			};

			const fileHandle = await window.showSaveFilePicker(options);
			const writable = await fileHandle.createWritable();
			await writable.write(jsonString);
			await writable.close();
		} else {
			const blob = new Blob([jsonString], { type: FLOCK_MIME });
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${projectName}${FLOCK_EXT}`;
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
		if (!file) return;

		const fileType = file.type;
		const fileName = file.name.toLowerCase();

		// Custom MIME for Flock snippets (matches exportBlockSnippet)
		const FLOCK_SNIP_MIME = "application/vnd.flock-snippet+json";

		const reader = new FileReader();

		reader.onload = () => {
			const content = reader.result;

			if (fileType === "image/svg+xml") {
				handleSVGImport(content);
			} else if (fileType === "image/png") {
				handlePNGImport(content);
			} else if (
				fileType === "application/json" ||
				fileType === FLOCK_SNIP_MIME ||
				fileName.endsWith(".fsnip")
			) {
				// Treat .fsnip the same as JSON snippets
				handleJSONImport(content);
			} else {
				console.error("Unsupported file type:", fileType || "(none)");
			}

			// Allow re-selecting the same file
			event.target.value = "";
		};

		if (fileType === "image/png") {
			reader.readAsArrayBuffer(file);
		} else {
			reader.readAsText(file);
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
	const fileInput = document.getElementById("fileInput");

	fileInput.addEventListener("change", function (event) {
		const file = event.target.files[0];
		if (!file) return;

		const maxSize = 5 * 1024 * 1024;
		if (file.size > maxSize) {
                    alert(translate("file_too_large_alert"));
			event.target.value = ""; // Reset the input
			return;
		}

		const lowerName = file.name.toLowerCase();
		if (!lowerName.endsWith(".json") && !lowerName.endsWith(".flock")) {
                    alert(translate("invalid_filetype_alert"));
			event.target.value = ""; // Reset the input
			return;
		}

		const reader = new FileReader();
		reader.onload = function () {
			window.loadingCode = true;
			try {
				const text = reader.result;
				if (typeof text !== "string") {
					console.log("Invalid file content: not a string");
					throw new Error("File content is invalid (not a string)");
				}
				if (text.length > 4 * 1024 * 1024) {
					console.log("Invalid file content: too large");
					throw new Error("File content is too large");
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
					rawName.replace(/[^a-zA-Z0-9_.-]/g, "").substring(0, 50) ||
					"untitled";

				// Remove .json or .flock extension (case-insensitive) before using as project name
				const baseName = sanitizedName.replace(/\.(json|flock)$/i, "");

				document.getElementById("projectName").value =
					stripFilename(baseName);

				loadWorkspaceAndExecute(json, workspace, executeCallback);
			} catch (e) {
				console.error("Error loading Blockly project:", e);
                            alert(translate("invalid_project_alert"));
				window.loadingCode = false;
			} finally {
				// Reset the input so the same file can be selected again
				event.target.value = "";
			}
		};
		reader.onerror = function () {
                    alert(translate("failed_to_read_file_alert"));
			window.loadingCode = false;
			event.target.value = ""; // Reset the input
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
		const selectedOption =
			exampleSelect.options[exampleSelect.selectedIndex].text;
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
