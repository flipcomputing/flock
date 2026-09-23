import * as Blockly from 'blockly';
import { translate, getCurrentLanguage } from '../main/translation.js';
import { generateSVG } from '../main/export.js';
import { options as blocklyOptions } from '../blocks/blocks.js';
import { toolbox as toolboxDefinition } from '../toolbox.js';
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
// `tags` assigns topic tags — the label for each comes from a
// `howto_tag_<tag>_ui` locale entry, and the grid offers them as a filter.
// To add a new tag, use it here and add its locale entry; no other change
// needed, the filter picks it up automatically.
// `icon` (a UI_BUTTON_ICONS key, see below) shows that button's glyph inline
// at the start of the card — only set for gizmo how-tos, one per gizmo.
const HOW_TOS = [
  { slug: 'add-sky-and-ground', i18nKey: 'howto_add_sky_and_ground_ui', tone: 1, tags: ['scene'] },
  { slug: 'add-objects', i18nKey: 'howto_add_objects_ui', tone: 2, tags: ['gizmo'], icon: 'addmenu' },
  { slug: 'color-an-object', i18nKey: 'howto_colour_an_object_ui', tone: 8, tags: ['gizmo'], icon: 'colorpicker' },
  { slug: 'position-objects', i18nKey: 'howto_position_objects_ui', tone: 3, tags: ['gizmo'], icon: 'positiongizmo' },
  { slug: 'position-with-code', i18nKey: 'howto_position_with_code_ui', tone: 15, tags: ['code'] },
  { slug: 'rotate-an-object', i18nKey: 'howto_rotate_an_object_ui', tone: 9, tags: ['gizmo'], icon: 'rotategizmo' },
  { slug: 'resize-an-object', i18nKey: 'howto_resize_an_object_ui', tone: 10, tags: ['gizmo'], icon: 'scalegizmo' },
  { slug: 'select-an-object', i18nKey: 'howto_select_an_object_ui', tone: 14, tags: ['gizmo'], icon: 'selectgizmo' },
  { slug: 'duplicate-objects', i18nKey: 'howto_duplicate_objects_ui', tone: 4, tags: ['gizmo'], icon: 'duplicategizmo' },
  { slug: 'delete-an-object', i18nKey: 'howto_delete_an_object_ui', tone: 11, tags: ['gizmo'], icon: 'deletegizmo' },
  { slug: 'design-a-character', i18nKey: 'howto_design_a_character_ui', tone: 6, tags: ['character'] },
  { slug: 'look-around', i18nKey: 'howto_look_around_ui', tone: 5, tags: ['camera'] },
  { slug: 'fly-camera', i18nKey: 'howto_fly_camera_ui', tone: 13, tags: ['gizmo', 'camera'], icon: 'cameragizmo' },
  { slug: 'walk-around', i18nKey: 'howto_walk_around_ui', tone: 7, tags: ['camera'] },
  { slug: 'view-an-object', i18nKey: 'howto_view_an_object_ui', tone: 12, tags: ['gizmo', 'camera'], icon: 'viewgizmo' },
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
  // "Menu" → "Tools" → "Gizmo controls" is the same guided-chain shape as
  // "Projects"/"New" above, one level deeper: "Menu" always points at the
  // menu button (see mainmenu below); "Tools" points at the Tools menu item
  // if the menu dropdown is already open, or falls back to the menu button
  // otherwise; "Gizmo controls" points at its checkbox if the Tools modal is
  // already open, or falls back to the Tools menu item otherwise.
  toolsmenu: () => {
    const menuOpen = !document.getElementById('menuDropdown')?.classList.contains('hidden');
    drawAttention(document.getElementById(menuOpen ? 'tools-menu-item' : 'menuBtn'));
  },
  gizmocontrols: () => {
    const modalOpen = !document.getElementById('toolsModal')?.classList.contains('hidden');
    drawAttention(document.getElementById(modalOpen ? 'gizmoControlsCheckbox' : 'tools-menu-item'));
  },
  // Toolbox categories are pointed at via <ui-button target="toolbox:KEY">
  // instead (see glowToolboxCategory) — Blockly's toolbox categories aren't
  // plain DOM ids, so the tag looks the category up by its resolved
  // (translated) display name via getToolboxItems(), then glows its real row
  // element (item.getDiv()).
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
  // Points at the "+" toolbar button that opens the Add menu (shapes, models,
  // characters) — same "guide, don't open it for them" approach as above.
  addmenu: () => drawAttention(document.getElementById('showShapesButton')),
  // Gizmo toolbar buttons — each activates its gizmo.
  colorpicker: () => drawAttention(document.getElementById('colorPickerButton')),
  // Controls inside the color picker itself — same "Projects"/"New" guided-
  // chain fallback as newprojectbutton/gizmocontrols above: each points at
  // its real control if the picker is open, or falls back to the Color
  // picker gizmo button (which opens it) otherwise.
  colorpalette: () =>
    drawAttention(
      colorPickerSubElement('#palette-select') ?? document.getElementById('colorPickerButton')
    ),
  // The grid of preset swatches rendered under the palette dropdown, not the
  // dropdown itself — see colorpalette above.
  colorswatches: () =>
    drawAttention(
      colorPickerSubElement('.color-palette') ?? document.getElementById('colorPickerButton')
    ),
  colorrandom: () =>
    drawAttention(
      colorPickerSubElement('.color-picker-random') ??
        document.getElementById('colorPickerButton')
    ),
  colorwheel: () =>
    drawAttention(
      colorPickerSubElement('.color-wheel-canvas') ?? document.getElementById('colorPickerButton')
    ),
  colorbrightness: () =>
    drawAttention(
      colorPickerSubElement('.lightness-slider') ?? document.getElementById('colorPickerButton')
    ),
  colorhue: () =>
    drawAttention(
      colorPickerSubElement('.hue-slider-container') ??
        document.getElementById('colorPickerButton')
    ),
  coloreyedropper: () =>
    drawAttention(
      colorPickerSubElement('.color-picker-eyedropper') ??
        document.getElementById('colorPickerButton')
    ),
  // Points at the Position button in the gizmo toolbar, which activates the
  // position gizmo — same approach as above.
  positiongizmo: () => drawAttention(document.getElementById('positionButton')),
  rotategizmo: () => drawAttention(document.getElementById('rotationButton')),
  scalegizmo: () => drawAttention(document.getElementById('scaleButton')),
  selectgizmo: () => drawAttention(document.getElementById('selectButton')),
  // Points at the Duplicate button in the gizmo toolbar, which activates the
  // duplicate gizmo — same approach as above.
  duplicategizmo: () => drawAttention(document.getElementById('duplicateButton')),
  deletegizmo: () => drawAttention(document.getElementById('deleteButton')),
  cameragizmo: () => drawAttention(document.getElementById('cameraButton')),
  viewgizmo: () => drawAttention(document.getElementById('eyeButton')),
  // Top menu bar buttons.
  mainmenu: () => drawAttention(document.getElementById('menuBtn')),
  projects: () => drawAttention(document.getElementById('exampleButton')),
  run: () => drawAttention(document.getElementById('runCodeButton')),
  stop: () => drawAttention(document.getElementById('stopCodeButton')),
  playmode: () => drawAttention(document.getElementById('togglePlay')),
  fullscreen: () => drawAttention(document.getElementById('fullscreenToggle')),
  // Block workspace toolbar buttons.
  blockhints: () => drawAttention(document.getElementById('blockHintsBtn')),
  search: () => drawAttention(document.getElementById('workspaceSearchBtn')),
  undo: () => drawAttention(document.getElementById('undoBtn')),
  redo: () => drawAttention(document.getElementById('redoBtn')),
  zoomout: () => drawAttention(document.getElementById('zoomOutBtn')),
  zoomin: () => drawAttention(document.getElementById('zoomInBtn')),
  // Bottom-bar view toggles.
  canvasview: () => drawAttention(document.getElementById('canvasToggleBtn')),
  codeview: () => drawAttention(document.getElementById('codeToggleBtn')),
  // Floating block-toolbar buttons (ui/contextmenu.js). The toolbar only
  // exists while a block is selected, so these no-op until the reader has
  // selected a block — same convention as skyblock/mapblock above.
  'block-expand': () =>
    drawAttention(findBlockToolbarButton([['context_expand_option', 'Expand']])),
  'block-collapse': () =>
    drawAttention(findBlockToolbarButton([['context_collapse_option', 'Collapse']])),
  'block-unlock': () =>
    drawAttention(findBlockToolbarButton([['unlock_block_option', 'Unlock']])),
  'block-duplicate': () =>
    drawAttention(findBlockToolbarButton([['duplicate_block_button_ui', 'Duplicate block']])),
  'block-copy': () =>
    drawAttention(findBlockToolbarButton([['copy_block_button_ui', 'Copy block']])),
  'block-paste': () =>
    drawAttention(findBlockToolbarButton([['paste_block_button_ui', 'Paste block']])),
  'block-detach': () =>
    drawAttention(findBlockToolbarButton([['shortcut_detach_block', 'Detach']])),
  'block-enable': () =>
    drawAttention(
      findBlockToolbarButton([
        ['context_enable_option', 'Enable'],
        ['context_disable_option', 'Disable'],
      ])
    ),
  'block-view': () =>
    drawAttention(
      findBlockToolbarButton([
        ['view_in_canvas', 'View in canvas'],
        ['exit_canvas_view', 'Stop orbiting object'],
      ])
    ),
  'block-delete': () =>
    drawAttention(findBlockToolbarButton([['delete_block_button_ui', 'Delete block']])),
  // The workspace trashcan (Blockly's own bin, a `.blocklyTrash` SVG group —
  // glow works on SVG the same way, see style.css).
  trashcan: () => drawAttention(document.querySelector('#blocklyDiv .blocklyTrash')),
};

