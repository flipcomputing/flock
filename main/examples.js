// Example ("Demo") gallery: a tabbed, tile-based, accessible picker that
// replaces the old <select id="exampleSelect"> dropdown. To add an example:
// append an entry below (with its `category`), drop its .flock file in
// /examples, and add an `<key>_ui` label in the locale files. To add a
// category, add an entry to CATEGORIES with an `examples_cat_<id>_ui` label.
import { applyTranslations, translate } from "./translation.js";
import { loadExample } from "./files.js";

// Tabs, in display order. `i18nKey` maps to an `examples_cat_<…>_ui` locale
// entry. Categories with no examples are skipped when building the tabs.
export const CATEGORIES = [
  { id: "start", i18nKey: "examples_cat_start" },
  { id: "worlds", i18nKey: "examples_cat_worlds" },
  { id: "games", i18nKey: "examples_cat_games" },
  { id: "physics", i18nKey: "examples_cat_physics" },
  { id: "create", i18nKey: "examples_cat_create" },
  { id: "xr", i18nKey: "examples_cat_xr" },
];

// Ordered list of bundled examples. `i18nKey` maps to the existing `<key>_ui`
// locale entries (which already include the leading emoji); `emoji` is kept as
// a fallback used before translations are applied; `category` is a CATEGORIES id.
export const EXAMPLES = [
  { i18nKey: "starter", file: "examples/starter.flock", emoji: "👋🏽", category: "start" },
  { i18nKey: "tree_jump", file: "examples/tree_jump.flock", emoji: "🌳", category: "games" },
  { i18nKey: "collect_the_gems", file: "examples/collect_the_gems.flock", emoji: "💎", category: "games" },
  { i18nKey: "candy_dash", file: "examples/candy_dash.flock", emoji: "🎃", category: "games" },
  { i18nKey: "beetle", file: "examples/beetle.flock", emoji: "🪲", category: "games" },
  { i18nKey: "physics_fun", file: "examples/physics_fun.flock", emoji: "👆🏾", category: "physics" },
  { i18nKey: "shape_push", file: "examples/shape_push.flock", emoji: "🔶", category: "physics" },
  { i18nKey: "ball_pit", file: "examples/ball_pit.flock", emoji: "🟠", category: "physics" },
  { i18nKey: "skittles", file: "examples/skittles.flock", emoji: "🎳", category: "physics" },
  { i18nKey: "alien_planet", file: "examples/alien_planet.flock", emoji: "👽", category: "worlds" },
  { i18nKey: "my_place", file: "examples/my_place.flock", emoji: "🏠", category: "worlds" },
  { i18nKey: "forest_base", file: "examples/forest_base.flock", emoji: "🌲", category: "worlds" },
  { i18nKey: "water_map", file: "examples/water_map.flock", emoji: "💧", category: "worlds" },
  { i18nKey: "boat_trip", file: "examples/boat_trip.flock", emoji: "⛵", category: "worlds" },
  { i18nKey: "tent_lights", file: "examples/tent_lights.flock", emoji: "⛺", category: "worlds" },
  { i18nKey: "roominator", file: "examples/roominator.flock", emoji: "🛋️", category: "worlds" },
  { i18nKey: "character_animation", file: "examples/character_animation.flock", emoji: "🎥", category: "create" },
  { i18nKey: "sit_down", file: "examples/sit_down.flock", emoji: "🪑", category: "create" },
  { i18nKey: "cube_art", file: "examples/cube_art.flock", emoji: "🎨", category: "create" },
  { i18nKey: "snow_globe", file: "examples/snow_globe.flock", emoji: "❄️", category: "create" },
  { i18nKey: "ur_enough", file: "examples/ur_enough.flock", emoji: "💗", category: "create" },
  { i18nKey: "flockenspiel", file: "examples/flockenspiel.flock", emoji: "🎵", category: "create" },
  { i18nKey: "tallest_buildings", file: "examples/tallest_buildings.flock", emoji: "📊", category: "create" },
  { i18nKey: "pendant", file: "examples/pendant.flock", emoji: "📿", category: "xr" },
  { i18nKey: "microbit_monkey", file: "examples/microbit_monkey.flock", emoji: "🐵", category: "xr" },
];

let previouslyFocused = null;
let galleryInitialised = false;

