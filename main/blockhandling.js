import * as Blockly from "blockly";
import { workspace } from "./blocklyinit.js";
import { translate } from "./translation.js";
import { blockHandlerRegistry } from "../blocks/blocks.js";
import { announceToScreenReader } from "./input.js";
import { TOP_BLOCK_TYPES } from "../config.js";

function asBlocklyBlock(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return typeof candidate.getNextBlock === "function" ? candidate : null;
}

function getSelectedBlockFromFocusedNode(node) {
  if (!node) {
    return null;
  }

  const direct = asBlocklyBlock(node);
  if (direct) {
    return direct;
  }

  if (typeof node.getSourceBlock === "function") {
    return asBlocklyBlock(node.getSourceBlock());
  }

  return asBlocklyBlock(node.sourceBlock_);
}

function getSelectedBlockForKeywordShortcut() {
  const selected = asBlocklyBlock(Blockly.common?.getSelected?.());
  if (selected) {
    return selected;
  }

  const focusedNode = Blockly.getFocusManager?.()?.getFocusedNode?.();
  return (
    getSelectedBlockFromFocusedNode(focusedNode) ||
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

  const blockTypesToCleanUp = TOP_BLOCK_TYPES;

  function layoutTopLevelBlocks() {
    const spacing = 40;
    const cursorX = 10;
    let cursorY = 10;

    Blockly.Events.setGroup(true);
    try {
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

      // Bring top-level blocks to the front in z-order so orphan blocks
      // (newly created, just-detached, dropped on existing stacks) render on
      // top of anything underneath them. canvas.appendChild on an existing
      // child detaches+reattaches the node, which drops DOM focus on any
      // focused descendant — so we snapshot document.activeElement around the
      // loop and restore it afterwards. In Blockly v13, after a duplicate or
      // delete this preserves the focus the focus_manager just placed on the
      // new / fallback block.
      try {
        const canvas = workspace.getBlockCanvas?.();
        if (canvas) {
          const activeBefore = document.activeElement;
          const activeInsideCanvas =
            activeBefore && canvas.contains(activeBefore) ? activeBefore : null;

          for (const b of topBlocks) {
            const svg = b.getSvgRoot?.();
            if (svg && svg.parentNode === canvas && svg !== canvas.lastChild) {
              canvas.appendChild(svg);
            }
          }

          if (
            activeInsideCanvas &&
            document.contains(activeInsideCanvas) &&
            document.activeElement !== activeInsideCanvas
          ) {
            try {
              activeInsideCanvas.focus({ preventScroll: true });
            } catch {
              // best-effort focus restoration
            }
          }
        }
      } catch (error) {
        console.warn("Suppressed non-critical error:", error);
      }
    } finally {
      Blockly.Events.setGroup(false);
    }
  }

  function pruneUnusedVariables() {
    const usedModels = Blockly.Variables.allUsedVarModels(workspace);
    const usedIds = new Set(usedModels.map((model) => model.getId()));
    const allVariableIds = workspace
      .getVariableMap()
      .getAllVariables()
      .map((model) => model.getId());
    const unusedVariableIds = allVariableIds.filter((id) => !usedIds.has(id));
    if (!unusedVariableIds.length) return;

    Blockly.Events.setGroup(true);
    try {
      for (const id of unusedVariableIds) {
        workspace.deleteVariableById(id);
      }
    } finally {
      Blockly.Events.setGroup(false);
    }
  }

  // Preserve selection/cursor focus while tidying.
  // This is invoked by explicit "Clean up blocks" actions.
  workspace.cleanUp = function () {
    layoutTopLevelBlocks();
    pruneUnusedVariables();
  };

  // Unify all undo-recording events fired during a drag (mouse or keyboard
  // nav) into a single group, so one undo press reverts the whole move.
  // Some internal Blockly/plugin code (Mover post-drop, dynamic-connection
  // finalize, etc.) emits follow-up events with new or null group IDs,
  // splitting the move across multiple undo entries.
  let __dragSessionGroup = null;
  let __dragSessionTimer = null;
  workspace.addChangeListener((event) => {
    if (event.type === Blockly.Events.BLOCK_DRAG) {
      if (event.isStart) {
        __dragSessionGroup =
          event.group || `drag-${Date.now()}-${Math.random()}`;
        if (__dragSessionTimer) {
          clearTimeout(__dragSessionTimer);
          __dragSessionTimer = null;
        }
      } else {
        if (__dragSessionTimer) clearTimeout(__dragSessionTimer);
        __dragSessionTimer = setTimeout(() => {
          __dragSessionGroup = null;
          __dragSessionTimer = null;
        }, 200);
      }
      return;
    }
    if (__dragSessionGroup && event.recordUndo && event.group !== __dragSessionGroup) {
      event.group = __dragSessionGroup;
    }
  });
  
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

    if ((event.ctrlKey || event.metaKey) && event.key === ".") {
      event.preventDefault();

      createKeywordBlockAtViewportCenter("keyword_block");
    }
  });

  // Handle Enter key for adding new blocks
  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "]") {
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
  });

  workspace.addChangeListener((event) => {
    // Track the currently selected block.
    if (event.type === Blockly.Events.SELECTED) {
      window.currentBlock = event.newElementId
        ? workspace.getBlockById(event.newElementId)
        : null;
    }

    // Workaround for Blockly not checking for orphans on key
    if (event.type === Blockly.Events.BLOCK_DRAG && event.isStart === false) {
      // Preserve the move's event group so the disabled-state change
      // from disableOrphans collapses into the same undo step.
      const eventGroup = event.group;
      // Wait until Blockly has fully settled
      queueMicrotask(() => {
        const prevGroup = Blockly.Events.getGroup();
        if (eventGroup) Blockly.Events.setGroup(eventGroup);
        try {
          Blockly.Events.disableOrphans({
            type: Blockly.Events.BLOCK_MOVE,
            workspaceId: workspace.id,
            blockId: event.blockId,
            oldParentId: undefined,
            newParentId: undefined,
            recordUndo: false,
            isUiEvent: false,
            group: eventGroup,
          });
        } finally {
          Blockly.Events.setGroup(prevGroup);
        }
      });
    }
    // Debounced cleanup on structural changes.
    if (
      !event.isUiEvent &&
      (event.type === Blockly.Events.BLOCK_MOVE ||
        event.type === Blockly.Events.BLOCK_CREATE ||
        event.type === Blockly.Events.BLOCK_DELETE)
    ) {
      // Capture this event's group so the cleanup's disableOrphans call
      // is attributed to the same undo entry as the triggering change.
      const eventGroup = event.group;
      clearTimeout(cleanupTimeout);
      cleanupTimeout = setTimeout(() => {
        const activeBefore = document.activeElement;

        const wasEnabled = Blockly.Events.isEnabled();
        try {
          if (wasEnabled) Blockly.Events.disable(); // don't create undo entries
          layoutTopLevelBlocks();
        } finally {
          if (wasEnabled) Blockly.Events.enable();
        }

        const prevGroup = Blockly.Events.getGroup();
        if (eventGroup) Blockly.Events.setGroup(eventGroup);
        try {
          Blockly.Events.disableOrphans(workspace);
        } finally {
          Blockly.Events.setGroup(prevGroup);
        }

        // Restore focus if the cleanup blurred it. Only restore if the
        // element is still in the DOM and currently lacks focus.
        if (
          activeBefore &&
          activeBefore !== document.body &&
          document.contains(activeBefore) &&
          document.activeElement !== activeBefore
        ) {
          try {
            activeBefore.focus?.({ preventScroll: true });
          } catch {
            // best-effort
          }
        }
      }, 300); // adjust if you want snappier/slower cleanup
    }

    // Immediate cleanup when a top-level block is collapsed/expanded.
    if (
      event.type === Blockly.Events.BLOCK_CHANGE &&
      event.element === "collapsed"
    ) {
      const block = workspace.getBlockById(event.blockId);
      if (block && !block.getParent()) {
        layoutTopLevelBlocks();
      }
    }

    // Purge deleted blocks from the registry, then dispatch to handlers.
    if (
      event.type === Blockly.Events.BLOCK_DELETE &&
      Array.isArray(event.ids)
    ) {
      for (const id of event.ids) {
        if (!workspace.getBlockById(id)) {
          blockHandlerRegistry.delete(id);
        }
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
    workspace?.getParentSvg()?.closest("#blocklyDiv") ??
    document.getElementById("blocklyDiv") ??
    document.body;
  observer.observe(blocklyContainer, { childList: true, subtree: true });
}
