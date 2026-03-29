import * as Blockly from "blockly";
import { workspace } from "./blocklyinit.js";
import { translate } from "./translation.js";
import { blockHandlerRegistry } from "../blocks/blocks.js";
import { announceToScreenReader } from "./input.js";

function asBlocklyBlock(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return typeof candidate.getNextBlock === "function" ? candidate : null;
}

function getSelectedBlockFromCursor(cursor) {
  if (!cursor) {
    return null;
  }

  if (typeof cursor.getSourceBlock === "function") {
    const sourceBlock = asBlocklyBlock(cursor.getSourceBlock());
    if (sourceBlock) {
      return sourceBlock;
    }
  }

  if (typeof cursor.getCurNode !== "function") {
    return null;
  }

  const currentNode = cursor.getCurNode();
  if (!currentNode) {
    return null;
  }

  if (typeof currentNode.getSourceBlock === "function") {
    return asBlocklyBlock(currentNode.getSourceBlock());
  }

  return asBlocklyBlock(currentNode.sourceBlock_);
}

function getSelectedBlockForKeywordShortcut() {
  const selected = asBlocklyBlock(Blockly.common?.getSelected?.());
  if (selected) {
    return selected;
  }

  return (
    getSelectedBlockFromCursor(workspace.getCursor()) ||
    asBlocklyBlock(window.currentBlock)
  );
}

function getViewportCenterCoordinates(activeWorkspace) {
  const { left, top, width, height } = activeWorkspace
    .getMetricsManager()
    .getViewMetrics(true);

  return new Blockly.utils.Coordinate(left + width / 2, top + height / 2);
}

function getBlocklyFocusManager() {
  return Blockly.getFocusManager?.() || Blockly.common?.getFocusManager?.();
}

function focusBlocklyBlock(block) {
  const previouslySelected = Blockly.common?.getSelected?.();
  if (previouslySelected && previouslySelected !== block) {
    previouslySelected.unselect?.();
  }

  Blockly.common?.setSelected?.(block);
  getBlocklyFocusManager()?.focusNode?.(block);
  block.select?.();
  workspace.getCursor?.()?.setCurNode?.(block);

  const focusableElement =
    block.getFocusableElement?.() || block.getSvgRoot?.();
  focusableElement?.focus?.({ preventScroll: true });
}

function focusKeywordField(block) {
  focusBlocklyBlock(block);

  const textInputField = block.getField("KEYWORD");
  if (textInputField) {
    textInputField.showEditor_();

    requestAnimationFrame(() => {
      const htmlInput = document.querySelector(".blocklyHtmlInput");
      htmlInput?.focus?.({ preventScroll: true });
      htmlInput?.select?.();
    });
  }
}

