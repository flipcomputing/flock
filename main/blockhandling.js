import * as Blockly from "blockly";
import { workspace } from "./blocklyinit.js";

export function initializeBlockHandling() {
	observeBlocklyInputs();

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

	let cleanupTimeout;

	workspace.addChangeListener(function (event) {
		// Only schedule after moves or deletes
		if (event.type === Blockly.Events.BLOCK_MOVE ||
			event.type === Blockly.Events.BLOCK_DELETE) {

			clearTimeout(cleanupTimeout);

			cleanupTimeout = setTimeout(() => {
				Blockly.Events.disable();    // Don't record undo
				try {
					workspace.cleanUp();     // Pure cleanup, no setGroup
				} finally {
					Blockly.Events.enable();
				}
			}, 300);
		}
	});

	// Global keyboard shortcuts
	document.addEventListener("keydown", function (event) {
		// Skip to main content (Alt+M)
		if (event.altKey && event.key.toLowerCase() === "m") {
			event.preventDefault();
			const mainContent = document.getElementById("maincontent");
			if (mainContent) {
				mainContent.focus();
				announceToScreenReader("Focused main content");
			}
			return;
		}

		// Close modal with Escape
		if (event.key === "Escape") {
			const openModals = document.querySelectorAll(".modal:not(.hidden)");
			openModals.forEach((modal) => {
				modal.classList.add("hidden");
				modal.setAttribute("aria-hidden", "true");
				modal.removeAttribute("aria-modal");
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

// Fast hover highlight (no full scans)
export function installHoverHighlight(workspace) {
  const svg = workspace.getParentSvg();
  if (!svg) return () => {};

  // State
  let lastHighlighted = null;
  let rafScheduled = false;
  let pendingXY = null;
  let panning = false;
  let dragging = false;
  let panTimer = null;

  // Prefer your own isBlockDraggable if present
  const isDraggable = (block) => {
	if (typeof window.isBlockDraggable === "function") return window.isBlockDraggable(block);
	if (!block) return false;
	if (block.isShadow && block.isShadow()) return false;
	if (!block.isMovable || !block.isMovable()) return false;
	if (!block.isDeletable || !block.isDeletable()) return false;
	// Match your old rules:
	if (block.previousConnection || block.nextConnection) return false;
	return true; // allow output blocks or standalones
  };

  function clearHighlight() {
	if (lastHighlighted) lastHighlighted.removeSelect();
	lastHighlighted = null;
  }
  function applyHighlight(block) {
	if (lastHighlighted === block) return;
	clearHighlight();
	block.addSelect();
	lastHighlighted = block;
  }

  // Track viewport pan/zoom and drag state via UI events
  const uiListener = (e) => {
	if (e.type !== Blockly.Events.UI) return;
	if (e.element === "viewport" || e.element === "zoom") {
	  panning = true;
	  clearTimeout(panTimer);
	  panTimer = setTimeout(() => (panning = false), 120);
	} else if (e.element === "drag") {
	  dragging = !!e.newValue; // true while dragging, false on release
	  if (!dragging) {
		// drag ended; make sure highlight is sane
		pendingXY = null;
		rafScheduled = false;
	  }
	}
  };
  workspace.addChangeListener(uiListener);

  // Mousemove on the workspace SVG (throttled to 1 per frame)
  const moveBinding = Blockly.browserEvents.bind(svg, "mousemove", null, (ev) => {
	if (panning || dragging) return;
	pendingXY = { x: ev.clientX, y: ev.clientY };
	if (rafScheduled) return;
	rafScheduled = true;
	requestAnimationFrame(() => {
	  rafScheduled = false;
	  if (!pendingXY) return;
	  const { x, y } = pendingXY;
	  pendingXY = null;

	  const el = document.elementFromPoint(x, y);
	  if (!el || !el.closest) { clearHighlight(); return; }

	  // Find the block <g> that carries data-id (covers normal & drag surface)
	  const g = el.closest('g.blocklyDraggable[data-id], g[data-id]');
	  if (!g) { clearHighlight(); return; }

	  const id = g.getAttribute("data-id");
	  if (!id) { clearHighlight(); return; }

	  const block = workspace.getBlockById(id);
		if (!block || !block.rendered || block.isInFlyout || !isDraggable(block)) {
		  clearHighlight();
		  return;
		}
	  applyHighlight(block);
	});
  });

  // Clear highlight when leaving the workspace SVG
  const leaveBinding = Blockly.browserEvents.bind(svg, "mouseleave", null, () => {
	clearHighlight();
  });

  // Cleanup
  return function destroyHoverHighlight() {
	clearTimeout(panTimer);
	clearHighlight();
	workspace.removeChangeListener(uiListener);
	Blockly.browserEvents.unbind(moveBinding);
	Blockly.browserEvents.unbind(leaveBinding);
  };
}
