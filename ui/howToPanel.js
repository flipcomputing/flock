import * as Blockly from 'blockly';
import { translate, getCurrentLanguage } from '../main/translation.js';
import { generateSVG } from '../main/export.js';
import { options as blocklyOptions } from '../blocks/blocks.js';
import {
  InfoPanel,
  ModalPanelBehaviour,
  decorateExternalLinks,
} from '../accessibility/infoPanel.js';

// Draws attention to a UI element with a steady yellow glow, without moving
// keyboard focus there — a how-to reader is usually mid-way through reading
// this panel, and yanking focus out to some other part of the page (as a
// real .focus() + focus ring would) is disorienting rather than helpful.
// Never flashes/pulses (a real seizure risk, not just a style choice).
// Disappears either when a different how-to link moves it elsewhere, or as
// soon as the reader actually uses the glowing element (clicks/taps/drags
// it, or tabs to it and activates it by keyboard) — its job is done at that
// point.
let attentionEl = null;
function drawAttention(el) {
  if (!el) return;
  attentionEl?.classList.remove('howto-attention');
  attentionEl = el;
  el.classList.remove('howto-attention');
  void el.getBoundingClientRect(); // reflow, so re-adding restarts the appear animation
  el.classList.add('howto-attention');
  const clear = () => {
    el.classList.remove('howto-attention');
    if (attentionEl === el) attentionEl = null;
    el.removeEventListener('pointerdown', clear);
    el.removeEventListener('click', clear);
    el.removeEventListener('focus', clear);
  };
  // pointerdown catches drag-start (e.g. the resizer, which never fires a
  // native click since the pointer moves between down and up); click catches
  // taps, non-drag clicks and keyboard Enter/Space activation on a button or
  // checkbox; focus catches simply tabbing to it, since it's never given
  // focus programmatically.
  el.addEventListener('pointerdown', clear, { once: true });
  el.addEventListener('click', clear, { once: true });
  el.addEventListener('focus', clear, { once: true });
}

// Cards, in display order. `i18nKey` maps to a `howto_<slug>_ui` locale
// entry; `tone` selects one of the --color-howto-N card background tokens.
const HOW_TOS = [
  { slug: 'set-the-scene', i18nKey: 'howto_set_the_scene_ui', tone: 1 },
  { slug: 'design-a-character', i18nKey: 'howto_design_a_character_ui', tone: 2 },
  { slug: 'add-objects', i18nKey: 'howto_add_objects_ui', tone: 3 },
  { slug: 'walk-around', i18nKey: 'howto_walk_around_ui', tone: 4 },
];

