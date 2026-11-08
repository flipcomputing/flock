// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from 'blockly';
import '@babylonjs/core/Debug/debugLayer';
import { flock } from '../flock.js';
import { enableGizmos } from '../ui/gizmos.js';
import { handleError, installGlobalErrorHandlers, isReported } from '../ui/notifications.js';
import { executeCode, togglePause } from './execution.js';
import '../ui/addmeshes.js';
import '../ui/colourpicker.js';
import { TOP_BLOCK_TYPES, AUTOSAVE_TO_FILE_ENABLED } from '../config.js';
import {
  initializeBlocks,
  initializeWorkspace,
  createBlocklyWorkspace,
  overrideSearchPlugin,
  workspace,
} from './blocklyinit.js';
import {
  saveWorkspace,
  loadWorkspace,
  exportCode,
  autoSaveToFile,
  setupFileInput,
  setupDragAndDrop,
  newProject,
  openFile,
  updateSaveButtonState,
  isProjectModified,
  isFileSaveUnknown,
  initProjectModifiedTracking,
  isFramedByOtherSite,
} from './files.js';
import { initExampleGallery } from './examples.js';
import {
  onResize,
  toggleInspector,
  isInspectorVisible,
  togglePlayMode,
  initializeUI,
  switchView,
} from './view.js';
import { hideLoadingScreen } from './loading.js';
//import "./debug.js";
import { initializeBlockHandling, showSelectedBlockHint } from './blockhandling.js';
import { announceToScreenReader, setupInput } from './input.js';
import { focusToolboxRestoringCategory } from './toolboxfocus.js';
import { addExportContextMenuOptions } from './export.js';
import { initCapturePanel } from '../ui/capturePanel.js';
import { initFpsCounter } from '../ui/fpsCounter.js';
import { setNameLabelsVisible } from '../ui/nameLabels.js';
import {
  setLanguage,
  initializeLanguageMenu,
  initializeSavedLanguage,
  translate,
} from './translation.js';
import { ShortcutsPanel } from '../accessibility/keyboardui.js';
import { KeyboardDispatcher } from './keyboardDispatcher.js';
import { ContextManager, toggleContextDebug } from './context.js';
import {
  areBlockHintsEnabled,
  setBlockHintsEnabled,
  showBlockHintMessage,
  hideBlockHint,
} from '../ui/blockHint.js';
import { setProjectLoading } from './projectLoading.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js')
    .then((registration) => {
      //console.log("Service Worker registered:", registration);

      // Check for updates to the Service Worker
      registration.onupdatefound = () => {
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.onstatechange = () => {
            if (newWorker.state === 'installed') {
              // If the old Service Worker is controlling the page
              if (navigator.serviceWorker.controller) {
                // Notify the user about the update
                console.log('New update available');
                showUpdateNotification();
              }
            }
          };
        }
      };
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}

async function showUpdateNotification() {
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'fixed',
    bottom: '0',
    left: '0',
    width: '100%',
    background: '#511D91',
    color: 'white',
    textAlign: 'center',
    padding: '10px',
    zIndex: '1000',
  });

  const message = document.createElement('span');
  message.dataset.i18n = 'update_available';
  message.textContent = 'A new version of Flock is available.';

  const reloadBtn = document.createElement('button');
  reloadBtn.id = 'reload-btn';
  reloadBtn.dataset.i18n = 'reload_button';
  reloadBtn.textContent = 'Reload';
  Object.assign(reloadBtn.style, {
    background: 'white',
    color: '#511D91',
    padding: '5px 10px',
    border: 'none',
    cursor: 'pointer',
  });

  banner.appendChild(message);
  banner.appendChild(document.createTextNode(' '));
  banner.appendChild(reloadBtn);

  const notification = document.createElement('div');
  notification.appendChild(banner);
  document.body.appendChild(notification);

  // Apply translations to the new elements
  const { applyTranslations } = await import('./translation.js');
  applyTranslations();

  reloadBtn.addEventListener('click', () => {
    // Reload the page to activate the new service worker
    window.location.reload();
  });
}

console.log('Blockly version:', Blockly.VERSION);

