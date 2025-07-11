// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from "blockly";

import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { flock, initializeFlock } from "../flock.js";
import { initializeVariableIndexes } from "../blocks";
import { meshMap, meshBlockIdMap } from "../generators";
import {
	enableGizmos,
	setGizmoManager,
	disposeGizmoManager,
} from "../ui/gizmos.js";
import { executeCode, stopCode } from "./execution.js";
import "../ui/addmeshes.js";
import {
	initializeBlocks,
	initializeWorkspace,
	createBlocklyWorkspace,
	getWorkspace,
	overrideSearchPlugin,
	workspace,
} from "./blocklyinit.js";
import {
	saveWorkspace,
	loadWorkspaceAndExecute,
	loadWorkspace,
	stripFilename,
	exportCode,
	importSnippet,
	setupFileInput,
	loadExample,
} from "./files.js";
import { onResize, toggleDesignMode, togglePlayMode, initializeUI, switchView, } from "./view.js"

if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("../sw.js")
		.then((registration) => {
			console.log("Service Worker registered:", registration);

			// Check for updates to the Service Worker
			registration.onupdatefound = () => {
				const newWorker = registration.installing;

				if (newWorker) {
					newWorker.onstatechange = () => {
						if (newWorker.state === "installed") {
							// If the old Service Worker is controlling the page
							if (navigator.serviceWorker.controller) {
								// Notify the user about the update
								console.log("New update available");
								showUpdateNotification();
							}
						}
					};
				}
			};
		})
		.catch((error) => {
			console.error("Service Worker registration failed:", error);
		});
}

function showUpdateNotification() {
	const notification = document.createElement("div");
	notification.innerHTML = `
	<div style="position: fixed; bottom: 0; left: 0; width: 100%; background: #511D91; color: white; text-align: center; padding: 10px; z-index: 1000;">
	  A new version of Flock is available. <button id="reload-btn" style="background: white; color: #511D91; padding: 5px 10px; border: none; cursor: pointer;">Reload</button>
	</div>
  `;
	document.body.appendChild(notification);

	document.getElementById("reload-btn").addEventListener("click", () => {
		// Reload the page to activate the new service worker
		window.location.reload();
	});
}

console.log("Blockly version:", Blockly.VERSION);


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
};
*/

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

function addExportPNGContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "exportPNG",
		weight: 100,
		displayText: function () {
			return "Export as PNG";
		},
		preconditionFn: function (scope) {
			return "enabled";
		},
		callback: function (scope) {
			if (scope.block) {
				exportBlockAsPNG(scope.block);
			} else if (scope.workspace) {
				//exportWorkspaceAsPNG(scope.workspace);
			}
		},
		scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
		checkbox: false,
	});
}

// Extend Blockly with custom context menu for exporting SVG of the workspace
function addExportSVGContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "exportSVG",
		weight: 101,
		displayText: function () {
			return "Export as SVG";
		},
		preconditionFn: function (scope) {
			return "enabled";
		},
		callback: function (scope) {
			if (scope.block) {
				// Export selected block or stack as SVG
				exportBlockAsSVG(scope.block);
			} else if (scope.workspace) {
				// Export the entire workspace as SVG
				exportWorkspaceAsSVG(scope.workspace);
			}
		},
		scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
		checkbox: false,
	});
}


function loadExampleWrapper() {
	loadExample(workspace, executeCode);
}

window.executeCode = executeCode;
window.exportCode = () => exportCode(workspace);
window.loadExample = loadExampleWrapper;


function initializeApp() {
	console.log("Initializing app...");

	// Add event listeners for menu buttons and controls
	const runCodeButton = document.getElementById("runCodeButton");
	const toggleDesignButton = document.getElementById("toggleDesign");
	const togglePlayButton = document.getElementById("togglePlay");
	const stopCodeButton = document.getElementById("stopCodeButton");
	const fileInput = document.getElementById("fileInput");
	const exportCodeButton = document.getElementById("exportCodeButton");
	const openButton = document.getElementById("openButton");

	runCodeButton.addEventListener("click", executeCode);
	stopCodeButton.addEventListener("click", stopCode);
	exportCodeButton.addEventListener("click", exportCode);

	// Make open button work with keyboard
	openButton.addEventListener("click", () => {
		fileInput.click();
	});

	openButton.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			fileInput.click();
		}
	});

	// Enable the file input after initialization
	fileInput.removeAttribute("disabled");

	toggleDesignButton.addEventListener("click", toggleDesignMode);

	togglePlayButton.addEventListener("click", togglePlayMode);

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

	enableGizmos();
	// Enable gizmo buttons

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

	exampleSelect.addEventListener("change", loadExampleWrapper);

	onResize();
}

async function exportWorkspaceAsSVG(workspace) {
	// Get the SVG element representing the entire workspace
	const svg = workspace.getParentSvg().cloneNode(true);

	// Adjust the dimensions to fit the content
	const bbox = svg.getBBox();
	svg.setAttribute("width", bbox.width);
	svg.setAttribute("height", bbox.height);
	svg.setAttribute(
		"viewBox",
		`${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`,
	);

	// Convert the SVG to a data URL
	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(svg);
	const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });

	// Create a download link
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = "workspace.svg";
	link.click();
	document.body.appendChild(link);
	document.body.removeChild(link);
}

