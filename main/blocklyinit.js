import * as Blockly from "blockly";
import { KeyboardNavigation } from "@blockly/keyboard-navigation";
import { WorkspaceSearch } from "@blockly/plugin-workspace-search";
import * as BlockDynamicConnection from "@blockly/block-dynamic-connection";
import { initializeTheme } from "./themes.js";
import { installHoverHighlight } from "./blockhandling.js";
import { translate } from "./translation.js";
import {
        options,
        defineBlocks,
        handleBlockSelect,
        handleBlockDelete,
        CustomZelosRenderer,
        initializeVariableIndexes,
        nextVariableIndexes,
} from "../blocks/blocks";
import { defineBaseBlocks } from "../blocks/base";
import { defineShapeBlocks } from "../blocks/shapes";
import { defineSceneBlocks } from "../blocks/scene.js";
import { defineModelBlocks } from "../blocks/models.js";
import { defineEffectsBlocks } from "../blocks/effects.js";
import { defineCameraBlocks } from "../blocks/camera.js";
import { defineXRBlocks } from "../blocks/xr.js";
import { defineEventsBlocks } from "../blocks/events.js";
import { definePhysicsBlocks } from "../blocks/physics.js";
import { defineConnectBlocks } from "../blocks/connect.js";
import { defineCombineBlocks } from "../blocks/combine.js";
import { defineTransformBlocks } from "../blocks/transform.js";
import { defineControlBlocks } from "../blocks/control.js";
import { defineConditionBlocks } from "../blocks/condition.js";
import { defineAnimateBlocks } from "../blocks/animate.js";
import { defineSoundBlocks } from "../blocks/sound.js";
import { defineMaterialsBlocks } from "../blocks/materials.js";
import { defineColourBlocks } from "../blocks/colour.js";
import { defineSensingBlocks } from "../blocks/sensing.js";
import { defineTextBlocks } from "../blocks/text.js";
import { defineGenerators } from "../generators/generators.js";
import { registerCustomCommentIcon } from "./customCommentIcon.js";

let workspace = null;
export { workspace };
import { flock } from "../flock.js";

export function initializeBlocks() {
        defineBaseBlocks();
        defineBlocks();
        defineSceneBlocks();
        defineModelBlocks();
        defineShapeBlocks();
        defineEffectsBlocks();
        defineCameraBlocks();
        defineXRBlocks();
        defineEventsBlocks();
        definePhysicsBlocks();
        defineConnectBlocks();
        defineCombineBlocks();
        defineTransformBlocks();
        defineControlBlocks();
        defineConditionBlocks();
        defineAnimateBlocks();
        defineSoundBlocks();
        defineMaterialsBlocks();
        defineColourBlocks();
        defineSensingBlocks();
        defineTextBlocks();
        defineGenerators();
}

Blockly.utils.colour.setHsvSaturation(0.3); // 0 (inclusive) to 1 (exclusive), defaulting to 0.45
Blockly.utils.colour.setHsvValue(0.85); // 0 (inclusive) to 1 (exclusive), defaulting to 0.65

const MODE = { IF: "IF", ELSEIF: "ELSEIF", ELSE: "ELSE" };

function initializeIfClauseConnectionChecker(workspace) {
        const connectionChecker = workspace.connectionChecker;

        // Store the original doTypeChecks method
        const originalDoTypeChecks =
                connectionChecker.doTypeChecks.bind(connectionChecker);

        function isRealBlock(block) {
                return (
                        !!block &&
                        !(
                                typeof block.isInsertionMarker === "function" &&
                                block.isInsertionMarker()
                        )
                );
        }

        function realTargetBlock(connection) {
                const t = connection?.targetBlock?.();
                return isRealBlock(t) ? t : null;
        }

        function realNext(block) {
                return realTargetBlock(block?.nextConnection);
        }

        function realPrev(block) {
                return realTargetBlock(block?.previousConnection);
        }

        // Helper function to get all blocks in a stack (excluding insertion markers)
        function getAllBlocksInStack(block) {
                const blocks = [block];
                let current = block;

                while (current?.nextConnection) {
                        const next = realNext(current);
                        if (!next) break;
                        blocks.push(next);
                        current = next;
                }

                return blocks;
        }

        // Helper function to check if a block or its descendants contain if_clause blocks
        function hasIfClauseInStack(block) {
                const stack = getAllBlocksInStack(block);
                // Check if any block after the first one is an if_clause
                for (let i = 1; i < stack.length; i++) {
                        if (stack[i].type === "if_clause") {
                                return true;
                        }
                }
                return false;
        }

        // Helper function to check if a connection is a statement input (like DO)
        function isStatementInputConnection(connection) {
                const block = connection.getSourceBlock();
                for (let i = 0; i < block.inputList.length; i++) {
                        const input = block.inputList[i];
                        if (
                                input.type === Blockly.INPUT_VALUE ||
                                input.type === Blockly.DUMMY_INPUT
                        ) {
                                continue;
                        }
                        if (input.connection === connection) {
                                return true;
                        }
                }
                return false;
        }

        // Override the doTypeChecks method
        connectionChecker.doTypeChecks = function (a, b) {
                // First do the standard type checking
                if (!originalDoTypeChecks(a, b)) {
                        return false;
                }

                // Get the blocks involved
                const blockA = a.getSourceBlock();
                const blockB = b.getSourceBlock();

                // Check if either block is an if_clause
                const aIsIfClause = blockA.type === "if_clause";
                const bIsIfClause = blockB.type === "if_clause";

                if (!aIsIfClause && !bIsIfClause) {
                        return true; // Neither is if_clause, allow
                }

                // Determine the type of connection
                let movingBlock,
                        targetBlock,
                        movingConnection,
                        targetConnection;

                if (
                        a.type === Blockly.PREVIOUS_STATEMENT &&
                        b.type === Blockly.NEXT_STATEMENT
                ) {
                        movingBlock = blockA;
                        targetBlock = blockB;
                        movingConnection = a;
                        targetConnection = b;
                } else if (
                        a.type === Blockly.NEXT_STATEMENT &&
                        b.type === Blockly.PREVIOUS_STATEMENT
                ) {
                        movingBlock = blockB;
                        targetBlock = blockA;
                        movingConnection = b;
                        targetConnection = a;
                } else {
                        return true; // Not a statement connection
                }

                // Check if target connection is a statement input (like DO)
                const isTargetStatementInput =
                        isStatementInputConnection(targetConnection);

                if (isTargetStatementInput) {
                        // This is connecting into a statement input (like DO)
                        // ELSEIF and ELSE cannot go inside DO blocks
                        if (movingBlock.type === "if_clause") {
                                const movingMode =
                                        movingBlock.getFieldValue("MODE");
                                if (
                                        movingMode === MODE.ELSEIF ||
                                        movingMode === MODE.ELSE
                                ) {
                                        return false;
                                }
                        }
                        // Everything else (including IF) is allowed in statement inputs
                        return true;
                }

                // This is a chain connection (previous connecting to next)
                const connectingToNext =
                        targetConnection === targetBlock.nextConnection;
                const movingIsIfClause = movingBlock.type === "if_clause";
                const targetIsIfClause = targetBlock.type === "if_clause";

                // If moving block is if_clause, validate its rules
                if (movingIsIfClause) {
                        const movingMode = movingBlock.getFieldValue("MODE");
                        const movingHasIfClauseBelow =
                                hasIfClauseInStack(movingBlock);

                        // IF blocks can connect anywhere (they start a new chain)
                        if (movingMode === MODE.IF) {
                                return true;
                        }

                        if (connectingToNext) {
                                // Moving block is connecting AFTER target

                                if (targetIsIfClause) {
                                        const targetMode =
                                                targetBlock.getFieldValue(
                                                        "MODE",
                                                );

                                        // Rule 1: Nothing can connect after ELSE
                                        if (targetMode === MODE.ELSE) {
                                                return false;
                                        }

                                        // Rule 2: ELSE cannot connect if it has if_clause blocks after it
                                        if (
                                                movingMode === MODE.ELSE &&
                                                movingHasIfClauseBelow
                                        ) {
                                                return false;
                                        }

                                        // Rule 3: ELSE cannot be inserted in middle of chain
                                        const targetHasNext =
                                                realNext(targetBlock);
                                        if (
                                                targetHasNext &&
                                                targetHasNext.type ===
                                                        "if_clause" &&
                                                movingMode === MODE.ELSE
                                        ) {
                                                return false;
                                        }
                                } else {
                                        // Target is NOT if_clause
                                        // ELSEIF and ELSE cannot connect after non-if_clause blocks
                                        if (
                                                movingMode === MODE.ELSEIF ||
                                                movingMode === MODE.ELSE
                                        ) {
                                                return false;
                                        }
                                }
                        } else {
                                // Moving block is connecting BEFORE target

                                if (targetIsIfClause) {
                                        // Rule 1: ELSE cannot connect if it has if_clause blocks after it
                                        if (
                                                movingMode === MODE.ELSE &&
                                                movingHasIfClauseBelow
                                        ) {
                                                return false;
                                        }

                                        // Rule 2: Cannot insert if target is part of a chain after ELSE
                                        let current = targetBlock;
                                        while (
                                                current &&
                                                current.type === "if_clause"
                                        ) {
                                                const prev = realPrev(current);
                                                if (
                                                        !prev ||
                                                        prev.type !==
                                                                "if_clause"
                                                )
                                                        break;

                                                const prevMode =
                                                        prev.getFieldValue(
                                                                "MODE",
                                                        );
                                                if (prevMode === MODE.ELSE) {
                                                        return false;
                                                }
                                                current = prev;
                                        }
                                } else {
                                        // Target is NOT if_clause
                                        // ELSEIF and ELSE cannot connect before non-if_clause blocks
                                        if (
                                                movingMode === MODE.ELSEIF ||
                                                movingMode === MODE.ELSE
                                        ) {
                                                return false;
                                        }
                                }
                        }
                }

                // If target is if_clause but moving block is not, additional checks
                if (targetIsIfClause && !movingIsIfClause) {
                        const targetMode = targetBlock.getFieldValue("MODE");

                        if (connectingToNext) {
                                // Non-if_clause connecting after if_clause
                                // Only allow if target is at the end of chain (no if_clause blocks after)
                                const targetHasNext = realNext(targetBlock);

                                if (
                                        targetHasNext &&
                                        targetHasNext.type === "if_clause"
                                ) {
                                        // Target has if_clause blocks after it, cannot insert non-if_clause
                                        return false;
                                }

                                // Otherwise it's fine - connecting at the end of the chain
                                return true;
                        } else {
                                // Non-if_clause connecting before if_clause
                                // Only allow before IF (which can start a new chain)
                                // Don't allow before ELSEIF or ELSE
                                if (
                                        targetMode === MODE.ELSEIF ||
                                        targetMode === MODE.ELSE
                                ) {
                                        return false;
                                }
                        }
                }

                return true;
        };
}