function canRestoreFocus(element) {
  if (!element || !element.isConnected) {
    return false;
  }
  let currentElement = element;
  while (currentElement) {
    const style = window.getComputedStyle(currentElement);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    currentElement = currentElement.parentElement;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function createTile(example) {
  // role="option" inside the role="listbox" grid: the reader announces it as
  // an option with its position (e.g. "Starter, 1 of 7"), and roving tabindex
  // (set by focusTile / populateExampleGrid) makes arrow-key navigation the
  // expected, announced behaviour — mirroring the tablist.
  const button = document.createElement("button");
  button.type = "button";
  button.className = "example-tile";
  button.dataset.key = example.i18nKey;
  button.dataset.emoji = example.emoji;
  button.dataset.file = example.file;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", "false");
  button.tabIndex = -1;

  // Name first (the accessible label), emoji after it and aria-hidden so screen
  // readers don't lead with / announce the emoji. localizeTiles() fills the name.
  const name = document.createElement("span");
  name.className = "example-tile-name";
  const emoji = document.createElement("span");
  emoji.className = "example-tile-emoji";
  emoji.setAttribute("aria-hidden", "true");
  emoji.textContent = example.emoji;
  button.append(name, emoji);

  button.addEventListener("click", () => {
    loadExample(example.file, name.textContent.trim());
    hideExampleModal();
  });

  return button;
}

// Set each tile's visible name from its localised label, with the leading
// emoji (which the locale strings bake in) stripped off — the emoji is shown
// separately via the aria-hidden span. Runs on build and on every language
// change (see the "translationsapplied" listener in initExampleGallery).
function localizeTiles() {
  document.querySelectorAll(".example-tile").forEach((tile) => {
    const key = tile.dataset.key;
    const emoji = tile.dataset.emoji || "";
    const full = translate(`${key}_ui`) || key;
    const nameEl = tile.querySelector(".example-tile-name");
    if (nameEl) {
      nameEl.textContent = full.startsWith(emoji)
        ? full.slice(emoji.length).trim()
        : full;
    }
  });
}

// Build the tablist + one tabpanel (grid) per non-empty category, then localise
// all labels. Idempotent.
export function populateExampleGrid() {
  const tablist = document.getElementById("exampleTabs");
  const panels = document.getElementById("examplePanels");
  if (!tablist || !panels || tablist.childElementCount > 0) return;

  const categories = CATEGORIES.filter((cat) =>
    EXAMPLES.some((ex) => ex.category === cat.id),
  );
  if (categories.length === 0) return;

  categories.forEach((cat, index) => {
    const tabId = `exampleTab-${cat.id}`;
    const panelId = `examplePanel-${cat.id}`;
    const isFirst = index === 0;

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "example-tab";
    tab.id = tabId;
    tab.dataset.category = cat.id;
    tab.dataset.i18n = cat.i18nKey;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", isFirst ? "true" : "false");
    tab.tabIndex = isFirst ? 0 : -1;
    tab.textContent = cat.i18nKey;
    tab.addEventListener("click", () => selectTab(cat.id));
    tablist.appendChild(tab);

    // Plain container (no role="tabpanel"/aria-controls): the tabpanel layer
    // only made the reader announce a redundant "<tab name> property page".
    // The listbox below provides the navigable content.
    const panel = document.createElement("div");
    panel.className = "example-panel";
    panel.id = panelId;
    panel.dataset.category = cat.id;
    panel.hidden = !isFirst;

    const grid = document.createElement("div");
    grid.className = "example-grid";
    grid.setAttribute("role", "listbox");
    grid.setAttribute("aria-labelledby", tabId);
    EXAMPLES.filter((ex) => ex.category === cat.id).forEach((ex, i) => {
      const tile = createTile(ex);
      // Roving tabindex: the first option is the listbox's single Tab stop.
      if (i === 0) {
        tile.tabIndex = 0;
        tile.setAttribute("aria-selected", "true");
      }
      grid.appendChild(tile);
    });
    panel.appendChild(grid);
    panels.appendChild(panel);
  });

  applyTranslations(); // localises the tab labels
  localizeTiles(); // fills tile names (emoji stripped, shown after the name)
}

function getActivePanel() {
  return document.querySelector("#examplePanels .example-panel:not([hidden])");
}

// Switch to a category tab: toggle aria-selected / roving tabindex on the tabs
// (tablist uses roving tabindex, the standard pattern) and show its panel.
function selectTab(id, { focusTab = false } = {}) {
  document.querySelectorAll(".example-tab").forEach((tab) => {
    const selected = tab.dataset.category === id;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focusTab) tab.focus();
  });

  document.querySelectorAll(".example-panel").forEach((panel) => {
    panel.hidden = panel.dataset.category !== id;
  });
}

function getTiles() {
  const panel = getActivePanel();
  return panel ? Array.from(panel.querySelectorAll(".example-tile")) : [];
}

// Selection follows focus within the listbox (as it does in the tablist):
// move the roving tabindex and aria-selected onto the focused option.
function focusTile(tile) {
  if (!tile) return;
  getTiles().forEach((t) => {
    const isCurrent = t === tile;
    t.tabIndex = isCurrent ? 0 : -1;
    t.setAttribute("aria-selected", isCurrent ? "true" : "false");
  });
  tile.focus();
  tile.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// Read the live number of columns from the resolved grid template, so arrow
// navigation always matches whatever the responsive auto-fill grid renders.
function getColumnCount() {
  const grid = getActivePanel()?.querySelector(".example-grid");
  if (!grid) return 1;
  const template = getComputedStyle(grid).gridTemplateColumns;
  const count = template ? template.split(" ").filter(Boolean).length : 1;
  return Math.max(1, count);
}

// Move focus within the row-major grid by index: Left/Right step one tile
// (wrapping across rows), Up/Down move one row, landing directly above/below
// when a tile exists there.
function moveFocus(current, key) {
  const tiles = getTiles();
  if (tiles.length === 0) return;
  const index = current ? tiles.indexOf(current) : -1;
  if (index === -1) return focusTile(tiles[0]);

  const cols = getColumnCount();
  let next = index;
  switch (key) {
    case "ArrowRight":
      next = (index + 1) % tiles.length;
      break;
    case "ArrowLeft":
      next = (index - 1 + tiles.length) % tiles.length;
      break;
    case "ArrowDown":
      if (index + cols < tiles.length) next = index + cols;
      break;
    case "ArrowUp":
      if (index - cols >= 0) next = index - cols;
      break;
  }
  focusTile(tiles[next]);
}

// Arrow / Home / End navigation within the tile grid. Enter & Space activate
// the focused tile natively (it's a <button>), so they need no handling here.
function handleGridKeydown(e) {
  const active = document.activeElement;
  const current = active?.classList.contains("example-tile") ? active : null;
  const tiles = getTiles();
  if (tiles.length === 0) return false;

  switch (e.key) {
    case "ArrowUp": {
      e.preventDefault();
      // From the top row, return focus to the active tab.
      const index = current ? tiles.indexOf(current) : -1;
      if (index >= 0 && index < getColumnCount()) {
        getTabs().find((t) => t.getAttribute("aria-selected") === "true")?.focus();
      } else {
        moveFocus(current, e.key);
      }
      break;
    }
    case "ArrowRight":
    case "ArrowLeft":
    case "ArrowDown":
      e.preventDefault();
      moveFocus(current, e.key);
      break;
    case "Home":
      e.preventDefault();
      focusTile(tiles[0]);
      break;
    case "End":
      e.preventDefault();
      focusTile(tiles[tiles.length - 1]);
      break;
    default:
      return false;
  }
  return true;
}

function getTabs() {
  const tablist = document.getElementById("exampleTabs");
  return tablist ? Array.from(tablist.querySelectorAll(".example-tab")) : [];
}

// Tablist keyboard navigation (focus on a tab): Left/Right (and Home/End) move
// between tabs with automatic activation; Down/Up moves focus into the grid.
function handleTabKeydown(e) {
  const tabs = getTabs();
  if (tabs.length === 0) return false;
  const index = tabs.indexOf(document.activeElement);
  if (index === -1) return false;

  switch (e.key) {
    case "ArrowRight":
    case "ArrowLeft": {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + dir + tabs.length) % tabs.length];
      selectTab(next.dataset.category, { focusTab: true });
      break;
    }
    case "Home":
      e.preventDefault();
      selectTab(tabs[0].dataset.category, { focusTab: true });
      break;
    case "End":
      e.preventDefault();
      selectTab(tabs[tabs.length - 1].dataset.category, { focusTab: true });
      break;
    case "ArrowDown":
    case "Enter":
    case " ": {
      e.preventDefault();
      const firstTile = getTiles()[0];
      if (firstTile) focusTile(firstTile);
      break;
    }
    default:
      return false;
  }
  return true;
}

