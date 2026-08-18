import * as Blockly from 'blockly';
import { KeyboardDispatcher } from '../main/keyboardDispatcher.js';
import { ContextManager } from '../main/context.js';
import { translate } from '../main/translation.js';
import { SHORTCUTS_HELP_URL } from '../config.js';
import { stopCanvasKeyboardMode } from '../ui/canvas-utils.js';
import { focusToolboxRestoringCategory } from '../main/toolboxfocus.js';

// Must match the CSS breakpoint in style.css that hides the docked info panel.
const isNarrowLayout = () =>
  window.matchMedia('(max-width: 1024px) and (orientation: landscape)').matches;

// Measured: ~65px chrome plus ~40px per em per row; below 2 rows the modal reads better than a docked scroll.
const MIN_DOCKED_ROWS = 2;
const PANEL_CHROME_HEIGHT = 65;
const ROW_HEIGHT_PER_EM = 40;

// offsetHeight is 0 both when too short and when unmeasurable (hidden/jsdom); isNarrowLayout() already handles the hidden case.
const isDockedAreaTooShort = (fontSize) => {
  const height = document.getElementById('info-panel-body')?.offsetHeight ?? 0;
  const needed = PANEL_CHROME_HEIGHT + MIN_DOCKED_ROWS * ROW_HEIGHT_PER_EM * fontSize;
  return height > 0 && height < needed;
};

// Area menu accessed with Ctrl + B to quickly skip to
// different areas on the interface

const AreaManager = {
  overlay: null,
  areas: [
    { selector: '#menuleft', label: '1', name: 'Top left menu' },
    { selector: '#menuright', label: '2', name: 'Top right menu' },
    { selector: '#renderCanvas', label: '3', name: 'Canvas' },
    { selector: '#gizmoButtons', label: '4', name: 'Gizmos' },
    {
      selector: '#info-panel-tabs',
      label: '5',
      name: 'Info panel tabs',
      focusSelector: '#info-tab-btn-shortcuts',
    },
    { selector: '#resizer', label: '6', pad: -3, name: 'Resizer' },
    { selector: '.blocklyToolbox', label: '7', name: 'Toolbox' },
    { selector: 'svg.blocklySvg', label: '8', name: 'Code editor' },
    {
      selector: '#blocklyZoomControls',
      label: '9',
      name: 'Workspace controls',
      extend: { top: -8 },
    },
  ],

  get effectiveAreas() {
    const reloadBtn = document.getElementById('reload-btn');
    const reloadConnected = reloadBtn?.isConnected;
    const infoPanelTabs = document.getElementById('info-panel-tabs');
    const infoPanelTabsHidden = !infoPanelTabs || infoPanelTabs.offsetWidth === 0;
    return this.areas.map((a) => {
      // #info-panel-tabs is a dead target whenever it's not actually on screen
      // (hidden by the landscape-narrow CSS, or display:none via canvasArea in
      // narrow Code view) — hand area 5 to the pill toggle instead.
      if (infoPanelTabsHidden && a.label === '5') {
        return {
          selector: '#viewToggle',
          label: '5',
          name: 'View switch',
          focusSelector: '#canvasToggleBtn',
        };
      }
      if (reloadConnected && a.label === '9') {
        return { selector: '#reload-btn', label: '9', name: 'Reload' };
      }
      return a;
    });
  },

  init() {
    this.createOverlay();
    this.setupListeners();
  },

  createOverlay() {
    // Create the element dynamically so you don't have to edit index.html
    const div = document.createElement('div');
    div.id = 'area-menu-overlay';
    div.classList.add('hidden');
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-label', 'Area navigation menu');
    div.tabIndex = -1;
    div.innerHTML = `<div id="area-menu-content"> </div>`;
    document.body.appendChild(div);
    this.overlay = div;
  },

  toggle(show) {
    if (this.overlay) {
      if (show) {
        stopCanvasKeyboardMode(); // Stop canvas keyboard cursor if active
        GizmoMenuManager.toggle(false); // Close gizmo menu if open
        this.renderHighlights();
        this._previousInertStates = new Map();
        document.querySelectorAll('body > *:not(#area-menu-overlay)').forEach((el) => {
          this._previousInertStates.set(el, el.inert);
          el.inert = true;
        });
        this.previousFocus = document.activeElement;
        setTimeout(() => this.overlay.focus(), 0);
      } else {
        this._previousInertStates?.forEach((wasInert, el) => (el.inert = wasInert));
        this._previousInertStates = null;
        this.previousFocus?.focus();
      }
      this.overlay.classList.toggle('hidden', !show);
    }
  },

  setupListeners() {
    KeyboardDispatcher.on('*', 'Mod+KeyB', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle(this.overlay.classList.contains('hidden'));
    });

    KeyboardDispatcher.on('OVERLAY', 'Escape', () => this.toggle(false));

    for (let i = 1; i <= 9; i++) {
      KeyboardDispatcher.on('OVERLAY', `Digit${i}`, (e) => {
        e.preventDefault();
        const area = this.effectiveAreas.find((a) => a.label === String(i));
        if (area) this.activateArea(area);
      });
    }

    const cycleBadges = (reverse) => {
      const badges = [...this.overlay.querySelectorAll('.area-number-badge')];
      if (badges.length === 0) return;
      const currentIndex = badges.indexOf(document.activeElement);
      const nextIndex = reverse
        ? currentIndex === -1
          ? badges.length - 1
          : (currentIndex - 1 + badges.length) % badges.length
        : (currentIndex + 1) % badges.length;
      badges[nextIndex].focus();
    };

    KeyboardDispatcher.on('OVERLAY', 'Tab', (e) => {
      e.preventDefault();
      cycleBadges(false);
    });
    KeyboardDispatcher.on('OVERLAY', 'Shift+Tab', (e) => {
      e.preventDefault();
      cycleBadges(true);
    });

    KeyboardDispatcher.on('OVERLAY', 'Enter', (e) => {
      const focused = document.activeElement;
      if (!focused?.classList.contains('area-number-badge')) return;
      e.preventDefault();
      const area = this.effectiveAreas.find((a) => a.label === focused.innerText);
      if (area) this.activateArea(area);
    });

    // Re-render if the browser window gets resized
    window.addEventListener('resize', () => {
      if (!this.overlay.classList.contains('hidden')) {
        requestAnimationFrame(() => this.renderHighlights());
      }
    });
  },

  // Set the focus to this area and close overlay
  activateArea(area) {
    this.toggle(false); // Close the menu
    if (area.selector === '.blocklyToolbox') {
      // Restores the remembered category; the generic child lookup below
      // would land on the toolbox search input and wipe that memory.
      focusToolboxRestoringCategory();
      return;
    }
    if (area.selector === 'svg.blocklySvg') {
      // Focus the workspace through the FocusManager, not the generic child
      // lookup below (which can grab the trashcan or zoom controls). setIsActive
      // gates the focus highlight and Blockly's nav shortcuts.
      const workspace = Blockly.getMainWorkspace?.();
      if (workspace) {
        Blockly.keyboardNavigationController?.setIsActive?.(true);
        Blockly.getFocusManager?.()?.focusTree?.(workspace);
        return;
      }
      const surface = document.querySelector('svg.blocklySvg g.blocklyWorkspace');
      if (surface) {
        surface.focus();
        return;
      }
    }
    const el = document.querySelector(area.selector);
    const childFocusable =
      el?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) ?? el;
    const focusable =
      (area.focusSelector ? document.querySelector(area.focusSelector) : null) ?? childFocusable;

    focusable?.focus();
    if (area.selector === '#gizmoButtons') GizmoMenuManager.toggle(true);
  },

  renderHighlights() {
    const container = document.getElementById('area-menu-content');
    container.innerHTML = ''; // Clear old numbers

    this.effectiveAreas.forEach((area) => {
      const el = document.querySelector(area.selector);
      if (el && (el.offsetWidth > 0 || el.getBoundingClientRect().width > 0)) {
        const rect = el.getBoundingClientRect();

        const badge = document.createElement('div');
        badge.className = 'area-number-badge';
        badge.setAttribute('role', 'button');
        badge.setAttribute('aria-label', `${area.label}: ${area.name}`);
        badge.tabIndex = 0; // Make badges focusable
        badge.innerText = area.label;

        // Position the badge in the center of the area
        badge.style.top = `${rect.top + rect.height / 2 - 20}px`;
        badge.style.left = `${rect.left + rect.width / 2 - 20}px`;

        container.appendChild(badge);

        const highlight = document.createElement('div');
        const pad = area.pad ?? 1;
        const ext = area.extend ?? {};
        const eTop = ext.top ?? 0;
        const eBottom = ext.bottom ?? 0;
        const eLeft = ext.left ?? 0;
        const eRight = ext.right ?? 0;
        highlight.className = 'area-outline';
        highlight.style.top = `${rect.top - pad - eTop}px`;
        highlight.style.left = `${rect.left - pad - eLeft}px`;
        highlight.style.width = `${rect.width + pad * 2 + eLeft + eRight}px`;
        highlight.style.height = `${rect.height + pad * 2 + eTop + eBottom}px`;
        container.appendChild(highlight);
      }
    });
  },
};