async function convertFontToBase64(fontUrl) {
	const response = await fetch(fontUrl);
	const fontBlob = await response.blob();
	const reader = new FileReader();

	return new Promise((resolve, reject) => {
		reader.onloadend = () => {
			const base64Data = reader.result.split(",")[1]; // Remove the data URL prefix
			resolve(base64Data);
		};
		reader.onerror = reject;
		reader.readAsDataURL(fontBlob); // Read as data URL and convert to base64
	});
}

async function generateSVG(block) {
	const svgBlock = block.getSvgRoot().cloneNode(true);
	const serializer = new XMLSerializer();

	svgBlock.removeAttribute("transform");

	const bbox = block.getSvgRoot().getBBox();

	const images = svgBlock.querySelectorAll("image");
	await Promise.all(
		Array.from(images).map(async (img) => {
			const href =
				img.getAttribute("xlink:href") || img.getAttribute("href");
			if (href && !href.startsWith("data:")) {
				try {
					const response = await fetch(href);
					const blob = await response.blob();
					const reader = new FileReader();
					const dataUrl = await new Promise((resolve) => {
						reader.onload = () => resolve(reader.result);
						reader.readAsDataURL(blob);
					});
					img.setAttribute("xlink:href", dataUrl);
					img.setAttribute("href", dataUrl);
				} catch (error) {
					console.error(`Failed to embed image: ${href}`, error);
				}
			}
		}),
	);

	const uiElements = svgBlock.querySelectorAll("rect.blocklyFieldRect");
	uiElements.forEach((element) => {
		const parentBlock = element.closest(".blocklyDraggable");
		if (element.classList.contains("blocklyDropdownRect")) {
			const blockFill = parentBlock
				?.querySelector(".blocklyPath")
				?.getAttribute("fill");
			if (blockFill) {
				element.setAttribute("fill", blockFill);
			}
			element.setAttribute("stroke", "#999999");
			element.setAttribute("stroke-width", "1px");
		} else if (element.classList.contains("blocklyCheckbox")) {
			element.setAttribute("style", "fill: #ffffff !important;");
			element.setAttribute("stroke", "#999999");
			element.setAttribute("stroke-width", "1px");
		} else {
			element.setAttribute("fill", "none");
			element.setAttribute("stroke", "#999999");
			element.setAttribute("stroke-width", "1px");
		}
	});

	const uiTexts = svgBlock.querySelectorAll(
		"text.blocklyCheckbox, text.blocklyText",
	);
	uiTexts.forEach((textElement) => {
		textElement.setAttribute("style", "fill: #000000 !important;");
		textElement.setAttribute("stroke", "none");
		textElement.setAttribute("font-weight", "600");
	});

	const fontBase64 = await convertFontToBase64("./fonts/Asap-Medium.woff2");

	const style = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"style",
	);
	style.textContent = `
	@font-face {
	  font-family: "Asap";
	  src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
	}
	.blocklyText {
	  font-family: "Asap", sans-serif;
	  font-weight: 500;
	}
	.blocklyEditableText rect.blocklyFieldRect:not(.blocklyDropdownRect) {
	  fill: #ffffff !important; 
	}
  `;
	svgBlock.insertBefore(style, svgBlock.firstChild);

	const wrapperSVG = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"svg",
	);
	wrapperSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	wrapperSVG.setAttribute("width", bbox.width);
	wrapperSVG.setAttribute("height", bbox.height);
	wrapperSVG.setAttribute("viewBox", `0 0 ${bbox.width} ${bbox.height}`);

	const translationGroup = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"g",
	);
	translationGroup.setAttribute(
		"transform",
		`translate(${-bbox.x}, ${-bbox.y})`,
	);
	translationGroup.appendChild(svgBlock);

	wrapperSVG.appendChild(translationGroup);

	// Get the JSON representation of the block
	const blockJson = JSON.stringify(Blockly.serialization.blocks.save(block));
	const encodedJson = encodeURIComponent(blockJson); // Ensure it is URL-encoded

	// Embed the JSON in a <metadata> tag inside the SVG
	const metadata = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"metadata",
	);
	metadata.textContent = `{"blockJson": "${encodedJson}"}`;
	wrapperSVG.appendChild(metadata);

	const svgString = serializer.serializeToString(wrapperSVG);
	const svgDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
	const finalSVG = `${svgDeclaration}${svgString}`;

	return finalSVG;
}

async function exportBlockAsSVG(block) {
	const finalSVG = await generateSVG(block);

	// Create and download the SVG blob
	const blob = new Blob([finalSVG], { type: "image/svg+xml" });
	const link = document.createElement("a");
	link.download = `${block.type}.svg`;
	link.href = URL.createObjectURL(blob);
	document.body.appendChild(link);
	document.body.removeChild(link);
}

import { addMetadata } from "meta-png";

