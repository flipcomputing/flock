import * as Blockly from "blockly";
import { importSnippet } from "./files.js";
import { getSnippetOption } from "./translation.js";
import w500 from "@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff2";

async function exportBlockSnippet(block) {
	try {
		// Save the block and its children to a JSON object
		const blockJson = Blockly.serialization.blocks.save(block);

		// Convert the JSON object to a pretty-printed JSON string
		const jsonString = JSON.stringify(blockJson, null, 2);

		// Custom extension + MIME for Flock snippets
		const FLOCK_SNIP_EXT = ".fsnip";
		const FLOCK_SNIP_MIME = "application/vnd.flock-snippet+json";

		// Check if the File System Access API is available
		if ("showSaveFilePicker" in window) {
			// Define the options for the file picker
			const options = {
				suggestedName: `flock_snippet${FLOCK_SNIP_EXT}`,
				types: [
					{
						description: "Flock XR Snippet",
						accept: {
							[FLOCK_SNIP_MIME]: [FLOCK_SNIP_EXT],
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

			const blob = new Blob([jsonString], { type: FLOCK_SNIP_MIME });
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${filename}${FLOCK_SNIP_EXT}`;
			link.click();
		}
	} catch (e) {
		console.error("Error exporting block:", e);
	}
}


export function addExportContextMenuOptions() {
	addExportContextMenuOption();
	addImportContextMenuOption();
	//addExportSVGContextMenuOption();
	addExportPNGContextMenuOption();
}

function addExportContextMenuOption() {
	Blockly.ContextMenuRegistry.registry.register({
		id: "exportBlock",
		weight: 200,
		displayText: function () {
			return getSnippetOption("export_JSON");
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
			return getSnippetOption("import");
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
			return getSnippetOption("export_PNG");
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
			return getSnippetOption("export_SVG");
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

	// A) Only neutralise overlays that are safe to blank
	svgBlock.querySelectorAll(
	  '.blocklyPath.blocklyPathSelected, .blocklyHighlightedConnectionPath'
	).forEach(el => {
	  el.setAttribute('fill', 'none');           // prevent covering text
	  if (!el.getAttribute('stroke')) el.setAttribute('stroke', '#999'); // optional thin outline
	  el.setAttribute('stroke-width', '1');
	});

	// B) Do NOT change fills on .blocklyActiveFocus (base path can have it).
	// If you want to remove the class (purely cosmetic), do this:
	svgBlock.querySelectorAll('.blocklyActiveFocus').forEach(el => {
	  el.classList.remove('blocklyActiveFocus');
	});

	// C) Safety net: in each block group, keep only the FIRST path filled
	svgBlock.querySelectorAll('g.blocklyBlock, g.start').forEach(g => {
	  const paths = g.querySelectorAll(':scope > path.blocklyPath');
	  paths.forEach((p, i) => {
		if (i > 0) {                          // later paths are overlays
		  p.setAttribute('fill', 'none');
		  if (!p.getAttribute('stroke')) p.setAttribute('stroke', '#999');
		  p.setAttribute('stroke-width', '1');
		}
	  });
	});

	const serializer = new XMLSerializer();

	svgBlock.removeAttribute("change");

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
		textElement.setAttribute("font-weight", "500");
	});

	const fontBase64 = await convertFontToBase64(w500);

	const style = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"style",
	);
	style.textContent = `
	@font-face {
	  font-family: "Atkinson Hyperlegible Next";
	  src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
	}
	.blocklyText {
	  font-family: "Atkinson Hyperlegible Next", sans-serif;
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
		"change",
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
