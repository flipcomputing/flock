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
  if (typeof blockDefOrType !== 'string' && blockDefOrType?.searchLabel) {
    return blockDefOrType.searchLabel;
  }
  const type = typeof blockDefOrType === 'string' ? blockDefOrType : blockDefOrType?.type;
  if (!type) return '';
  return (
    workspace?.flockBlockLabelMap?.get(type) ||
    type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

// The blocks that work on one variable, in the order the Variables flyout
// lists them. Their shadow values come from the toolbox entries, so the two
// surfaces stay in step.
const VARIABLE_BLOCK_TYPES = ['variables_set', 'math_change', 'variables_get'];
// Only the getter is rounded, so it is all a value socket can take.
const VARIABLE_VALUE_BLOCK_TYPES = ['variables_get'];
const VARIABLE_BLOCK_MESSAGES = {
  variables_set: 'VARIABLES_SET',
  math_change: 'MATH_CHANGE_TITLE',
};
function variableBlockLabel(type, name) {
  const message = Blockly.Msg[VARIABLE_BLOCK_MESSAGES[type]];
  return message ? message.replace('%1', name).replace('%2', '( )').trim() : name;
}

function variableName(variable) {
  return variable.getName?.() ?? variable.name ?? '';
}

function variableRank(variable, query) {
  const name = variableName(variable).toLowerCase();
  if (name === query) return 0;
  return name.startsWith(query) ? 1 : 2;
}

// A set/change/get trio for the closest matching variable, so a variable can be
// reached by its own name instead of by the generic block names. Only the one
// variable: typing "box" should reach box1, not fill the list with box2 and
// box3 as well.
function variableBlockDefinitions(workspace, query, index, types) {
  const variables = workspace.getVariableMap?.()?.getAllVariables?.() ?? [];
  const [variable] = variables
    .filter((candidate) => variableName(candidate).toLowerCase().includes(query))
    .sort(
      (a, b) =>
        variableRank(a, query) - variableRank(b, query) ||
        variableName(a).length - variableName(b).length
    );
  if (!variable) return [];

  const name = variableName(variable);
  return types
    .map((type) => index.find((entry) => entry.type === type)?.full)
    .filter(Boolean)
    .map((template) => ({
      ...template,
      keyword: name,
      searchLabel: variableBlockLabel(template.type, name),
      fields: { ...template.fields, VAR: { name, type: variable.getType?.() ?? '' } },
    }));
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

// Value mode offers only blocks the target socket would accept. `outputCheck`
// is the socket's own check: null accepts anything, and so does a block whose
// output is untyped, matching Blockly's own connection checker.
function fitsSocket(entry, outputCheck) {
  const check = entry.outputCheck;
  if (check === undefined || check === false) return false;
  if (check === null || outputCheck === null) return true;
  return check.some((type) => outputCheck.includes(type));
}

export function matchBlockDefinitions(workspace, rawQuery, options = {}) {
  const query = (rawQuery || '').toLowerCase().trim();
  if (!query) return [];

  const index = ensureBlockSearchIndex(workspace);
  if (!index) return [];

  const valueOnly = options.valueOnly === true;
  const outputCheck = options.outputCheck ?? null;

  const labelOf = (def) => getBlockSearchLabel(workspace, def).toLowerCase();
  // Variable blocks are one per variable, so the type alone is not unique.
  const keyOf = (def) => `${def.type}|${def.fields?.VAR?.name ?? ''}`;

  const seenKeys = new Set();
  return [
    ...variableBlockDefinitions(
      workspace,
      query,
      index,
      valueOnly ? VARIABLE_VALUE_BLOCK_TYPES : VARIABLE_BLOCK_TYPES
    ),
    ...index
      .filter((b) => b.text && b.text.includes(query) && (!valueOnly || fitsSocket(b, outputCheck)))
      .map((b) => b.full),
  ]
    .filter((def) => def?.type && !seenKeys.has(keyOf(def)) && seenKeys.add(keyOf(def)))
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