// Hardcoded copies of the menu-bar button icons, keyed by <ui-button>
// target. Deliberately duplicated from index.html (menu bar) and
// ui/contextmenu.js (floating block toolbar) rather than cloned at runtime —
// if a button icon changes, update its entry here in the same pass.
// Text-only buttons (projects, canvasview, codeview) have no entry and render
// as a label-only highlight link. Entries are { viewBox, path }, except
// block-duplicate (custom two-rect glyph, not a single path) which uses
// { viewBox, inner }, and block-collapse (same glyph as block-expand, shown
// flipped) which adds flip: true.
const UI_BUTTON_ICONS = {
  addmenu: {
    viewBox: '0 0 122.875 122.648',
    path: 'M108.993,47.079c7.683-0.059,13.898,6.12,13.882,13.805 c-0.018,7.683-6.26,13.959-13.942,14.019L75.24,75.138l-0.235,33.73c-0.063,7.619-6.338,13.789-14.014,13.78 c-7.678-0.01-13.848-6.197-13.785-13.818l0.233-33.497l-33.558,0.235C6.2,75.628-0.016,69.448,0,61.764 c0.018-7.683,6.261-13.959,13.943-14.018l33.692-0.236l0.236-33.73C47.935,6.161,54.209-0.009,61.885,0 c7.678,0.009,13.848,6.197,13.784,13.818l-0.233,33.497L108.993,47.079L108.993,47.079z',
  },
  colorpicker: {
    viewBox: '0 0 512 512',
    path: 'M512 256c0 .9 0 1.8 0 2.7c-.4 36.5-33.6 61.3-70.1 61.3L344 320c-26.5 0-48 21.5-48 48c0 3.4 .4 6.7 1 9.9c2.1 10.2 6.5 20 10.8 29.9c6.1 13.8 12.1 27.5 12.1 42c0 31.8-21.6 60.7-53.4 62c-3.5 .1-7 .2-10.6 .2C114.6 512 0 397.4 0 256S114.6 0 256 0S512 114.6 512 256zM128 288a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm0-96a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM288 96a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm96 96a32 32 0 1 0 0-64 32 32 0 1 0 0 64z',
  },
  positiongizmo: {
    viewBox: '0 0 512 512',
    path: 'M278.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-64 64c-9.2 9.2-11.9 22.9-6.9 34.9s16.6 19.8 29.6 19.8l32 0 0 96-96 0 0-32c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9l-64 64c-12.5 12.5-12.5 32.8 0 45.3l64 64c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6l0-32 96 0 0 96-32 0c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l64 64c12.5 12.5 32.8 12.5 45.3 0l64-64c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8l-32 0 0-96 96 0 0 32c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l64-64c12.5-12.5 12.5-32.8 0-45.3l-64-64c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 32-96 0 0-96 32 0c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-64-64z',
  },
  rotategizmo: {
    viewBox: '0 0 512 512',
    path: 'M142.9 142.9c-17.5 17.5-30.1 38-37.8 59.8c-5.9 16.7-24.2 25.4-40.8 19.5s-25.4-24.2-19.5-40.8C55.6 150.7 73.2 122 97.6 97.6c87.2-87.2 228.3-87.5 315.8-1L455 55c6.9-6.9 17.2-8.9 26.2-5.2s14.8 12.5 14.8 22.2l0 128c0 13.3-10.7 24-24 24l-8.4 0c0 0 0 0 0 0L344 224c-9.7 0-18.5-5.8-22.2-14.8s-1.7-19.3 5.2-26.2l41.1-41.1c-62.6-61.5-163.1-61.2-225.3 1zM16 312c0-13.3 10.7-24 24-24l7.6 0 .7 0L168 288c9.7 0 18.5 5.8 22.2 14.8s1.7 19.3-5.2 26.2l-41.1 41.1c62.6 61.5 163.1 61.2 225.3-1c17.5-17.5 30.1-38 37.8-59.8c5.9-16.7 24.2-25.4 40.8-19.5s25.4 24.2 19.5 40.8c-10.8 30.6-28.4 59.3-52.9 83.8c-87.2 87.2-228.3 87.5-315.8 1L57 457c-6.9 6.9-17.2 8.9-26.2 5.2S16 449.7 16 440l0-119.6 0-.7 0-7.6z',
  },
  scalegizmo: {
    viewBox: '0 0 512 512',
    path: 'M344 0L488 0c13.3 0 24 10.7 24 24l0 144c0 9.7-5.8 18.5-14.8 22.2s-19.3 1.7-26.2-5.2l-39-39-87 87c-9.4 9.4-24.6 9.4-33.9 0l-32-32c-9.4-9.4-9.4-24.6 0-33.9l87-87L327 41c-6.9-6.9-8.9-17.2-5.2-26.2S334.3 0 344 0zM168 512L24 512c-13.3 0-24-10.7-24-24L0 344c0-9.7 5.8-18.5 14.8-22.2s19.3-1.7 26.2 5.2l39 39 87-87c9.4-9.4 24.6-9.4 33.9 0l32 32c9.4 9.4 9.4 24.6 0 33.9l-87 87 39 39c6.9 6.9 8.9 17.2 5.2 26.2s-12.5 14.8-22.2 14.8z',
  },
  selectgizmo: {
    viewBox: '0 0 320 512',
    path: 'M0 55.2L0 426c0 12.2 9.9 22 22 22c6.3 0 12.4-2.7 16.6-7.5L121.2 346l58.1 116.3c7.9 15.8 27.1 22.2 42.9 14.3s22.2-27.1 14.3-42.9L179.8 320l118.1 0c12.2 0 22.1-9.9 22.1-22.1c0-6.3-2.7-12.3-7.4-16.5L38.6 37.9C34.3 34.1 28.9 32 23.2 32C10.4 32 0 42.4 0 55.2z',
  },
  duplicategizmo: {
    viewBox: '0 0 448 512',
    path: 'M208 0L332.1 0c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9L448 336c0 26.5-21.5 48-48 48l-192 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48zM48 128l80 0 0 64-64 0 0 256 192 0 0-32 64 0 0 48c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 176c0-26.5 21.5-48 48-48z',
  },
  deletegizmo: {
    viewBox: '0 0 448 512',
    path: 'M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z',
  },
  cameragizmo: {
    viewBox: '0 0 576 512',
    path: 'M0 128C0 92.7 28.7 64 64 64l256 0c35.3 0 64 28.7 64 64l0 256c0 35.3-28.7 64-64 64L64 448c-35.3 0-64-28.7-64-64L0 128zM559.1 99.8c10.4 5.6 16.9 16.4 16.9 28.2l0 256c0 11.8-6.5 22.6-16.9 28.2s-23 5-32.9-1.6l-96-64L416 337.1l0-17.1 0-128 0-17.1 14.2-9.5 96-64c9.8-6.5 22.4-7.2 32.9-1.6z',
  },
  viewgizmo: {
    viewBox: '0 0 576 512',
    path: 'M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z',
  },
  mainmenu: {
    viewBox: '0 0 448 512',
    path: 'M0 96C0 78.3 14.3 64 32 64h384c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zm0 160c0-17.7 14.3-32 32-32h384c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zm448 160c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32h384c17.7 0 32-14.3 32 32z',
  },
  run: {
    viewBox: '0 0 512 512',
    path: 'M0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zM188.3 147.1c-7.6 4.2-12.3 12.3-12.3 20.9l0 176c0 8.7 4.7 16.7 12.3 20.9s16.8 4.1 24.3-.5l144-88c7.1-4.4 11.5-12.1 11.5-20.5s-4.4-16.1-11.5-20.5l-144-88c-7.4-4.5-16.7-4.7-24.3-.5z',
  },
  stop: {
    viewBox: '0 0 512 512',
    path: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM192 160l128 0c17.7 0 32 14.3 32 32l0 128c0 17.7-14.3 32-32 32l-128 0c-17.7 0-32-14.3-32-32l0-128c0-17.7 14.3-32 32-32z',
  },
  playmode: {
    viewBox: '0 0 640 512',
    path: 'M192 64C86 64 0 150 0 256S86 448 192 448l256 0c106 0 192-86 192-192s-86-192-192-192L192 64zM496 168a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM392 304a40 40 0 1 1 80 0 40 40 0 1 1 -80 0zM168 200c0-13.3 10.7-24 24-24s24 10.7 24 24l0 32 32 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-32 0 0 32c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-32-32 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l32 0 0-32z',
  },
  fullscreen: {
    viewBox: '0 0 512 512',
    path: 'M200 32L56 32C42.7 32 32 42.7 32 56l0 144c0 9.7 5.8 18.5 14.8 22.2s19.3 1.7 26.2-5.2l40-40 79 79-79 79L73 295c-6.9-6.9-17.2-8.9-26.2-5.2S32 302.3 32 312l0 144c0 13.3 10.7 24 24 24l144 0c9.7 0 18.5-5.8 22.2-14.8s1.7-19.3-5.2-26.2l-40-40 79-79 79 79-40 40c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8l144 0c13.3 0 24-10.7 24-24l0-144c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2l-40 40-79-79 79-79 40 40c6.9 6.9 17.2 8.9 26.2 5.2s14.8-12.5 14.8-22.2l0-144c0-13.3-10.7-24-24-24L312 32c-9.7 0-18.5 5.8-22.2 14.8s-1.7 19.3 5.2 26.2l40 40-79 79-79-79 40-40c6.9-6.9 8.9-17.2 5.2-26.2S209.7 32 200 32z',
  },
  blockhints: {
    viewBox: '0 0 512 512',
    path: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336l24 0 0-64-24 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l48 0c13.3 0 24 10.7 24 24l0 88 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z',
  },
  search: {
    viewBox: '0 0 512 512',
    path: 'M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z',
  },
  undo: {
    viewBox: '0 0 512 512',
    path: 'M48.5 224H40c-13.3 0-24-10.7-24-24V72c0-9.7 5.8-18.5 14.8-22.2s19.3-1.7 26.2 5.2L98.6 96.6c87.6-86.5 228.7-86.2 315.8 1c87.8 87.8 87.8 230.2 0 318s-230.2 87.8-318 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3c-62.2-62.2-162.7-62.5-225.3-1L185 183c6.9 6.9 8.9 17.2 5.2 26.2s-12.5 14.8-22.2 14.8H48.5z',
  },
  redo: {
    viewBox: '0 0 512 512',
    path: 'M463.5 224H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.8 87.8-87.8 230.2 0 318s230.2 87.8 318 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8H463.5z',
  },
  zoomout: {
    viewBox: '0 0 512 512',
    path: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM184 232l144 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-144 0c-13.3 0-24-10.7-24-24s10.7-24 24-24z',
  },
  zoomin: {
    viewBox: '0 0 512 512',
    path: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM232 344l0-64-64 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l64 0 0-64c0-13.3 10.7-24 24-24s24 10.7 24 24l0 64 64 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-64 0 0 64c0 13.3-10.7 24-24 24s-24-10.7-24-24z',
  },
  // Floating block-toolbar icons (ui/contextmenu.js) — same glyphs as the
  // real toolbar buttons.
  'block-expand': {
    viewBox: '0 0 640 640',
    path: 'M342.6 534.6C330.1 547.1 309.8 547.1 297.3 534.6L137.3 374.6C124.8 362.1 124.8 341.8 137.3 329.3C149.8 316.8 170.1 316.8 182.6 329.3L320 466.7L457.4 329.4C469.9 316.9 490.2 316.9 502.7 329.4C515.2 341.9 515.2 362.2 502.7 374.7L342.7 534.7zM502.6 182.6L342.6 342.6C330.1 355.1 309.8 355.1 297.3 342.6L137.3 182.6C124.8 170.1 124.8 149.8 137.3 137.3C149.8 124.8 170.1 124.8 182.6 137.3L320 274.7L457.4 137.4C469.9 124.9 490.2 124.9 502.7 137.4C515.2 149.9 515.2 170.2 502.7 182.7z',
  },
  'block-collapse': {
    viewBox: '0 0 640 640',
    path: 'M342.6 534.6C330.1 547.1 309.8 547.1 297.3 534.6L137.3 374.6C124.8 362.1 124.8 341.8 137.3 329.3C149.8 316.8 170.1 316.8 182.6 329.3L320 466.7L457.4 329.4C469.9 316.9 490.2 316.9 502.7 329.4C515.2 341.9 515.2 362.2 502.7 374.7L342.7 534.7zM502.6 182.6L342.6 342.6C330.1 355.1 309.8 355.1 297.3 342.6L137.3 182.6C124.8 170.1 124.8 149.8 137.3 137.3C149.8 124.8 170.1 124.8 182.6 137.3L320 274.7L457.4 137.4C469.9 124.9 490.2 124.9 502.7 137.4C515.2 149.9 515.2 170.2 502.7 182.7z',
    flip: true,
  },
  'block-duplicate': {
    viewBox: '0 0 28 26',
    inner:
      '<rect x="7" y="8" width="20" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="1" y="2" width="20" height="16" rx="3" fill="currentColor"/>',
  },
  'block-paste': {
    viewBox: '0 0 512 512',
    path: 'M160 0c-23.7 0-44.4 12.9-55.4 32L48 32C21.5 32 0 53.5 0 80L0 400c0 26.5 21.5 48 48 48l144 0 0-272c0-44.2 35.8-80 80-80l48 0 0-16c0-26.5-21.5-48-48-48l-56.6 0C204.4 12.9 183.7 0 160 0zM272 128c-26.5 0-48 21.5-48 48l0 272 0 16c0 26.5 21.5 48 48 48l192 0c26.5 0 48-21.5 48-48l0-220.1c0-12.7-5.1-24.9-14.1-33.9l-67.9-67.9c-9-9-21.2-14.1-33.9-14.1L320 128l-48 0zM160 40a24 24 0 1 1 0 48 24 24 0 1 1 0-48z',
  },
  'block-detach': {
    viewBox: '0 0 576 512',
    path: 'M352 224H305.5c-45 0-81.5 36.5-81.5 81.5c0 22.3 10.3 34.3 19.2 40.5c6.8 4.7 12.8 12 12.8 20.3c0 9.8-8 17.8-17.8 17.8h-2.5c-2.4 0-4.8-.4-7.1-1.4C210.8 374.8 128 333.4 128 240c0-79.5 64.5-144 144-144h80V34.7C352 15.5 367.5 0 386.7 0c8.6 0 16.8 3.2 23.2 8.9L548.1 133.3c7.6 6.8 11.9 16.5 11.9 26.7s-4.3 19.9-11.9 26.7l-139 125.1c-5.9 5.3-13.5 8.2-21.4 8.2H384c-17.7 0-32-14.3-32-32V224zM80 96c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16H400c8.8 0 16-7.2 16-16V384c0-17.7 14.3-32 32-32s32 14.3 32 32v48c0 44.2-35.8 80-80 80H80c-44.2 0-80-35.8-80-80V112C0 67.8 35.8 32 80 32h48c17.7 0 32 14.3 32 32s-14.3 32-32 32H80z',
  },
  'block-unlock': {
    viewBox: '0 0 576 512',
    path: 'M352 144c0-44.2 35.8-80 80-80s80 35.8 80 80v48c0 17.7 14.3 32 32 32s32-14.3 32-32V144C576 64.5 511.5 0 432 0S288 64.5 288 144v48H64c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H336c35.3 0 64-28.7 64-64V256c0-35.3-28.7-64-64-64H352V144z',
  },
  'block-enable': {
    viewBox: '0 0 576 512',
    path: 'M384 64c106 0 192 86 192 192s-86 192-192 192l-192 0C86 448 0 362 0 256S86 64 192 64l192 0zm0 288a96 96 0 1 0 0-192 96 96 0 1 0 0 192z',
  },
};

