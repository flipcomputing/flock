// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as Blockly from 'blockly';
import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import { flock } from '../flock.js';
import { initializeVariableIndexes } from '../blocks/blocks';
import { enableGizmos } from '../ui/gizmos.js';
import { handleError, installGlobalErrorHandlers } from '../ui/notifications.js';
import { executeCode, stopCode } from './execution.js';
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
} from './files.js';
import { initExampleGallery } from './examples.js';
import { onResize, toggleDesignMode, togglePlayMode, initializeUI, switchView } from './view.js';
import { hideLoadingScreen } from './loading.js';
//import "./debug.js";
import { initializeBlockHandling } from './blockhandling.js';
import { setupInput } from './input.js';
import { addExportContextMenuOptions } from './export.js';
import {
  setLanguage,
  initializeLanguageMenu,
  initializeSavedLanguage,
  translate,
} from './translation.js';
import { ShortcutsPanel } from '../accessibility/keyboardui.js';
import { KeyboardDispatcher } from './keyboardDispatcher.js';
import { ContextManager } from './context.js';

function isEmbedModeEnabled() {
  const embedParam = new URLSearchParams(window.location.search).get('embed');
  if (embedParam === null) return false;

  const normalized = embedParam.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0' && normalized !== 'off';
}

function addEmbedPlaybackControls() {
  const existingControls = document.getElementById('embedTopBar');
  if (existingControls) return existingControls;

  const topBar = document.createElement('div');
  topBar.id = 'embedTopBar';
  Object.assign(topBar.style, {
    position: 'relative',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '1000',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    background: '#ffffff',
    border: '0',
    borderBottom: '1px solid #cfcde0',
    boxSizing: 'border-box',
  });

  const buttonRow = document.createElement('div');
  Object.assign(buttonRow.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  });

  const createActionButton = (templateId, fallbackLabel, onClick) => {
    const template = document.getElementById(templateId);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bigbutton';
    button.title = fallbackLabel;
    button.setAttribute('aria-label', fallbackLabel);
    button.style.minWidth = '36px';
    button.style.minHeight = '36px';
    button.style.width = '36px';
    button.style.height = '36px';
    button.style.margin = '0';
    button.style.padding = '0';
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.lineHeight = '1';

    if (template) {
      button.innerHTML = template.innerHTML;
    } else {
      button.textContent = fallbackLabel;
    }
    button.addEventListener('click', onClick);
    return button;
  };

  const playButton = createActionButton('runCodeButton', 'Play', () => {
    void executeCode();
  });
  buttonRow.appendChild(playButton);

  const stopButton = createActionButton('stopCodeButton', 'Stop', () => {
    stopCode();
  });
  buttonRow.appendChild(stopButton);
  topBar.appendChild(buttonRow);

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  });

  const openInFlockButton = document.createElement('a');
  const projectUrl = new URLSearchParams(window.location.search).get('project');
  const targetUrl = projectUrl
    ? `https://flipcomputing.github.io/flock/?project=${encodeURIComponent(projectUrl)}`
    : 'https://flipcomputing.github.io/flock/';
  openInFlockButton.href = targetUrl;
  openInFlockButton.id = 'embedOpenInFlock';
  openInFlockButton.target = '_blank';
  openInFlockButton.rel = 'noopener noreferrer';
  openInFlockButton.className = 'bigbutton';
  openInFlockButton.title = 'Open in Flock';
  openInFlockButton.setAttribute('aria-label', 'Open in Flock');
  openInFlockButton.style.minWidth = '36px';
  openInFlockButton.style.minHeight = '36px';
  openInFlockButton.style.width = '36px';
  openInFlockButton.style.height = '36px';
  openInFlockButton.style.margin = '0';
  openInFlockButton.style.padding = '0';
  openInFlockButton.style.textDecoration = 'none';
  openInFlockButton.style.display = 'inline-flex';
  openInFlockButton.style.alignItems = 'center';
  openInFlockButton.style.justifyContent = 'center';
  openInFlockButton.innerHTML = `
    <span class="icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <path fill="currentColor" d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l82.7 0-201.4 201.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3 448 192c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160c0-17.7-14.3-32-32-32L320 0zM80 96C35.8 96 0 131.8 0 176L0 432c0 44.2 35.8 80 80 80l256 0c44.2 0 80-35.8 80-80l0-80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 80c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l80 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 96z"/>
      </svg>
    </span>
  `;
  actions.appendChild(openInFlockButton);
  topBar.appendChild(actions);

  document.body.prepend(topBar);
  return topBar;
}

function shouldShowEmbedPlaybackControls() {
  const controlsParam = new URLSearchParams(window.location.search).get('controls');
  if (!controlsParam) return false;

  const normalized = controlsParam.trim().toLowerCase();
  return (
    normalized === 'playstop' ||
    normalized === 'play-stop' ||
    normalized === 'true' ||
    normalized === '1'
  );
}