export function initializeWorkspace() {
        // Set Blockly color configuration
        Blockly.utils.colour.setHsvSaturation(0.3);
        Blockly.utils.colour.setHsvValue(0.85);

        // Register variable category callback
        workspace.registerToolboxCategoryCallback("VARIABLE", function (ws) {
                const xmlList = Blockly.Variables.flyoutCategory(ws);

                xmlList.forEach((xmlBlock) => {
                        if (xmlBlock.getAttribute("type") === "variables_set") {
                                const valueElement =
                                        document.createElement("value");
                                valueElement.setAttribute("name", "VALUE");

                                const shadowElement =
                                        document.createElement("shadow");
                                shadowElement.setAttribute(
                                        "type",
                                        "math_number",
                                );

                                const fieldElement =
                                        document.createElement("field");
                                fieldElement.setAttribute("name", "NUM");
                                fieldElement.textContent = "0";

                                shadowElement.appendChild(fieldElement);
                                valueElement.appendChild(shadowElement);
                                xmlBlock.appendChild(valueElement);
                        }
                });

                const defaultBlock = xmlList.find(
                        (xmlBlock) =>
                                xmlBlock.getAttribute("type") ===
                                "variables_set",
                );
                if (defaultBlock) {
                        const xmlBlockText = defaultBlock.cloneNode(true);

                        const valueElements =
                                xmlBlockText.getElementsByTagName("value");
                        for (let i = 0; i < valueElements.length; i++) {
                                if (
                                        valueElements[i].getAttribute(
                                                "name",
                                        ) === "VALUE"
                                ) {
                                        while (valueElements[i].firstChild) {
                                                valueElements[i].removeChild(
                                                        valueElements[i]
                                                                .firstChild,
                                                );
                                        }
                                        const shadowText =
                                                document.createElement(
                                                        "shadow",
                                                );
                                        shadowText.setAttribute("type", "text");

                                        const fieldText =
                                                document.createElement("field");
                                        fieldText.setAttribute("name", "TEXT");
                                        fieldText.textContent = "";
                                        shadowText.appendChild(fieldText);
                                        valueElements[i].appendChild(
                                                shadowText,
                                        );
                                        break;
                                }
                        }

                        const defaultIndex = xmlList.indexOf(defaultBlock);
                        if (defaultIndex !== -1) {
                                xmlList.splice(
                                        defaultIndex + 1,
                                        0,
                                        xmlBlockText,
                                );
                        }
                }
                return xmlList;
        });

        // Add change listeners
        workspace.addChangeListener(BlockDynamicConnection.finalizeConnections);
        workspace.addChangeListener(handleBlockSelect);
        workspace.addChangeListener(handleBlockDelete);

        // Disable scrollBoundsIntoView temporarily during focus changes after deletion
        const originalScrollBoundsIntoView =
                Blockly.WorkspaceSvg.prototype.scrollBoundsIntoView;

        Blockly.WorkspaceSvg.prototype.scrollBoundsIntoView = function (
                bounds,
        ) {
                // Check if we're in the middle of a block deletion by looking at the call stack
                const stack = new Error().stack;

                // If this is being called from the dispose->focus chain, skip scrolling
                if (
                        stack.includes("dispose") ||
                        stack.includes("onNodeFocus")
                ) {
                        return; // Don't scroll at all
                }

                // Otherwise, do normal scrolling
                originalScrollBoundsIntoView.call(this, bounds);
        };

        console.log("Workspace initialized", workspace);

        // Initialize workspace search
        const workspaceSearch = new WorkspaceSearch(workspace);
        workspaceSearch.init();

        // Set up auto value behavior
        setupAutoValueBehavior(workspace);

        return workspace;
}