// How-to text lives in docs/how-tos/<lang>/<slug>.html — one locale folder
// per language, so it can be edited (and translated) without touching code;
// bundled at build time (?raw) rather than fetched, so it works offline in
// the PWA. English-only for now — any language without a folder falls back to
// en/, same as the Help panel falling back to en.html.
const HOWTO_CONTENT = import.meta.glob('../docs/how-tos/*/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const howToContentFor = (slug, lang) =>
  HOWTO_CONTENT[`../docs/how-tos/${lang}/${slug}.html`] ??
  HOWTO_CONTENT[`../docs/how-tos/en/${slug}.html`] ??
  '';

// <link-to target="…"> in how-to content becomes a button wired to one of
// these — the how-to equivalent of the two hand-wired ids in wireHelpLinks()
// (accessibility/keyboardui.js), reusing the same targets.
const HOWTO_LINK_TARGETS = {
  tools: () => {
    document.getElementById('tools-menu-item')?.click();
    setTimeout(() => drawAttention(document.getElementById('gizmoHintsCheckbox')), 0);
  },
  blockinfo: () => {
    drawAttention(document.getElementById('blockHintsBtn'));
  },
  resizer: () => {
    drawAttention(document.getElementById('resizer'));
  },
  // "Projects" and "New" guide the reader through the two-step real flow
  // rather than opening the modal for them: clicking "Projects" always
  // points at the Projects button; clicking "New" points at the New button
  // if the Projects modal happens to already be open, or falls back to the
  // Projects button otherwise, since New isn't reachable until then.
  newproject: () => {
    drawAttention(document.getElementById('exampleButton'));
  },
  newprojectbutton: () => {
    const modalOpen = !document.getElementById('exampleModal')?.classList.contains('hidden');
    drawAttention(document.getElementById(modalOpen ? 'newProjectButton' : 'exampleButton'));
  },
  // Points at the block toolbox's "Snippets" category — same glow, same
  // "guide, don't open it for them" approach as Projects/New. Blockly's
  // toolbox categories aren't plain DOM ids, so this looks the category up
  // by its resolved (translated) display name via getToolboxItems(), then
  // glows its real row element (item.getDiv()).
  snippets: () => drawAttention(findSnippetsCategory()?.getDiv?.()),
  // Same "Projects"/"New" fallback shape: if the Snippets flyout is already
  // open, glow the actual first block in it (its own SVG root — glow works
  // on SVG the same way it does on a plain DOM element, see style.css);
  // otherwise fall back to glowing the category, since the block isn't
  // visible/reachable until that's open. Safe to target the live block now
  // that wireHowToLinks() suppresses Blockly's own close-the-flyout
  // behaviour around every how-to link click.
  skymapsnippet: () => {
    // toolbox.getSelectedItem() isn't reliably === the item found via
    // getToolboxItems() (the toolbox doesn't guarantee stable object
    // identity across calls), so check the flyout's own visibility instead.
    const flyout = Blockly.getMainWorkspace()?.getFlyout?.();
    if (!flyout?.isVisible?.()) {
      drawAttention(findSnippetsCategory()?.getDiv?.());
      return;
    }
    const firstBlock = flyout.getWorkspace?.()?.getTopBlocks(false)?.[0];
    drawAttention(firstBlock?.getSvgRoot?.());
  },
  // Points at the reader's own sky/map block already sitting in their
  // workspace (added via the snippet above), so "change the color" isn't
  // left to a screenshot's worth of imagination. No-ops if the reader hasn't
  // added the block (or deleted it) — nothing to glow yet.
  skyblock: () => drawAttention(findMainWorkspaceBlock('set_sky_color')?.getSvgRoot?.()),
  mapblock: () => drawAttention(findMainWorkspaceBlock('create_map')?.getSvgRoot?.()),
};

function findSnippetsCategory() {
  const toolbox = Blockly.getMainWorkspace()?.getToolbox?.();
  return (toolbox?.getToolboxItems?.() ?? []).find(
    (item) => item.getName?.() === Blockly.Msg['CATEGORY_SNIPPETS']
  );
}

function findMainWorkspaceBlock(type) {
  return Blockly.getMainWorkspace()
    ?.getAllBlocks(false)
    ?.find((block) => block.type === type);
}

// Any click on our how-to panel is, spatially and in the DOM, a click
// *outside* an open Blockly flyout — and Blockly closes an open flyout on
// any outside interaction by default (flyout.hide()/setVisible(false), fired
// on pointerdown, ahead of our own click handler ever running). That's a
// real conflict whenever a how-to link points at something inside an
// already-open flyout (e.g. re-pointing at the Snippets category while it's
// open) — the flyout closing out from under the reader as a side effect of
// reading the how-to. Armed on pointerdown (as early in the gesture as
// possible) and disarmed shortly after, so it brackets the whole
// pointerdown → click sequence regardless of exactly which of those two
// calls Blockly ends up making.
// Guarded against re-entry: without flyoutSuppressed, a second call inside
// the 300ms window (e.g. a quick double-click) would capture the already-
// stubbed hide/setVisible as "original" and restore those no-ops instead of
// the real methods, permanently disabling the flyout's close behaviour.
let flyoutSuppressed = false;
function suppressFlyoutAutoClose() {
  const flyout = Blockly.getMainWorkspace()?.getFlyout?.();
  if (!flyout || flyoutSuppressed) return;
  flyoutSuppressed = true;
  const originalHide = flyout.hide?.bind(flyout);
  const originalSetVisible = flyout.setVisible?.bind(flyout);
  if (originalHide) flyout.hide = () => {};
  if (originalSetVisible) flyout.setVisible = () => {};
  setTimeout(() => {
    if (originalHide) flyout.hide = originalHide;
    if (originalSetVisible) flyout.setVisible = originalSetVisible;
    flyoutSuppressed = false;
  }, 300);
}

// Upgrades each declarative <link-to target="…">label</link-to> into the same
// button.help-link shape/behaviour wireHelpLinks() produces, so how-to
// authors write a plain tag rather than hand-rolling a button+id.
function wireHowToLinks(root) {
  root.querySelectorAll('link-to').forEach((el) => {
    const target = el.getAttribute('target');
    const handler = HOWTO_LINK_TARGETS[target];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'help-link';
    btn.textContent = el.textContent;
    if (handler) {
      btn.addEventListener('pointerdown', suppressFlyoutAutoClose, { capture: true });
      btn.addEventListener('click', handler);
    }
    el.replaceWith(btn);
  });
}

// How-to snippet blocks — Blockly JSON, one file per snippet, shared by
// every language (see docs/how-tos/snippets/README.md for why this is
// rendered live rather than shipped as a picture).
const SNIPPET_JSON = import.meta.glob('../docs/how-tos/snippets/*.json', {
  eager: true,
  import: 'default',
});

const snippetJsonFor = (name) => SNIPPET_JSON[`../docs/how-tos/snippets/${name}.json`];

// A single hidden, off-screen Blockly workspace reused to render every
// snippet — off-screen rather than display:none, since Blockly needs the SVG
// actually laid out to measure it. Lazy: only created the first time a
// how-to with a snippet is actually opened.
let snippetWorkspace = null;
function getSnippetWorkspace() {
  if (snippetWorkspace) return snippetWorkspace;
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed; left:-9999px; top:-9999px; width:600px; height:400px;';
  document.body.appendChild(container);
  // Blockly.inject() reassigns Blockly.getMainWorkspace() to whatever it just
  // injected — including this hidden render-only workspace — with no way to
  // opt out, and never restores the previous one on dispose(). Every other
  // part of the app (including our own how-to link targets above) relies on
  // getMainWorkspace() pointing at the real workspace, so put it back
  // immediately, synchronously, in the same tick inject() changed it — the
  // only moment anything could observe the wrong workspace is between these
  // two lines, and nothing else can run in between JS's single call stack.
  const realMainWorkspace = Blockly.getMainWorkspace();
  snippetWorkspace = Blockly.inject(container, {
    // Reuse the real app's renderer/theme/media path so a rendered snippet
    // actually looks like Flock, not stock Blockly — omitting these was why
    // an earlier version of this rendered plain, unstyled blocks. No toolbox:
    // this workspace only ever holds one offscreen block at a time.
    ...blocklyOptions,
    toolbox: undefined,
    readOnly: true,
  });
  Blockly.common.setMainWorkspace(realMainWorkspace);
  return snippetWorkspace;
}

async function renderSnippetSVG(blockJson) {
  const ws = getSnippetWorkspace();
  const block = Blockly.serialization.blocks.append(blockJson, ws, { recordUndo: false });
  try {
    block.initSvg();
    block.render();
    return await generateSVG(block, { rasterSafe: true });
  } finally {
    block.dispose();
  }
}

function wireHowToSnippets(root) {
  root.querySelectorAll('snippet').forEach((el) => {
    const src = el.getAttribute('src');
    const caption = el.textContent.trim();
    const figure = document.createElement('figure');
    figure.className = 'howto-snippet';
    if (caption) {
      const figcaption = document.createElement('figcaption');
      figcaption.textContent = caption;
      figure.appendChild(figcaption);
    }
    el.replaceWith(figure);

    const blockJson = snippetJsonFor(src);
    if (!blockJson) {
      console.error(`How-to snippet "${src}" has no matching docs/how-tos/snippets/*.json`);
      return;
    }
    renderSnippetSVG(blockJson)
      .then((svg) => {
        figure.insertAdjacentHTML('afterbegin', svg);
        // The figcaption (when present) is the accessible description; the
        // picture itself is decorative on top of that.
        figure.querySelector('svg')?.setAttribute('aria-hidden', 'true');
      })
      .catch((e) => console.error(`Failed to render how-to snippet "${src}"`, e));
  });
}

// Appends a toggleable "Mark as complete" button to the end of every <step>,
// right-aligned, styled after flipcomputing.com's UEFN tutorial steps:
// clicking it toggles a `completed` class on the step (CSS greys it out with
// a strikethrough) and flips the button's own label. Nothing is persisted —
// completion is just DOM state on the rendered article, so it resets the
// next time the how-to is opened (renderArticle() re-injects the raw HTML
// from scratch).
function wireHowToSteps(root) {
  root.querySelectorAll('step').forEach((step) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'howto-step-complete';
    btn.textContent = translate('howto_mark_complete');
    btn.addEventListener('click', () => {
      const completed = step.classList.toggle('completed');
      btn.textContent = translate(completed ? 'howto_step_completed' : 'howto_mark_complete');
    });
    // The button must be display: inline-block (see style.css) to avoid the
    // completed step's line-through painting across it, so alignment is done
    // via text-align: right on this wrapping row instead of on the button.
    const row = document.createElement('div');
    row.className = 'howto-step-complete-row';
    row.appendChild(btn);
    step.appendChild(row);
  });
}