/* Overlay for gizmo buttons */
const GizmoMenuManager = {
  overlay: null,
  // Other menus (e.g. the add-shape dropdown) that should close themselves
  // when the gizmo overlay opens, so they don't sit on top of the gizmos.
  _closeHooks: [],
  buttons: [
    { id: 'showShapesButton', label: '1' },
    { id: 'colorPickerButton', label: '2' },
    { id: 'positionButton', label: '3' },
    { id: 'rotationButton', label: '4' },
    { id: 'scaleButton', label: '5' },
    { id: 'selectButton', label: '6' },
    { id: 'duplicateButton', label: '7' },
    { id: 'deleteButton', label: '8' },
    { id: 'cameraButton', label: '9' },
    { id: 'eyeButton', label: '0' },
  ],

  init() {
    this.createOverlay();
    this.setupListeners();
  },

  createOverlay() {
    const div = document.createElement('div');
    div.id = 'gizmo-menu-overlay';
    div.className = 'hidden';
    div.innerHTML = `<div id="gizmo-menu-content"></div>`;
    document.body.appendChild(div);
    this.overlay = div;
  },

  isOpen() {
    return !this.overlay.classList.contains('hidden');
  },

  registerCloseHook(fn) {
    this._closeHooks.push(fn);
  },

  toggle(show) {
    if (!this.overlay) return;
    if (show) {
      this._closeHooks.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error('GizmoMenuManager close hook failed:', e);
        }
      });
      this.renderBadges();

      if (this._watchFocus) {
        document.removeEventListener('focusin', this._watchFocus);
      }
      if (this._watchPointer) {
        document.removeEventListener('pointerdown', this._watchPointer, {
          capture: true,
        });
      }
      this._watchFocus = () => {
        const ctx = ContextManager.getCurrentContext();
        if (ctx !== 'GIZMO' && ctx !== 'NAVIGATION') this.toggle(false);
      };
      this._watchPointer = () => this.toggle(false);
      document.addEventListener('focusin', this._watchFocus);
      document.addEventListener('pointerdown', this._watchPointer, {
        capture: true,
      });

      // Focus 1st button if nothing in gizmos is already focused,
      // but if another gizmo is active, leave focus there
      const alreadyFocused = document.activeElement?.closest('#gizmoButtons');

      if (!alreadyFocused) {
        const btn =
          document.querySelector('.gizmo-button.active') ||
          document.getElementById('showShapesButton');
        if (btn && !btn.disabled && btn.offsetParent !== null) btn.focus();
      }
    } else {
      document.removeEventListener('focusin', this._watchFocus);
      document.removeEventListener('pointerdown', this._watchPointer, {
        capture: true,
      });
      this._watchFocus = null;
      this._watchPointer = null;
    }
    this.overlay.classList.toggle('hidden', !show);
  },

  setupListeners() {
    // Toggle gizmo menu with Ctrl + G
    KeyboardDispatcher.on('*', 'Mod+KeyG', (e) => {
      const ctx = ContextManager.getCurrentContext();
      if (ctx === 'TYPING' || ctx === 'OVERLAY') return;
      e.preventDefault();
      e.stopPropagation();
      this.toggle(true);
    });

    // Activate gizmo buttons with number keys
    for (let i = 0; i <= 9; i++) {
      KeyboardDispatcher.on('*', `Digit${i}`, () => {
        if (!this.isOpen()) return;
        const entry = this.buttons.find((b) => b.label === String(i));
        if (entry) this.activateButton(entry);
      });
    }

    // Move the gizmo buttons if the window is resized
    const gizmoButtons = document.getElementById('gizmoButtons');
    const resizer = document.getElementById('resizer');
    if (gizmoButtons) {
      new ResizeObserver(() => {
        if (this.isOpen()) this.renderBadges();
      }).observe(gizmoButtons);
    }
    if (resizer) {
      new MutationObserver(() => {
        if (!resizer.classList.contains('resizing') && this.isOpen()) {
          this.renderBadges();
        }
      }).observe(resizer, { attributes: true, attributeFilter: ['class'] });
    }
  },

  activateButton(entry) {
    const el = document.getElementById(entry.id);
    if (!el) return;
    el.focus();
    if (!el.disabled) el.click();
  },

  // Badges float into the gap .gizmo-status leaves below the buttons.
  renderBadges() {
    const container = document.getElementById('gizmo-menu-content');
    container.innerHTML = '';
    const visible = this.buttons
      .map((entry) => {
        const el = document.getElementById(entry.id);
        if (!el || el.offsetParent === null) return null;
        return { entry, rect: el.getBoundingClientRect() };
      })
      .filter(Boolean);
    // If badges span two rows, put top row badges on top
    const bottomRowTop = Math.max(...visible.map(({ rect }) => rect.top));
    visible.forEach(({ entry, rect }) => {
      const badge = document.createElement('div');
      badge.className = 'gizmo-key-badge';
      badge.innerText = entry.label;
      const isBottomRow = rect.top >= bottomRowTop - rect.height / 2;
      badge.style.top = isBottomRow ? `${rect.top + rect.height + 8}px` : `${rect.top - 8}px`;
      badge.style.left = `${rect.left + rect.width / 2}px`;
      container.appendChild(badge);
    });
  },
};