export function createBlocklyWorkspace() {
        // Register the custom renderer
        Blockly.registry.register(
                Blockly.registry.Type.RENDERER,
                "custom_zelos_renderer",
                CustomZelosRenderer,
        );

        registerCustomCommentIcon();

        KeyboardNavigation.registerKeyboardNavigationStyles();

        workspace = Blockly.inject("blocklyDiv", options);
        initializeIfClauseConnectionChecker(workspace);

        // --- Blockly search flyout accessibility fix ---
        // Makes the visible search flyout tabbable and allows Tab/↓ from the search input to reach it.

        (function enableBlocklySearchFlyoutTabbing() {
                // 1) Blockly's injection area (always exists when workspace is loaded)
                const root = document.getElementById("blocklyDiv");
                if (!root) return;

                // 2) Helper to find visible search flyout (the one with actual results)
                function getVisibleFlyout() {
                        const flyouts = root.querySelectorAll(
                                "svg.blocklyToolboxFlyout",
                        );
                        return (
                                Array.from(flyouts).find((svg) => {
                                        const r = svg.getBoundingClientRect();
                                        return r.width > 0 && r.height > 0;
                                }) || null
                        );
                }

                // 3) Make the flyout focusable
                function ensureFlyoutFocusable() {
                        const flyout = getVisibleFlyout();
                        if (!flyout) return null;

                        const ws = flyout.querySelector("g.blocklyWorkspace");
                        const target = ws || flyout;

                        // Ensure focusability
                        target.setAttribute("tabindex", "0");
                        target.setAttribute("focusable", "true");
                        target.setAttribute("role", "group");
                        target.setAttribute(
                                "aria-label",
                                translate("toolbox_search_results_aria"),
                        );

                        return target;
                }

                // 4) Jump from search input → flyout
                function wireSearchInput() {
                        const search = root.querySelector(
                                '.blocklyToolbox input[type="search"]',
                        );
                        if (!search) return;
                        if (search.dataset.searchFlyoutWired === "true") {
                                return;
                        }
                        search.dataset.searchFlyoutWired = "true";

                        // Blockly sets tabindex="-1" by default — fix that
                        if (search.tabIndex < 0) search.tabIndex = 0;

                        search.addEventListener("keydown", (e) => {
                                if (e.key !== "Tab" || e.shiftKey) {
                                        return;
                                }
                                const target = ensureFlyoutFocusable();
                                if (!target) return;
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                        target.focus({
                                                preventScroll: true,
                                        });
                                } catch {}
                        });
                }

                // 5) Keep it alive while Blockly updates dynamically
                const observer = new MutationObserver(() => {
                        wireSearchInput();
                        ensureFlyoutFocusable();
                });
                observer.observe(root, { childList: true, subtree: true });

                // Initial setup
                wireSearchInput();
                ensureFlyoutFocusable();
        })();

        const keyboardNav = new KeyboardNavigation(workspace);

        (function preventToolboxShortcutTextEntry() {
                const shortcutRegistry = Blockly.ShortcutRegistry.registry;
                const registry = shortcutRegistry.getRegistry?.();
                const toolboxShortcut = registry?.toolbox;

                if (!toolboxShortcut) {
                        return;
                }

                const wrappedShortcut = {
                        ...toolboxShortcut,
                        callback: (ws, event, shortcut, scope) => {
                                const keyboardEvent =
                                        event instanceof KeyboardEvent
                                                ? event
                                                : null;
                                if (
                                        keyboardEvent &&
                                        (keyboardEvent.key || "")
                                                .toLowerCase() === "t"
                                ) {
                                        keyboardEvent.preventDefault();
                                }

                                return toolboxShortcut.callback
                                        ? toolboxShortcut.callback(
                                                ws,
                                                event,
                                                shortcut,
                                                scope,
                                        )
                                        : false;
                        },
                };

                shortcutRegistry.removeAllKeyMappings?.("toolbox");
                shortcutRegistry.register(wrappedShortcut, true);
        })();

        // Keep scrolling; remove only the obvious flyout-width bump.
        (function simpleNoBumpTranslate() {
                const ws = Blockly.getMainWorkspace();
                const original = ws.translate.bind(ws);

                ws.translate = function (requestedX, newY) {
                        const tb = this.getToolbox?.();
                        const fo = this.getFlyout?.();
                        const mm = this.getMetricsManager?.();

                        // Toolbox edge on the left. Prefer toolbox.getWidth(); fallback to absolute metrics.
                        const tbW =
                                (tb && tb.getWidth?.()) ??
                                (mm && mm.getAbsoluteMetrics
                                        ? mm.getAbsoluteMetrics().left
                                        : 0) ??
                                0;

                        let x = requestedX;

                        // Only adjust when the flyout is actually visible.
                        if (fo && fo.isVisible?.()) {
                                const foW = fo.getWidth?.() || 0;
                                const EPS = 1; // small float tolerance

                                if (foW > 0) {
                                        // Case 1: absolute shove to ≈ toolbox + flyout
                                        if (x >= tbW + foW - EPS) {
                                                x -= foW;
                                        }
                                        // Case 2: relative shove by ≈ flyout from current position
                                        else if (
                                                x - this.scrollX >=
                                                foW - EPS
                                        ) {
                                                x -= foW;
                                        }
                                }
                        }

                        // Never allow the origin to go left of the toolbox edge.
                        if (x < tbW) x = tbW;

                        // Debug
                        /*console.log('[translate simple-no-bump]', {
              requestedX,
              appliedX: x,
              scrollX: this.scrollX,
              toolboxWidth: tbW,
              flyoutVisible: !!(fo && fo.isVisible?.()),
              flyoutWidth: fo?.getWidth?.() || 0
            });*/

                        return original(x, newY);
                };
        })();

        // ------- Pointer tracking for "paste at pointer" -------
        const mainWs = Blockly.getMainWorkspace();
        let lastCM = { x: 0, y: 0 };
        (mainWs.getInjectionDiv() || document).addEventListener(
                "contextmenu",
                (e) => {
                        lastCM = { x: e.clientX, y: e.clientY };
                },
                { capture: true },
        );

        // Screen -> workspace coords
        function screenToWs(ws, xy) {
                const c = new Blockly.utils.Coordinate(xy.x, xy.y);
                return Blockly.utils.svgMath.screenToWsCoordinates(ws, c);
        }

        // Add a context menu item that mirrors the keyboard-navigation "detach" (X) shortcut.
        (function registerDetachContextMenuItem() {
                const registry = Blockly.ContextMenuRegistry.registry;
                const id = "detachBlockWithShortcut";
                if (registry.getItem && registry.getItem(id)) return;

                function renderShortcut(label, shortcut) {
                        const wrapper = document.createElement("span");
                        wrapper.style.display = "flex";
                        wrapper.style.alignItems = "center";
                        wrapper.style.justifyContent = "space-between";
                        wrapper.style.gap = "1.5em";
                        wrapper.style.width = "100%";

                        const labelEl = document.createElement("span");
                        labelEl.textContent = label;

                        const shortcutEl = document.createElement("span");
                        shortcutEl.textContent = shortcut;
                        shortcutEl.style.color =
                                "var(--blockly-text-disabled, #aaa)";

                        wrapper.append(labelEl, shortcutEl);
                        return wrapper;
                }

                registry.register({
                        id,
                        weight: 80,
                        displayText: () => {
                                const text = translate("detach_block_option");
                                const label =
                                        text === "detach_block_option"
                                                ? "Detach"
                                                : text;
                                return renderShortcut(label, "X");
                        },
                        preconditionFn: (scope) => {
                                const block = scope.block;
                                if (!block || block.isInFlyout) return "hidden";

                                const hasParent =
                                        !!block.getParent() ||
                                        !!block.previousConnection
                                                ?.targetConnection ||
                                        !!block.outputConnection
                                                ?.targetConnection;
                                return hasParent ? "enabled" : "disabled";
                        },
                        callback: (scope) => {
                                const block = scope.block;
                                if (!block) return;

                                const healStack =
                                        !block.outputConnection?.isConnected();
                                const prevGroup = Blockly.Events.getGroup();
                                Blockly.Events.setGroup("contextmenu_detach");
                                block.unplug(healStack);
                                const cursor = block.workspace?.getCursor?.();
                                if (cursor?.setCurNode)
                                        cursor.setCurNode(block);
                                Blockly.Events.setGroup(prevGroup || null);
                        },
                        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
                });
        })();

        // Reorder block context menu items for better grouping.
        (function adjustBlockContextMenuWeights() {
                const registry = Blockly.ContextMenuRegistry.registry;

                const duplicate = registry.getItem?.("blockDuplicate");
                if (duplicate) duplicate.weight = 9;

                const detach = registry.getItem?.("detachBlockWithShortcut");
                if (detach) detach.weight = 10;

                const deleteItem = registry.getItem?.("blockDelete");
                if (deleteItem) deleteItem.weight = 20;
        })();

        // ===== OVERRIDE CLIPBOARD METHODS =====
        // Save original methods
        const origCopy = Blockly.clipboard.copy;

        // Override copy to add flyout-closing behavior
        Blockly.clipboard.copy = function (block) {
                // Call original copy
                origCopy.call(Blockly.clipboard, block);

                // If copied from the toolbox flyout, close the flyout
                if (block && block.isInFlyout) {
                        const tb = Blockly.getMainWorkspace()?.getToolbox?.();
                        const flyout = tb?.getFlyout?.();
                        flyout?.hide?.();
                        tb?.getSelectedItem?.()?.setSelected?.(false);
                }
        };

        function isTypingInInput() {
                const el = document.activeElement;
                if (!el) return false;
                const tag = el.tagName?.toLowerCase();
                return (
                        tag === "input" ||
                        tag === "textarea" ||
                        !!el.isContentEditable
                );
        }

        const host = mainWs.getInjectionDiv() || document;
        let __fcLastPointer = { x: 0, y: 0 };
        let __fcLastPointerType = "mouse"; // 'mouse' | 'touch' | 'pen'
        let __fcMenuPoint = null;
        let __fcMenuPointerType = "mouse";

        host.addEventListener(
                "pointerdown",
                (e) => {
                        if (!e.isPrimary) return;
                        __fcLastPointer = { x: e.clientX, y: e.clientY };
                        __fcLastPointerType = e.pointerType || "mouse";
                },
                { capture: true },
        );

        host.addEventListener(
                "pointermove",
                (e) => {
                        if (!e.isPrimary) return;
                        __fcLastPointer = { x: e.clientX, y: e.clientY };
                        __fcLastPointerType =
                                e.pointerType || __fcLastPointerType;
                },
                { capture: true },
        );

        // Capture the *actual* coordinates that opened the context menu (works for long-press)
        const __origShow = Blockly.ContextMenu.show;
        Blockly.ContextMenu.show = function (e, options, rtl) {
                __fcMenuPoint = { x: e.clientX, y: e.clientY };
                __fcMenuPointerType =
                        e.pointerType || __fcLastPointerType || "mouse";
                return __origShow.call(Blockly.ContextMenu, e, options, rtl);
        };
        host.addEventListener(
                "contextmenu",
                (e) => {
                        lastCM = { x: e.clientX, y: e.clientY };
                },
                { capture: true },
        );
        host.addEventListener(
                "mousemove",
                (e) => {
                        lastCM = { x: e.clientX, y: e.clientY };
                },
                { capture: true },
        );

        // ---- Core paste logic (same behavior as your menu item) ----
        function pasteAsChildOrHere(targetBlock /* may be null */, ws, data) {
                if (!data) return;
                const at = screenToWs(ws, lastCM);
                const pasted = Blockly.clipboard.paste(data, ws, at);
                const pb = /** @type {Blockly.BlockSvg} */ (pasted);
                if (!targetBlock) return;

                const checker = ws.getConnectionChecker
                        ? ws.getConnectionChecker()
                        : new Blockly.ConnectionChecker();
                const can = (a, b) =>
                        checker.canConnect(a, b, /*isDragging=*/ false);

                // 1) stack after: target.next ⟷ pb.previous
                if (
                        targetBlock.nextConnection &&
                        pb.previousConnection &&
                        can(targetBlock.nextConnection, pb.previousConnection)
                ) {
                        targetBlock.nextConnection.connect(
                                pb.previousConnection,
                        );
                        return;
                }
                // 2) empty statement input ⟷ pb.previous
                for (const input of targetBlock.inputList) {
                        if (
                                input.type === Blockly.NEXT_STATEMENT &&
                                input.connection &&
                                !input.connection.targetBlock() &&
                                pb.previousConnection &&
                                can(input.connection, pb.previousConnection)
                        ) {
                                input.connection.connect(pb.previousConnection);
                                return;
                        }
                }
                // 3) empty value input ⟷ pb.output
                for (const input of targetBlock.inputList) {
                        if (
                                input.type === Blockly.INPUT_VALUE &&
                                input.connection &&
                                !input.connection.targetBlock() &&
                                pb.outputConnection &&
                                can(input.connection, pb.outputConnection)
                        ) {
                                input.connection.connect(pb.outputConnection);
                                return;
                        }
                }
                // 4) insert above: target.previous ⟷ pb.next
                if (
                        targetBlock.previousConnection &&
                        pb.nextConnection &&
                        can(targetBlock.previousConnection, pb.nextConnection)
                ) {
                        targetBlock.previousConnection.connect(
                                pb.nextConnection,
                        );
                        return;
                }
                // else: stays at pointer
        }

        // ---- Bind Ctrl/Cmd+V ----
        host.addEventListener(
                "keydown",
                (e) => {
                        if (!(e.ctrlKey || e.metaKey)) return;
                        if ((e.key || "").toLowerCase() !== "v") return;
                        if (isTypingInInput()) return;

                        const data = Blockly.clipboard?.getLastCopiedData?.();
                        if (!data) return;

                        // Selected block (if any, and not from flyout)
                        const selected =
                                Blockly.common?.getSelected?.() || null;
                        if (selected && selected.isInFlyout) return; // never paste in the flyout

                        e.preventDefault();
                        e.stopPropagation();
                        pasteAsChildOrHere(selected || null, mainWs, data);
                },
                { capture: true },
        );

        // ---- Blockly event debug helpers ----
        (function setupBlocklyEventDebug() {
                if (!window.Blockly) return;

                const pad = (s, n) => (s + "").padEnd(n, " ");
                const short = (id) => (id ? id.slice(0, 8) : "");

                // Pretty-print one event
                function describeEvent(e) {
                        const bits = [
                                pad(e.type, 14),
                                "grp:",
                                pad(e.group || "∅", 12),
                                "ui:",
                                String(!!e.isUiEvent).padEnd(5),
                                "undo:",
                                String(!!e.recordUndo).padEnd(5),
                                "id:",
                                short(e.blockId),
                        ];

                        // Extra for moves/connects
                        if (e.type === Blockly.Events.BLOCK_MOVE) {
                                bits.push(
                                        " oldParent:",
                                        short(e.oldParentId),
                                        " -> newParent:",
                                        short(e.newParentId),
                                        " oldInp:",
                                        e.oldInputName || "∅",
                                        " -> newInp:",
                                        e.newInputName || "∅",
                                        " newXY:",
                                        e.newCoordinate
                                                ? `(${e.newCoordinate.x.toFixed(0)},${e.newCoordinate.y.toFixed(0)})`
                                                : "∅",
                                );
                        }
                        // Variable & create
                        if (e.type === Blockly.Events.BLOCK_CREATE)
                                bits.push(" createdIds:", e.ids?.length);
                        if (
                                e.type === Blockly.Events.VAR_CREATE ||
                                e.type === Blockly.Events.VAR_DELETE ||
                                e.type === Blockly.Events.VAR_RENAME
                        ) {
                                bits.push(
                                        " varId:",
                                        short(e.varId),
                                        " name:",
                                        e.varName,
                                );
                        }
                        // Changes to fields
                        if (e.type === Blockly.Events.CHANGE) {
                                bits.push(
                                        " elem:",
                                        e.element,
                                        " name:",
                                        e.name,
                                        " old→new:",
                                        `${e.oldValue}→${e.newValue}`,
                                );
                        }
                        // UI events (selected, dragging, clicked, etc.)
                        if (e.type === Blockly.Events.UI) {
                                bits.push(
                                        " elem:",
                                        e.element,
                                        " newVal:",
                                        e.newValue,
                                        " oldVal:",
                                        e.oldValue,
                                );
                        }
                        return bits.join("");
                }

                // Dump undo/redo stack sizes + top group
                function dumpStacks(ws) {
                        try {
                                const u = ws.getUndoStack?.() || [];
                                const r = ws.getRedoStack?.() || [];
                                const topGrp = u.length
                                        ? u[u.length - 1].group || "∅"
                                        : "∅";
                                console.log(
                                        `%c[UNDO] size:${u.length} topGrp:${topGrp}   [REDO] size:${r.length}`,
                                        "color:#0072B2",
                                );
                        } catch {}
                }

                // Attach once per workspace you care about:
                window.attachBlocklyDebug = function attachBlocklyDebug(
                        workspace,
                        label = "WS",
                ) {
                        if (!workspace || workspace.__debugListenerAttached)
                                return;
                        workspace.__debugListenerAttached = true;

                        workspace.addChangeListener((e) => {
                                // Filter noise if you like, but for now log everything:
                                console.log(
                                        `%c[${label}] ${describeEvent(e)}`,
                                        e.group
                                                ? "color:#009E73"
                                                : "color:#D55E00",
                                );
                                dumpStacks(workspace);
                        });

                        // Warn if something fiddles with grouping
                        const origSetGroup = Blockly.Events.setGroup;
                        Blockly.Events.setGroup = function patchedSetGroup(g) {
                                console.log(
                                        `%c[EVT.setGroup] ->`,
                                        "color:#aa00ff",
                                        g === true
                                                ? "(true: start auto-group)"
                                                : g === false
                                                  ? "(false: end auto-group)"
                                                  : g == null
                                                    ? "null/∅"
                                                    : `id:${g}`,
                                );
                                return origSetGroup.call(Blockly.Events, g);
                        };

                        // Optional: trace event fire points (very verbose)
                        const origFire = Blockly.Events.fire;
                        Blockly.Events.fire = function patchedFire(evts) {
                                const arr = Array.isArray(evts) ? evts : [evts];
                                console.log(
                                        `%c[EVT.fire] ${arr.length} event(s)`,
                                        "color:#555",
                                );
                                return origFire.call(Blockly.Events, evts);
                        };

                        console.log(
                                "%cBlockly event debug attached →",
                                "color:#0072B2",
                                label,
                        );
                };
        })();

        // after you create your workspace:
        //attachBlocklyDebug(workspace, 'MainWS');

        initializeTheme();
        installHoverHighlight(workspace);

        // Register comment options for workspace comments
        Blockly.ContextMenuItems.registerCommentOptions();

        if (flock.performanceOverlay) initBlocklyPerfOverlay(workspace);

        window.mainWorkspace = workspace;

        return workspace;
}