function registerBlocklyPlayShortcut() {
  const shortcutRegistry = Blockly.ShortcutRegistry.registry;
  const shortcutName = 'flock_play_scene';
  const keyCode = shortcutRegistry.createSerializedKey(Blockly.utils.KeyCodes.P, null);

  const keyboardShortcuts = shortcutRegistry.getRegistry?.();
  if (keyboardShortcuts?.[shortcutName]) {
    shortcutRegistry.unregister(shortcutName);
  }
  shortcutRegistry.register({
    name: shortcutName,
    keyCodes: [keyCode],
    preconditionFn: (ws) => !ws.isDragging(),
    callback: (_ws, event) => {
      const targetElement = event?.target instanceof Element ? event.target : null;
      const activeElement = document.activeElement;
      const inToolboxContext =
        !!targetElement?.closest?.('.blocklyToolboxDiv, .blocklyToolbox, .blocklyFlyout') ||
        !!activeElement?.closest?.('.blocklyToolboxDiv, .blocklyToolbox, .blocklyFlyout');
      if (inToolboxContext) {
        return false;
      }
      event.preventDefault();
      void executeCode({ focusCanvas: false });
      return true;
    },
  });
}

// Replace a registered shortcut's callback, passing the original as the last arg.
function wrapShortcut(name, handler) {
  const registry = Blockly.ShortcutRegistry.registry;
  const existing = registry.getRegistry?.()?.[name];
  if (!existing) return;
  const orig = existing.callback;
  registry.unregister(name);
  registry.register({
    ...existing,
    callback: (ws, event, shortcut) => handler(ws, event, shortcut, orig),
  });
}

function registerTopBlockReorderShortcuts() {
  // Active move session, set on start_move / start_move_stack.
  // snapshot: Map<block, originalY> for all top blocks at session start,
  // so abort_move can restore everything we displaced.
  let session = null;

  function asBlock(node) {
    return node &&
      typeof node.getRelativeToSurfaceXY === 'function' &&
      typeof node.moveTo === 'function'
      ? node
      : null;
  }

  function focusedBlock() {
    return asBlock(Blockly.getFocusManager?.().getFocusedNode?.());
  }

  function isTopBlock(b) {
    if (!b) return false;
    if (b.outputConnection) return false;
    if (b.previousConnection?.targetBlock?.()) return false;
    return !b.getParent();
  }

  function topBlocksSortedY(ws) {
    return (ws.getTopBlocks(false) || [])
      .slice()
      .sort((a, b) => a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y);
  }

  function syncIndicator() {
    Blockly.KeyboardMover?.mover?.repositionMoveIndicator?.();
  }

  function scrollBlockIntoView(ws, block) {
    const rect = block.getBoundingRectangle?.();
    if (!rect) return;
    if (typeof ws.scrollBoundsIntoView === 'function') {
      ws.scrollBoundsIntoView(rect, /* padding */ 20);
    } else if (typeof ws.scrollBlockIntoView === 'function') {
      ws.scrollBlockIntoView(block.id);
    }
  }

  function swap(direction, ws) {
    const block = session?.block;
    if (!block || !isTopBlock(block)) return false;

    const ordered = topBlocksSortedY(ws);
    const idx = ordered.indexOf(block);
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= ordered.length) return true;

    const reordered = ordered.slice();
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];

    // Same constants as layoutTopLevelBlocks.
    const SPACING = 40;
    const X = 10;
    let cursorY = 10;

    const prevGroup = Blockly.Events.getGroup();
    Blockly.Events.setGroup(prevGroup || true);
    try {
      for (const b of reordered) {
        const xy = b.getRelativeToSurfaceXY();
        if (xy.x !== X || xy.y !== cursorY) {
          b.moveTo(new Blockly.utils.Coordinate(X, cursorY));
        }
        const h = b.getHeightWidth?.().height || 40;
        cursorY += h + SPACING;
      }
    } finally {
      Blockly.Events.setGroup(prevGroup);
    }

    syncIndicator();
    scrollBlockIntoView(ws, block);
    return true;
  }

  function openSession(ws) {
    session = null;
    const block = focusedBlock();
    if (!TOP_BLOCK_TYPES.includes(block.type)) return;
    console.log('Moving top block', block.type, TOP_BLOCK_TYPES.includes(block.type));
    const snapshot = new Map();
    for (const b of ws.getTopBlocks(false) || []) {
      snapshot.set(b, b.getRelativeToSurfaceXY().y);
    }
    session = { block, snapshot };
  }

  wrapShortcut('start_move', (ws, e, s, orig) => {
    const r = orig(ws, e, s);
    openSession(ws);
    return r;
  });
  wrapShortcut('start_move_stack', (ws, e, s, orig) => {
    const r = orig(ws, e, s);
    openSession(ws);
    return r;
  });

  wrapShortcut('move_up', (ws, e, s, orig) => {
    if (session && isTopBlock(session.block)) return swap('up', ws);
    return orig(ws, e, s);
  });
  wrapShortcut('move_down', (ws, e, s, orig) => {
    if (session && isTopBlock(session.block)) return swap('down', ws);
    return orig(ws, e, s);
  });

  wrapShortcut('finish_move', (ws, e, s, orig) => {
    session = null;
    return orig(ws, e, s);
  });

  wrapShortcut('abort_move', (ws, e, s, orig) => {
    if (session) {
      const focused = session.block;
      const focusedOrigY = session.snapshot.get(focused);

      const prevGroup = Blockly.Events.getGroup();
      Blockly.Events.setGroup(prevGroup || true);
      try {
        for (const [block, y] of session.snapshot) {
          const cur = block.getRelativeToSurfaceXY();
          if (cur.y !== y) {
            block.moveTo(new Blockly.utils.Coordinate(cur.x, y));
          }
        }
      } finally {
        Blockly.Events.setGroup(prevGroup);
      }

      if (focused && focusedOrigY != null) {
        syncIndicator();
        scrollBlockIntoView(ws, focused);
      }
      session = null;
    }
    return orig(ws, e, s);
  });
}