// Aliases sharing a glyph with a menu-bar button above.
UI_BUTTON_ICONS['block-copy'] = UI_BUTTON_ICONS.duplicategizmo;
UI_BUTTON_ICONS['block-delete'] = UI_BUTTON_ICONS.deletegizmo;
UI_BUTTON_ICONS['block-view'] = UI_BUTTON_ICONS.viewgizmo;
UI_BUTTON_ICONS.trashcan = UI_BUTTON_ICONS.deletegizmo;

// Builds an <img> or <svg> node from a UI_BUTTON_ICONS entry — the shared
// bit of wireHowToButtons() below and renderGrid()'s card icons, so both
// draw the exact same glyph the same way.
function createIconElement(icon) {
  if (icon?.src) {
    const img = document.createElement('img');
    img.src = icon.src;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.className = 'howto-icon';
    return img;
  }
  if (icon) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', icon.viewBox);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'howto-icon');
    if (icon.flip) svg.style.transform = 'scaleY(-1)';
    if (icon.inner) {
      svg.innerHTML = icon.inner;
    } else {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('fill', 'currentColor');
      path.setAttribute('d', icon.path);
      svg.appendChild(path);
    }
    return svg;
  }
  return null;
}

// Small icon buttons that live on blocks themselves, keyed by <block-icon>
// name — as opposed to the toolbar/menu buttons behind <ui-button>. Same
// hardcoded-copy convention as UI_BUTTON_ICONS above: if a block icon
// changes, update its entry here in the same pass. First entry is the
// pick-position pin from blocks/fieldPickPosition.js.
const BLOCK_ICONS = {
  pin: {
    viewBox: '0 0 384 512',
    path: 'M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z',
  },
};