// Anchor the panel directly under the Demo button, clamped to the viewport.
function positionPanel(modal) {
  const trigger = document.getElementById("exampleButton");
  const panel = modal.querySelector(".example-modal-content");
  if (!trigger || !panel) return;

  const margin = 8;
  const gap = 6;
  const rect = trigger.getBoundingClientRect();
  // clientWidth excludes the scrollbar; window.innerWidth / 100vw include it,
  // which otherwise lets the panel spill past the right edge on narrow desktop
  // windows. Cap the panel width to the real content area before measuring.
  const viewportWidth = document.documentElement.clientWidth;
  panel.style.maxWidth = `${viewportWidth - margin * 2}px`;

  panel.style.top = `${rect.bottom + gap}px`;
  // Measure the (now capped) panel width, then keep it on-screen.
  let left = rect.left;
  const panelWidth = panel.offsetWidth;
  if (left + panelWidth + margin > viewportWidth) {
    left = viewportWidth - panelWidth - margin;
  }
  panel.style.left = `${Math.max(margin, left)}px`;
  panel.style.maxHeight = `${window.innerHeight - rect.bottom - gap - margin}px`;
}

export function openExampleModal() {
  const modal = document.getElementById("exampleModal");
  if (!modal) return;

  previouslyFocused = document.activeElement;
  modal.classList.remove("hidden");
  // Containment comes from role="dialog" + the Tab focus trap below, not
  // aria-modal. Toggling aria-modal made NVDA/JAWS announce the returning focus
  // twice on close (once for the focus, once for "left the dialog"); and the
  // .hidden/display:none already removes the background from the a11y flow.
  positionPanel(modal);

  setTimeout(() => {
    const selectedTab = modal.querySelector('.example-tab[aria-selected="true"]');
    if (selectedTab) {
      selectedTab.focus();
    } else {
      document.getElementById("closeExampleModal")?.focus();
    }
  }, 0);
}