function registerBlockInfoHint() {
  let describedBlockId = null;

  const dismiss = () => {
    describedBlockId = null;
    hideBlockHint();
  };

  wrapShortcut('information', (ws, event, shortcut, orig) => {
    const handled = orig?.(ws, event, shortcut);
    if (Blockly.getFocusManager().ephemeralFocusTaken()) return handled;

    const node = Blockly.getFocusManager().getFocusedNode();
    const block = ws.getNavigator?.().getSourceBlockFromNode(node) ?? null;
    if (!block || describedBlockId === block.id) {
      dismiss();
      return handled;
    }
    describedBlockId = block.id;
    showBlockHintMessage(Blockly.Tooltip.getTooltipOfObject(block));
    document.addEventListener('focusin', dismiss, { once: true, capture: true });
    return handled;
  });
}

// Blockly's "menu" shortcut opens nothing when the bare workspace is focused —
// its focus-target node has no showContextMenu. Fall back to the workspace menu.
function registerWorkspaceContextMenuFallback() {
  wrapShortcut('menu', (ws, event, shortcut, orig) => {
    if (orig?.(ws, event, shortcut)) return true;
    const focusedTree = Blockly.getFocusManager?.()?.getFocusedTree?.();
    if (focusedTree === ws && typeof ws.showContextMenu === 'function') {
      ws.showContextMenu(event);
      return true;
    }
    return false;
  });
}

