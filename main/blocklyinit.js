import * as Blockly from "blockly";
import { KeyboardNavigation } from "@blockly/keyboard-navigation";
import { javascriptGenerator } from "blockly/javascript";
import { WorkspaceSearch } from "@blockly/plugin-workspace-search";
import * as BlockDynamicConnection from "@blockly/block-dynamic-connection";
import { CrossTabCopyPaste } from "@blockly/plugin-cross-tab-copy-paste";
import { initializeTheme } from "./themes.js";
import { installHoverHighlight } from "./blockhandling.js";
import { translate } from "./translation.js";
import {
        options,
        defineBlocks,
        initializeVariableIndexes,
        handleBlockSelect,
        handleBlockDelete,
        CustomZelosRenderer,
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

        const _origOnKeyDown = Blockly.Toolbox && Blockly.Toolbox.prototype.onKeyDown_;
        if (Blockly.Toolbox && Blockly.Toolbox.prototype) {
          Blockly.Toolbox.prototype.onKeyDown_ = function /* no-op */ (e) { /* defer to keyboard nav */ };
        }

        workspace = Blockly.inject("blocklyDiv", options);

        // --- Blockly search flyout accessibility fix ---
        // Makes the visible search flyout tabbable and allows Tab/↓ from the search input to reach it.

        (function enableBlocklySearchFlyoutTabbing() {
          // 1) Blockly's injection area (always exists when workspace is loaded)
          const root = document.getElementById('blocklyDiv');
          if (!root) return;

          // 2) Helper to find visible search flyout (the one with actual results)
          function getVisibleFlyout() {
            const flyouts = root.querySelectorAll('svg.blocklyToolboxFlyout');
            return Array.from(flyouts).find(svg => {
              const r = svg.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            }) || null;
          }

          // 3) Make the flyout focusable
          function ensureFlyoutFocusable() {
            const flyout = getVisibleFlyout();
            if (!flyout) return null;

            const ws = flyout.querySelector('g.blocklyWorkspace');
            const target = ws || flyout;

            // Ensure focusability
            target.setAttribute('tabindex', '0');
            target.setAttribute('focusable', 'true');
            target.setAttribute('role', 'group');
            target.setAttribute(
              'aria-label',
              translate('toolbox_search_results_aria'),
            );

            return target;
          }

          // 4) Jump from search input → flyout
          function wireSearchInput() {
            const search = root.querySelector('.blocklyToolbox input[type="search"]');
            if (!search) return;

            // Blockly sets tabindex="-1" by default — fix that
            if (search.tabIndex < 0) search.tabIndex = 0;

            search.addEventListener('keydown', (e) => {
              if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown') {
                const target = ensureFlyoutFocusable();
                if (!target) return;
                e.preventDefault();
                e.stopPropagation();
                try { target.focus({ preventScroll: true }); } catch {}
              }
            });
          }

          // 5) Keep it alive while Blockly updates dynamically
          const observer = new MutationObserver(() => ensureFlyoutFocusable());
          observer.observe(root, { childList: true, subtree: true });

          // Initial setup
          wireSearchInput();
          ensureFlyoutFocusable();
        })();


        const keyboardNav = new KeyboardNavigation(workspace);


        
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

        // Small helper
        function hasClipboardData() {
                return !!Blockly.clipboard.getLastCopiedData?.();
        }

        // ===== 1) COPY on ALL BLOCKS (workspace + flyout) =====
        Blockly.ContextMenuRegistry.registry.register({
                id: "fc_copy_block",
                weight: -1000000,
                scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
                displayText: () => translate("context_copy_option"),
                preconditionFn(scope) {
                        return scope?.block instanceof Blockly.BlockSvg
                                ? "enabled"
                                : "hidden";
                },
                callback(scope) {
                        const block = /** @type {Blockly.BlockSvg} */ (
                                scope.block
                        );
                        Blockly.clipboard.copy(block);

                        // If copied from the toolbox flyout, close the flyout.
                        if (block.isInFlyout) {
                                const tb =
                                        Blockly.getMainWorkspace()?.getToolbox?.();
                                const flyout = tb?.getFlyout?.();
                                flyout?.hide?.();

                                // (optional) also clear the selected category so it collapses
                                tb?.getSelectedItem?.()?.setSelected?.(false);
                        }
                },
                checkbox: false,
        });

        // ===== 2) PASTE on WORKSPACE (at pointer) =====
        Blockly.ContextMenuRegistry.registry.register({
                id: "fc_paste_to_workspace_here",
                weight: -900000,
                scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
                displayText: () => translate("context_paste_option"),
                preconditionFn(scope) {
                        // Enable only if clipboard has something AND this is the main workspace (not flyout)
                        const isMain = scope?.workspace === mainWs;
                        return isMain && hasClipboardData()
                                ? "enabled"
                                : "hidden";
                },
                callback(scope) {
                        const ws = scope.workspace;
                        const at = screenToWs(ws, lastCM);
                        const data = Blockly.clipboard.getLastCopiedData();
                        Blockly.clipboard.paste(data, ws, at);
                },
                checkbox: false,
        });

        // ===== 3) PASTE on BLOCK (try attach as child; else at pointer) =====
        Blockly.ContextMenuRegistry.registry.register({
                id: "fc_paste_as_child_or_here",
                weight: -800000,
                scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
                displayText: () => translate("context_paste_option"),
                preconditionFn(scope) {
                        const block =
                                /** @type {Blockly.BlockSvg|undefined} */ (
                                        scope?.block
                                );
                        if (
                                !hasClipboardData() ||
                                !(block instanceof Blockly.BlockSvg)
                        )
                                return "hidden";
                        // Never offer paste for flyout blocks
                        if (block.isInFlyout) return "hidden";
                        return "enabled";
                },
                callback(scope) {
                        const target = /** @type {Blockly.BlockSvg} */ (
                                scope.block
                        );
                        if (!target || target.isInFlyout) return;

                        const ws = target.workspace;
                        const data = Blockly.clipboard?.getLastCopiedData?.();
                        if (!data) return;

                        // --- use menu-open point if available; else last pointer; else block XY ---
                        function screenToWsPoint(xy) {
                                const c = new Blockly.utils.Coordinate(
                                        xy.x,
                                        xy.y,
                                );
                                return Blockly.utils.svgMath.screenToWsCoordinates(
                                        ws,
                                        c,
                                );
                        }

                        const fallbackXY = (() => {
                                const xy = target.getRelativeToSurfaceXY();
                                return {
                                        x: xy.x + 16 * (ws.scale || 1),
                                        y: xy.y + 16 * (ws.scale || 1),
                                };
                        })();

                        const screenXY =
                                __fcMenuPoint || __fcLastPointer || fallbackXY;
                        const pointerType =
                                __fcMenuPointerType ||
                                __fcLastPointerType ||
                                "mouse";

                        // Larger “hit” radius for touch so the intended socket is caught
                        const HIT_RADIUS_PX = pointerType === "touch" ? 36 : 18;
                        const REPLACE_REAL_ON_HOVER = true; // replace real children only when explicitly hovering a socket
                        const REPLACE_REAL_IN_FALLBACKS = false; // in fallbacks, prefer empty inputs (don’t yank real children)

                        // --- Helpers (version-safe) ---
                        function screenToWsPoint(xy) {
                                const c = new Blockly.utils.Coordinate(
                                        xy.x,
                                        xy.y,
                                );
                                return Blockly.utils.svgMath.screenToWsCoordinates(
                                        ws,
                                        c,
                                );
                        }
                        function connWsXY(conn) {
                                if (
                                        typeof conn.getOffsetInWorkspaceCoordinates ===
                                        "function"
                                ) {
                                        return conn.getOffsetInWorkspaceCoordinates();
                                }
                                const inBlock =
                                        typeof conn.getOffsetInBlock ===
                                        "function"
                                                ? conn.getOffsetInBlock()
                                                : { x: 0, y: 0 };
                                const b = conn.getSourceBlock();
                                const base = b.getRelativeToSurfaceXY();
                                return new Blockly.utils.Coordinate(
                                        base.x + inBlock.x,
                                        base.y + inBlock.y,
                                );
                        }
                        // If the input has a shadow, dispose it (no bump). If a real child and allowed, disconnect.
                        function clearInputForPaste(conn, replaceReal) {
                                const targetBlock =
                                        conn.targetBlock && conn.targetBlock();
                                if (!targetBlock) return true;
                                if (
                                        targetBlock.isShadow &&
                                        targetBlock.isShadow()
                                ) {
                                        targetBlock.dispose(
                                                false /* healStack */,
                                        ); // remove quietly, no bump
                                        return true;
                                }
                                if (replaceReal && conn.targetConnection) {
                                        conn.targetConnection.disconnect(); // real child will bump (expected)
                                        return true;
                                }
                                return false; // occupied and we chose not to replace
                        }

                        // --- Determine pointer position (fallback to block position if needed) ---
                        const lastPoint =
                                typeof lastCM === "object" &&
                                lastCM &&
                                "x" in lastCM &&
                                "y" in lastCM
                                        ? lastCM
                                        : (() => {
                                                  const xy =
                                                          target.getRelativeToSurfaceXY();
                                                  // small offset so we don't land exactly on the block origin
                                                  return {
                                                          x:
                                                                  xy.x +
                                                                  16 *
                                                                          (ws.scale ||
                                                                                  1),
                                                          y:
                                                                  xy.y +
                                                                  16 *
                                                                          (ws.scale ||
                                                                                  1),
                                                  };
                                          })();

                        const wsPoint = screenToWsPoint(screenXY);

                        // --- Paste at the pointer first (so we have a block to connect) ---
                        const pasted = Blockly.clipboard.paste(
                                data,
                                ws,
                                wsPoint,
                        );
                        const pb = /** @type {Blockly.BlockSvg} */ (pasted);
                        const checker =
                                ws.getConnectionChecker?.() ||
                                new Blockly.ConnectionChecker();
                        const can = (a, b) =>
                                a &&
                                b &&
                                checker.canConnect(a, b, /*isDragging=*/ false);

                        // --- Prefer the socket under the cursor (value or statement) ---
                        const hitR = HIT_RADIUS_PX / (ws.scale || 1);
                        const hitR2 = hitR * hitR;

                        // Try VALUE inputs first: INPUT_VALUE ⟷ output
                        if (pb.outputConnection) {
                                for (const input of target.inputList) {
                                        if (
                                                input.type !==
                                                        Blockly.INPUT_VALUE ||
                                                !input.connection
                                        )
                                                continue;
                                        const off = connWsXY(input.connection);
                                        const dx = wsPoint.x - off.x,
                                                dy = wsPoint.y - off.y;
                                        if (
                                                dx * dx + dy * dy <= hitR2 &&
                                                can(
                                                        input.connection,
                                                        pb.outputConnection,
                                                )
                                        ) {
                                                if (
                                                        !clearInputForPaste(
                                                                input.connection,
                                                                REPLACE_REAL_ON_HOVER,
                                                        )
                                                )
                                                        break;
                                                input.connection.connect(
                                                        pb.outputConnection,
                                                );
                                                return;
                                        }
                                }
                        }

                        // Then STATEMENT inputs: NEXT_STATEMENT ⟷ previous
                        if (pb.previousConnection) {
                                for (const input of target.inputList) {
                                        if (
                                                input.type !==
                                                        Blockly.NEXT_STATEMENT ||
                                                !input.connection
                                        )
                                                continue;
                                        const off = connWsXY(input.connection);
                                        const dx = wsPoint.x - off.x,
                                                dy = wsPoint.y - off.y;
                                        if (
                                                dx * dx + dy * dy <= hitR2 &&
                                                can(
                                                        input.connection,
                                                        pb.previousConnection,
                                                )
                                        ) {
                                                if (
                                                        !clearInputForPaste(
                                                                input.connection,
                                                                REPLACE_REAL_ON_HOVER,
                                                        )
                                                )
                                                        break;
                                                input.connection.connect(
                                                        pb.previousConnection,
                                                );
                                                return;
                                        }
                                }
                        }

                        // --- Fallbacks (your original order), preferring empty inputs ---
                        // 1) stack after: target.next ⟷ pb.previous
                        if (
                                target.nextConnection &&
                                pb.previousConnection &&
                                can(
                                        target.nextConnection,
                                        pb.previousConnection,
                                )
                        ) {
                                target.nextConnection.connect(
                                        pb.previousConnection,
                                );
                                return;
                        }

                        // 2) an empty statement input ⟷ pb.previous
                        for (const input of target.inputList) {
                                if (
                                        input.type === Blockly.NEXT_STATEMENT &&
                                        input.connection &&
                                        pb.previousConnection &&
                                        can(
                                                input.connection,
                                                pb.previousConnection,
                                        )
                                ) {
                                        if (
                                                !clearInputForPaste(
                                                        input.connection,
                                                        REPLACE_REAL_IN_FALLBACKS,
                                                )
                                        )
                                                continue;
                                        input.connection.connect(
                                                pb.previousConnection,
                                        );
                                        return;
                                }
                        }

                        // 3) an empty value input ⟷ pb.output
                        for (const input of target.inputList) {
                                if (
                                        input.type === Blockly.INPUT_VALUE &&
                                        input.connection &&
                                        pb.outputConnection &&
                                        can(
                                                input.connection,
                                                pb.outputConnection,
                                        )
                                ) {
                                        if (
                                                !clearInputForPaste(
                                                        input.connection,
                                                        REPLACE_REAL_IN_FALLBACKS,
                                                )
                                        )
                                                continue;
                                        input.connection.connect(
                                                pb.outputConnection,
                                        );
                                        return;
                                }
                        }

                        // 4) insert above: target.previous ⟷ pb.next
                        if (
                                target.previousConnection &&
                                pb.nextConnection &&
                                can(
                                        target.previousConnection,
                                        pb.nextConnection,
                                )
                        ) {
                                target.previousConnection.connect(
                                        pb.nextConnection,
                                );
                                return;
                        }

                        // else: stays where pasted (at the pointer)
                },
                checkbox: false,
        });

        function getClipboardData() {
                return Blockly.clipboard?.getLastCopiedData?.() || null;
        }

        function screenToWs(ws, xy) {
                const c = new Blockly.utils.Coordinate(xy.x, xy.y);
                return Blockly.utils.svgMath.screenToWsCoordinates(ws, c);
        }

        // Clean re-register on hot reloads (optional)
        try {
                Blockly.ContextMenuRegistry.registry.unregister("fc_cut_block");
        } catch (e) {}

        Blockly.ContextMenuRegistry.registry.register({
                id: "fc_cut_block",
                // Order: Copy (-1000000), then Cut (-999999.5), then your Paste (-999999)
                weight: -900000,
                scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
                displayText: () => translate("context_cut_option"),
                preconditionFn(scope) {
                        const b = scope?.block;
                        if (!(b instanceof Blockly.BlockSvg)) return "hidden";
                        if (b.isInFlyout) return "hidden"; // never in toolbox
                        if (b.isShadow()) return "hidden"; // avoid cutting shadows
                        if (!b.isDeletable() || !b.isMovable()) return "hidden";
                        return "enabled";
                },
                callback(scope) {
                        const block = /** @type {Blockly.BlockSvg} */ (
                                scope.block
                        );

                        // Group copy+delete as one undoable action
                        const prev = Blockly.Events.getGroup?.();
                        Blockly.Events.setGroup?.("fc_cut");

                        try {
                                // Put block on the clipboard
                                Blockly.clipboard.copy(block);
                                // Delete block, healing stacks where possible
                                block.dispose(true /* heal stack */);
                        } finally {
                                Blockly.Events.setGroup?.(prev || false);
                        }
                },
                checkbox: false,
        });

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

                        const data = getClipboardData();
                        if (!data) return;

                        // Selected block (if any, and not from flyout)
                        const selected = Blockly.common?.getSelected?.() || null;
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
            const seenTypes = new Set(); // Track which block types we've already added

            function processItem(item, categoryName = "") {
                const currentCategory = item.getName
                    ? item.getName()
                    : categoryName;

                if (currentCategory === "Snippets") {
                    return;
                }

                if (item.getContents) {
                    const contents = item.getContents();
                    const blocks = Array.isArray(contents)
                        ? contents
                        : [contents];

                    blocks.forEach((block) => {
                        if (block.kind === "block" && !seenTypes.has(block.type)) {
                            seenTypes.add(block.type);
                            toolboxBlocks.push({
                                type: block.type,
                                text: block.type,
                                full: block,
                            });
                        }
                    });
                }

                if (item.getChildToolboxItems) {
                    item.getChildToolboxItems().forEach((child) => {
                        processItem(child, currentCategory);
                    });
                }
            }

            workspace.getToolbox().getToolboxItems().forEach(processItem);
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
        SearchCategory.prototype.initBlockSearcher = function () {
                this.blockSearcher.indexBlocks = function () {
                        this.indexedBlocks_ = toolboxBlocks;
                };
                this.blockSearcher.indexBlocks();
        };

        SearchCategory.prototype.matchBlocks = function () {
                if (!this.hasInputStarted) {
                        this.hasInputStarted = true;
                        return;
                }

                const query =
                        this.searchField?.value.toLowerCase().trim() || "";

                const matches = this.blockSearcher.indexedBlocks_.filter(
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
            const flyout = this.workspace_.getToolbox().getFlyout();
            if (!flyout) {
                console.error("Flyout not found!");
                return;
            }

            flyout.hide();
            flyout.show([]);

            const xmlList = matches.map(match => createXmlFromJson(match.full));
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