export function getWorkspace() {
        return workspace;
}

function setupAutoValueBehavior(workspace) {
        workspace.addChangeListener(function (event) {
                if (
                        event.type === Blockly.Events.BLOCK_CHANGE ||
                        event.type === Blockly.Events.BLOCK_CREATE
                ) {
                        var block = workspace.getBlockById(event.blockId);
                        if (block && block.type === "lists_create_with") {
                                var inputCount = 0;
                                while (block.getInput("ADD" + inputCount)) {
                                        inputCount++;
                                }
                                if (inputCount >= 2) {
                                        var previousInput = block.getInput(
                                                "ADD" + (inputCount - 2),
                                        );
                                        var lastInput = block.getInput(
                                                "ADD" + (inputCount - 1),
                                        );
                                        if (
                                                previousInput &&
                                                previousInput.connection
                                                        .targetConnection &&
                                                lastInput &&
                                                !lastInput.connection
                                                        .targetConnection
                                        ) {
                                                var sourceBlock =
                                                        previousInput.connection
                                                                .targetConnection
                                                                .sourceBlock_;

                                                function deepCopyBlock(
                                                        originalBlock,
                                                ) {
                                                        var newBlock =
                                                                workspace.newBlock(
                                                                        originalBlock.type,
                                                                );

                                                        if (
                                                                originalBlock.isShadow()
                                                        ) {
                                                                newBlock.setShadow(
                                                                        true,
                                                                );
                                                        }

                                                        var fieldMap = {
                                                                math_number:
                                                                        "NUM",
                                                                text: "TEXT",
                                                                logic_boolean:
                                                                        "BOOL",
                                                                variables_get:
                                                                        "VAR",
                                                        };

                                                        if (
                                                                fieldMap[
                                                                        originalBlock
                                                                                .type
                                                                ]
                                                        ) {
                                                                var fieldName =
                                                                        fieldMap[
                                                                                originalBlock
                                                                                        .type
                                                                        ];
                                                                newBlock.setFieldValue(
                                                                        originalBlock.getFieldValue(
                                                                                fieldName,
                                                                        ),
                                                                        fieldName,
                                                                );
                                                        }

                                                        for (
                                                                var i = 0;
                                                                i <
                                                                originalBlock
                                                                        .inputList
                                                                        .length;
                                                                i++
                                                        ) {
                                                                var originalInput =
                                                                        originalBlock
                                                                                .inputList[
                                                                                i
                                                                        ];
                                                                var newInput =
                                                                        newBlock.getInput(
                                                                                originalInput.name,
                                                                        );

                                                                if (
                                                                        originalInput.connection &&
                                                                        originalInput
                                                                                .connection
                                                                                .targetConnection
                                                                ) {
                                                                        var originalNestedBlock =
                                                                                originalInput
                                                                                        .connection
                                                                                        .targetConnection
                                                                                        .sourceBlock_;

                                                                        var newNestedBlock =
                                                                                deepCopyBlock(
                                                                                        originalNestedBlock,
                                                                                );

                                                                        if (
                                                                                newInput &&
                                                                                newNestedBlock.outputConnection
                                                                        ) {
                                                                                newInput.connection.connect(
                                                                                        newNestedBlock.outputConnection,
                                                                                );
                                                                        }
                                                                }
                                                        }

                                                        newBlock.initSvg();
                                                        newBlock.render();

                                                        return newBlock;
                                                }

                                                var newBlock =
                                                        deepCopyBlock(
                                                                sourceBlock,
                                                        );
                                                lastInput.connection.connect(
                                                        newBlock.outputConnection,
                                                );
                                        }
                                }
                        }
                }
        });
}