// Modal showing all keyboard shortcuts, accessed with Ctrl + /

// Check their platform (Mac or not Mac) to show the correct modifier key
function isMac() {
  return (navigator.userAgentData?.platform ?? navigator.platform).toUpperCase().includes('MAC');
}

// List of shortcuts to show in the panel, with categories for grouping
function getShortcuts() {
  const mod = isMac() ? '⌘' : 'Ctrl';
  const pgUpDn = isMac() ? 'Fn + ↑ ↓' : 'PgUp PgDn';
  return [
    {
      label: translate('shortcut_show_hide_help'),
      keys: `${mod} + /`,
      category: translate('shortcut_category_main'),
    },
    {
      label: translate('shortcut_move_between_areas'),
      keys: `Tab / Shift + Tab`,
      category: translate('shortcut_category_main'),
    },
    {
      label: translate('shortcut_confirm'),
      keys: `Enter`,
      category: translate('shortcut_category_main'),
    },
    {
      label: translate('shortcut_exit'),
      keys: `Esc`,
      category: translate('shortcut_category_main'),
    },
    {
      label: translate('shortcut_play'),
      keys: `${mod} + P`,
      category: translate('shortcut_category_main'),
    },
    {
      label: translate('shortcut_undo'),
      keys: `${mod} + Z`,
      category: translate('shortcut_category_main'),
    },
    {
      label: translate('shortcut_redo'),
      keys: `${mod} + Shift + Z`,
      category: translate('shortcut_category_main'),
    },
    {
      label: translate('shortcut_browser_nav'),
      keys: `${mod} + L`,
      category: translate('shortcut_category_main'),
    },

    {
      label: translate('shortcut_main_menu'),
      keys: `${mod} + M`,
      category: translate('shortcut_category_menu'),
    },
    {
      label: translate('shortcut_open_file'),
      keys: `${mod} + O`,
      category: translate('shortcut_category_menu'),
    },
    {
      label: translate('shortcut_save_export'),
      keys: `${mod} + S`,
      category: translate('shortcut_category_menu'),
    },

    {
      label: translate('shortcut_open_close_area_menu'),
      keys: `${mod} + B`,
      category: translate('shortcut_category_area_menu'),
    },
    {
      label: translate('shortcut_toggle_area'),
      keys: `Tab`,
      category: translate('shortcut_category_area_menu'),
    },
    {
      label: translate('shortcut_select_area'),
      keys: `1-9 / Enter`,
      category: translate('shortcut_category_area_menu'),
    },

    {
      label: translate('shortcut_toolbox'),
      keys: `T`,
      category: translate('shortcut_category_toolbox'),
    },
    {
      label: translate('shortcut_toolbox_typing'),
      keys: `"${translate('shortcut_toolbox_typing_hint')}"`,
      category: translate('shortcut_category_toolbox'),
    },
    {
      label: translate('shortcut_nav_toolbox_blocks'),
      keys: `↑ ↓ ← →`,
      category: translate('shortcut_category_toolbox'),
    },
    {
      label: translate('shortcut_add_block'),
      keys: `Enter`,
      category: translate('shortcut_category_toolbox'),
    },

    {
      label: translate('shortcut_code_editor'),
      keys: `${mod} + E`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_select_workspace'),
      keys: `W`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_move_through_blocks'),
      keys: `↑ ↓`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_move_in_out_blocks'),
      keys: `← →`,
      category: translate('shortcut_category_editor'),
    },

    {
      label: translate('shortcut_next_block_stack'),
      keys: `N`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_prev_block_stack'),
      keys: `B`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_add_block_by_name'),
      keys: `${mod} + ]`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_context_menu'),
      keys: `${mod} + Enter`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_toggle_block_toolbar'),
      keys: `H`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_duplicate_block'),
      keys: `D`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_detach_block'),
      keys: `X`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_comment_block'),
      keys: `K`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_delete_comment'),
      keys: `Shift + K`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_enable_disable_block'),
      keys: `L`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_start_move_block'),
      keys: `M`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_move_arrows'),
      keys: `↑ ↓`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_move_anywhere'),
      keys: `${mod} + ↑ ↓ ← →`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_search_block'),
      keys: `${mod} + F`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_select_next_result'),
      keys: `Enter`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_select_previous_result'),
      keys: `Shift + Enter`,
      category: translate('shortcut_category_editor'),
    },
    {
      label: translate('shortcut_focus_result'),
      keys: `Esc`,
      category: translate('shortcut_category_editor'),
    },

    {
      label: translate('shortcut_open_gizmos'),
      keys: `${mod} + G`,
      category: translate('shortcut_category_gizmos'),
    },
    {
      label: translate('shortcut_select_gizmo'),
      keys: `0-9`,
      category: translate('shortcut_category_gizmos'),
    },
    {
      label: translate('shortcut_keyboard_cursor_gizmos'),
      keys: `↑ ↓ ← →`,
      category: translate('shortcut_category_gizmos'),
    },
    {
      label: translate('shortcut_slow_cursor_gizmos'),
      keys: `Shift + ↑ ↓ ← →`,
      category: translate('shortcut_category_gizmos'),
    },
    {
      label: translate('shortcut_lock_transform'),
      keys: `X Y Z`,
      category: translate('shortcut_category_gizmos'),
    },
    {
      label: translate('shortcut_uniform_scale'),
      keys: `U`,
      category: translate('shortcut_category_gizmos'),
    },
    {
      label: translate('shortcut_transform_3d'),
      keys: `↑ ↓ ← → ${pgUpDn}`,
      category: translate('shortcut_category_gizmos'),
    },
    {
      label: translate('shortcut_focus_camera'),
      keys: `F`,
      category: translate('shortcut_category_gizmos'),
    },
    {
      label: translate('shortcut_toggle_hud'),
      keys: `O`,
      category: translate('shortcut_category_gizmos'),
    },
    {
      label: translate('shortcut_quick_colour'),
      keys: `C`,
      category: translate('shortcut_category_gizmos'),
    },
    {
      label: translate('shortcut_delete_object'),
      keys: `Del`,
      category: translate('shortcut_category_gizmos'),
    },
  ];
}