export function hideExampleModal() {
  const modal = document.getElementById("exampleModal");
  if (!modal) return;

  // Remove the dialog from the a11y tree first (display:none via .hidden), then
  // move focus, so the screen reader announces the Demo button exactly once.
  modal.classList.add("hidden");

  if (canRestoreFocus(previouslyFocused)) {
    previouslyFocused.focus();
  } else {
    document.getElementById("exampleButton")?.focus();
  }
  previouslyFocused = null;
}

// Wire up the trigger button and the modal's keyboard / click behaviour. Call
// once during init after the DOM exists.
export function initExampleGallery() {
  const modal = document.getElementById("exampleModal");
  const trigger = document.getElementById("exampleButton");
  const closeButton = document.getElementById("closeExampleModal");
  if (!modal || !trigger) return;
  // Idempotent: a second call must not stack duplicate listeners.
  if (galleryInitialised) return;
  galleryInitialised = true;

  populateExampleGrid();

  // Re-localise tile names when the language changes.
  document.addEventListener("translationsapplied", localizeTiles);

  trigger.addEventListener("click", openExampleModal);
  closeButton?.addEventListener("click", hideExampleModal);

  // Escape to close + trap Tab focus within the modal (mirrors the About modal).
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      hideExampleModal();
    } else if (
      document.activeElement?.classList.contains("example-tab") &&
      handleTabKeydown(e)
    ) {
      // Arrow / Home / End / Enter handled by the tablist.
    } else if (handleGridKeydown(e)) {
      // Arrow / Home / End handled by the grid.
    } else if (e.key === "Tab") {
      // Only genuinely tabbable, visible elements: roving tabindex parks most
      // tabs/tiles at -1, and hidden panels' tiles have no layout box.
      const focusable = Array.from(
        modal.querySelectorAll(
          'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.tabIndex !== -1 && el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Keep the panel anchored and on-screen if the window is resized while open.
  window.addEventListener("resize", () => {
    if (!modal.classList.contains("hidden")) {
      positionPanel(modal);
    }
  });

  // Click on the backdrop (outside the content) closes the modal.
  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      hideExampleModal();
    }
  });
}
