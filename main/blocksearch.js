import * as Blockly from 'blockly';

// Shared by the toolbox search flyout, the mobile search overlay and the
// add-block-by-name field, so one query gives the same answers everywhere.
// The index is built by overrideSearchPlugin (blocklyinit.js), which exposes
// the builder as workspace.flockBuildSearchIndex.

export const compactSearchMediaQuery =
  '(max-width: 768px), (max-width: 899px) and (pointer: coarse)';

export const isCompactSearchLayout = () => window.matchMedia(compactSearchMediaQuery).matches;

export function ensureBlockSearchIndex(workspace) {
  if (!workspace) return null;
  if (!Array.isArray(workspace.flockSearchIndexedBlocks)) {
    workspace.flockBuildSearchIndex?.();
  }
  return Array.isArray(workspace.flockSearchIndexedBlocks)
    ? workspace.flockSearchIndexedBlocks
    : null;
}

// Variable fields name the user's own variables, and an image field's value is
// its src — indexing an inline SVG icon makes every block carrying one match
// "box" (from `viewBox`), "path" or "svg".
export function indexesFieldValues(field) {
  return !(field instanceof Blockly.FieldVariable) && !(field instanceof Blockly.FieldImage);
}

export function getBlockSearchLabel(workspace, blockDefOrType) {
  const type = typeof blockDefOrType === 'string' ? blockDefOrType : blockDefOrType?.type;
  if (!type) return '';
  return (
    workspace?.flockBlockLabelMap?.get(type) ||
    type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

// Ranking tiers, best first. An exactly typed keyword or label wins outright so
// the keywords people already know still land on the block they expect.
function scoreMatch(def, query, label) {
  if (!def?.type) return 9;
  const keyword = (def.keyword || '').toLowerCase();
  const type = def.type.toLowerCase();
  if (keyword === query || label === query) return 0;
  if (keyword.startsWith(query)) return 1;
  if (label.startsWith(query)) return 2;
  if (label.includes(query)) return 3;
  if (type.includes(query)) return 4;
  return 5;
}

export function matchBlockDefinitions(workspace, rawQuery) {
  const query = (rawQuery || '').toLowerCase().trim();
  if (!query) return [];

  const index = ensureBlockSearchIndex(workspace);
  if (!index) return [];

  const labelOf = (def) => getBlockSearchLabel(workspace, def).toLowerCase();

  const seenTypes = new Set();
  return index
    .filter((b) => b.text && b.text.includes(query))
    .map((b) => b.full)
    .filter((def) => def?.type && !seenTypes.has(def.type) && seenTypes.add(def.type))
    .sort((a, b) => scoreMatch(a, query, labelOf(a)) - scoreMatch(b, query, labelOf(b)));
}

const categoryMaps = new WeakMap();

function resolveCategoryColour(workspace, categorystyle) {
  if (!categorystyle) return null;
  let themeColour = workspace.getTheme?.()?.categoryStyles?.[categorystyle]?.colour;
  if (themeColour === undefined || themeColour === null) return null;
  if (
    typeof themeColour === 'string' &&
    themeColour.startsWith('%{BKY_') &&
    themeColour.endsWith('}')
  ) {
    const key = themeColour.slice(6, -1);
    themeColour = Blockly.Msg?.[key] ?? themeColour;
  }
  if (typeof themeColour === 'string' && themeColour.startsWith('#')) return themeColour;
  const hue = parseFloat(themeColour);
  if (isNaN(hue)) return null;
  return Blockly.utils.colour.hueToHex(hue);
}

function resolveCategoryName(name) {
  if (!name?.startsWith('%{BKY_') || !name.endsWith('}')) return name;
  const key = name.slice(6, -1);
  return (
    Blockly.Msg?.[key] ||
    key
      .replace(/^CATEGORY_/, '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^./, (c) => c.toUpperCase())
  );
}

export function rebuildBlockCategoryMap(workspace, toolboxDef) {
  const map = new Map();
  const walk = (node, categoryName, categoryColour) => {
    if (!node) return;
    if (node.kind === 'block' && node.type && !map.has(node.type)) {
      map.set(node.type, { name: categoryName, color: categoryColour });
    }
    if (node.contents) {
      const name = resolveCategoryName(node.name || categoryName);
      const colour = node.categorystyle
        ? (resolveCategoryColour(workspace, node.categorystyle) ?? categoryColour)
        : categoryColour;
      node.contents.forEach((child) => walk(child, name, colour));
    }
  };
  walk(toolboxDef, '', null);
  categoryMaps.set(workspace, map);
  return map;
}

export function getBlockCategoryInfo(workspace, type) {
  return categoryMaps.get(workspace)?.get(type) ?? { name: '', color: null };
}