// Formats keys for menu nicely
// You can use + or / and these won't be <kbd> tagged
function formatKeys(keys) {
  if (keys.startsWith('"') && keys.endsWith('"')) {
    return keys.slice(1, -1);
  }
  return keys
    .split(/( \+ | \/ )/)
    .map((part) =>
      part === ' + '
        ? part
        : part === ' / '
          ? `<span aria-label="or"> / </span>`
          : part
              .split(' ')
              .map((k) => `<kbd>${k}</kbd>`)
              .join(' ')
    )
    .join('');
}

const InfoPanel = {
  _tabs: new Map(),
  _activeId: null,

  init() {
    this._el = document.getElementById('info-panel');
    this._tablist = document.getElementById('info-panel-tablist');
    this._body = document.getElementById('info-panel-body');
  },

  // owner.toggle(), not activate()/deactivate(), so the tab gets the same docked/modal logic as every other entry point.
  register(id, label, owner) {
    const btn = document.createElement('button');
    btn.id = `info-tab-btn-${id}`;
    btn.className = 'info-tab-btn bigbutton';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.setAttribute('aria-controls', `info-tab-panel-${id}`);
    btn.textContent = label;
    btn.addEventListener('click', () => (owner ? owner.toggle() : this.toggle(id)));
    this._tablist.appendChild(btn);
    const divider = document.createElement('div');
    divider.className = 'toolbar-divider';
    divider.setAttribute('aria-hidden', 'true');
    this._tablist.appendChild(divider);

    const panel = document.createElement('div');
    panel.id = `info-tab-panel-${id}`;
    panel.className = 'info-tab-panel hidden';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `info-tab-btn-${id}`);
    panel.tabIndex = 0;
    this._body.appendChild(panel);

    this._tabs.set(id, { btn, panel });
    return panel;
  },

  activate(id) {
    if (this._activeId && this._activeId !== id) {
      const cur = this._tabs.get(this._activeId);
      cur.btn.setAttribute('aria-selected', 'false');
      cur.btn.classList.remove('active');
      cur.panel.classList.add('hidden');
    }
    const tab = this._tabs.get(id);
    if (!tab) return;
    this._activeId = id;
    tab.btn.setAttribute('aria-selected', 'true');
    tab.btn.classList.add('active');
    tab.panel.classList.remove('hidden');
    // All tab panels share this scroll container, so switching tabs must
    // reset it or the new tab opens pre-scrolled to the old tab's position.
    this._body.scrollTop = 0;
    tab.panel.focus();
  },

  deactivate(id) {
    const tab = this._tabs.get(id);
    if (!tab) return;
    tab.btn.setAttribute('aria-selected', 'false');
    tab.btn.classList.remove('active');
    tab.panel.classList.add('hidden');
    if (this._activeId === id) this._activeId = null;
  },

  toggle(id) {
    const tab = this._tabs.get(id);
    if (!tab) return;
    tab.panel.classList.contains('hidden') ? this.activate(id) : this.deactivate(id);
  },
};

