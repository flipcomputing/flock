import { translate } from '../main/translation.js';
import { logViewport } from '../main/viewportDebug.js';

// Narrow landscape layouts (phones and small tablets alike) set
// #info-panel-body to display:none in CSS, so there's no docked area to
// measure — modal is the only option there. Portrait layouts keep a real,
// measurable docked body at every width, so they're left to isDockedAreaTooShort()
// instead of being forced modal by width alone.
const isNarrowLayout = () =>
  window.matchMedia('(max-width: 1024px) and (orientation: landscape)').matches;

// Measured: ~65px chrome plus ~40px per em per row; below 1 row the modal reads better than a docked scroll.
const MIN_DOCKED_ROWS = 1;
const PANEL_CHROME_HEIGHT = 65;
const ROW_HEIGHT_PER_EM = 40;

// offsetHeight is 0 both when too short and when unmeasurable (hidden/jsdom); isNarrowLayout() already handles the hidden case.
const isDockedAreaTooShort = (fontSize) => {
  const height = document.getElementById('info-panel-body')?.offsetHeight ?? 0;
  const needed = PANEL_CHROME_HEIGHT + MIN_DOCKED_ROWS * ROW_HEIGHT_PER_EM * fontSize;
  return height > 0 && height < needed;
};

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
    // preventScroll: the panel is far taller than its scrollport, so a plain
    // focus() scrolls every scrollable ancestor to reveal it — including
    // #maincontent, dragging the canvas up out of view.
    tab.panel.focus({ preventScroll: true });
    requestAnimationFrame(() => logViewport(`tab:${id}`));
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
          active.focus({ preventScroll: true });
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

const EXTERNAL_LINK_ICON = `<svg class="external-link-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true"><path fill="currentColor" d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l82.7 0L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3l0 82.7c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160c0-17.7-14.3-32-32-32L320 0zM80 32C35.8 32 0 67.8 0 112L0 432c0 44.2 35.8 80 80 80l320 0c44.2 0 80-35.8 80-80l0-112c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 112c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-320c0-8.8 7.2-16 16-16l112 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 32z"/></svg>`;

// External links in the help content are marked up automatically, so the docs
// maintainer only ever has to write a plain <a href>. The icon sits inside the link
// so it picks up the link colour, visited state included, from currentColor.
function decorateExternalLinks(root) {
  root.querySelectorAll('a[href^="http"]').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.insertAdjacentHTML(
      'beforeend',
      `<span class="sr-only"> (${translate('link_opens_in_new_tab')})</span>${EXTERNAL_LINK_ICON}`
    );
  });
}

function focusWithVisibleRing(el) {
  if (!el) return;
  el.classList.add('force-focus-ring');
  el.addEventListener('blur', () => el.classList.remove('force-focus-ring'), { once: true });
  el.focus();
}

export { InfoPanel, ModalPanelBehaviour, decorateExternalLinks, focusWithVisibleRing };
