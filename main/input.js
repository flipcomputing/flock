import * as Blockly from 'blockly';
import { translate } from './translation.js';

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

    // Set up custom tab order management
    setupTabOrder();
  }

  function setupTabOrder() {
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

      // 4) Keyboard tab, shortcuts panel contents (if open), logo link, resizer
      pushUnique(document.querySelector('#info-tab-btn-shortcuts'));

      const shortcutsTabPanel = document.getElementById('info-tab-panel-shortcuts');
      if (shortcutsTabPanel && !shortcutsTabPanel.classList.contains('hidden')) {
        pushUnique(shortcutsTabPanel);
        shortcutsTabPanel.querySelectorAll('a[href], button:not([disabled])').forEach(pushUnique);
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

      // 5) Search inputs (toolbox flyout etc.)
      document
        .querySelectorAll(
          '.blocklySearchInput, .blocklyTreeSearch input, input[placeholder*="Search"]'
        )
        .forEach(pushUnique);

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
        workspaceGroup.setAttribute('aria-label', 'Blocks workspace');
        pushUnique(workspaceGroup);
      }

      // 6a) Workspace comments and block comment icons
      document.querySelectorAll('g.blocklyComment').forEach((el) => {
        if (!el.hasAttribute('tabindex') || el.tabIndex < 0) el.setAttribute('tabindex', '0');
        if (!el.getAttribute('role')) el.setAttribute('role', 'group');
        if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Workspace comment');
        pushUnique(el);
      });
      document.querySelectorAll('textarea.blocklyCommentText').forEach(pushUnique);

      // 6b) Trashcan + its flyout. The bin icon is ALWAYS a stop (Enter opens it when
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
      // 6c) Shortcuts panel (when visible), then undo/redo/zoom

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
        '#menuBtn',
        '#runCodeButton',
        '#stopCodeButton',
        '#openButton',
        '#colorPickerButton',
        '#projectName',
        '#exportCodeButton',
        '#exampleButton',
        '#toggleDesign',
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

    document.addEventListener('keydown', (e) => {
      if (
        document.activeElement.id === 'resizer' &&
        ['ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)
      ) {
        return; // Don't prevent default, let resizer handle it
      }

      if (e.key !== 'Tab') return;
      const activeElement = document.activeElement;

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

      const nextElement = focusableElements[nextIndex];
      if (nextElement) {
        // Ensure element is still focusable before focusing
        if (!nextElement.disabled && isElementVisible(nextElement)) {
          nextElement.focus();

          // Announce for screen readers
          if (nextElement.id === 'renderCanvas') {
            announceToScreenReader(translate('canvas_focus_navigation'));
          } else if (nextElement.closest('#gizmoButtons')) {
            const label =
              nextElement.getAttribute('aria-label') ||
              nextElement.title ||
              translate('design_tool_label');
            const focusedMessage = translate('focused_element_suffix').replace('{name}', label);
            announceToScreenReader(focusedMessage);
          } else if (
            nextElement.classList?.contains('blocklySearchInput') ||
            nextElement.type === 'search'
          ) {
            announceToScreenReader(translate('search_toolbox_focused'));
          } else if (nextElement.getAttribute('aria-label') === 'Blocks workspace') {
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