const SHORTCUTS_FONT_SIZES = [0.8, 1.0, 1.2, 1.4, 1.6, 1.8];
const SHORTCUTS_FONT_SIZE_KEY = 'flock-shortcuts-font-size';
const SHORTCUTS_FONT_SIZE_DEFAULT = 1.2;

// Every panel that has text-size controls, so one panel's A- / A+ resizes them all.
const FONT_SIZED_PANELS = new Set();

// Modal presentation and text-size controls shared by info-panel tabs; mixers
// must set _modalTitleId, _tabBtnId, _closeLabelKey, _listId.
const ModalPanelBehaviour = {
  // Spread into each panel, so every panel starts at the shared stored size.
  fontSize:
    parseFloat(localStorage.getItem(SHORTCUTS_FONT_SIZE_KEY)) || SHORTCUTS_FONT_SIZE_DEFAULT,

  shouldBeModal() {
    return isNarrowLayout() || isDockedAreaTooShort(this.fontSize);
  },

  fontControlsHTML() {
    return `
            <button class="bigbutton font-decrease-btn" aria-label="${translate('player_decrease_font_size')}" title="${translate('player_decrease_font_size')}"><span aria-hidden="true">A</span></button>
            <button class="bigbutton font-increase-btn" aria-label="${translate('player_increase_font_size')}" title="${translate('player_increase_font_size')}"><span aria-hidden="true">A</span></button>`;
  },

  initFontControls() {
    this.panel
      .querySelector('.font-decrease-btn')
      .addEventListener('click', () => this.adjustFontSize(-1));
    this.panel
      .querySelector('.font-increase-btn')
      .addEventListener('click', () => this.adjustFontSize(1));
    FONT_SIZED_PANELS.add(this);
    this.applyFontSize();
  },

  // Both the list text and the panel title scale off this one property, so the
  // h2 title stays larger than the h3 categories inside the list at every size.
  applyFontSize() {
    const sizes = SHORTCUTS_FONT_SIZES;
    this.panel.style.setProperty('--panel-font-size', this.fontSize + 'em');
    this.panel.querySelector('.font-decrease-btn').disabled = this.fontSize === sizes[0];
    this.panel.querySelector('.font-increase-btn').disabled =
      this.fontSize === sizes[sizes.length - 1];
  },

  // Text size is one shared setting, so resizing here resizes every other panel too.
  adjustFontSize(delta) {
    const sizes = SHORTCUTS_FONT_SIZES;
    const idx = sizes.indexOf(this.fontSize);
    const next = sizes[Math.max(0, Math.min(sizes.length - 1, idx + delta))];
    if (next === this.fontSize) return;
    localStorage.setItem(SHORTCUTS_FONT_SIZE_KEY, next);
    FONT_SIZED_PANELS.forEach((p) => {
      p.fontSize = next;
      p.applyFontSize();
    });
  },

  // Resize listener catches the media-query flip; ResizeObserver catches docked-area size changes without a window resize (e.g. play mode).
  watchDockedSpace() {
    const reevaluate = () => {
      if (this.panel.classList.contains('hidden')) return;
      if (this.shouldBeModal()) this.enterModal();
      else if (this._modalActive) {
        // exitModal() reparents the panel, which blurs whatever was focused even if that element survives the move; refocus it in place rather than jumping to previousFocus, which is only for the removed close button.
        const active = document.activeElement;
        const activeSurvives = this.panel.contains(active) && active !== this._closeBtn;
        this.exitModal();
        if (activeSurvives) {
          active.focus();
        } else {
          this.previousFocus?.focus();
          this.previousFocus = null;
        }
      }
    };

    window.addEventListener('resize', reevaluate);

    const dockedArea = document.getElementById('info-panel-body');
    if (dockedArea && typeof ResizeObserver !== 'undefined') {
      // rAF-deferred: mutating the DOM inside the callback (enterModal reparents) trips "ResizeObserver loop completed with undelivered notifications".
      new ResizeObserver(() => requestAnimationFrame(reevaluate)).observe(dockedArea);
    }
  },

  // Reparent the panel to <body>, mark it a dialog, inert the rest of the page
  // and trap focus. Reparenting is required so it escapes the info panel (which
  // is display:none in narrow mode) and the canvas area's overflow clipping.
  enterModal() {
    if (this._modalActive) return;
    this._modalActive = true;
    const panel = this.panel;

    const backdrop = document.createElement('div');
    backdrop.className = 'shortcuts-modal-backdrop';
    backdrop.addEventListener('pointerdown', () => this.hide());
    document.body.appendChild(backdrop);
    this._backdrop = backdrop;

    // Remember the docked location so we can put it back on close.
    this._panelHome = panel.parentNode;
    this._panelNextSibling = panel.nextSibling;
    document.body.appendChild(panel);

    panel.classList.add('shortcuts-modal');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', this._modalTitleId);

    // Visible close control — there's no tab to click shut in modal mode, and
    // Escape/backdrop aren't discoverable (and Escape isn't available on touch).
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'bigbutton shortcuts-modal-close';
    closeBtn.setAttribute('aria-label', translate(this._closeLabelKey));
    closeBtn.setAttribute('title', translate(this._closeLabelKey));
    closeBtn.innerHTML = '<span aria-hidden="true">X</span>';
    closeBtn.addEventListener('click', () => this.hide());
    panel.querySelector('.shortcuts-panel-controls')?.appendChild(closeBtn);
    this._closeBtn = closeBtn;

    // Make everything else inert so SR/keyboard focus can't leave the dialog.
    this._inertStates = new Map();
    document.querySelectorAll('body > *').forEach((el) => {
      if (el === panel || el === backdrop) return;
      this._inertStates.set(el, el.inert);
      el.inert = true;
    });

    this._trapHandler = (e) => this.trapFocus(e);
    panel.addEventListener('keydown', this._trapHandler);

    requestAnimationFrame(() => panel.focus());
  },

  exitModal() {
    if (!this._modalActive) return;
    this._modalActive = false;
    const panel = this.panel;

    panel.removeEventListener('keydown', this._trapHandler);
    this._trapHandler = null;

    this._inertStates?.forEach((wasInert, el) => (el.inert = wasInert));
    this._inertStates = null;

    panel.classList.remove('shortcuts-modal');
    panel.setAttribute('role', 'tabpanel');
    panel.removeAttribute('aria-modal');
    panel.setAttribute('aria-labelledby', this._tabBtnId);

    this._closeBtn?.remove();
    this._closeBtn = null;

    // Dock the panel back where it came from.
    if (this._panelHome) {
      this._panelHome.insertBefore(panel, this._panelNextSibling);
      this._panelHome = null;
      this._panelNextSibling = null;
    }

    this._backdrop?.remove();
    this._backdrop = null;
  },

  focusableElements() {
    return [
      ...this.panel.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0);
  },

  trapFocus(e) {
    if (e.key !== 'Tab') return;
    // Keep the app-level Tab manager (input.js) out of the dialog.
    e.stopPropagation();
    const focusables = this.focusableElements();
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (!first) {
      e.preventDefault();
      this.panel.focus();
      return;
    }
    if (e.shiftKey && (active === first || active === this.panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  },
};

// First info panel tab; registered before the others so it renders leftmost.
const HelpPanel = {
  ...ModalPanelBehaviour,
  panel: null,
  previousFocus: null,
  _modalTitleId: 'help-panel-title',
  _tabBtnId: 'info-tab-btn-help',
  _closeLabelKey: 'close',
  _listId: '#help-list',

  init() {
    this.createPanel();
    this.setupListeners();
    this.watchDockedSpace();
    window.flockHelpPanel = this;
  },

  createPanel() {
    const panel = InfoPanel.register('help', translate('help_panel_title'), this);
    const btn = document.getElementById('info-tab-btn-help');
    btn.innerHTML = `<div class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3l58.3 0c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24l0-13.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1l-58.3 0c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg></div>`;
    panel.innerHTML = `
        <div class="shortcuts-panel-header">
          <h2 id="help-panel-title" class="shortcuts-panel-title"></h2>
          <div class="shortcuts-panel-controls">${this.fontControlsHTML()}
          </div>
        </div>
        <div id="help-list"></div>
      `;
    this.panel = panel;
    this.initFontControls();
    this.renderContent();
  },

  renderContent() {
    const title = translate('help_panel_title');
    const btn = document.getElementById('info-tab-btn-help');
    btn.setAttribute('aria-label', title);
    btn.setAttribute('title', title);
    this.panel.querySelector('#help-panel-title').textContent = title;
  },

  show() {
    this.renderContent();
    this.previousFocus = document.activeElement;
    InfoPanel.activate('help');
    if (this.shouldBeModal()) this.enterModal();
  },

  refreshTranslations() {
    this.renderContent();
  },

  hide() {
    this.exitModal();
    this.previousFocus?.focus();
    this.previousFocus = null;
    InfoPanel.deactivate('help');
  },

  toggle() {
    this.panel.classList.contains('hidden') ? this.show() : this.hide();
  },

  setupListeners() {
    this.panel.addEventListener('keydown', (e) => {
      // Modal mode reparents the panel to <body> and makes it the scroll
      // container itself; #info-panel-body only scrolls in docked mode.
      const scroller = this._modalActive ? this.panel : document.getElementById('info-panel-body');
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        scroller?.scrollBy({ top: -100, behavior: 'instant' });
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scroller?.scrollBy({ top: 100, behavior: 'instant' });
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        const tabBtn = document.getElementById('info-tab-btn-help');
        if (tabBtn?.offsetParent) tabBtn.focus();
      }
    });
  },
};

const ShortcutsPanel = {
  ...ModalPanelBehaviour,
  panel: null,
  previousFocus: null,
  _modalTitleId: 'shortcuts-panel-title',
  _tabBtnId: 'info-tab-btn-shortcuts',
  _closeLabelKey: 'shortcut_panel_close',
  _listId: '#shortcuts-list',

  init() {
    this.createPanel();
    this.setupListeners();
    this.watchDockedSpace();
    window.flockShortcutsPanel = this;
  },

  createPanel() {
    const panel = InfoPanel.register('shortcuts', translate('shortcut_panel_title'), this);
    const btn = document.getElementById('info-tab-btn-shortcuts');
    btn.setAttribute('aria-label', translate('shortcut_panel_title'));
    btn.setAttribute('title', translate('shortcut_panel_title'));
    btn.innerHTML = `<div class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M64 64C28.7 64 0 92.7 0 128L0 384c0 35.3 28.7 64 64 64l448 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64L64 64zm16 64l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16zM64 240c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32zm16 80l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16zm80-176c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32zm16 80l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16zM160 336c0-8.8 7.2-16 16-16l224 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-224 0c-8.8 0-16-7.2-16-16l0-32zM272 128l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16zM256 240c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32zM368 128l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16zM352 240c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32zM464 128l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16zM448 240c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32zm16 80l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16z"/></svg></div>`;
    panel.innerHTML = `
        <div class="shortcuts-panel-header">
          <h2 id="shortcuts-panel-title" class="shortcuts-panel-title"></h2>
          <div class="shortcuts-panel-controls">${this.fontControlsHTML()}
            <a href="${SHORTCUTS_HELP_URL}" target="_blank" rel="noopener noreferrer" class="help-link-button" aria-label="${translate('shortcut_panel_help_link')}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" aria-hidden="true"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path fill="currentColor" d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l82.7 0L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3l0 82.7c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160c0-17.7-14.3-32-32-32L320 0zM80 32C35.8 32 0 67.8 0 112L0 432c0 44.2 35.8 80 80 80l320 0c44.2 0 80-35.8 80-80l0-112c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 112c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-320c0-8.8 7.2-16 16-16l112 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 32z"/></svg></a>
          </div>
        </div>
        <div id="shortcuts-list"></div>
      `;
    this.panel = panel;
    this.initFontControls();
    this.renderContent();
  },

  renderContent() {
    document
      .getElementById('info-tab-btn-shortcuts')
      .setAttribute('aria-label', translate('shortcut_panel_title'));
    this.panel.querySelector('#shortcuts-panel-title').textContent =
      translate('shortcut_panel_title');
    this.panel
      .querySelector('.help-link-button')
      .setAttribute('aria-label', translate('shortcut_panel_help_link'));
    const container = this.panel.querySelector('#shortcuts-list');
    const groups = getShortcuts().reduce((acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    }, {});
    container.innerHTML = Object.entries(groups)
      .map(
        ([cat, items]) => `
      <h3 class="shortcuts-category">${cat}</h3>
      <dl class="shortcuts-group">
        ${items.map(({ label, keys }) => `<div class="shortcuts-entry"><dt>${label}</dt><dd>${formatKeys(keys)}</dd></div>`).join('')}
      </dl>
    `
      )
      .join('');
  },

  show() {
    this.renderContent();
    this.previousFocus = document.activeElement;
    InfoPanel.activate('shortcuts');
    document.getElementById('shortcutsBtn')?.classList.add('active');
    if (this.shouldBeModal()) this.enterModal();
  },

  refreshTranslations() {
    this.renderContent();
  },

  hide() {
    this.exitModal();
    this.previousFocus?.focus();
    this.previousFocus = null;
    InfoPanel.deactivate('shortcuts');
    document.getElementById('shortcutsBtn')?.classList.remove('active');
  },

  toggle() {
    this.panel.classList.contains('hidden') ? this.show() : this.hide();
  },

  setupListeners() {
    this.panel.addEventListener('keydown', (e) => {
      // Modal mode reparents the panel to <body> and makes it the scroll
      // container itself; #info-panel-body only scrolls in docked mode.
      const scroller = this._modalActive ? this.panel : document.getElementById('info-panel-body');
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        scroller?.scrollBy({ top: -100, behavior: 'instant' });
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scroller?.scrollBy({ top: 100, behavior: 'instant' });
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        // In narrow mode the tab button is hidden, so hide()'s previous-focus
        // restore is what returns focus; only grab the tab button when visible.
        const tabBtn = document.getElementById('info-tab-btn-shortcuts');
        if (tabBtn?.offsetParent) tabBtn.focus();
      }
    });
  },
};

