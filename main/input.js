import * as Blockly from 'blockly';
import { translate } from './translation.js';
import { focusToolboxRestoringCategory } from './toolboxfocus.js';
import { hideInspector } from './view.js';
import {
  isRestorableWorkspaceNode,
  rememberWorkspaceFocus,
  focusRememberedWorkspaceNode,
} from './workspaceFocus.js';

const BLOCKS_WORKSPACE_LABEL = 'Blocks workspace';

export function setupInput() {
  // Get the canvas element
  const canvas = document.getElementById('renderCanvas');
  if (!canvas) return;

  // For mouse events
  canvas.addEventListener('mousedown', disableSelection);
  document.addEventListener('mousedown', enableSelection);

  // For touch events (mobile)
  canvas.addEventListener('touchstart', disableSelection);
  document.addEventListener('touchstart', enableSelection);

  // Disable text selection on the body when the canvas is touched or clicked
  function disableSelection() {
    document.body.style.userSelect = 'none'; // Disable text selection
  }

  // Enable text selection when touching or clicking outside the canvas
  function enableSelection(event) {
    // Check if the event target is outside the canvas
    if (!canvas.contains(event.target)) {
      document.body.style.userSelect = 'auto'; // Enable text selection
    }
  }

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

    // Focus directly so the href doesn't write a fragment to the URL.
    const skipLink = document.getElementById('skip-to-scene');
    if (skipLink && canvas) {
      skipLink.addEventListener('click', (e) => {
        e.preventDefault();
        canvas.focus();
      });
    }

    // Set up custom tab order management
    setupTabOrder();
  }

  function setupTabOrder() {
    const inspectorFocusableSelector =
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

    function getInspectorFocusableElements() {
      const inspector = document.getElementById('babylon-inspector-container');
      if (!inspector) return [];

      return Array.from(inspector.querySelectorAll(inspectorFocusableSelector)).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.disabled &&
          element.getAttribute('aria-hidden') !== 'true' &&
          isElementVisible(element)
      );
    }

    function getFocusableElements() {
      const elements = [];

      // Helper: add once if visible & enabled
      const pushUnique = (el) => {
        if (!el) return;
        const disabled = 'disabled' in el && el.disabled;
        if (isElementVisible(el) && !disabled && !elements.includes(el)) {
          elements.push(el);
        }
      };

      // 1) Canvas
      pushUnique(document.getElementById('renderCanvas'));
      pushUnique(document.getElementById('babylonUnmuteButton'));

      // 2) Gizmo buttons
      document.querySelectorAll('#gizmoButtons button, #gizmoButtons input').forEach(pushUnique);

      // 4) Info panel tabs and contents (if open), logo link, resizer
      pushUnique(document.querySelector('#info-tab-btn-help'));
      pushUnique(document.querySelector('#info-tab-btn-shortcuts'));

      const shortcutsTabPanel = document.getElementById('info-tab-panel-shortcuts');
      if (shortcutsTabPanel && !shortcutsTabPanel.classList.contains('hidden')) {
        pushUnique(shortcutsTabPanel);
        shortcutsTabPanel.querySelectorAll('a[href], button:not([disabled])').forEach(pushUnique);
      }

      pushUnique(document.querySelector('#info-tab-btn-player'));

      const playerTabPanel = document.getElementById('info-tab-panel-player');
      if (playerTabPanel && !playerTabPanel.classList.contains('hidden')) {
        pushUnique(playerTabPanel);
        playerTabPanel.querySelectorAll('a[href], button:not([disabled])').forEach(pushUnique);
      }

      pushUnique(document.querySelector('#info-panel-link'));

      // View toggle in canvas mode — after the logo link, before the resizer
      const bottomBar = document.getElementById('bottomBar');
      const inNarrowMode = bottomBar && getComputedStyle(bottomBar).display !== 'none';
      const codePanel = document.getElementById('codePanel');
      const inCodeMode =
        inNarrowMode && codePanel && getComputedStyle(codePanel).display !== 'none';
      if (inNarrowMode && !inCodeMode) {
        ['#canvasToggleBtn', '#codeToggleBtn', '#bottombar-flocklink'].forEach((sel) =>
          pushUnique(document.querySelector(sel))
        );
      }

      pushUnique(document.querySelector('#resizer'));

      // 5) Toolbox — the tree ROOT, so Blockly's FocusManager can restore the
      // remembered category. The search input inside it must NOT be a tab stop:
      // focusing it selects the search category, which wipes that memory.
      pushUnique(document.querySelector('.blocklyToolbox'));

      // Find the *visible* search flyout
      const flyout = Array.from(document.querySelectorAll('svg.blocklyToolboxFlyout')).find(
        (svg) => {
          const r = svg.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }
      );

      if (flyout) {
        // Prefer the inner workspace <g>, fall back to the svg
        const ws = flyout.querySelector('g.blocklyWorkspace');
        const target = ws || flyout;

        // Ensure it can receive focus
        if (!target.hasAttribute('tabindex') || target.tabIndex < 0) {
          target.setAttribute('tabindex', '0');
        }
        target.setAttribute('focusable', 'true');
        target.setAttribute('role', 'group');
        if (!target.getAttribute('aria-label')) {
          target.setAttribute('aria-label', 'Toolbox search results');
        }

        // Return just the flyout target (you can merge this into your larger list)
        elements.push(target);
      }

      // 6) Blockly MAIN WORKSPACE
      document
        .querySelectorAll(
          '.blockly-ws-search input, .blockly-ws-search button, .ws-search-mobile-bar input, .ws-search-mobile-bar button'
        )
        .forEach(pushUnique);
      const blocklySvg = document.querySelector('svg.blocklySvg');
      const workspaceGroup = blocklySvg?.querySelector('g.blocklyWorkspace');

      if (workspaceGroup && isElementVisible(blocklySvg)) {
        // Force tabIndex=0 — Blockly's focus manager may have set it to -1
        workspaceGroup.setAttribute('tabindex', '0');
        workspaceGroup.setAttribute('role', 'group');
        workspaceGroup.setAttribute('aria-label', BLOCKS_WORKSPACE_LABEL);
        pushUnique(workspaceGroup);
      }

      // Treat the inspector as a managed region immediately after the Blockly
      // workspace. Babylon handles Tab navigation within the region itself.
      pushUnique(getInspectorFocusableElements()[0]);

      // Workspace comments are deliberately not tab stops — Blockly's B/N stack
      // navigation reaches them and supplies their ARIA.

      // Trashcan + its flyout. The bin icon is ALWAYS a stop (Enter opens it when
      // closed, closes it when open). When the flyout is open, add its contents JUST
      // BEFORE the icon, so shift+tab off the icon drops into the code blocks and
      // tabbing forward into this region lands on the blocks, then the icon.
      // NOTE: intentionally unlike Blockly, which makes the icon the stop and only
      // lets you Tab into the flyout afterwards. Don't "fix" this back toward Blockly.
      const trashFlyout = Array.from(
        document.querySelectorAll('svg.blocklyFlyout:not(.blocklyToolboxFlyout)')
      ).find((svg) => {
        const r = svg.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (trashFlyout) {
        const ws = trashFlyout.querySelector('g.blocklyWorkspace') || trashFlyout;
        if (!ws.hasAttribute('tabindex') || ws.tabIndex < 0) ws.setAttribute('tabindex', '0');
        ws.setAttribute('role', 'group');
        if (!ws.getAttribute('aria-label')) ws.setAttribute('aria-label', 'Trash contents');
        pushUnique(ws);
      }
      const trashEl = document.querySelector('g.blocklyTrash');
      if (trashEl) {
        trashEl.setAttribute('tabindex', '0'); // focus manager may have set it to -1
        pushUnique(trashEl);
      }
      // Shortcuts panel (when visible), then undo/redo/zoom

      const shortcutsPanel = document.getElementById('shortcutsPanel');
      pushUnique(shortcutsPanel);
      if (shortcutsPanel) {
        shortcutsPanel.querySelectorAll('a[href], button:not([disabled])').forEach(pushUnique);
      }

      ['#workspaceSearchBtn', '#undoBtn', '#redoBtn', '#zoomOutBtn', '#zoomInBtn'].forEach((sel) =>
        pushUnique(document.querySelector(sel))
      );

      // View toggle in code mode — right after zoomInBtn
      if (inCodeMode) {
        ['#canvasToggleBtn', '#codeToggleBtn', '#bottombar-flocklink'].forEach((sel) =>
          pushUnique(document.querySelector(sel))
        );
      }

      // 7) Main UI controls (in natural order)
      [
        '#exampleButton',
        '#menuBtn',
        '#runCodeButton',
        '#stopCodeButton',
        '#colorPickerButton',
        '#projectName',
        '#togglePlay',
        '#fullscreenToggle',
      ].forEach((sel) => pushUnique(document.querySelector(sel)));

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

      // For SVG child elements, use the owning SVG's bounding rect
      // since <g> elements may return zero dimensions even when visible
      const rectSource = element.ownerSVGElement ?? element;
      const rect = rectSource.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function monitorInspectorFocus(inspector) {
      const focusableElements = getFocusableElements();
      const firstInspectorElement = getInspectorFocusableElements()[0];
      const inspectorIndex = focusableElements.indexOf(firstInspectorElement);
      const workspaceElement = document.querySelector(
        'svg.blocklySvg g.blocklyWorkspace[aria-label="Blocks workspace"]'
      );
      const nextElement = focusableElements[inspectorIndex + 1];
      const controller = new AbortController();
      let checkQueued = false;

      const stopMonitoring = () => controller.abort();
      const checkFocus = () => {
        checkQueued = false;
        if (controller.signal.aborted) return;
        if (!inspector.isConnected) {
          stopMonitoring();
          return;
        }
        if (inspector.dataset.focusTransition === 'true') return;

        const focusedElement = document.activeElement;
        if (inspector.contains(focusedElement)) return;

        stopMonitoring();
        const movedBackToWorkspace = focusedElement?.closest?.('svg.blocklySvg');
        const movedForwardOnWorkspace = focusedElement?.closest?.('#blocklyDiv, .fc-block-toolbar');
        if (!movedBackToWorkspace && !movedForwardOnWorkspace) return;

        hideInspector();
        const destination = movedBackToWorkspace ? workspaceElement : nextElement;
        requestAnimationFrame(() => {
          if (!destination || !isElementVisible(destination)) return;
          destination.focus();
          if (
            destination === workspaceElement &&
            !isRestorableWorkspaceNode(Blockly.getFocusManager?.()?.getFocusedNode?.())
          ) {
            focusRememberedWorkspaceNode();
          }
        });
      };
      const queueFocusCheck = () => {
        if (checkQueued) return;
        checkQueued = true;
        requestAnimationFrame(checkFocus);
      };

      inspector.addEventListener('focusout', queueFocusCheck, { signal: controller.signal });
      document.addEventListener('flock-inspector-collapsed-by-escape', stopMonitoring, {
        once: true,
        signal: controller.signal,
      });
    }

    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Tab' || !e.shiftKey) return;

        const firstInspectorElement = getInspectorFocusableElements()[0];
        if (!firstInspectorElement || document.activeElement !== firstInspectorElement) return;

        e.preventDefault();
        hideInspector();
        requestAnimationFrame(() => {
          const workspaceElement = document.querySelector(
            'svg.blocklySvg g.blocklyWorkspace[aria-label="Blocks workspace"]'
          );
          workspaceElement?.focus();
          if (!isRestorableWorkspaceNode(Blockly.getFocusManager?.()?.getFocusedNode?.())) {
            focusRememberedWorkspaceNode();
          }
        });
      },
      true
    );

    document.addEventListener('flock-inspector-collapsed-by-escape', () => {
      setTimeout(() => {
        document.querySelector('svg.blocklySvg g.blocklyWorkspace')?.focus();
        focusRememberedWorkspaceNode();
        announceToScreenReader(translate('code_workspace_focused'), {
          requireCanvasFocus: false,
        });
      }, 350);
    });

    document.addEventListener('keydown', (e) => {
      if (
        document.activeElement.id === 'resizer' &&
        ['ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)
      ) {
        return; // Don't prevent default, let resizer handle it
      }

      if (e.key !== 'Tab') return;
      const activeElement = document.activeElement;

      const inspector = activeElement?.closest?.('#babylon-inspector-container');
      if (inspector) {
        // Babylon owns navigation between controls inside the inspector.
        return;
      }

      // Let workspace search handle tabs when focussed
      if (activeElement?.closest?.('.blockly-ws-search, .ws-search-mobile-bar')) {
        return;
      }

      // Special handling for details navigation
      const detailsElement = document.getElementById('info-details');

      // If we're on the summary and details is closed, use custom management
      if (activeElement.matches('#info-details summary') && !detailsElement.open) {
        // Let custom management handle this - will go to next UI element
      }
      // If we're anywhere inside open details content, let browser handle it
      else if (activeElement.closest('#info-details') && detailsElement.open) {
        return; // Let browser handle navigation within details
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const currentElement = document.activeElement;
      let currentIndex = focusableElements.indexOf(currentElement);

      // If not directly in the list, check if inside a tracked container
      // (e.g. Blockly moved focus internally to a block within the flyout/workspace)
      if (currentIndex === -1) {
        currentIndex = focusableElements.findIndex(
          (el) => el !== currentElement && el.contains?.(currentElement)
        );
      }

      // Only manage tab navigation for our tracked elements
      if (currentIndex === -1 || currentElement.closest('details[open]')) return;

      e.preventDefault();

      // Calculate next index with wraparound
      let nextIndex;
      if (e.shiftKey) {
        nextIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1;
      }

      const focusManager = Blockly.getFocusManager?.();
      rememberWorkspaceFocus();

      const nextElement = focusableElements[nextIndex];
      if (nextElement) {
        // Ensure element is still focusable before focusing
        if (!nextElement.disabled && isElementVisible(nextElement)) {
          if (nextElement.classList?.contains('blocklyToolbox')) {
            focusToolboxRestoringCategory();
          } else {
            nextElement.focus();
            const inspector = nextElement.closest?.('#babylon-inspector-container');
            if (inspector) monitorInspectorFocus(inspector);
            // Blockly restores the passive block when Tab arrives from another
            // tree, but not from the trashcan (same tree) — fall back then.
            if (
              nextElement.getAttribute('aria-label') === BLOCKS_WORKSPACE_LABEL &&
              !isRestorableWorkspaceNode(focusManager?.getFocusedNode?.())
            ) {
              focusRememberedWorkspaceNode();
            }
          }

          // Announce for screen readers
          if (nextElement.id === 'renderCanvas') {
            announceToScreenReader(translate('canvas_focus_navigation'));
          } else if (nextElement.closest('#babylon-inspector-container')) {
            const focusedMessage = translate('focused_element_suffix').replace(
              '{name}',
              translate('inspector_tool_ui')
            );
            announceToScreenReader(focusedMessage);
          } else if (nextElement.closest('#gizmoButtons')) {
            const label =
              nextElement.getAttribute('aria-label') ||
              nextElement.title ||
              translate('design_tool_label');
            const focusedMessage = translate('focused_element_suffix').replace('{name}', label);
            announceToScreenReader(focusedMessage);
          } else if (nextElement.getAttribute('aria-label') === BLOCKS_WORKSPACE_LABEL) {
            announceToScreenReader(translate('code_workspace_focused'));
          } else if (nextElement.tagName === 'BUTTON' || nextElement.tagName === 'LABEL') {
            const text =
              nextElement.getAttribute('aria-label') ||
              nextElement.title ||
              nextElement.textContent ||
              translate('interactive_element_label');
            const focusedMessage = translate('focused_element_suffix').replace('{name}', text);
            announceToScreenReader(focusedMessage);
          } else if (nextElement.id === 'resizer') {
            announceToScreenReader(translate('panel_resizer_focused'));
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
    // Handle Ctrl+Z for undo when canvas is focused
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      const workspace = window.mainWorkspace || Blockly.getMainWorkspace();
      if (workspace) {
        workspace.undo(false);
        announceToScreenReader(translate('undo_performed'));
      }
      return;
    }

    // Handle Ctrl+Shift+Z or Ctrl+Y for redo when canvas is focused
    if (
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
      (e.ctrlKey && e.key.toLowerCase() === 'y')
    ) {
      e.preventDefault();
      const workspace = window.mainWorkspace || Blockly.getMainWorkspace();
      if (workspace) {
        workspace.undo(true);
        announceToScreenReader(translate('redo_performed'));
      }
      return;
    }

    // Announce camera movements to screen readers
    const announcements = {
      ArrowUp: translate('camera_moving_forward'),
      ArrowDown: translate('camera_moving_backward'),
      ArrowLeft: translate('camera_moving_left'),
      ArrowRight: translate('camera_moving_right'),
      w: translate('moving_forward'),
      s: translate('moving_backward'),
      a: translate('moving_left'),
      d: translate('moving_right'),
      ' ': translate('action_triggered'),
    };

    if (announcements[e.key]) {
      announceToScreenReader(announcements[e.key]);
    }

    // Tab navigation is now handled by the main setupTabOrder function
    // No need to prevent default here - let the main handler manage it
  }

  initializeFocusManagement();
}

export function announceToScreenReader(message, { requireCanvasFocus = true } = {}) {
  const canvas = document.getElementById('renderCanvas');
  if (requireCanvasFocus && document.activeElement !== canvas) return;

  const announcer = document.getElementById('announcements');
  if (announcer) {
    announcer.textContent = message;
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}