// The color picker (ui/colourpicker.js) is a single instance appended to
// #canvasArea once at startup and toggled via style.display, never
// created/destroyed — so a plain selector reliably finds its current
// controls. Returns null while the picker is closed, so callers can fall
// back to the Color picker gizmo button instead of glowing a hidden control.
function colorPickerSubElement(selector) {
  const picker = document.querySelector('.custom-color-picker');
  if (!picker || picker.style.display === 'none') return null;
  return picker.querySelector(selector);
}

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

// Same English-fallback convention as getToolbarLabel() in
// ui/contextmenu.js: an untranslated key comes back as the key itself.
function toolbarLabel(key, fallback) {
  const result = translate(key);
  return result === key ? fallback : result;
}

// Finds a floating block-toolbar button by its (translated) accessible name.
// Returns null unless the toolbar is actually open with the button visible —
// highlighting a hidden button would glow nothing, so callers no-op instead
// (same convention as skyblock/mapblock above).
function findBlockToolbarButton(labelPairs) {
  const bar = document.querySelector('.fc-block-toolbar.visible');
  if (!bar) return null;
  const wanted = new Set(labelPairs.map(([key, fallback]) => toolbarLabel(key, fallback)));
  return (
    [...bar.querySelectorAll('button.fc-block-toolbar-btn')]
      .filter((btn) => btn.style.display !== 'none' && btn.getBoundingClientRect().width > 0)
      .find((btn) => wanted.has(btn.getAttribute('aria-label'))) ?? null
  );
}