function createKeywordBlockAtViewportCenter(blockType) {
  const block = workspace.newBlock(blockType);
  block.initSvg();
  block.render();
  block.moveTo(getViewportCenterCoordinates(workspace));
  window.currentBlock = block;
  focusKeywordField(block);
  return block;
}

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

  const blockTypesToCleanUp = [
    "start",
    "forever",
    "when_clicked",
    "when_touches",
    "on_collision",
    "when_key_event",
    "when_action_event",
    "on_event",
    "procedures_defnoreturn",
    "procedures_defreturn",
    "microbit_input",
  ];

  // Preserve selection/cursor focus while tidying.
  workspace.cleanUp = function () {
    const spacing = 40;
    const cursorX = 10;
    let cursorY = 10;

    // --- Preserve current focus/selection/cursor ---
    const prevSelected =
      (Blockly.common && Blockly.common.getSelected?.()) || null;

    // Keyboard Navigation (if installed)
    const navCursor = workspace.getCursor?.() || null;
    const prevCurNode = navCursor?.getCurNode ? navCursor.getCurNode() : null;

    // Keep track of the exact focused element (for keyboard users)
    const prevActiveEl = document.activeElement;

    // Group events to reduce churn / side-effects
    Blockly.Events.setGroup(true);
    try {
      // Get top-level roots (Blockly already filters by parent=null)
      const topBlocks = (workspace.getTopBlocks(false) || [])
        .filter((b) => !!b && !b.isInFlyout && !b.isShadow?.())
        .sort(
          (a, b) => a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y,
        );

      for (const block of topBlocks) {
        if (!blockTypesToCleanUp.includes(block.type)) continue;
        try {
          const xy = block.getRelativeToSurfaceXY();
          const dx = cursorX - xy.x;
          const dy = cursorY - xy.y;
          if (dx || dy) block.moveBy(dx, dy);

          const h = block.getHeightWidth?.().height || 40;
          cursorY += h + spacing;
        } catch (error) {
   console.warn("Suppressed non-critical error:", error);
 }
      }

      // Original z-order behaviour: top-level blocks (any type) to the front.
      // Reuse topBlocks (already computed above) instead of getAllBlocks() to
      // avoid iterating every block in the workspace and triggering unnecessary
      // DOM reflows.
      try {
        const canvas = workspace.getBlockCanvas?.();
        if (canvas) {
          for (const b of topBlocks) {
            const svg = b.getSvgRoot?.();
            if (svg && svg.parentNode === canvas) {
              const isSelected = prevSelected && b.id === prevSelected.id;
              canvas.appendChild(svg);
              if (isSelected) {
                prevSelected.select();
              }
            }
          }
        }
      } catch (error) {
   console.warn("Suppressed non-critical error:", error);
 }
    } finally {
      Blockly.Events.setGroup(false);

      // --- Restore selection and focus deterministically ---
      // Re-select the previously selected block (if it still exists in this workspace)
      if (prevSelected && !prevSelected.isDeadOrDying?.()) {
        prevSelected.select?.();

        // Restore keyboard nav cursor position (if available)
        if (navCursor && prevCurNode) {
          try {
            navCursor.setCurNode(prevCurNode);
          } catch (error) {
   console.warn("Suppressed non-critical error:", error);
 }
        }

        // Put DOM focus back on the block's SVG root for keyboard users
        const svgRoot = prevSelected.getSvgRoot?.();
        if (svgRoot && svgRoot.focus) {
          try {
            svgRoot.focus({ preventScroll: true });
          } catch (error) {
   console.warn("Suppressed non-critical error:", error);
 }
        } else if (prevActiveEl && document.contains(prevActiveEl)) {
          // Fallback: restore whatever had focus before
          try {
            prevActiveEl.focus?.({ preventScroll: true });
          } catch (error) {
   console.warn("Suppressed non-critical error:", error);
 }
        }
      }
    }
  };

  workspace.addChangeListener(Blockly.Events.disableOrphans);

  let cleanupTimeout = null;

  // Global keyboard shortcuts
  document.addEventListener("keydown", function (event) {
    // Skip to main content (Alt+M)
    if (event.altKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      const mainContent = document.getElementById("maincontent");
      if (mainContent) {
        mainContent.focus();
        announceToScreenReader(translate("focused_main_content"));
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

      createKeywordBlockAtViewportCenter("keyword_block");
    }
  });

  // Handle Enter key for adding new blocks
  document.addEventListener("keydown", function (event) {
    if (event.ctrlKey && event.key === "]") {
      const selectedBlock = getSelectedBlockForKeywordShortcut();
      event.preventDefault();

      if (!selectedBlock) {
        createKeywordBlockAtViewportCenter("keyword");
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
      selectedBlock.nextConnection.connect(keywordBlock.previousConnection);
      if (currentNextBlock && keywordBlock.nextConnection) {
        keywordBlock.nextConnection.connect(
          currentNextBlock.previousConnection,
        );
      }

      // Update our tracking variable to the new block
      window.currentBlock = keywordBlock;

      // Open the editor with a delay
      setTimeout(() => {
        focusKeywordField(keywordBlock);
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

  // -------------------------------------------------------------------------
  // Single consolidated workspace listener.
  //
  // Combines four previously separate addChangeListener calls:
  //   1. Track window.currentBlock on SELECTED events.
  //   2. Debounced workspace.cleanUp() on structural changes
  //      (BLOCK_MOVE / BLOCK_CREATE / BLOCK_DELETE).
  //   3. Immediate workspace.cleanUp() when a top-level block
  //      collapses or expands (BLOCK_CHANGE + element === "collapsed").
  //   4. Registry dispatcher — purge deleted block IDs then fan out to
  //      all registered block handlers (O(1) listeners vs O(N blocks)).
  // -------------------------------------------------------------------------
  workspace.addChangeListener((event) => {
    // 1. Track the currently selected block.
    if (event.type === Blockly.Events.SELECTED) {
      window.currentBlock = event.newElementId
        ? workspace.getBlockById(event.newElementId)
        : null;
    }

    // 2. Debounced cleanup on structural changes.
    if (
      !event.isUiEvent &&
      (event.type === Blockly.Events.BLOCK_MOVE ||
        event.type === Blockly.Events.BLOCK_CREATE ||
        event.type === Blockly.Events.BLOCK_DELETE)
    ) {
      clearTimeout(cleanupTimeout);
      cleanupTimeout = setTimeout(() => {
        const wasEnabled = Blockly.Events.isEnabled();
        try {
          if (wasEnabled) Blockly.Events.disable(); // don't create undo entries
          workspace.cleanUp();
        } finally {
          if (wasEnabled) Blockly.Events.enable();
        }
        Blockly.Events.disableOrphans(workspace);
      }, 300); // adjust if you want snappier/slower cleanup
    }

    // 3. Immediate cleanup when a top-level block is collapsed/expanded.
    if (
      event.type === Blockly.Events.BLOCK_CHANGE &&
      event.element === "collapsed"
    ) {
      const block = workspace.getBlockById(event.blockId);
      if (block && !block.getParent()) {
        workspace.cleanUp();
      }
    }

    // 4. Purge deleted blocks from the registry, then dispatch to handlers.
    if (
      event.type === Blockly.Events.BLOCK_DELETE &&
      Array.isArray(event.ids)
    ) {
      for (const id of event.ids) {
        blockHandlerRegistry.delete(id);
      }
    }

    // cachedValues() returns a stable snapshot that guards against
    // mid-iteration mutations (e.g. a handler that creates or deletes blocks)
    // without allocating a new array on every event.
    const handlers = blockHandlerRegistry.cachedValues();
    for (const handler of handlers) {
      handler(event);
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

  // Observe only the Blockly container to avoid scanning the entire document
  const blocklyContainer =
    workspace.getParentSvg()?.closest("#blocklyDiv") ??
    document.getElementById("blocklyDiv") ??
    document.body;
  observer.observe(blocklyContainer, { childList: true, subtree: true });
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
    if (typeof window.isBlockDraggable === "function")
      return window.isBlockDraggable(block);
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
    block.select();
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
  const moveBinding = Blockly.browserEvents.bind(
    svg,
    "mousemove",
    null,
    (ev) => {
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
        if (!el || !el.closest) {
          clearHighlight();
          return;
        }

        // Find the block <g> that carries data-id (covers normal & drag surface)
        const g = el.closest("g.blocklyDraggable[data-id], g[data-id]");
        if (!g) {
          clearHighlight();
          return;
        }

        const id = g.getAttribute("data-id");
        if (!id) {
          clearHighlight();
          return;
        }

        const block = workspace.getBlockById(id);
        if (
          !block ||
          !block.rendered ||
          block.isInFlyout ||
          !isDraggable(block)
        ) {
          clearHighlight();
          return;
        }
        applyHighlight(block);
      });
    },
  );

  // Clear highlight when leaving the workspace SVG
  const leaveBinding = Blockly.browserEvents.bind(
    svg,
    "mouseleave",
    null,
    () => {
      clearHighlight();
    },
  );

  // Cleanup
  return function destroyHoverHighlight() {
    clearTimeout(panTimer);
    clearHighlight();
    workspace.removeChangeListener(uiListener);
    Blockly.browserEvents.unbind(moveBinding);
    Blockly.browserEvents.unbind(leaveBinding);
  };
}
