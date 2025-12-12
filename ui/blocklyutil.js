import * as Blockly from "blockly";
let lastAddMenuHighlighted = null;

function trackAddMenuHighlight(workspace, blockId) {
	lastAddMenuHighlighted = { workspace, blockId };
}

function clearAddMenuHighlight(workspace, newSelectedId) {
	if (
		!lastAddMenuHighlighted ||
		lastAddMenuHighlighted.workspace !== workspace ||
		lastAddMenuHighlighted.blockId === newSelectedId
	) {
		return;
	}

	const block = workspace.getBlockById(lastAddMenuHighlighted.blockId);
	block?.unselect?.();

	lastAddMenuHighlighted = null;
}

export function appendWithUndo(spec, ws, groupId) {
	let block;
	try {
		block = Blockly.serialization.blocks.append(spec, ws, {
			recordUndo: true,
		});
	} catch {
		block = Blockly.serialization.blocks.append(spec, ws);
		const ev = new Blockly.Events.BlockCreate(block);
		ev.group = groupId;
		ev.recordUndo = true;
		Blockly.Events.fire(ev);
	}
	block?.initSvg?.();
	block?.render?.();
	return block;
}

export function highlightBlockById(workspace, block) {
	if (!workspace || !block || block.workspace !== workspace) return;

	// Select and scroll only when the code view is visible
	if (window.codeMode === "both") {
		ensureAddMenuSelectionCleanup(workspace);

		clearAddMenuHighlight(workspace, block.id);

		block.select();

		trackAddMenuHighlight(workspace, block.id);

		// Scroll to position the block at the top and its parent at the left
		scrollToBlockTopParentLeft(workspace, block.id);
	}
}

function ensureAddMenuSelectionCleanup(workspace) {
	if (!workspace || workspace.__addMenuSelectionCleanupAttached) return;

	const listener = (event) => {
		const isSelectEvent =
			event.type === Blockly.Events.SELECTED ||
			(event.type === Blockly.Events.UI && event.element === "selected");

		if (isSelectEvent) {
			clearAddMenuHighlight(workspace, event.newElementId);
		}
	};

	workspace.addChangeListener(listener);
	workspace.__addMenuSelectionCleanupAttached = true;
}

function scrollToBlockTopParentLeft(workspace, blockId) {
	if (!workspace.isMovable()) {
		console.warn("Tried to move a non-movable workspace.");
		return;
	}

	const block = blockId ? workspace.getBlockById(blockId) : null;
	if (!block) {
		return;
	}

	// Find the ultimate parent block
	let ultimateParent = block;
	while (ultimateParent.getParent()) {
		ultimateParent = ultimateParent.getParent();
	}

	// Get the position of the target block (for top positioning)
	const blockXY = block.getRelativeToSurfaceXY();

	// Get the position of the ultimate parent (for left positioning)
	const parentXY = ultimateParent.getRelativeToSurfaceXY();

	// Workspace scale, used to convert from workspace coordinates to pixels
	const scale = workspace.scale;

	// Convert block positions to pixels
	const pixelBlockY = blockXY.y * scale;
	const pixelParentX = parentXY.x * scale;

	const padding = 20;
	const scrollToY = pixelBlockY - padding;
	const scrollToX = pixelParentX - padding;

	// Convert to canvas directions (negative values)
	const x = -scrollToX;
	const y = -scrollToY;

	workspace.scroll(x, y);
}

// Updated setPositionValues function with rounding behavior
export function setPositionValues(block, position, blockType) {
	// Helper function to set position values on blocks
	if (block && position) {
		try {
			// Helper function to set or create shadow block for position input
			function setOrCreatePositionInput(inputName, value) {
				const input = block.getInput(inputName);
				if (!input) return;

				// Round the value to 1 decimal place
				const roundedValue = Math.round(value * 10) / 10;

				let targetBlock = input.connection.targetBlock();
				if (!targetBlock) {
					// Create a shadow block if none exists
					const shadowBlock =
						Blockly.getMainWorkspace().newBlock("math_number");
					shadowBlock.setFieldValue(String(roundedValue), "NUM");
					shadowBlock.setShadow(true);
					shadowBlock.setMovable(false);
					shadowBlock.setDeletable(false);
					shadowBlock.initSvg();
					shadowBlock.render();
					input.connection.connect(shadowBlock.outputConnection);
				} else {
					// Set the value if a block is already connected
					targetBlock.setFieldValue(String(roundedValue), "NUM");
				}
			}

			setOrCreatePositionInput("X", position.x);
			setOrCreatePositionInput("Y", position.y);
			setOrCreatePositionInput("Z", position.z);
		} catch (e) {
			console.warn(
				"Could not set position values for block:",
				blockType,
				e,
			);
		}
	}
}

export function getCanvasXAndCanvasYValues(event, canvasRect) {
  return [event.clientX - canvasRect.left, event.clientY - canvasRect.top];
}