// Second info panel tab: a grid of how-to cards that swaps to an article
// view (inline, in the same docked tab) when a card is clicked.
const HowToPanel = {
  ...ModalPanelBehaviour,
  panel: null,
  previousFocus: null,
  _activeSlug: null,
  _modalTitleId: 'howto-panel-title',
  _tabBtnId: 'info-tab-btn-howto',
  _closeLabelKey: 'close',
  _listId: '#howto-list',

  init() {
    this.createPanel();
    this.setupListeners();
    this.watchDockedSpace();
    window.flockHowToPanel = this;
  },

  createPanel() {
    const panel = InfoPanel.register('howto', translate('howto_panel_title'), this);
    const btn = document.getElementById('info-tab-btn-howto');
    btn.innerHTML = `<div class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path fill="currentColor" d="M152.1 38.2c9.9 8.9 10.7 24 1.8 33.9l-72 80c-4.4 4.9-10.6 7.8-17.2 7.9s-12.9-2.4-17.6-7L7 113C-2.3 103.6-2.3 88.4 7 79s24.6-9.4 33.9 0l22.1 22.1 55.1-61.2c8.9-9.9 24-10.7 33.9-1.8zm0 160c9.9 8.9 10.7 24 1.8 33.9l-72 80c-4.4 4.9-10.6 7.8-17.2 7.9s-12.9-2.4-17.6-7L7 273c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l22.1 22.1 55.1-61.2c8.9-9.9 24-10.7 33.9-1.8zM224 96c0-17.7 14.3-32 32-32l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32zm0 160c0-17.7 14.3-32 32-32l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32zM160 416c0-17.7 14.3-32 32-32l288 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-288 0c-17.7 0-32-14.3-32-32zM48 368a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/></svg></div>`;
    panel.innerHTML = `
        <div class="shortcuts-panel-header">
          <h2 id="howto-panel-title" class="shortcuts-panel-title"></h2>
          <div class="shortcuts-panel-controls">${this.fontControlsHTML()}
          </div>
        </div>
        <div id="howto-list"></div>
      `;
    this.panel = panel;
    this.initFontControls();
    this.renderContent();
  },

  renderContent() {
    const title = translate('howto_panel_title');
    const btn = document.getElementById('info-tab-btn-howto');
    btn.setAttribute('aria-label', title);
    btn.setAttribute('title', title);
    this.panel.querySelector('#howto-panel-title').textContent = title;

    const list = this.panel.querySelector('#howto-list');
    if (this._activeSlug) {
      this.renderArticle(list, this._activeSlug);
    } else {
      this.renderGrid(list);
    }
  },

  renderGrid(list) {
    list.innerHTML = `<ul class="howto-grid"></ul>`;
    const grid = list.querySelector('.howto-grid');
    HOW_TOS.forEach((howTo) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'howto-tile';
      button.dataset.tone = String(howTo.tone);
      const name = document.createElement('span');
      name.className = 'howto-tile-name';
      name.textContent = translate(howTo.i18nKey);
      button.appendChild(name);
      button.addEventListener('click', () => this.openHowTo(howTo.slug));
      li.appendChild(button);
      grid.appendChild(li);
    });
  },

  renderArticle(list, slug) {
    const howTo = HOW_TOS.find((t) => t.slug === slug);
    list.innerHTML = `
      <button type="button" class="howto-back">${translate('howto_back_to_list')}</button>
      <h3 class="howto-article-title">${howTo ? translate(howTo.i18nKey) : ''}</h3>
      <div class="howto-article">${howToContentFor(slug, getCurrentLanguage())}</div>
    `;
    list.querySelector('.howto-back').addEventListener('click', () => this.closeHowTo());
    const article = list.querySelector('.howto-article');
    decorateExternalLinks(article);
    wireHowToLinks(article);
    wireHowToSteps(article);
    wireHowToSnippets(article);
  },

  openHowTo(slug) {
    this._activeSlug = slug;
    this.renderContent();
    document.getElementById('info-panel-body')?.scrollTo(0, 0);
    this.panel.querySelector('.howto-back')?.focus();
  },

  closeHowTo() {
    this._activeSlug = null;
    this.renderContent();
    document.getElementById('info-panel-body')?.scrollTo(0, 0);
    document.getElementById('info-tab-btn-howto')?.focus();
  },

  show() {
    this.renderContent();
    this.previousFocus = document.activeElement;
    InfoPanel.activate('howto');
    if (this.shouldBeModal()) this.enterModal();
  },

  refreshTranslations() {
    this.renderContent();
  },

  hide() {
    this.exitModal();
    this.previousFocus?.focus();
    this.previousFocus = null;
    InfoPanel.deactivate('howto');
    // Re-opening the tab should land back on the card grid, not strand the
    // reader mid-article.
    this._activeSlug = null;
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
        const tabBtn = document.getElementById('info-tab-btn-howto');
        if (tabBtn?.offsetParent) tabBtn.focus();
      }
    });
  },
};

export { HowToPanel };