// Looks a toolbox category up by its resolved (translated) display name,
// searching nested subcategories as well as top-level categories.
function findToolboxItemByName(name) {
  const items = Blockly.getMainWorkspace()?.getToolbox?.()?.getToolboxItems?.() ?? [];
  const walk = (list) => {
    for (const item of list) {
      if (item.getName?.() === name) return item;
      const found = walk(item.getChildToolboxItems?.() ?? []);
      if (found) return found;
    }
    return null;
  };
  return walk(items);
}

// Resolves a '%{BKY_X}' toolbox-definition name the same way Blockly does.
function resolveToolboxDefName(defName) {
  const m = /%\{BKY_([A-Za-z0-9_]+)\}/.exec(defName ?? '');
  return m ? (Blockly.Msg[m[1]] ?? m[1]) : defName;
}

// The category icon for a <ui-button target="toolbox:KEY"> tag, taken from
// the static toolbox definition (toolbox.js) rather than hardcoded here —
// the definition is the one place category icons live, so an icon change
// lands in the tag with no second edit.
function toolboxIconSrcFor(key) {
  const want = Blockly.Msg[`CATEGORY_${key}`];
  if (!want) return null;
  let src = null;
  const walk = (contents) => {
    for (const def of contents ?? []) {
      if (def?.kind !== 'category') continue;
      if (src == null && resolveToolboxDefName(def.name) === want && def.icon) src = def.icon;
      walk(def.contents);
    }
  };
  walk(toolboxDefinition.contents);
  return src;
}