function addEmbedBottomBar() {
  const existingBar = document.getElementById('embedBottomBar');
  if (existingBar) return existingBar;

  const bar = document.createElement('div');
  bar.id = 'embedBottomBar';
  Object.assign(bar.style, {
    position: 'relative',
    left: '0',
    right: '0',
    bottom: '0',
    zIndex: '1000',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: '6px 6px',
    minHeight: '0',
    lineHeight: '1',
    background: '#ffffff',
    border: '0',
    borderTop: '1px solid #cfcde0',
    boxSizing: 'border-box',
  });

  const logoLink = document.createElement('a');
  logoLink.href = 'https://flockxr.com/';
  logoLink.target = '_blank';
  logoLink.rel = 'noopener noreferrer';
  logoLink.setAttribute('aria-label', 'Visit Flock XR website');
  logoLink.style.display = 'inline-flex';
  logoLink.style.alignItems = 'center';
  logoLink.style.justifyContent = 'center';
  logoLink.style.padding = '2px';
  logoLink.style.borderRadius = '4px';

  const logo = document.createElement('img');
  logo.src = './images/inline-flock-xr.svg';
  logo.alt = 'Flock XR';
  logo.style.height = '15px';
  logo.style.width = 'auto';
  logoLink.appendChild(logo);
  bar.appendChild(logoLink);

  document.body.appendChild(bar);
  return bar;
}

function applyEmbedMode() {
  if (!isEmbedModeEnabled()) return;
  document.body.classList.add('embed-mode');

  const header = document.querySelector('header');
  const codePanel = document.getElementById('codePanel');
  const bottomBar = document.getElementById('bottomBar');
  const gizmoButtons = document.getElementById('gizmoButtons');
  const flockLink = document.getElementById('flocklink');
  const resizer = document.getElementById('resizer');
  const infoPanel = document.getElementById('info-panel');
  const canvasArea = document.getElementById('canvasArea');
  const mainContent = document.getElementById('maincontent');
  const canvas = document.getElementById('renderCanvas');

  if (header) header.style.display = 'none';
  if (codePanel) codePanel.style.display = 'none';
  if (bottomBar) bottomBar.style.display = 'none';
  if (gizmoButtons) gizmoButtons.style.display = 'none';
  if (resizer) resizer.style.display = 'none';
  if (infoPanel) infoPanel.style.display = 'none';

  if (canvasArea) {
    canvasArea.style.display = '';
    canvasArea.style.width = '100%';
    canvasArea.style.height = '100%';
    canvasArea.style.flex = '1 1 100%';
    canvasArea.style.overflow = 'hidden';
  }

  if (mainContent) {
    mainContent.style.transform = 'translateX(0px)';
    mainContent.style.marginTop = '0';
    mainContent.style.height = 'auto';
    mainContent.tabIndex = -1;
  }

  if (canvas) {
    canvas.tabIndex = 0;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
  }

  if (flockLink) flockLink.style.display = 'none';
  flock.embedMode = true;

  document.documentElement.style.setProperty('--dynamic-offset', '0px');
  document.documentElement.style.background = '#e5e5eb';

  const embedBottomBar = addEmbedBottomBar();
  let embedTopBar = null;

  if (shouldShowEmbedPlaybackControls()) {
    embedTopBar = addEmbedPlaybackControls();
  }

  let embedShell = document.getElementById('embedShell');
  if (!embedShell) {
    embedShell = document.createElement('div');
    embedShell.id = 'embedShell';
    document.body.appendChild(embedShell);
  }

  if (embedTopBar) embedShell.appendChild(embedTopBar);
  if (mainContent) embedShell.appendChild(mainContent);
  if (embedBottomBar) embedShell.appendChild(embedBottomBar);

  const openInFlockButton = document.getElementById('embedOpenInFlock');
  const logoLink = document.querySelector('#embedBottomBar a');

  if (canvas && openInFlockButton && !openInFlockButton.dataset.canvasTabBound) {
    openInFlockButton.addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        canvas.focus();
      }
    });
    openInFlockButton.dataset.canvasTabBound = 'true';
  }

  if (canvas && logoLink && !canvas.dataset.logoTabBound) {
    canvas.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;

      if (!event.shiftKey) {
        event.preventDefault();
        logoLink.focus();
        return;
      }

      const unmuteButton = document.getElementById('babylonUnmuteButton');
      const unmuteVisible =
        unmuteButton &&
        getComputedStyle(unmuteButton).display !== 'none' &&
        getComputedStyle(unmuteButton).visibility !== 'hidden';

      if (!unmuteVisible && openInFlockButton) {
        event.preventDefault();
        openInFlockButton.focus();
      }
    });
    canvas.dataset.logoTabBound = 'true';
  }

  if (canvas && logoLink && !logoLink.dataset.canvasTabBound) {
    logoLink.addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && event.shiftKey) {
        event.preventDefault();
        canvas.focus();
      }
    });
    logoLink.dataset.canvasTabBound = 'true';
  }

  onResize('reset');
}

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