function initializeApp() {
  //console.log("Initializing Flock XR ...");

  (() => {
    const ws = () => Blockly.getMainWorkspace?.();
    const flyout = () => ws()?.getToolbox?.()?.getFlyout?.();

    const isSearchCategorySelected = () => {
      const sel = document.querySelector(
        '.blocklyToolboxDiv .blocklyToolboxCategory.blocklyToolboxSelected'
      );
      return !!sel?.querySelector('input[type="search"]');
    };

    const clickIsInsideToolboxOrFlyout = (el) => !!el.closest('.blocklyToolboxDiv, .blocklyFlyout');

    // Close search flyout on outside clicks *only when* search is the selected category.
    const onOutside = (e) => {
      if (!isSearchCategorySelected()) return; // only for search
      if (clickIsInsideToolboxOrFlyout(e.target)) return; // ignore toolbox/flyout clicks
      flyout()?.hide?.();
    };

    // Capture so we run even if something stops propagation later.
    window.addEventListener('pointerdown', onOutside, {
      capture: true,
    });
    window.addEventListener('click', onOutside, { capture: true });
  })();

  const observer = new MutationObserver(() => {
    const unmuteButton = document.getElementById('babylonUnmuteButton');
    if (!unmuteButton) return;
    if (unmuteButton) {
      if (!unmuteButton.getAttribute('aria-label')) {
        unmuteButton.setAttribute('aria-label', translate('unmute_audio_aria'));
      }
      if (!unmuteButton.hasAttribute('tabindex')) {
        unmuteButton.setAttribute('tabindex', '0');
      }
      if (!unmuteButton.getAttribute('type')) {
        unmuteButton.setAttribute('type', 'button');
      }
      observer.disconnect();
    }

    const canvas = document.getElementById('renderCanvas');

    const restoreCanvasFocus = () => {
      if (!canvas) return;
      canvas.focus({ preventScroll: true });
    };

    const focusAfterUnmuteSettles = () => {
      // Try immediately and shortly after in case Babylon reflows/replaces elements
      restoreCanvasFocus();
      setTimeout(restoreCanvasFocus, 0);
      setTimeout(restoreCanvasFocus, 50);
    };

    const onActivate = () => {
      // Wait until Babylon hides/removes the unmute button
      const isGoneOrHidden = () =>
        !document.body.contains(unmuteButton) ||
        getComputedStyle(unmuteButton).display === 'none' ||
        getComputedStyle(unmuteButton).visibility === 'hidden';

      if (isGoneOrHidden()) {
        focusAfterUnmuteSettles();
        return;
      }

      const mo = new MutationObserver(() => {
        if (isGoneOrHidden()) {
          mo.disconnect();
          focusAfterUnmuteSettles();
        }
      });

      mo.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    };

    unmuteButton.addEventListener('click', onActivate, { once: true });
    unmuteButton.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter' || e.key === ' ') onActivate();
      },
      { once: true }
    );
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  // Add event listeners for menu buttons and controls
  const runCodeButton = document.getElementById('runCodeButton');
  const inspectorCheckbox = document.getElementById('inspectorCheckbox');
  const physicsShapesCheckbox = document.getElementById('physicsShapesCheckbox');
  const nameLabelsCheckbox = document.getElementById('nameLabelsCheckbox');
  const blockHintsButton = document.getElementById('blockHintsBtn');
  const togglePlayButton = document.getElementById('togglePlay');
  const pauseCodeButton = document.getElementById('pauseCodeButton');
  const fileInput = document.getElementById('fileInput');
  const exportCodeButton = document.getElementById('exportCodeButton');
  const openButton = document.getElementById('openButton');
  const mainMenuButton = document.getElementById('menuBtn');
  if (!runCodeButton || !pauseCodeButton || !exportCodeButton || !fileInput) {
    return;
  }
  runCodeButton.addEventListener('click', executeCode);
  pauseCodeButton.addEventListener('click', () => togglePause({ focusCanvas: true }));
  exportCodeButton.addEventListener('click', () => exportCode(workspace));
  initCapturePanel();
  initFpsCounter();

  // Add toolbar buttons
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  // Anchor button zoom at the top-left of the visible workspace rather than
  // the centre, so the blocks under the top-left corner stay put.
  const zoomTopLeft = (amount) => {
    const metrics = workspace.getMetrics();
    workspace.zoom(metrics.absoluteLeft, metrics.absoluteTop, amount);
  };
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoomTopLeft(1));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoomTopLeft(-1));
  const workspaceSearchBtn = document.getElementById('workspaceSearchBtn');
  if (workspaceSearchBtn)
    workspaceSearchBtn.addEventListener('click', () => {
      const workspaceSearch = window.flockWorkspaceSearch;
      if (!workspaceSearch) return;
      if (document.getElementById('blocklyDiv')?.classList.contains('blockly-search-active')) {
        workspaceSearch.close();
      } else {
        workspaceSearch.open();
      }
    });
  if (undoBtn) undoBtn.addEventListener('click', () => workspace.undo(false));
  if (redoBtn) redoBtn.addEventListener('click', () => workspace.undo(true));
  document.getElementById('gizmoUndoBtn')?.addEventListener('click', () => workspace.undo(false));
  document.getElementById('gizmoRedoBtn')?.addEventListener('click', () => workspace.undo(true));
  const shortcutsBtn = document.getElementById('shortcutsBtn');
  if (shortcutsBtn) shortcutsBtn.addEventListener('click', () => ShortcutsPanel.toggle());

  // Make open button work with keyboard
  if (openButton) {
    openButton.addEventListener('click', () => {
      openFile(workspace, executeCode);
    });

    openButton.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFile(workspace, executeCode);
      }
    });
  }

  // Enable the file input after initialization
  fileInput.removeAttribute('disabled');

  KeyboardDispatcher.on('*', 'Mod+KeyO', (e) => {
    e.preventDefault();
    openFile(workspace, executeCode);
  });
  KeyboardDispatcher.on('*', 'Mod+KeyS', (e) => {
    e.preventDefault();
    exportCode(workspace);
  });
  KeyboardDispatcher.on('*', 'Mod+KeyP', (e) => {
    // Documented in the Shortcuts panel as Play (accessibility/keyboardui.js);
    // match the visible Play button exactly, including restarting a running scene.
    e.preventDefault();
    void executeCode();
  });
  KeyboardDispatcher.on('*', 'Mod+KeyK', (e) => {
    // Matches the Pause button, so it works while editing code as well.
    e.preventDefault();
    togglePause();
  });
  KeyboardDispatcher.on('*', 'Mod+Slash', (e) => {
    e.preventDefault();
    ShortcutsPanel.toggle();
  });
  KeyboardDispatcher.on('*', 'Mod+KeyM', (e) => {
    e.preventDefault();
    mainMenuButton?.focus();
  });
  KeyboardDispatcher.on('*', 'Mod+KeyE', (e) => {
    e.preventDefault();
    Blockly.keyboardNavigationController?.setIsActive?.(true);
    Blockly.getFocusManager()?.focusTree?.(workspace);
  });
  KeyboardDispatcher.on('*', 'Mod+Shift+KeyD', (e) => {
    // Desktop fallback that toggles both debug panels together: the context
    // banner, and the console log panel normally opened with a three-finger
    // tap on touch devices.
    if (!window.__flockToggleDebugLog) return;
    e.preventDefault();
    window.__flockToggleDebugLog();
    toggleContextDebug();
  });
  KeyboardDispatcher.on('*', 'KeyT', (e) => {
    const ctx = ContextManager.getCurrentContext();
    if (ctx === 'TYPING') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (!document.activeElement?.closest('.injectionDiv')) return;
    if (document.activeElement?.closest('.blocklyToolbox')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    // Defer focus until after this keydown event finishes dispatching.
    // The Blockly v13 toolbox-search category synchronously focuses its
    // <input> when the toolbox receives focus, so moving focus inline
    // here causes the 't' keypress to be typed into the search box.
    setTimeout(() => {
      focusToolboxRestoringCategory(workspace);
    }, 0);
  });
  // The inspector can also be closed from its own header, so read its live state.
  document.addEventListener('toolspanelsync', () => {
    if (inspectorCheckbox) inspectorCheckbox.checked = isInspectorVisible();
    if (physicsShapesCheckbox) {
      physicsShapesCheckbox.checked = !!flock.physicsViewer && !!flock.physicsViewerActive;
    }
  });
  physicsShapesCheckbox?.addEventListener('change', () => {
    flock.showPhysics(physicsShapesCheckbox.checked);
    physicsShapesCheckbox.checked = !!flock.physicsViewer && !!flock.physicsViewerActive;
  });
  nameLabelsCheckbox?.addEventListener('change', () => {
    setNameLabelsVisible(nameLabelsCheckbox.checked);
  });
  inspectorCheckbox?.addEventListener('change', async () => {
    const opening = inspectorCheckbox.checked;
    // The inspector docks behind the panel, so close it before focus moves.
    if (opening) document.dispatchEvent(new CustomEvent('toolspanelclose'));
    const opened = await toggleInspector({ focus: opening });
    inspectorCheckbox.checked = opened;
    const inspector = document.getElementById('babylon-inspector-container');
    if (opened && inspector?.contains(document.activeElement)) {
      const focusedMessage = translate('focused_element_suffix').replace(
        '{name}',
        translate('inspector_tool_ui')
      );
      announceToScreenReader(focusedMessage, { requireCanvasFocus: false });
    }
  });

  const updateBlockHintsButton = () => {
    if (!blockHintsButton) return;
    const expanded = areBlockHintsEnabled();
    const key = expanded ? 'hide_block_hints' : 'show_block_hints';
    const label = translate(`${key}_ui`);
    blockHintsButton.dataset.i18n = key;
    blockHintsButton.setAttribute('aria-expanded', String(expanded));
    blockHintsButton.setAttribute('aria-label', label);
    blockHintsButton.title = label;
    blockHintsButton.classList.toggle('active', expanded);
  };
  updateBlockHintsButton();
  document.addEventListener('flock-block-hints-changed', updateBlockHintsButton);
  // Taking focus would deselect the workspace block, leaving nothing to hint about.
  blockHintsButton?.addEventListener('pointerdown', (event) => event.preventDefault());
  blockHintsButton?.addEventListener('click', () => {
    setBlockHintsEnabled(!areBlockHintsEnabled());
    if (areBlockHintsEnabled()) {
      showSelectedBlockHint();
    }
    updateBlockHintsButton();
  });

  if (togglePlayButton) {
    togglePlayButton.addEventListener('click', togglePlayMode);
  }

  const fullscreenToggleEl = document.getElementById('fullscreenToggle');
  if (fullscreenToggleEl) {
    fullscreenToggleEl.addEventListener('click', function () {
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
  }

  const projectNew = document.getElementById('project-new');
  if (projectNew) {
    projectNew.addEventListener('click', function (e) {
      e.preventDefault();
      newProject();
      document.getElementById('menuDropdown')?.classList.add('hidden');
    });
  }
  const projectOpen = document.getElementById('project-open');
  if (projectOpen) {
    projectOpen.addEventListener('click', function (e) {
      e.preventDefault();
      openFile(workspace, executeCode);
      document.getElementById('menuDropdown')?.classList.add('hidden');
    });
  }
  const projectSave = document.getElementById('project-save');
  if (projectSave) {
    projectSave.addEventListener('click', function (e) {
      e.preventDefault();
      exportCode(workspace);
      document.getElementById('menuDropdown')?.classList.add('hidden');
    });
  }

  initializeUI();

  enableGizmos();
  // Enable gizmo buttons

  const exampleButton = document.getElementById('exampleButton');

  const fullscreenToggle = document.getElementById('fullscreenToggle');

  //toolboxControl.removeAttribute("disabled");
  runCodeButton.removeAttribute('disabled');
  if (exampleButton) exampleButton.removeAttribute('disabled');

  if (fullscreenToggle) {
    const isIOS = () =>
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobile = () => /Mobi|Android/i.test(navigator.userAgent) || isIOS();
    const isInstalledApp = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      navigator.standalone === true;

    const fullscreenSupported =
      document.documentElement.requestFullscreen ||
      document.documentElement.mozRequestFullScreen ||
      document.documentElement.webkitRequestFullscreen ||
      document.documentElement.msRequestFullscreen;

    // iOS browsers drop out of fullscreen as soon as a text field takes focus and
    // the keyboard appears. A home-screen app can still hide the system bars, but
    // not for enough gain to spend a button on.
    const fullscreenShown = fullscreenSupported && !isIOS() && !(isMobile() && isInstalledApp());

    if (fullscreenShown) {
      fullscreenToggle.removeAttribute('disabled');
    } else {
      fullscreenToggle.style.display = 'none';
    }
  }

  // Add event listeners for buttons and controls
  /*toolboxControl.addEventListener("mouseover", function () {
                toolboxControl.style.cursor = "pointer";
                toggleToolbox();
        });*/

  initExampleGallery();

  // Make setLanguage available globally for the menu
  window.setLanguage = async (lang) => await setLanguage(lang);

  // Initialize language menu
  initializeLanguageMenu();
}

function showFramedRefusal() {
  const notice = document.createElement('div');
  notice.className = 'framed-refusal';
  notice.setAttribute('role', 'alert');
  const message = document.createElement('p');
  message.textContent = translate('framed_editor_message');
  const link = document.createElement('a');
  link.href = window.location.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = translate('framed_editor_open_link');
  notice.append(message, link);
  document.body.replaceChildren(notice);
}

window.onload = async function () {
  if (isFramedByOtherSite()) {
    showFramedRefusal();
    return;
  }

  installGlobalErrorHandlers();

  const blocklyContainer = document.getElementById('blocklyDiv');
  if (!blocklyContainer) {
    console.warn('Skipping editor initialization: missing required #blocklyDiv container.');
    return;
  }

  // Resize Blockly workspace and Babylon.js canvas when the window is resized
  window.addEventListener('resize', onResize);

  switchView('both');
  initializeBlocks();
  // Initialize Blockly and add custom context menu options
  addExportContextMenuOptions();

  createBlocklyWorkspace();
  if (!workspace) {
    handleError(new Error('Blockly workspace failed to initialize'), {
      source: 'startup',
      fatal: true,
    });
    return;
  }

  registerBlocklyPlayShortcut();
  registerTopBlockReorderShortcuts();
  registerWorkspaceContextMenuFallback();
  registerBlockInfoHint();
  initializeWorkspace();
  overrideSearchPlugin(workspace);
  initializeBlockHandling();
  initProjectModifiedTracking(workspace);

  console.log('Welcome to Flock XR 🐦🐦🐦');
  console.log('Release 1');

  // Autosave every 30 seconds: to localStorage and (if enabled and a file was
  // saved) to that file
  setInterval(() => {
    saveWorkspace(workspace);
    if (AUTOSAVE_TO_FILE_ENABLED) {
      autoSaveToFile(workspace);
    }
  }, 30000);

  // A custom dialog can't run synchronously here, so save to localStorage and
  // fall back to the browser's own "leave site?" prompt.
  window.addEventListener('beforeunload', (event) => {
    if (!isProjectModified() && !isFileSaveUnknown()) return;
    saveWorkspace(workspace);
    event.preventDefault();
    event.returnValue = '';
  });

  (async () => {
    try {
      await flock.initialize();
      KeyboardDispatcher.connect(flock.inputManager);

      // Hide loading screen once Flock is fully initialized
      setTimeout(hideLoadingScreen, 500);
    } catch (error) {
      if (!isReported(error)) handleError(error, { source: 'startup', fatal: true });
    }
  })();

  //workspace.getToolbox().setVisible(false);

  workspace.addChangeListener(function (event) {
    if (event.type === Blockly.Events.FINISHED_LOADING) {
      setProjectLoading(false);
    }
  });

  // Initial view setup
  setProjectLoading(true);

  // Initialize saved language before loading workspace
  await initializeSavedLanguage();

  // Refresh toolbox to ensure categories are translated after language initialization
  const toolboxElement = document.getElementById('toolbox');
  if (toolboxElement) {
    workspace.updateToolbox(toolboxElement);
  } else {
    // If no toolbox element, import the toolbox configuration
    const { toolbox } = await import('../toolbox.js');
    workspace.updateToolbox(toolbox);
  }

  initializeApp();

  setupFileInput(workspace, executeCode);
  setupDragAndDrop(workspace, executeCode);

  setupInput();

  if (flock.isDebugLoggingEnabled()) {
    import('../ui/sizedebug.js').then((m) => m.initSizeDebug());
  }

  loadWorkspace(workspace, executeCode);
  updateSaveButtonState();
};