export function overrideSearchPlugin(workspace) {
        function getBlocksFromToolbox(workspace) {
                const toolboxBlocks = [];
                const seenTypes = new Set();

                function collectBlocks(schema, categoryName = "") {
                        if (!schema) {
                                return;
                        }

                        if ("contents" in schema) {
                                const currentCategory = schema.name || categoryName;
                                if (currentCategory === "Snippets") {
                                        return;
                                }

                                schema.contents?.forEach((item) => {
                                        collectBlocks(item, currentCategory);
                                });
                                return;
                        }

                        if (
                                schema.kind?.toLowerCase() === "block" &&
                                schema.type &&
                                !seenTypes.has(schema.type)
                        ) {
                                seenTypes.add(schema.type);
                                toolboxBlocks.push({
                                        type: schema.type,
                                        text: schema.type,
                                        full: schema,
                                        keyword: schema.keyword,
                                });
                        }
                }

                workspace.options.languageTree?.contents?.forEach((item) => {
                        collectBlocks(item);
                });

                return toolboxBlocks;
        }

        const SearchCategory = Blockly.registry.getClass(
                Blockly.registry.Type.TOOLBOX_ITEM,
                "search",
        );

        if (!SearchCategory) {
                console.error("Search category not found in registry!");
                return;
        }

        const toolboxBlocks = getBlocksFromToolbox(workspace);
        const isSearchCategorySelected = (category = null) => {
                const toolbox = workspace.getToolbox?.();
                const selectedItem = toolbox?.getSelectedItem?.();
                const selectedDef =
                        selectedItem?.getToolboxItemDef?.() ||
                        selectedItem?.toolboxItemDef;
                const isSelectedSearch =
                        selectedDef?.kind === "search" ||
                        (category && selectedItem === category);

                return (
                        category?.searchField === document.activeElement &&
                        isSelectedSearch
                );
        };

        function getBlockMessage(blockType) {
                const definition = Blockly.Blocks?.[blockType];
                if (!definition) {
                        return "";
                }

                const message0 =
                        (typeof definition.message0 === "string" &&
                                definition.message0) ||
                        (typeof definition.json?.message0 === "string" &&
                                definition.json.message0) ||
                        "";

                if (!message0) {
                        return "";
                }

                const resolvedMessage =
                        Blockly.utils.replaceMessageReferences(message0);
                return translate(resolvedMessage);
        }

        function buildSearchIndex() {
                const startTime =
                        typeof performance !== "undefined" &&
                        typeof performance.now === "function"
                                ? performance.now()
                                : Date.now();
                if (!Object.keys(nextVariableIndexes).length) {
                        initializeVariableIndexes();
                }

                const blockCreationWorkspace = new Blockly.Workspace();
                const indexedBlocks = [];

                function applyFieldValues(block, fieldValues) {
                        if (!block || !fieldValues) {
                                return;
                        }

                        Object.entries(fieldValues).forEach(
                                ([fieldName, value]) => {
                                        if (
                                                value === undefined ||
                                                value === null ||
                                                !block.getField(fieldName)
                                        ) {
                                                return;
                                        }

                                        const normalizedValue =
                                                typeof value === "string"
                                                        ? value
                                                        : String(value);
                                        block.setFieldValue(
                                                normalizedValue,
                                                fieldName,
                                        );
                                },
                        );
                }

                function addBlockFieldTerms(block, searchTerms, runDebugFields) {
                        block.inputList.forEach((input) => {
                                input.fieldRow.forEach((field) => {
                                        const fieldText = field.getText();
                                        if (fieldText) {
                                                searchTerms.add(fieldText);
                                                runDebugFields.push({
                                                        name: field.name,
                                                        text: fieldText,
                                                        kind: field.constructor?.name,
                                                });
                                        }

                                        if (
                                                field instanceof
                                                Blockly.FieldVariable
                                        ) {
                                                return;
                                        }

                                        if (
                                                !fieldText &&
                                                typeof field.getValue ===
                                                        "function"
                                        ) {
                                                const fieldValue =
                                                        field.getValue();
                                                if (
                                                        typeof fieldValue ===
                                                                "string" &&
                                                        fieldValue.trim()
                                                ) {
                                                        searchTerms.add(
                                                                fieldValue,
                                                        );
                                                        runDebugFields.push({
                                                                name: field.name,
                                                                value: fieldValue,
                                                                kind: field.constructor?.name,
                                                        });
                                                }
                                        }

                                        if (
                                                field instanceof
                                                Blockly.FieldDropdown
                                        ) {
                                                field.getOptions(
                                                        true,
                                                ).forEach((option) => {
                                                        if (
                                                                typeof option[0] ===
                                                                "string"
                                                        ) {
                                                                searchTerms.add(
                                                                        option[0],
                                                                );
                                                                runDebugFields.push({
                                                                        name: field.name,
                                                                        option:
                                                                                option[0],
                                                                        kind: field.constructor?.name,
                                                                });
                                                        } else if (
                                                                "alt" in
                                                                option[0]
                                                        ) {
                                                                searchTerms.add(
                                                                        option[0].alt,
                                                                );
                                                                runDebugFields.push({
                                                                        name: field.name,
                                                                        option:
                                                                                option[0].alt,
                                                                        kind: field.constructor?.name,
                                                                });
                                                        }
                                                });
                                        }
                                });
                        });
                }

                try {
                        toolboxBlocks.forEach((blockInfo) => {
                                const type = blockInfo.type;
                                if (!type || type === "") {
                                        return;
                                }

                                const searchTerms = new Set();
                                searchTerms.add(type.replaceAll("_", " "));

                                const runDebugFields = [];

                                const keyword =
                                        blockInfo.keyword || blockInfo.full?.keyword;
                                if (keyword) {
                                        searchTerms.add(keyword);
                                }

                                const block =
                                        blockCreationWorkspace.newBlock(type);
                                applyFieldValues(
                                        block,
                                        blockInfo.full?.fields,
                                );

                                const labelText =
                                        typeof block.toString === "function"
                                                ? block.toString()
                                                : "";

                                if (labelText && labelText.trim()) {
                                        searchTerms.add(labelText);
                                } else {
                                        const fallbackMessage =
                                                getBlockMessage(type);
                                        if (fallbackMessage) {
                                                searchTerms.add(fallbackMessage);
                                        }
                                }

                                addBlockFieldTerms(
                                        block,
                                        searchTerms,
                                        runDebugFields,
                                );

                                const inputDefinitions = blockInfo.full?.inputs;
                                if (inputDefinitions) {
                                        Object.values(inputDefinitions).forEach(
                                                (definition) => {
                                                        const shadowType =
                                                                definition?.shadow?.type;
                                                        if (!shadowType) {
                                                                return;
                                                        }

                                                        const shadowBlock =
                                                                blockCreationWorkspace.newBlock(
                                                                        shadowType,
                                                                );
                                                        applyFieldValues(
                                                                shadowBlock,
                                                                definition?.shadow
                                                                        ?.fields,
                                                        );
                                                        addBlockFieldTerms(
                                                                shadowBlock,
                                                                searchTerms,
                                                                runDebugFields,
                                                        );
                                                        shadowBlock.dispose(
                                                                true,
                                                        );
                                                },
                                        );
                                }
                        
                                indexedBlocks.push({
                                        ...blockInfo,
                                        text: Array.from(searchTerms).join(
                                                " ",
                                        ),
                                });
                        });
                } finally {
                        blockCreationWorkspace.dispose();
                }

                const endTime =
                        typeof performance !== "undefined" &&
                        typeof performance.now === "function"
                                ? performance.now()
                                : Date.now();
                return indexedBlocks;
        }

        SearchCategory.prototype.initBlockSearcher = function () {
                const blockSearcher = this.blockSearcher;
                const rebuildSearchIndex = () => {
                        const cachedIndex = workspace.flockSearchIndexedBlocks;
                        if (Array.isArray(cachedIndex)) {
                                blockSearcher.indexedBlocks_ = cachedIndex;
                                return;
                        }

                        const newIndex = buildSearchIndex();
                        workspace.flockSearchIndexedBlocks = newIndex;
                        blockSearcher.indexedBlocks_ = newIndex;

                        const searchCategory = workspace.flockSearchCategory;
                        if (searchCategory) {
                                const showAllBlocksAsync = () => {
                                        if (!isSearchCategorySelected(searchCategory)) {
                                                return;
                                        }
                                        if (
                                                searchCategory.searchField?.value
                                                        .toLowerCase()
                                                        .trim()
                                        ) {
                                                return;
                                        }

                                        searchCategory.showMatchingBlocks(
                                                newIndex,
                                        );
                                };

                                if (typeof requestIdleCallback === "function") {
                                        requestIdleCallback(showAllBlocksAsync);
                                } else {
                                        setTimeout(showAllBlocksAsync, 0);
                                }
                        }
                };
                this.blockSearcher.indexBlocks = rebuildSearchIndex;
                blockSearcher.indexedBlocks_ =
                        workspace.flockSearchIndexedBlocks || null;

                if (!workspace.flockSearchIndexScheduled) {
                        workspace.flockSearchIndexScheduled = true;
                        const scheduleBuild = () => {
                                workspace.flockSearchIndexScheduled = false;
                                if (!workspace.flockSearchIndexedBlocks) {
                                        rebuildSearchIndex();
                                }
                        };

                        if (typeof requestIdleCallback === "function") {
                                requestIdleCallback(scheduleBuild, {
                                        timeout: 1000,
                                });
                        } else {
                                setTimeout(scheduleBuild, 0);
                        }
                }

                workspace.flockSearchCategory = this;

                if (!this.flockSearchKeydownAttached && this.searchField) {
                        this.flockSearchKeydownAttached = true;
                        this.searchField.addEventListener("keydown", (event) => {
                                if (
                                        event.key !== "ArrowDown" &&
                                        event.key !== "ArrowUp"
                                ) {
                                        return;
                                }

                                event.preventDefault();
                                this.searchField.value = "";
                                this.searchField?.blur();
                                this.searchField?.setSelectionRange?.(0, 0);
                                setTimeout(() => {
                                        const toolbox =
                                                this.workspace_?.getToolbox?.();
                                        const toolboxDiv = toolbox?.getDiv?.();
                                        if (toolboxDiv) {
                                                if (toolboxDiv.tabIndex < 0) {
                                                        toolboxDiv.tabIndex = 0;
                                                }
                                                toolboxDiv.focus();
                                        }
                                        if (toolbox) {
                                                if (event.key === "ArrowDown") {
                                                        toolbox.selectNext?.();
                                                } else {
                                                        toolbox.selectPrevious?.();
                                                }
                                                toolbox.refreshSelection?.();
                                        }
                                        toolboxDiv?.focus?.();
                                        Blockly.getFocusManager?.()?.focusTree?.(
                                                toolbox || null,
                                        );
                                }, 0);
                        });
                }

                if (!this.flockSearchFocusAttached && this.searchField) {
                        this.flockSearchFocusAttached = true;
                        this.searchField.addEventListener("focus", () => {
                                this.parentToolbox_?.setSelectedItem?.(this);
                        });
                }

                if (!this.flockSearchToolboxKeydownAttached && this.searchField) {
                        this.flockSearchToolboxKeydownAttached = true;
                        const toolboxDiv =
                                this.workspace_
                                        ?.getToolbox?.()
                                        ?.getDiv?.() ||
                                document.querySelector(".blocklyToolboxDiv");
                        if (toolboxDiv) {
                                toolboxDiv.addEventListener("keydown", (event) => {
                                        if (
                                                event.ctrlKey ||
                                                event.metaKey ||
                                                event.altKey ||
                                                event.key.length !== 1
                                        ) {
                                                return;
                                        }

                                        const target = event.target;
                                        const isEditable =
                                                target instanceof HTMLElement &&
                                                (target.isContentEditable ||
                                                        target.closest(
                                                                "input, textarea, [contenteditable='true']",
                                                        ));
                                        if (isEditable) {
                                                return;
                                        }

                                        event.preventDefault();
                                        event.stopPropagation();
                                        this.parentToolbox_?.setSelectedItem?.(this);
                                        this.searchField.value = event.key;
                                        this.searchField.focus();
                                        this.matchBlocks?.();
                                });
                        }
                }
        };

        const searchToolboxItem = workspace
                .getToolbox()
                ?.getToolboxItems?.()
                ?.find(
                        (item) =>
                                item instanceof SearchCategory ||
                                item.getToolboxItemDef?.().kind === "search" ||
                                item.toolboxItemDef?.kind === "search",
                );

        if (searchToolboxItem?.initBlockSearcher) {
                searchToolboxItem.initBlockSearcher();
        }

        SearchCategory.prototype.matchBlocks = function () {
                if (!this.hasInputStarted) {
                        this.hasInputStarted = true;
                }

                const query =
                        this.searchField?.value.toLowerCase().trim() || "";

                if (!query) {
                        const showAllBlocksAsync = () => {
                                if (!isSearchCategorySelected(this)) {
                                        return;
                                }
                                if (!Array.isArray(this.blockSearcher.indexedBlocks_)) {
                                        return;
                                }

                                if (this.searchField?.value.toLowerCase().trim()) {
                                        return;
                                }

                                this.showMatchingBlocks(
                                        this.blockSearcher.indexedBlocks_,
                                );
                        };

                        const requestType =
                                this.flockSearchAllBlocksRequest?.type;
                        const requestId =
                                this.flockSearchAllBlocksRequest?.id;
                        if (
                                requestType === "idle" &&
                                typeof cancelIdleCallback === "function" &&
                                typeof requestId === "number"
                        ) {
                                cancelIdleCallback(requestId);
                        } else if (
                                requestType === "timeout" &&
                                typeof requestId === "number"
                        ) {
                                clearTimeout(requestId);
                        }

                        if (
                                !Array.isArray(this.blockSearcher.indexedBlocks_) &&
                                this.blockSearcher.indexBlocks
                        ) {
                                if (typeof requestIdleCallback === "function") {
                                        const idleId = requestIdleCallback(() => {
                                                this.blockSearcher.indexBlocks();
                                                showAllBlocksAsync();
                                        });
                                        this.flockSearchAllBlocksRequest = {
                                                type: "idle",
                                                id: idleId,
                                        };
                                } else {
                                        const timeoutId = setTimeout(() => {
                                                this.blockSearcher.indexBlocks();
                                                showAllBlocksAsync();
                                        }, 0);
                                        this.flockSearchAllBlocksRequest = {
                                                type: "timeout",
                                                id: timeoutId,
                                        };
                                }
                        } else if (typeof requestIdleCallback === "function") {
                                const idleId = requestIdleCallback(showAllBlocksAsync);
                                this.flockSearchAllBlocksRequest = {
                                        type: "idle",
                                        id: idleId,
                                };
                        } else {
                                const timeoutId = setTimeout(showAllBlocksAsync, 0);
                                this.flockSearchAllBlocksRequest = {
                                        type: "timeout",
                                        id: timeoutId,
                                };
                        }
                        return;
                }

                if (this.flockSearchAllBlocksRequest?.type === "idle") {
                        if (typeof cancelIdleCallback === "function") {
                                cancelIdleCallback(
                                        this.flockSearchAllBlocksRequest.id,
                                );
                        }
                } else if (this.flockSearchAllBlocksRequest?.type === "timeout") {
                        clearTimeout(this.flockSearchAllBlocksRequest.id);
                }

                if (!Array.isArray(this.blockSearcher.indexedBlocks_)) {
                        if (this.blockSearcher.indexBlocks) {
                                this.blockSearcher.indexBlocks();
                        }
                }

                const indexedBlocks = Array.isArray(
                        this.blockSearcher.indexedBlocks_,
                )
                        ? this.blockSearcher.indexedBlocks_
                        : [];

                const matches = indexedBlocks.filter(
                        (block) => {
                                if (block.text) {
                                        return block.text
                                                .toLowerCase()
                                                .includes(query);
                                }
                                return false;
                        },
                );

                this.showMatchingBlocks(matches);
        };

        const originalOnNodeBlur = SearchCategory.prototype.onNodeBlur;
        SearchCategory.prototype.onNodeBlur = function () {
                if (originalOnNodeBlur) {
                        originalOnNodeBlur.call(this);
                }

                this.workspace_?.getToolbox?.()?.refreshSelection?.();
        };

        function createXmlFromJson(
                blockJson,
                isShadow = false,
                isTopLevel = true,
        ) {
                const blockXml = Blockly.utils.xml.createElement(
                        isShadow ? "shadow" : "block",
                );
                blockXml.setAttribute("type", blockJson.type);

                if (isTopLevel && blockJson.type === "lists_create_with") {
                        blockXml.setAttribute("inline", "true");
                }

                if (
                        blockJson.type === "lists_create_with" &&
                        blockJson.extraState
                ) {
                        const mutation =
                                Blockly.utils.xml.createElement("mutation");
                        mutation.setAttribute(
                                "items",
                                blockJson.extraState.itemCount,
                        );
                        blockXml.appendChild(mutation);
                }

                if (blockJson.inputs) {
                        Object.entries(blockJson.inputs).forEach(
                                ([name, input]) => {
                                        const valueXml =
                                                Blockly.utils.xml.createElement(
                                                        "value",
                                                );
                                        valueXml.setAttribute("name", name);

                                        if (input.block) {
                                                const nestedXml =
                                                        createXmlFromJson(
                                                                input.block,
                                                                false,
                                                                false,
                                                        );
                                                valueXml.appendChild(nestedXml);
                                        }

                                        if (input.shadow) {
                                                const shadowXml =
                                                        createXmlFromJson(
                                                                input.shadow,
                                                                true,
                                                                false,
                                                        );
                                                valueXml.appendChild(shadowXml);
                                        }

                                        blockXml.appendChild(valueXml);
                                },
                        );
                }

                if (blockJson.fields) {
                        Object.entries(blockJson.fields).forEach(
                                ([name, value]) => {
                                        const fieldXml =
                                                Blockly.utils.xml.createElement(
                                                        "field",
                                                );
                                        fieldXml.setAttribute("name", name);
                                        fieldXml.textContent = value;
                                        blockXml.appendChild(fieldXml);
                                },
                        );
                }

                return blockXml;
        }

        SearchCategory.prototype.showMatchingBlocks = function (matches) {
                if (!isSearchCategorySelected(this)) {
                        return;
                }
                const flyout = this.workspace_.getToolbox().getFlyout();
                if (!flyout) {
                        console.error("Flyout not found!");
                        return;
                }

                flyout.hide();
                flyout.show([]);

                const xmlList = matches.map((match) =>
                        createXmlFromJson(match.full),
                );
                flyout.show(xmlList);
        };

        const toolboxDef = workspace.options.languageTree;
        workspace.updateToolbox(toolboxDef);
}