// Glows a toolbox category row for <ui-button target="toolbox:KEY">, where
// KEY matches a CATEGORY_<KEY> locale entry (e.g. toolbox:SNIPPETS). A
// subcategory whose parent isn't open yet can't be seen, so the glow goes to
// the parent category instead — opening it is the reader's next move.
function glowToolboxCategory(key) {
  const name = Blockly.Msg[`CATEGORY_${key}`];
  if (!name) {
    console.error(`How-to toolbox category "${key}" has no matching Blockly.Msg CATEGORY_ entry`);
    return;
  }
  const item = findToolboxItemByName(name);
  const el = item?.getDiv?.();
  if (el && el.offsetParent !== null) {
    drawAttention(el);
    return;
  }
  const parentEl = item?.getParent?.()?.getDiv?.();
  if (parentEl) drawAttention(parentEl);
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

// Upgrades each declarative <ui-button target="…">label</ui-button> into a
// clickable highlight link that shows the button's hardcoded icon from
// UI_BUTTON_ICONS next to its label (a toolbox category's own icon image for
// target="toolbox:KEY", placed before the name like the toolbox itself).
// Same glow behaviour as <link-to>; the label itself is authored per how-to
// (and per language). Label-icon gaps come from CSS margin, not whitespace
// text nodes, so no underline paints in the gap.
function wireHowToButtons(root) {
  root.querySelectorAll('ui-button').forEach((el) => {
    const target = el.getAttribute('target');
    const label = el.textContent.trim() || target || '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'help-link howto-ui-button';
    // Read by gizmos.js's color-picker "click outside to close" handler —
    // see the matching comment in wireHowToLinks() above.
    if (target) btn.dataset.target = target;
    // The label lives in its own span (not a bare text node) so the
    // icon's :first-child rule only matches when the icon genuinely comes
    // before the label — bare text nodes don't count for :first-child, so
    // a trailing icon would otherwise match it too and lose its margin.
    const labelEl = document.createElement('span');
    labelEl.className = 'howto-ui-label';
    labelEl.textContent = label;
    btn.append(labelEl);
    let handler = HOWTO_LINK_TARGETS[target];
    let icon = UI_BUTTON_ICONS[target];
    // Toolbox categories show their icon before the name, like the toolbox
    // itself does; every other button shows it after the label.
    let iconFirst = false;
    if (target?.startsWith('toolbox:')) {
      const key = target.slice('toolbox:'.length);
      handler = () => glowToolboxCategory(key);
      const src = toolboxIconSrcFor(key);
      if (src) icon = { src };
      iconFirst = true;
    }
    const iconEl = createIconElement(icon);
    if (iconEl) {
      if (iconFirst) btn.prepend(iconEl);
      else btn.appendChild(iconEl);
    }
    if (handler) {
      btn.addEventListener('pointerdown', suppressFlyoutAutoClose, { capture: true });
      btn.addEventListener('click', handler);
    } else {
      console.error(`How-to ui-button "${target}" has no matching HOWTO_LINK_TARGETS entry`);
    }
    el.replaceWith(btn);
  });
}

// Upgrades each declarative <block-icon name="…"> into the block's own
// inline icon from BLOCK_ICONS above, sized to the surrounding type by
// .howto-icon like any other inline icon in the text. Unlike <ui-button>
// this is not a link — it names no target and glows nothing; it just shows
// the icon so the reader can match the text to the block.
function wireHowToBlockIcons(root) {
  root.querySelectorAll('block-icon').forEach((el) => {
    const name = el.getAttribute('name');
    const icon = BLOCK_ICONS[name];
    if (!icon) {
      console.error(`How-to block-icon "${name}" has no matching BLOCK_ICONS entry`);
      el.remove();
      return;
    }
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', icon.viewBox);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'howto-icon');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', icon.path);
    svg.appendChild(path);
    el.replaceWith(svg);
  });
}