function registerTopBlockReorderShortcuts() {
  function refreshMoveIndicator(ws) {
    const block = session?.block;
    if (!block) return;

    // Try to locate the active KeyboardMover via the controller.
    const ctrl = Blockly.keyboardNavigationController;
    let mover = ctrl?.mover;
    if (!mover && ctrl) {
      for (const k of Object.keys(ctrl)) {
        const v = ctrl[k];
        if (v && v.constructor?.name?.includes('Mover')) {
          mover = v;
          break;
        }
      }
    }

    // Common refresh hooks — different beta builds expose different ones.
    const indicator = mover?.moveIndicator ?? mover?.indicator ?? mover?.moveIndicator_;
    if (indicator?.updateLocation) {
      indicator.updateLocation(block);
      return;
    }
    if (indicator?.update) {
      indicator.update(block);
      return;
    }
    if (mover?.updateIndicator) {
      mover.updateIndicator();
      return;
    }

    // DOM fallback: translate the indicator SVG to the block's new XY.
    const xy = block.getRelativeToSurfaceXY();
    const el = ws
      .getInjectionDiv()
      ?.querySelector(".blocklyMoveIndicator, [data-id*='moveIndicator']");
    if (el) {
      el.setAttribute('transform', `translate(${xy.x}, ${xy.y})`);
    }
  }

  const registry = Blockly.ShortcutRegistry.registry;
  const origRegistry = registry.getRegistry?.() ?? {};

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

  function findIndicatorEl(ws) {
    return (
      ws.getInjectionDiv()?.querySelector(".blocklyMoveIndicator, [class*='oveIndicator']") ??
      document.querySelector(".blocklyMoveIndicator, [class*='oveIndicator']")
    );
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

  function wrap(name, handler) {
    const existing = origRegistry[name];
    if (!existing) return;
    const orig = existing.callback;
    registry.unregister(name);
    registry.register({
      ...existing,
      callback: (ws, event, shortcut) => handler(ws, event, shortcut, orig),
    });
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

  wrap('start_move', (ws, e, s, orig) => {
    const r = orig(ws, e, s);
    openSession(ws);
    return r;
  });
  wrap('start_move_stack', (ws, e, s, orig) => {
    const r = orig(ws, e, s);
    openSession(ws);
    return r;
  });

  wrap('move_up', (ws, e, s, orig) => {
    if (session && isTopBlock(session.block)) return swap('up', ws);
    return orig(ws, e, s);
  });
  wrap('move_down', (ws, e, s, orig) => {
    if (session && isTopBlock(session.block)) return swap('down', ws);
    return orig(ws, e, s);
  });

  wrap('finish_move', (ws, e, s, orig) => {
    session = null;
    return orig(ws, e, s);
  });

  wrap('abort_move', (ws, e, s, orig) => {
    if (session) {
      const focused = session.block;
      const focusedOrigY = session.snapshot.get(focused);
      const indicatorEl = findIndicatorEl(ws);

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
  const toggleDesignButton = document.getElementById('toggleDesign');
  const togglePlayButton = document.getElementById('togglePlay');
  const stopCodeButton = document.getElementById('stopCodeButton');
  const fileInput = document.getElementById('fileInput');
  const exportCodeButton = document.getElementById('exportCodeButton');
  const openButton = document.getElementById('openButton');
  const menuButton = document.getElementById('menuBtn');
  if (!runCodeButton || !stopCodeButton || !exportCodeButton || !fileInput) {
    return;
  }
  runCodeButton.addEventListener('click', executeCode);
  stopCodeButton.addEventListener('click', stopCode);
  exportCodeButton.addEventListener('click', () => exportCode(workspace));

  // Add toolbar buttons
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => workspace.zoomCenter(1));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => workspace.zoomCenter(-1));
  const workspaceSearchBtn = document.getElementById('workspaceSearchBtn');
  if (workspaceSearchBtn)
    workspaceSearchBtn.addEventListener('click', () => window.flockWorkspaceSearch?.open());
  if (undoBtn) undoBtn.addEventListener('click', () => workspace.undo(false));
  if (redoBtn) redoBtn.addEventListener('click', () => workspace.undo(true));
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
    e.preventDefault();
    document.getElementById('renderCanvas')?.focus({ preventScroll: true });
  });
  KeyboardDispatcher.on('*', 'Mod+Slash', (e) => {
    e.preventDefault();
    ShortcutsPanel.toggle();
  });
  KeyboardDispatcher.on('*', 'Mod+KeyM', (e) => {
    e.preventDefault();
    if (menuButton) menuButton.focus();
  });
  KeyboardDispatcher.on('*', 'Mod+KeyE', (e) => {
    e.preventDefault();
    Blockly.getFocusManager()?.focusTree?.(workspace);
  });
  KeyboardDispatcher.on('*', 'KeyT', (e) => {
    const ctx = ContextManager.getCurrentContext();
    if (ctx === 'TYPING') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (document.activeElement?.closest('.blocklyToolbox')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    // Defer focus until after this keydown event finishes dispatching.
    // The Blockly v13 toolbox-search category synchronously focuses its
    // <input> when the toolbox receives focus, so moving focus inline
    // here causes the 't' keypress to be typed into the search box.
    setTimeout(() => {
      Blockly.keyboardNavigationController?.setIsActive(true);
      const toolbox = workspace.getToolbox?.();
      if (!toolbox) return;

      const SearchCategory = Blockly.registry.getClass(
        Blockly.registry.Type.TOOLBOX_ITEM,
        'search'
      );
      const isSearchItem = (item) => {
        if (!item) return false;
        const def = item.getToolboxItemDef?.() || item.toolboxItemDef;
        const kind = (def?.kind || '').toLowerCase();
        return (SearchCategory && item instanceof SearchCategory) || kind === 'search';
      };

      const selected = toolbox.getSelectedItem?.();
      const previous = toolbox.getPreviouslySelectedItem?.();

      let target = null;
      if (selected && !isSearchItem(selected)) {
        target = selected;
      } else if (previous && !isSearchItem(previous)) {
        target = previous;
      } else {
        // First use (or last selection was the search category):
        // land on the first real category instead of the search box.
        target = (toolbox.getToolboxItems?.() || []).find((item) => {
          const def = item.getToolboxItemDef?.() || item.toolboxItemDef;
          const kind = (def?.kind || '').toLowerCase();
          if (isSearchItem(item) || kind === 'sep' || kind === 'label') {
            return false;
          }
          return typeof item.isSelectable === 'function' ? item.isSelectable() : true;
        });
      }

      const focusManager = Blockly.getFocusManager?.();
      focusManager?.focusTree?.(toolbox);
      if (target) {
        if (toolbox.getSelectedItem?.() === target) {
          toolbox.setSelectedItem?.(null);
        }
        toolbox.setSelectedItem?.(target);
        focusManager?.focusNode?.(target);
      } else {
        const toolboxDiv = toolbox.HtmlDiv || document.querySelector('.blocklyToolboxDiv');
        toolboxDiv?.focus();
      }
    }, 0);
  });
  if (toggleDesignButton) {
    toggleDesignButton.addEventListener('click', toggleDesignMode);
  }

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
    // iOS browsers (iPad/iPhone, Safari and Chrome) drop out of fullscreen as
    // soon as a text field is focused and the keyboard appears, so hiding the
    // button is better than offering one that breaks. Installed PWA / standalone
    // is already fullscreen and is handled separately.
    const isIOSBrowser = () => {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        navigator.standalone === true;
      return isIOS && !isStandalone;
    };

    const fullscreenSupported =
      document.documentElement.requestFullscreen ||
      document.documentElement.mozRequestFullScreen ||
      document.documentElement.webkitRequestFullscreen ||
      document.documentElement.msRequestFullscreen;
    if (fullscreenSupported && !isIOSBrowser()) {
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

window.onload = async function () {
  installGlobalErrorHandlers();

  const blocklyContainer = document.getElementById('blocklyDiv');
  if (!blocklyContainer) {
    const standaloneScript = document.getElementById('flock');
    if (standaloneScript) {
      console.log(
        'Skipping editor initialization: standalone script detected without #blocklyDiv.'
      );
    } else {
      console.warn('Skipping editor initialization: missing required #blocklyDiv container.');
    }
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
  initializeWorkspace();
  overrideSearchPlugin(workspace);
  initializeBlockHandling();

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

  (async () => {
    try {
      await flock.initialize();
      KeyboardDispatcher.connect(flock.inputManager);

      // Hide loading screen once Flock is fully initialized
      setTimeout(hideLoadingScreen, 500);
    } catch (error) {
      handleError(error, { source: 'startup', fatal: true });
    }
  })();

  //workspace.getToolbox().setVisible(false);

  workspace.addChangeListener(function (event) {
    if (event.type === Blockly.Events.FINISHED_LOADING) {
      initializeVariableIndexes();
      window.loadingCode = false;
    }
  });

  // Initial view setup
  window.loadingCode = true;

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
  applyEmbedMode();

  setupFileInput(workspace, executeCode);
  setupDragAndDrop(workspace, executeCode);

  setupInput();

  loadWorkspace(workspace, executeCode);
  updateSaveButtonState();
};