// blockly-perf-overlay.js
export function initBlocklyPerfOverlay(
        workspace,
        {
                updateIntervalMs = 250,
                patchRender = true, // set false if you don't want to wrap render()
                patchResize = true, // set false if you don't want to wrap resize()
        } = {},
) {
        if (!workspace)
                throw new Error("initBlocklyPerfOverlay: workspace required");

        // ----- DOM: overlay -------------------------------------------------------
        const panel = document.createElement("div");
        panel.id = "blockly-perf-overlay";
        panel.setAttribute("aria-live", "polite");
        panel.style.cssText = `
        position: fixed; z-index: 99999; right: 10px; bottom: 10px;
        font: 12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        background: rgba(0,0,0,.75); color: #fff; padding: 10px 12px; border-radius: 10px;
        box-shadow: 0 6px 20px rgba(0,0,0,.35); max-width: 320px; pointer-events: none;
  `;
        panel.innerHTML = `
        <div style="font-weight:600;margin-bottom:6px;">Blockly Perf</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px;white-space:nowrap;">
          <div>Blocks (all/top):</div><div id="bp_blocks">–</div>
          <div>Rendered blocks:</div><div id="bp_rendered">–</div>
          <div>SVG nodes:</div><div id="bp_svg">–</div>
          <div>Events/sec:</div><div id="bp_eps">–</div>
          <div>Render time:</div><div id="bp_render">–</div>
          <div>Resize time:</div><div id="bp_resize">–</div>
          <div>Pan speed:</div><div id="bp_pan">–</div>
          <div>Pan FPS (~):</div><div id="bp_fps">–</div>
        </div>
        <div style="margin-top:6px;opacity:.8;">Press <kbd style="background:#222;border-radius:4px;padding:0 4px;">O</kbd> to hide/show</div>
  `;
        document.body.appendChild(panel);
        let hidden = false;
        const toggle = () => {
                hidden = !hidden;
                panel.style.display = hidden ? "none" : "block";
        };
        // Keyboard: O to toggle
        const keyHandler = (e) => {
                if (
                        e.key.toLowerCase() === "o" &&
                        !e.metaKey &&
                        !e.ctrlKey &&
                        !e.altKey
                )
                        toggle();
        };
        window.addEventListener("keydown", keyHandler, { passive: true });

        // ----- Metrics state -------------------------------------------------------
        const el = (id) => panel.querySelector(`#${id}`);
        const fmtMs = (n) => (n ? `${n.toFixed(1)} ms` : "–");
        const fmtInt = (n) => (Number.isFinite(n) ? n.toString() : "–");

        let eventsThisSecond = 0;
        let lastEPSFlush = performance.now();

        // Track pan (workspace scroll) speed and rough FPS while panning
        let lastScrollX = workspace.scrollX;
        let lastScrollY = workspace.scrollY;
        let lastPanT = performance.now();
        let panSpeed = 0; // px/s (screen coords-ish)
        let panFrameCount = 0;
        let panLastFpsFlush = performance.now();
        let panFPS = 0;

        // Render/resize timings (rolling average of last N)
        const rolling = (size = 10) => {
                const arr = [];
                return {
                        push(v) {
                                arr.push(v);
                                if (arr.length > size) arr.shift();
                        },
                        avg() {
                                return arr.length
                                        ? arr.reduce((a, b) => a + b, 0) /
                                                  arr.length
                                        : 0;
                        },
                };
        };
        const renderTimes = rolling(12);
        const resizeTimes = rolling(12);

        // ----- Instrument events ---------------------------------------------------
        const changeListener = () => {
                eventsThisSecond++;
        };
        workspace.addChangeListener(changeListener);

        // Count rendered blocks quickly
        const countRendered = () => {
                let rendered = 0;
                // getAllBlocks(true) excludes children? In Blockly, true = ordered; false = include children.
                // We want all, so false:
                const blocks = workspace.getAllBlocks(false);
                for (let i = 0; i < blocks.length; i++) {
                        if (blocks[i].rendered) rendered++;
                }
                return {
                        total: blocks.length,
                        rendered,
                        top: workspace.getTopBlocks(false).length,
                };
        };

        // SVG node count
        const countSvgNodes = () => {
                const svg = workspace.getParentSvg?.();
                if (!svg) return NaN;
                return svg.getElementsByTagName("*").length;
        };

        // ----- Monkey-patch (optional) render/resize to time calls -----------------
        let origRender = null;
        if (patchRender && typeof workspace.render === "function") {
                origRender = workspace.render;
                workspace.render = function (...args) {
                        const t0 = performance.now();
                        const res = origRender.apply(this, args);
                        renderTimes.push(performance.now() - t0);
                        return res;
                };
        }

        let origResize = null;
        if (patchResize && typeof workspace.resize === "function") {
                origResize = workspace.resize;
                workspace.resize = function (...args) {
                        const t0 = performance.now();
                        const res = origResize.apply(this, args);
                        resizeTimes.push(performance.now() - t0);
                        return res;
                };
        }

        // ----- RAF loop: pan metrics ----------------------------------------------
        let rafId = 0;
        const rafLoop = () => {
                const now = performance.now();
                // Pan speed
                if (
                        workspace &&
                        (workspace.scrollX !== lastScrollX ||
                                workspace.scrollY !== lastScrollY)
                ) {
                        const dx = workspace.scrollX - lastScrollX;
                        const dy = workspace.scrollY - lastScrollY;
                        const dt = (now - lastPanT) / 1000; // s
                        if (dt > 0) panSpeed = Math.hypot(dx, dy) / dt; // px/s-ish
                        lastScrollX = workspace.scrollX;
                        lastScrollY = workspace.scrollY;
                        lastPanT = now;
                        panFrameCount++;
                }
                // Rough FPS while panning: frames per second over last 500ms window
                if (now - panLastFpsFlush >= 500) {
                        panFPS =
                                panFrameCount /
                                        ((now - panLastFpsFlush) / 1000) || 0;
                        panFrameCount = 0;
                        panLastFpsFlush = now;
                }
                rafId = requestAnimationFrame(rafLoop);
        };
        rafId = requestAnimationFrame(rafLoop);

        // ----- Interval: update overlay text --------------------------------------
        const intervalId = setInterval(() => {
                // EPS flush every ~1s for stability
                const now = performance.now();
                let eps = null;
                if (now - lastEPSFlush >= 1000) {
                        eps = Math.round(
                                eventsThisSecond /
                                        ((now - lastEPSFlush) / 1000),
                        );
                        eventsThisSecond = 0;
                        lastEPSFlush = now;
                }

                const { total, rendered, top } = countRendered();
                const svgNodes = countSvgNodes();

                el("bp_blocks").textContent =
                        `${fmtInt(total)} / ${fmtInt(top)}`;
                el("bp_rendered").textContent = fmtInt(rendered);
                el("bp_svg").textContent = fmtInt(svgNodes);
                if (eps !== null) el("bp_eps").textContent = fmtInt(eps);
                el("bp_render").textContent = renderTimes.avg()
                        ? fmtMs(renderTimes.avg())
                        : "–";
                el("bp_resize").textContent = resizeTimes.avg()
                        ? fmtMs(resizeTimes.avg())
                        : "–";
                el("bp_pan").textContent = Number.isFinite(panSpeed)
                        ? `${panSpeed.toFixed(0)} px/s`
                        : "–";
                el("bp_fps").textContent = panFPS ? panFPS.toFixed(0) : "–";
        }, updateIntervalMs);

        // ----- Cleanup API ---------------------------------------------------------
        function destroy() {
                workspace.removeChangeListener(changeListener);
                if (origRender) workspace.render = origRender;
                if (origResize) workspace.resize = origResize;
                cancelAnimationFrame(rafId);
                clearInterval(intervalId);
                window.removeEventListener("keydown", keyHandler);
                panel.remove();
        }

        // Return a tiny control API
        return { destroy, toggle };
}