// Upgrades each declarative <link-to target="…">label</link-to> into the same
// button.help-link shape/behaviour wireHelpLinks() produces, so how-to
// authors write a plain tag rather than hand-rolling a button+id. A target of
// the form "howto:<slug>" opens another how-to card instead of pointing at
// the UI.
function wireHowToLinks(root, onOpenHowTo) {
  root.querySelectorAll('link-to').forEach((el) => {
    const target = el.getAttribute('target');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'help-link';
    btn.textContent = el.textContent;
    // Read by gizmos.js's color-picker "click outside to close" handler —
    // color-picker-targeting links (colorpalette/colorrandom/etc.) glow a
    // picker control while it stays open, so they're special-cased there
    // to not close it; everything else in the panel does.
    if (target) btn.dataset.target = target;
    if (target?.startsWith('howto:')) {
      const slug = target.slice('howto:'.length);
      if (HOW_TOS.some((h) => h.slug === slug)) {
        btn.addEventListener('click', () => onOpenHowTo(slug));
      }
    } else {
      const handler = HOWTO_LINK_TARGETS[target];
      if (handler) {
        btn.addEventListener('pointerdown', suppressFlyoutAutoClose, { capture: true });
        btn.addEventListener('click', handler);
      }
    }
    el.replaceWith(btn);
  });
}