const CONTROL_MARKS = {
  up: '<path d="M12 5 20 18 4 18Z"/>',
  down: '<path d="M12 19 4 6 20 6Z"/>',
  left: '<path d="M5 12 18 4 18 20Z"/>',
  right: '<path d="M19 12 6 20 6 4Z"/>',
  triangle: '<path d="M12 4 21 19 3 19Z"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="1"/>',
  cross: '<path d="M5 5 19 19M19 5 5 19"/>',
  stick: '<circle cx="12" cy="8.5" r="4.5"/><path d="M12 13v4M7 20h10"/>',
};

const svgMark = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${CONTROL_MARKS[name]}</svg>`;

const svgRingedChar = (char) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><text x="12" y="12" text-anchor="middle" dominant-baseline="central" font-size="13" fill="currentColor" stroke="none">${char}</text></svg>`;

function getPlayerControls() {
  return [
    {
      section: 'player_section_onscreen',
      entries: [
        {
          action: 'player_action_move',
          marks: ['up', 'left', 'down', 'right'].map(svgMark),
          layout: 'dpad',
          label: translate('player_control_arrows'),
        },
        {
          action: 'player_action_camera_up',
          marks: [svgRingedChar(1)],
          keys: 'R',
          label: translate('player_control_button').replace('%1', 1),
        },
        {
          action: 'player_action_interact',
          marks: [svgRingedChar(2)],
          keys: 'E',
          label: translate('player_control_button').replace('%1', 2),
        },
        {
          action: 'player_action_camera_down',
          marks: [svgRingedChar(3)],
          keys: 'F',
          label: translate('player_control_button').replace('%1', 3),
        },
        {
          action: 'player_action_spare',
          marks: [svgRingedChar(4)],
          keys: 'Space',
          label: translate('player_control_button').replace('%1', 4),
        },
      ],
    },
    {
      section: 'player_section_gamepad',
      entries: [
        {
          action: 'player_action_move',
          keys: `"${translate('gamepad_left_stick')}"`,
        },
        {
          action: 'player_action_look',
          keys: `"${translate('gamepad_right_stick')}"`,
        },
        {
          action: 'player_action_turn',
          keys: translate('gamepad_l1_r1'),
        },
        {
          action: 'player_action_camera_up',
          keys: translate('gamepad_triangle_y'),
        },
        {
          action: 'player_action_camera_down',
          keys: translate('gamepad_square_x'),
        },
        {
          action: 'player_action_interact',
          keys: translate('gamepad_circle_b'),
        },
        {
          action: 'player_action_spare',
          keys: translate('gamepad_cross_a'),
        },
      ],
    },
    {
      section: 'player_section_sr',
      entries: [
        {
          action: 'player_control_dpad_up',
          keys: translate('dpad_up'),
        },
        {
          action: 'player_control_dpad_down',
          keys: translate('dpad_down'),
        },
        {
          action: 'player_control_dpad_left',
          keys: translate('dpad_left'),
        },
      ],
    },
  ];
}