async function exportBlockAsPNG(block) {
	const finalSVG = await generateSVG(block);
	const blockJson = JSON.stringify(Blockly.serialization.blocks.save(block));
	const encodedJson = encodeURIComponent(blockJson);

	const img = new Image();
	const svgBlob = new Blob([finalSVG], { type: "image/svg+xml" });
	const svgUrl = URL.createObjectURL(svgBlob);

	const scale = 2; // Adjust for higher resolution

	img.onload = () => {
		const canvas = document.createElement("canvas");
		const scaledWidth = img.width * scale;
		const scaledHeight = img.height * scale;
		canvas.width = scaledWidth;
		canvas.height = scaledHeight;
		const ctx = canvas.getContext("2d");

		// Improve image quality by setting a higher resolution
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";

		// Draw at a higher resolution
		ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

		canvas.toBlob(async (pngBlob) => {
			if (!pngBlob) {
				console.error("Failed to create PNG blob");
				return;
			}

			const arrayBuffer = await pngBlob.arrayBuffer();
			const updatedPngBuffer = addMetadata(
				new Uint8Array(arrayBuffer),
				"blockJson",
				encodedJson,
			);

			const updatedBlob = new Blob([updatedPngBuffer], {
				type: "image/png",
			});
			const updatedUrl = URL.createObjectURL(updatedBlob);

			const link = document.createElement("a");
			link.download = `${block.type}.png`;
			link.href = updatedUrl;
			link.click();

			URL.revokeObjectURL(svgUrl);
			URL.revokeObjectURL(updatedUrl);
		}, "image/png");
	};

	img.onerror = (error) => {
		console.error("Failed to load SVG image:", error);
	};

	img.src = svgUrl;
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

// Function to hide loading screen
function hideLoadingScreen() {
	const loadingScreen = document.getElementById('loadingScreen');
	const loadingText = document.getElementById('loading-description');
	const body = document.body;
	
	if (loadingScreen) {
		// Announce completion to screen readers
		if (loadingText) {
			loadingText.textContent = 'Flock XR loaded successfully';
		}
		
		// First fade out loading screen
		loadingScreen.classList.add('fade-out');
		
		// Then show main content after a brief delay
		setTimeout(() => {
			body.classList.remove('loading');
		}, 250);
		
		// Remove loading screen from DOM after transition
		setTimeout(() => {
			if (loadingScreen.parentNode) {
				loadingScreen.parentNode.removeChild(loadingScreen);
			}
		}, 500);
	}
}

window.onload = function () {
	const scriptElement = document.getElementById("flock");
	if (scriptElement) {
		initializeFlock();
		console.log("Standalone Flock");
		// Hide loading screen after a short delay for standalone flock
		setTimeout(hideLoadingScreen, 1000);
		return; // standalone flock
	}

	observeBlocklyInputs();

	initializeBlocks();
	// Initialize Blockly and add custom context menu options
	addExportContextMenuOption();
	addImportContextMenuOption();
	addExportSVGContextMenuOption();
	addExportPNGContextMenuOption();
	
	createBlocklyWorkspace();
	initializeWorkspace();
	overrideSearchPlugin(workspace);

	// Resize Blockly workspace and Babylon.js canvas when the window is resized
	window.addEventListener("resize", onResize);

	Blockly.getMainWorkspace().addChangeListener((event) => {
		// Check if the event is a block collapse action
		if (
			event.type === Blockly.Events.BLOCK_CHANGE &&
			event.element === "collapsed"
		) {
			const block = Blockly.getMainWorkspace().getBlockById(
				event.blockId,
			);

			// Check if the block is a top-level block (no parent)
			if (block && !block.getParent() && block.isCollapsed()) {
				// Call Blockly's built-in clean up function
				Blockly.getMainWorkspace().cleanUp();
			}
		}
	});

	Blockly.getMainWorkspace().addChangeListener((event) => {
		// Check if the event is a block collapse/expand action
		if (
			event.type === Blockly.Events.BLOCK_CHANGE &&
			event.element === "collapsed"
		) {
			const block = Blockly.getMainWorkspace().getBlockById(
				event.blockId,
			);

			// Check if the block is a top-level block (no parent)
			if (block && !block.getParent()) {
				// Call Blockly's built-in clean up function when the block is collapsed or expanded
				Blockly.getMainWorkspace().cleanUp();
			}
		}
	});

	let dummyNextBlock = null; // Store the dummy next block
	let dummyPreviousBlock = null; // Store the dummy previous block
	let draggedBlock = null; // Variable to store the currently dragged block

	// Listen for the drag start event to detect when a block starts being dragged
	workspace.getCanvas().addEventListener("mousedown", function (event) {
		// Check if the event target is a block being dragged (using Blockly's internal event system)
		if (
			event.target &&
			event.target.block &&
			event.target.block.type === "when_clicked"
		) {
			draggedBlock = event.target.block; // Store the dragged block
			// Listen for mousemove to track the block's position during dragging
			workspace.getCanvas().addEventListener("mousemove", onMouseMove);
		}
	});

	// Listen for mouse move events during dragging to track the block's position
	function onMouseMove(event) {
		if (draggedBlock) {
			//console.log("Dragging block:", draggedBlock);

			// Check if the dragged block is over any other block
			checkIfOverAnyBlock(draggedBlock);
		}
	}

	// Check if the dragged "when_clicked" block is over any other block
	function checkIfOverAnyBlock(sourceBlock) {
		const allBlocks = workspace.getAllBlocks();
		let isOverOtherBlock = false;

		for (let i = 0; i < allBlocks.length; i++) {
			const targetBlock = allBlocks[i];

			// Skip the source block itself
			if (sourceBlock === targetBlock) continue;

			// Check if the dragged block is near the target block
			if (isBlockOverAnotherBlock(sourceBlock, targetBlock)) {
				isOverOtherBlock = true;
				break; // Stop as soon as we detect it's over a block
			}
		}

		// If the dragged block is over another block, add the next/previous blocks
		if (isOverOtherBlock) {
			addNextAndPreviousBlocks(sourceBlock);
		} else {
			// If not over another block, remove the next/previous blocks
			removeNextAndPreviousBlocks();
		}
	}

	// Check if the dragged block is near another block (e.g., within a certain distance)
	function isBlockOverAnotherBlock(sourceBlock, targetBlock) {
		const sourcePosition = sourceBlock.getRelativeToSurfaceXY();
		const targetPosition = targetBlock.getRelativeToSurfaceXY();

		// Define a "nearby" threshold distance (you can adjust this value)
		const threshold = 50;

		// Calculate the distance between the blocks
		const distanceX = Math.abs(sourcePosition.x - targetPosition.x);
		const distanceY = Math.abs(sourcePosition.y - targetPosition.y);

		return distanceX < threshold && distanceY < threshold; // If within the threshold, it's "over" the target block
	}

	// Add the "next" and "previous" blocks to the dragged block (when_clicked)
	function addNextAndPreviousBlocks(sourceBlock) {
		// Only add the blocks if they don't already exist
		if (!dummyNextBlock && !dummyPreviousBlock) {
			dummyNextBlock = workspace.newBlock("next_statement");
			dummyPreviousBlock = workspace.newBlock("previous_statement");

			// Attach the dummy blocks to the source block
			dummyNextBlock.setParent(sourceBlock);
			dummyPreviousBlock.setParent(sourceBlock);

			// Make these blocks non-interactive (they are just visual cues)
			dummyNextBlock.setEditable(false);
			dummyPreviousBlock.setEditable(false);

			// Position them next to the dragged block
			dummyNextBlock.moveBy(10, 10);
			dummyPreviousBlock.moveBy(10, 30);

			//console.log("Dummy next and previous blocks added");
		}
	}

	// Remove the next and previous blocks if the dragged block is not over another block
	function removeNextAndPreviousBlocks() {
		if (dummyNextBlock) {
			dummyNextBlock.dispose();
			dummyNextBlock = null;
		}
		if (dummyPreviousBlock) {
			dummyPreviousBlock.dispose();
			dummyPreviousBlock = null;
		}

		//console.log("Dummy next and previous blocks removed");
	}

	// Listen for the drag end event to clean up after the drag ends
	workspace.getCanvas().addEventListener("mouseup", function (event) {
		if (draggedBlock) {
			//console.log("Drag ended for block:", draggedBlock);

			// Stop the mousemove listener after the drag is done
			workspace.getCanvas().removeEventListener("mousemove", onMouseMove);

			// Clean up the visual blocks after the drag ends
			removeNextAndPreviousBlocks();

			// Reset the draggedBlock variable
			draggedBlock = null;
		}
	});

	const workspaceSvg = workspace.getParentSvg();

	// Bind mousemove event using browserEvents
	Blockly.browserEvents.bind(workspaceSvg, "mousemove", null, (event) => {
		const mouseXY = Blockly.utils.browserEvents.mouseToSvg(
			event,
			workspace.getParentSvg(),
			workspace.getInverseScreenCTM(),
		);

		const absoluteMetrics = workspace
			.getMetricsManager()
			.getAbsoluteMetrics();
		mouseXY.x -= absoluteMetrics.left;
		mouseXY.y -= absoluteMetrics.top;

		// Adjust for scrolling
		mouseXY.x -= workspace.scrollX;
		mouseXY.y -= workspace.scrollY;

		// Adjust for zoom scaling
		mouseXY.x /= workspace.scale;
		mouseXY.y /= workspace.scale;

		highlightBlockUnderCursor(workspace, mouseXY.x, mouseXY.y);
	});

	let lastHighlightedBlock = null;

	function highlightBlockUnderCursor(workspace, cursorX, cursorY) {
		if (lastHighlightedBlock) {
			lastHighlightedBlock.removeSelect();
			lastHighlightedBlock = null;
		}

		const allBlocks = workspace.getAllBlocks();

		// Flatten all descendants of each block to consider nested blocks
		const blocksWithDescendants = [];
		for (const block of allBlocks) {
			blocksWithDescendants.push(...block.getDescendants(false));
		}

		// Iterate through blocks in reverse order to prioritize inner blocks
		for (let i = blocksWithDescendants.length - 1; i >= 0; i--) {
			const block = blocksWithDescendants[i];
			if (!block.rendered) continue;

			const blockBounds = block.getBoundingRectangle();

			// Check if cursor is within block bounds
			if (
				cursorX >= blockBounds.left &&
				cursorX <= blockBounds.right &&
				cursorY >= blockBounds.top &&
				cursorY <= blockBounds.bottom
						) {
				if (isBlockDraggable(block)) {					block.addSelect();
					lastHighlightedBlock = block;
				}
				lastHighlightedBlock = block;
				break;
			}
		}
	}

	function isBlockDraggable(block) {
		// Check if block is a shadow block
		if (block.isShadow()) {
			return false;
		}

		if (block.previousConnection || block.nextConnection) {
			return false;
		}

		// Check if block is a C-block
		if (block.statementInputCount > 0) {
			return false;
		}

		// Check if block is movable
		if (!block.isMovable()) {
			return false;
		}

		// Check if block is deletable
		if (!block.isDeletable()) {
			return false;
		}

		// Output blocks are allowed
		if (block.outputConnection) {
			return true;
		}

		return true;
	}

	//Blockly.ContextMenuItems.registerCommentOptions();

	/*const navigationController = new NavigationController();
	navigationController.init();
	navigationController.addWorkspace(workspace);*/
	// Turns on keyboard navigation.
	//keyboardNav = new KeyboardNavigation(workspace);

	console.log("Welcome to Flock 🐑🐑🐑");

	// Call this function to autosave periodically
	setInterval(() => saveWorkspace(workspace), 30000); // Autosave every 30 seconds

	(async () => {
		await flock.initialize();
		
		// Hide loading screen once Flock is fully initialized
		setTimeout(hideLoadingScreen, 500);
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

	loadWorkspace(workspace, executeCode);
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

	setupFileInput(workspace, executeCode);

	const blockTypesToCleanUp = [
		"start",
		"forever",
		"when_clicked",
		"when_touches",
		"on_collision",
		"when_key_event",
		"on_event",
		"procedures_defnoreturn",
		"procedures_defreturn",
		"microbit_input",
	];

	workspace.cleanUp = function () {

		Blockly.Events.setGroup(true); // Start a new group for cleanup events

		const topBlocks = workspace.getTopBlocks(false);
		const spacing = 40;
		let cursorY = 10;
		let cursorX = 10;

		topBlocks.sort(
			(a, b) =>
				a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y,
		);

		topBlocks.forEach((block) => {
			if (blockTypesToCleanUp.includes(block.type)) {
				const blockXY = block.getRelativeToSurfaceXY();
				//console.log(`Moving block ${block.type} during cleanup`);
				block.moveBy(cursorX - blockXY.x, cursorY - blockXY.y);
				cursorY += block.getHeightWidth().height + spacing;
			}
		});

		enforceOrphanZOrder();
		Blockly.Events.setGroup(false); // End the group
		//console.log('Finished workspace cleanup');
	};

	let cleanupTimeout;

	function enforceOrphanZOrder() {
workspace.getAllBlocks().forEach((block) => {
			if (!block.getParent() && !block.isInFlyout) {	
				bringToTop(block);
			}
		});
	}

	function bringToTop(block) {
		if (block.rendered && block.bringToFront) {
			block.bringToFront();
		}
	}

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
		// Log all events during cleanup
		if (window.cleanupInProgress) {
			/*console.log('Event during cleanup:', {
				type: event.type,
				blockId: event.blockId,
				group: event.group,
				recordUndo: event.recordUndo,
				trace: new Error().stack
			});*/
		}

		try {
			const block = workspace.getBlockById(event.blockId);

			if (
				event.type === Blockly.Events.BLOCK_MOVE ||
				event.type === Blockly.Events.BLOCK_DELETE
			) {

				clearTimeout(cleanupTimeout);

				// Set a new timeout to call cleanUp after block movement settles
				cleanupTimeout = setTimeout(() => {
					window.cleanupInProgress = true;
					Blockly.Events.disable(); // Temporarily disable events
					workspace.cleanUp(); // Clean up the workspace
					Blockly.Events.enable(); // Re-enable events
					window.cleanupInProgress = false;
				}, 500); // Delay cleanup by 500ms to ensure block moves have settled
			}
		} catch (error) {
			console.error(
				"An error occurred during the Blockly workspace cleanup process:",
				error,
			);
		}
	});

	// Focus management and keyboard navigation
	function initializeFocusManagement() {
		// Modal focus trapping
		const modal = document.getElementById('infoModal');
		if (modal) {
			modal.addEventListener('keydown', trapFocus);
		}

		// Enhanced canvas keyboard support
		const canvas = document.getElementById('renderCanvas');
		if (canvas) {
			canvas.addEventListener('keydown', handleCanvasKeyboard);
		}

		// Set up custom tab order management
		setupTabOrder();
	}


function setupTabOrder() {
		function getFocusableElements() {
			const elements = [];

			// Add canvas first
			const canvas = document.getElementById('renderCanvas');
			if (canvas && isElementVisible(canvas)) {
				elements.push(canvas);
			}

			// Add gizmo buttons if visible
			const gizmoButtons = document.querySelectorAll('#gizmoButtons button, #gizmoButtons input');
			gizmoButtons.forEach(btn => {
				if (isElementVisible(btn) && !btn.disabled) {
					elements.push(btn);
				}
			});

			// Add Flock XR logo link after gizmos if visible
			const logoLink = document.querySelector('#info-panel-link');
			if (logoLink && isElementVisible(logoLink) && !elements.includes(logoLink)) {
				elements.push(logoLink);
			}

			// Add search inputs if visible  
			const searchInputs = document.querySelectorAll('.blocklySearchInput, .blocklyTreeSearch input, input[placeholder*="Search"]');
			searchInputs.forEach(input => {
				if (isElementVisible(input) && !input.disabled) {
					elements.push(input);
				}
			});

			// Add blockly workspace
			const blocklyDiv = document.getElementById('blocklyDiv');
			if (blocklyDiv && blocklyDiv.getAttribute('tabindex') === '0' && isElementVisible(blocklyDiv)) {
				elements.push(blocklyDiv);
			}

			// Add main UI elements in their natural order
			const mainUISelectors = [
				'#menuBtn',
				'#runCodeButton', 
				'#stopCodeButton',
				'#openButton', // The actual open button
				'#colorPickerButton',  // Color picker with correct ID
				'#projectName',
				'#exportCodeButton',
				'#exampleSelect',
				'#toggleDesign',
				'#togglePlay',
				'#fullscreenToggle'
			];

			mainUISelectors.forEach(selector => {
				const element = document.querySelector(selector);
				if (element && isElementVisible(element) && !element.disabled && !elements.includes(element)) {
					elements.push(element);
				}
			});

			return elements;
		}

		function isElementVisible(element) {
			if (!element) return false;

			// Check if element or its parent is hidden
			let currentElement = element;
			while (currentElement) {
				const style = window.getComputedStyle(currentElement);
				if (style.display === 'none' || style.visibility === 'hidden') {
					return false;
				}
				currentElement = currentElement.parentElement;
			}

			// Check if element has actual dimensions
			const rect = element.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0;
		}

		document.addEventListener('keydown', (e) => {
			if (e.key !== 'Tab') return;

			const focusableElements = getFocusableElements();
			if (focusableElements.length === 0) return;

			const currentElement = document.activeElement;
			const currentIndex = focusableElements.indexOf(currentElement);

			// Only manage tab navigation for our tracked elements
			if (currentIndex === -1) return;

			e.preventDefault();

			// Calculate next index with wraparound
			let nextIndex;
			if (e.shiftKey) {
				nextIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
			} else {
				nextIndex = currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1;
			}

			const nextElement = focusableElements[nextIndex];
			if (nextElement) {
				// Ensure element is still focusable before focusing
				if (!nextElement.disabled && isElementVisible(nextElement)) {
					nextElement.focus();

					// Announce for screen readers
					if (nextElement.id === 'renderCanvas') {
						announceToScreenReader('3D canvas focused. Use arrow keys or WASD to navigate.');
					} else if (nextElement.closest('#gizmoButtons')) {
						announceToScreenReader(`${nextElement.getAttribute('aria-label') || nextElement.title || 'Design tool'} focused`);
					} else if (nextElement.classList?.contains('blocklySearchInput') || nextElement.type === 'search') {
						announceToScreenReader('Search toolbox focused');
					} else if (nextElement.id === 'blocklyDiv') {
						announceToScreenReader('Code workspace focused');
					} else if (nextElement.tagName === 'BUTTON' || nextElement.tagName === 'LABEL') {
						const text = nextElement.getAttribute('aria-label') || nextElement.title || nextElement.textContent || 'Interactive element';
						announceToScreenReader(`${text} focused`);
					}
				}
			}
		});
	}


	function trapFocus(e) {
		if (e.key !== 'Tab') return;

		const modal = e.currentTarget;
		const focusableElements = modal.querySelectorAll(
			'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'
		);

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		if (e.shiftKey && document.activeElement === firstElement) {
			e.preventDefault();
			lastElement.focus();
		} else if (!e.shiftKey && document.activeElement === lastElement) {
			e.preventDefault();
			firstElement.focus();
		}
	}

	function handleCanvasKeyboard(e) {
		// Announce camera movements to screen readers
		const announcements = {
			'ArrowUp': 'Camera moving forward',
			'ArrowDown': 'Camera moving backward', 
			'ArrowLeft': 'Camera moving left',
			'ArrowRight': 'Camera moving right',
			'w': 'Moving forward',
			's': 'Moving backward',
			'a': 'Moving left',
			'd': 'Moving right',
			' ': 'Action triggered'
		};

		if (announcements[e.key]) {
			announceToScreenReader(announcements[e.key]);
		}

		// Tab navigation is now handled by the main setupTabOrder function
		// No need to prevent default here - let the main handler manage it
	}

	function announceToScreenReader(message) {
		const announcer = document.getElementById('announcements');
		if (announcer) {
			announcer.textContent = message;
			// Clear after announcement
			setTimeout(() => {
				announcer.textContent = '';
			}, 1000);
		}
	}

	// Enhanced modal management
	function openModal(modalId) {
		const modal = document.getElementById(modalId);
		if (!modal) return;

		const previouslyFocused = document.activeElement;
		modal.classList.remove('hidden');

		// Focus first focusable element in modal
		const focusableElements = modal.querySelectorAll(
			'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'
		);

		if (focusableElements.length > 0) {
			focusableElements[0].focus();
		} else {
			modal.focus();
		}

		// Store reference to return focus
		modal.dataset.previouslyFocused = previouslyFocused?.id || '';

		announceToScreenReader('Modal opened');
	}

	function closeModal(modalId) {
		const modal = document.getElementById(modalId);
		if (!modal) return;

		modal.classList.add('hidden');

		// Return focus to previously focused element
		const previouslyFocusedId = modal.dataset.previouslyFocused;
		if (previouslyFocusedId) {
			const element = document.getElementById(previouslyFocusedId);
			if (element) {
				element.focus();
			}
		}

		announceToScreenReader('Modal closed');
	}

	// Global keyboard shortcuts
	document.addEventListener("keydown", function (event) {
		// Skip to main content (Alt+M)
		if (event.altKey && event.key.toLowerCase() === 'm') {
			event.preventDefault();
			const mainContent = document.getElementById('maincontent');
			if (mainContent) {
				mainContent.focus();
				announceToScreenReader('Focused main content');
			}
			return;
		}

		// Close modal with Escape
		if (event.key === 'Escape') {
			const openModals = document.querySelectorAll('.modal:not(.hidden)');
			openModals.forEach(modal => {
				closeModal(modal.id);
			});
			return;
		}

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

	// Add a click handler to track block selection
	workspace.addChangeListener(function (event) {
		if (event.type === Blockly.Events.SELECTED) {
			if (event.newElementId) {
				// A block was selected
				window.currentBlock = workspace.getBlockById(
					event.newElementId,
				);
			} else {
				// Selection was cleared
				window.currentBlock = null;
			}
		}
	});
	// Handle Enter key for adding new blocks
	document.addEventListener("keydown", function (event) {
		if (event.ctrlKey && event.key === "]") {
			let selectedBlock = null;

			const cursor = workspace.getCursor();

			if (cursor?.getCurNode()) {
				const currentNode = cursor.getCurNode();
				if (currentNode) {
					const block = currentNode.getSourceBlock();
					if (block) {
						selectedBlock = block;
					}
				}
			} else {
				selectedBlock = window.currentBlock;
			}

			if (!selectedBlock) {
				return;
			}

			selectedBlock.unselect();

			if (!selectedBlock.nextConnection) {
				return;
			}

			// Create a new keyword block
			const keywordBlock = workspace.newBlock("keyword");
			window.currentBlock = keywordBlock;
			keywordBlock.initSvg();
			keywordBlock.render();

			// Connect blocks (same as before)
			const currentNextBlock = selectedBlock.getNextBlock();
			if (currentNextBlock) {
				selectedBlock.nextConnection.disconnect();
			}
			selectedBlock.nextConnection.connect(
				keywordBlock.previousConnection,
			);
			if (currentNextBlock && keywordBlock.nextConnection) {
				keywordBlock.nextConnection.connect(
					currentNextBlock.previousConnection,
				);
			}

			// Update our tracking variable to the new block
			window.currentBlock = keywordBlock;

			// Try to select it in Blockly too
			keywordBlock.select();

			// Open the editor with a delay
			setTimeout(() => {
				const textInputField = keywordBlock.getField("KEYWORD");
				if (textInputField) {
					textInputField.showEditor_();
				}
			}, 100);
		}
		/*else if (event.ctrlKey && event.key === "[") {
			event.preventDefault();

			let selectedBlock = null;
			const cursor = workspace.getCursor();
			if (cursor?.getCurNode()) {
				const currentNode = cursor.getCurNode();
				if (currentNode) {
					const block = currentNode.getSourceBlock();
					if (block) {
						selectedBlock = block;
					}
				}
			} else {
				selectedBlock = window.currentBlock;
			}

			if (!selectedBlock) {
				return;
			}

			let inputName = "DO";
			if (selectedBlock.type === "controls_if") {
				inputName = "DO0";
			}
			const statementInput = selectedBlock.getInput(inputName);
			if (!statementInput) {
				return;
			}

			const inputConnection = statementInput.connection;
			if (!inputConnection) {
				return;
			}

			// Create a new block to be added inside (change type if necessary)
			const insideBlock = workspace.newBlock("keyword");
			insideBlock.initSvg();
			insideBlock.render();

			// If the input already has a block connected, append to the end of the chain.
			if (inputConnection.targetBlock()) {
				let lastBlock = inputConnection.targetBlock();
				while (lastBlock.getNextBlock()) {
					lastBlock = lastBlock.getNextBlock();
				}
				lastBlock.nextConnection.connect(
					insideBlock.previousConnection,
				);
			} else {
				// Connect directly if there is no block inside yet.
				inputConnection.connect(insideBlock.previousConnection);
			}

			window.currentBlock = insideBlock;
			insideBlock.select();

			// Open the editor after a short delay if the new block has a text field
			setTimeout(() => {
				const textInputField = insideBlock.getField("KEYWORD");
				if (textInputField) {
					textInputField.showEditor_();
				}
			}, 100);
		}*/
	});

	/*document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "k") {
			e.preventDefault(); // stop the default T key behavior
			const workspace = Blockly.getMainWorkspace(); 
			if(!keyboardNav){
				keyboardNav = new KeyboardNavigation(workspace);
				const flockTheme = Blockly.Theme.defineTheme('classic', {
					  base: Blockly.Themes.Modern,
					  blockStyles: {
						'logic_blocks': { 
						  colourPrimary: Blockly.Msg['LOGIC_HUE']
						},
						'loop_blocks': { 
						  colourPrimary: Blockly.Msg['LOOPS_HUE']
						},
						'math_blocks': { 
						  colourPrimary: Blockly.Msg['MATH_HUE']
						},
						'text_blocks': { 
						  colourPrimary: Blockly.Msg['TEXTS_HUE']
						},
						'list_blocks': { 
						  colourPrimary: Blockly.Msg['LISTS_HUE']
						},
						'variable_blocks': { 
						  colourPrimary: Blockly.Msg['VARIABLES_HUE']
						},
						'procedure_blocks': { 
						  colourPrimary: Blockly.Msg['PROCEDURES_HUE']
						}
						// Your custom categories can be added here too
					  }
					});

				workspace.setTheme(flockTheme);
			}
		}
		else if (e.ctrlKey && e.shiftKey &&  e.key.toLowerCase() === "l") {
			e.preventDefault(); // stop the default T key behavior
			const workspace = Blockly.getMainWorkspace(); 

			const toolbox = workspace.getToolbox();
			if (!toolbox) return;

			const items = toolbox.getToolboxItems();
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (
					item.getName &&
					item.getName().toLowerCase() === "scene" &&
					item.isSelectable &&
					item.isSelectable()
				) {
					toolbox.selectItemByPosition(i);
					return;
				}
			}

			console.warn("Scene category not found in toolbox");
		}
	});*/
	window.flockDebug = {
		info() {
			console.log("=== FLOCK DEBUG INFO ===");

			const blocks = workspace.getAllBlocks();
			const allMeshes = flock.scene.meshes;
			const relevantMeshes = allMeshes.filter(
				(m) =>
					m.name !== "__root__" &&
					!m.name.includes("_primitive") &&
					!m.name.includes(".glb_first") &&
					!m.name.includes("Constraint_"),
			);

			console.log(
				`📦 Blocks: ${blocks.length}, 🎮 Meshes: ${relevantMeshes.length}, 🔗 Tracked: ${Object.keys(meshMap).length}`,
			);

			// Camera info
			const camera = flock.scene.activeCamera;
			if (camera) {
				const pos = camera.position;
				console.log(
					`📷 Camera at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`,
				);
			}

			let workingConnections = 0;
			let missingMeshes = 0;
			const trackedMeshNames = new Set();

			Object.entries(meshMap).forEach(([meshId, block]) => {
				trackedMeshNames.add(meshId);
				const meshExists = allMeshes.some((m) => m.name === meshId);

				if (meshExists) {
					workingConnections++;
					console.log(`  ✅ ${meshId} → ${block.type}`);
				} else {
					missingMeshes++;
					console.log(`  ❌ ${meshId} → ${block.type} (MISSING)`);
				}
			});

			// Find orphaned meshes
			const orphanedMeshes = relevantMeshes.filter(
				(mesh) =>
					!trackedMeshNames.has(mesh.name) &&
					!Array.from(trackedMeshNames).some((id) =>
						mesh.name.includes(id.split("__")[0]),
					),
			);

			console.log(
				`\n📊 SUMMARY: ✅ ${workingConnections} working, ❌ ${missingMeshes} missing, 🚨 ${orphanedMeshes.length} orphaned`,
			);

			if (orphanedMeshes.length > 0 && orphanedMeshes.length <= 10) {
				console.log("🚨 ORPHANED MESHES:");
				orphanedMeshes.forEach((mesh) => {
					const pos = mesh.position;
					console.log(
						`  - ${mesh.name} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`,
					);
				});
			} else if (orphanedMeshes.length > 10) {
				console.log(
					`🚨 ${orphanedMeshes.length} orphaned meshes (too many to list)`,
				);
			}
		},

		goTo(objectName) {
			const mesh = flock.scene.getMeshByName(objectName);
			if (!mesh) {
				console.log(`❌ Object "${objectName}" not found`);

				if (
					!this._cachedAvailable ||
					this._cacheTime < Date.now() - 5000
				) {
					this._cachedAvailable = flock.scene.meshes
						.filter(
							(m) =>
								m.name !== "__root__" &&
								!m.name.includes("_primitive") &&
								!m.name.includes(".glb_first"),
						)
						.map((m) => m.name);
					this._cacheTime = Date.now();
				}

				console.log(
					"Available objects:",
					this._cachedAvailable.slice(0, 10).join(", ") +
						(this._cachedAvailable.length > 10
							? `... and ${this._cachedAvailable.length - 10} more`
							: ""),
				);
				return;
			}

			const camera = flock.scene.activeCamera;
			if (camera) {
				const meshPos = mesh.position;
				const offset = new flock.BABYLON.Vector3(5, 5, 5);
				camera.position = meshPos.add(offset);
				camera.setTarget(meshPos);
				console.log(
					`📷 Moved to ${objectName} at (${meshPos.x.toFixed(1)}, ${meshPos.y.toFixed(1)}, ${meshPos.z.toFixed(1)})`,
				);
			}
		},

		health() {
			const blockCount = workspace.getAllBlocks().length;
			const meshCount = flock.scene.meshes.filter(
				(m) => m.name !== "__root__",
			).length;
			const trackedCount = Object.keys(meshMap).length;

			const workingCount = Object.keys(meshMap).filter((meshId) =>
				flock.scene.getMeshByName(meshId),
			).length;

			console.log("=== QUICK HEALTH CHECK ===");
			console.log(
				`📊 ${blockCount} blocks, ${meshCount} meshes, ${trackedCount} tracked`,
			);
			console.log(
				`${workingCount === trackedCount ? "✅" : "⚠️"} ${workingCount}/${trackedCount} connections working`,
			);

			if (workingCount === trackedCount && trackedCount > 0) {
				console.log("✅ System is healthy!");
			} else {
				console.log(
					"⚠️ Issues detected. Run flockDebug.info() for details",
				);
			}
		},
	};

	console.log("🛠️ Flock Debug loaded! Commands:");
	console.log("  flockDebug.health() - Quick health check");
	console.log("  flockDebug.info() - Detailed analysis");
	console.log("  flockDebug.goTo('objectName') - Move camera to object");

	initializeFocusManagement();
	initializeApp();

	// Modal handlers are now in index.html to avoid duplication
};