// Upgrades a <related><related-howto slug="…"></related-howto>…</related>
// block into a "Related:" box styled like <goal>/<tip> (see style.css), with
// a plain inline .help-link per how-to — not a chip/pill, just a link, same
// as any other link inside a tip. Deliberately text-free for the author: the
// title comes live from HOW_TOS/i18n by slug, the same lookup
// wireHowToLinks() uses for target="howto:…", so there's no label to type or
// keep in sync if a title changes.
function wireHowToRelated(root, onOpenHowTo) {
  root.querySelectorAll('related').forEach((el) => {
    const box = document.createElement('div');
    box.className = 'howto-related';
    const slugs = [...el.querySelectorAll('related-howto')].map((item) => item.getAttribute('slug'));
    slugs.forEach((slug, i) => {
      const howTo = HOW_TOS.find((h) => h.slug === slug);
      if (!howTo) {
        console.error(`How-to related-howto "${slug}" has no matching HOW_TOS entry`);
        return;
      }
      if (i > 0) box.appendChild(document.createTextNode(', '));
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'help-link';
      btn.textContent = translate(howTo.i18nKey);
      btn.addEventListener('click', () => onOpenHowTo(slug));
      box.appendChild(btn);
    });
    el.replaceWith(box);
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

// `highlightInput`, when given, selects the child block plugged into that
// named input (e.g. the little colour swatch on COLOR) instead of the whole
// top-level block — the snippet still crops to the top block's full bbox
// (generateSVG still gets `block`), only the glow moves to the child. Falls
// back to the top block if that input has nothing connected.
async function renderSnippetSVG(blockJson, { selected = false, highlightInput = null } = {}) {
  const ws = getSnippetWorkspace();
  const block = Blockly.serialization.blocks.append(blockJson, ws, { recordUndo: false });
  try {
    block.initSvg();
    block.render();
    const blockToHighlight = highlightInput
      ? (block.getInput(highlightInput)?.connection?.targetBlock() ?? block)
      : block;
    const highlight = selected || !!highlightInput;
    if (highlight) blockToHighlight.select();
    return await generateSVG(block, { rasterSafe: true, keepSelected: highlight });
  } finally {
    block.dispose();
  }
}

function wireHowToSnippets(root) {
  root.querySelectorAll('snippet').forEach((el) => {
    const src = el.getAttribute('src');
    const selected = el.hasAttribute('selected');
    const highlightInput = el.getAttribute('highlight-input');
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
    renderSnippetSVG(blockJson, { selected, highlightInput })
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
  // Gizmo is the default filter (not All) since most how-tos are gizmo
  // how-tos — the reader lands on the subset they're most likely to want.
  _activeTag: 'gizmo',
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
    // Topic filter — one chip per tag (in first-seen order) plus All.
    // Single-select: picking a tag shows only its cards; All shows everything.
    const tags = [...new Set(HOW_TOS.flatMap((h) => h.tags ?? []))];
    list.innerHTML = `<div class="howto-filter" role="group" aria-label="${translate('howto_filter_label_ui')}"></div><ul class="howto-grid"></ul>`;
    const filter = list.querySelector('.howto-filter');
    const addChip = (tag, label) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'howto-filter-chip';
      chip.textContent = label;
      chip.setAttribute('aria-pressed', String(this._activeTag === tag));
      chip.addEventListener('click', () => {
        this._activeTag = tag;
        this.renderGrid(list);
      });
      filter.appendChild(chip);
    };
    addChip(null, translate('howto_filter_all_ui'));
    tags.forEach((tag) => addChip(tag, translate(`howto_tag_${tag}_ui`)));
    const grid = list.querySelector('.howto-grid');
    HOW_TOS.filter((h) => !this._activeTag || (h.tags ?? []).includes(this._activeTag)).forEach(
      (howTo) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'howto-tile';
        button.dataset.tone = String(howTo.tone);
        const title = document.createElement('span');
        title.className = 'howto-tile-title';
        const iconEl = createIconElement(UI_BUTTON_ICONS[howTo.icon]);
        if (iconEl) title.appendChild(iconEl);
        const name = document.createElement('span');
        name.className = 'howto-tile-name';
        name.textContent = translate(howTo.i18nKey);
        title.appendChild(name);
        button.appendChild(title);
        button.addEventListener('click', () => this.openHowTo(howTo.slug));
        li.appendChild(button);
        grid.appendChild(li);
      }
    );
  },

  renderArticle(list, slug) {
    const howTo = HOW_TOS.find((t) => t.slug === slug);
    list.innerHTML = `
      <button type="button" class="howto-back">${translate('howto_back_to_list')}</button>
      <h3 class="howto-article-title">${howTo ? translate(howTo.i18nKey) : ''}</h3>
      <div class="howto-article">${howToContentFor(slug, getCurrentLanguage())}</div>
      <button type="button" class="howto-back">${translate('howto_back_to_list')}</button>
    `;
    list.querySelectorAll('.howto-back').forEach((btn) => btn.addEventListener('click', () => this.closeHowTo()));
    const article = list.querySelector('.howto-article');
    decorateExternalLinks(article);
    wireHowToLinks(article, (slug) => this.openHowTo(slug));
    wireHowToButtons(article);
    wireHowToBlockIcons(article);
    wireHowToSteps(article);
    wireHowToSnippets(article);
    wireHowToRelated(article, (slug) => this.openHowTo(slug));
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
    // Re-opening the tab should land back on the default card grid, not
    // strand the reader mid-article or mid-filter.
    this._activeSlug = null;
    this._activeTag = 'gizmo';
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