// On-screen and gamepad counterpart to ShortcutsPanel: a second info panel tab.
const PlayerPanel = {
  ...ModalPanelBehaviour,
  panel: null,
  previousFocus: null,
  _modalTitleId: 'player-panel-title',
  _tabBtnId: 'info-tab-btn-player',
  _closeLabelKey: 'close',
  _listId: '#player-list',

  init() {
    this.createPanel();
    this.setupListeners();
    this.watchDockedSpace();
    window.flockPlayerPanel = this;
  },

  createPanel() {
    const panel = InfoPanel.register('player', translate('player_panel_title'), this);
    const btn = document.getElementById('info-tab-btn-player');
    btn.innerHTML = `<div class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" fill-rule="evenodd" d="M60,144H516A36,36 0 0 1 552,180V332A36,36 0 0 1 516,368H60A36,36 0 0 1 24,332V180A36,36 0 0 1 60,144ZM134,180h52v50h50v52h-50v50h-52v-50h-50v-52h50ZM364,224a40,40 0 1 0 80,0a40,40 0 1 0 -80,0ZM428,296a40,40 0 1 0 80,0a40,40 0 1 0 -80,0Z"/></svg></div>`;
    panel.innerHTML = `
        <div class="shortcuts-panel-header">
          <h2 id="player-panel-title" class="shortcuts-panel-title"></h2>
          <div class="shortcuts-panel-controls">${this.fontControlsHTML()}
          </div>
        </div>
        <div id="player-list"></div>
      `;
    this.panel = panel;
    this.initFontControls();
    this.renderContent();
  },

  renderContent() {
    const title = translate('player_panel_title');
    const btn = document.getElementById('info-tab-btn-player');
    btn.setAttribute('aria-label', title);
    btn.setAttribute('title', title);
    this.panel.querySelector('#player-panel-title').textContent = title;

    const renderControl = (entry) => {
      if (entry.marks) {
        const keys = entry.keys ? `<span class="pc-sep"> / </span>${formatKeys(entry.keys)}` : '';
        const srText = entry.keys ? `${entry.label} ${formatKeys(entry.keys)}` : entry.label;
        return `<span class="pc-keys${entry.layout ? ` pc-keys--${entry.layout}` : ''}" aria-hidden="true">${entry.marks
          .map((m) => `<span class="pc-chip">${m}</span>`)
          .join('')}${keys}</span><span class="sr-only">${srText}</span>`;
      }
      return formatKeys(entry.keys);
    };

    const sections = getPlayerControls()
      .map(
        ({ section, entries, hideHeader }) => `
      ${hideHeader ? '' : `<h3 class="shortcuts-category">${translate(section)}</h3>`}
      <dl class="shortcuts-group">
        ${entries
          .map(
            (entry) => `
        <div class="shortcuts-entry">
          <dt>${translate(entry.action)}</dt>
          <dd>${renderControl(entry)}</dd>
        </div>`
          )
          .join('')}
      </dl>`
      )
      .join('');

    this.panel.querySelector('#player-list').innerHTML = `
        ${sections}
        <p class="player-controls-note">${translate('player_control_dpad_note')}</p>
      `;
  },

  show() {
    this.renderContent();
    this.previousFocus = document.activeElement;
    InfoPanel.activate('player');
    if (this.shouldBeModal()) this.enterModal();
  },

  refreshTranslations() {
    this.renderContent();
  },

  hide() {
    this.exitModal();
    this.previousFocus?.focus();
    this.previousFocus = null;
    InfoPanel.deactivate('player');
  },

  toggle() {
    this.panel.classList.contains('hidden') ? this.show() : this.hide();
  },

  setupListeners() {
    this.panel.addEventListener('keydown', (e) => {
      // Modal mode reparents the panel to <body> and makes it the scroll
      // container itself; #info-panel-body only scrolls in docked mode.
      const scroller = this._modalActive ? this.panel : document.getElementById('info-panel-body');
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        scroller?.scrollBy({ top: -100, behavior: 'instant' });
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scroller?.scrollBy({ top: 100, behavior: 'instant' });
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        const tabBtn = document.getElementById('info-tab-btn-player');
        if (tabBtn?.offsetParent) tabBtn.focus();
      }
    });
  },
};

// Start it up
AreaManager.init();
GizmoMenuManager.init();
if (document.getElementById('info-panel-tabs')) {
  InfoPanel.init();
  HelpPanel.init();
  ShortcutsPanel.init();
  PlayerPanel.init();
}

export { InfoPanel, HelpPanel, ShortcutsPanel, PlayerPanel, GizmoMenuManager, AreaManager };
