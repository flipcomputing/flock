import * as Blockly from 'blockly';

const NON_OBJECT_TYPES = new Set(['create_ground', 'create_map']);
const OBJECT_NAME_FIELDS = {
  clone_mesh: 'CLONE_VAR',
  merge_meshes: 'RESULT_VAR',
  subtract_meshes: 'RESULT_VAR',
  embed_meshes: 'RESULT_VAR',
  intersection_meshes: 'RESULT_VAR',
  hull_meshes: 'RESULT_VAR',
  combine: 'RESULT_VAR',
  mirror_mesh: 'ID_VAR',
};
const DEFAULT_OBJECT_NAME = 'object';
const CHARACTER_TYPE = 'load_character';
const MAX_RECENT_OBJECTS = 8;

let recentObjects = [];
let recentWorkspace = null;

function variableNameSet(workspace) {
  const variables = workspace?.getVariableMap?.().getAllVariables?.() ?? [];
  return new Set(variables.map((variable) => variable.getName?.() ?? variable.name).map(lower));
}

function lower(name) {
  return String(name ?? '').toLowerCase();
}

export function lowestFreeName(workspace, prefix, start = 1) {
  const taken = variableNameSet(workspace);
  let n = Math.max(1, start);
  while (taken.has(lower(`${prefix}${n}`))) n += 1;
  return `${prefix}${n}`;
}

export function nextVariableName(block, prefix) {
  const workspace = block?.workspace;
  return lowestFreeName(workspace?.targetWorkspace ?? workspace, prefix);
}

function objectNameField(block) {
  if (!block?.type) return null;
  if (OBJECT_NAME_FIELDS[block.type]) return OBJECT_NAME_FIELDS[block.type];
  const isCreator = block.type.startsWith('create_') || block.type.startsWith('load_');
  if (!isCreator || NON_OBJECT_TYPES.has(block.type)) return null;
  return 'ID_VAR';
}

function objectEntry(block) {
  const fieldName = objectNameField(block);
  const varId = fieldName ? block.getField(fieldName)?.getValue?.() : null;
  return varId ? { varId, type: block.type } : null;
}

function resolvedRecentObjects() {
  const variableMap = recentWorkspace?.getVariableMap?.();
  if (!variableMap) return [];
  return recentObjects
    .map((entry) => ({ ...entry, name: variableMap.getVariableById(entry.varId)?.getName() }))
    .filter((entry) => entry.name);
}

function refreshCurrentMesh() {
  window.currentMesh = resolvedRecentObjects()[0]?.name ?? DEFAULT_OBJECT_NAME;
}

function remember(entry) {
  recentObjects = [entry, ...recentObjects.filter((e) => e.varId !== entry.varId)].slice(
    0,
    MAX_RECENT_OBJECTS
  );
}

export function rememberObjectBlock(block) {
  if (!block || block.isInFlyout || block.isDisposed?.()) return;
  const entry = objectEntry(block);
  if (!entry) return;
  recentWorkspace = block.workspace;
  remember(entry);
  refreshCurrentMesh();
}

function declaredObjectVarIds(workspace) {
  const ids = new Set();
  for (const block of workspace.getAllBlocks(false)) {
    const entry = objectEntry(block);
    if (entry) ids.add(entry.varId);
  }
  return ids;
}

function forgetMissingObjects(workspace) {
  if (!recentObjects.length) return;
  const declared = declaredObjectVarIds(workspace);
  recentObjects = recentObjects.filter((entry) => declared.has(entry.varId));
  refreshCurrentMesh();
}

function resetRecentObjects(workspace) {
  recentWorkspace = workspace;
  recentObjects = [];
  const entries = workspace.getAllBlocks(true).map(objectEntry).filter(Boolean);
  entries.slice(-MAX_RECENT_OBJECTS).forEach(remember);
  refreshCurrentMesh();
}

export function otherObjectName(fallback) {
  return resolvedRecentObjects()[1]?.name ?? fallback;
}

export function objectAndCharacterTarget(objectFallback, targetFallback) {
  const [first, ...others] = resolvedRecentObjects();
  if (!first) return { object: objectFallback, target: targetFallback };
  if (first.type === CHARACTER_TYPE) {
    return { object: others[0]?.name ?? objectFallback, target: first.name };
  }
  const target = others.find((entry) => entry.type === CHARACTER_TYPE) ?? others[0];
  return { object: first.name, target: target?.name ?? targetFallback };
}

export function handleRecentObjectEvent(event) {
  const workspace = Blockly.Workspace.getById(event.workspaceId);
  if (!workspace || workspace.isFlyout) return;

  switch (event.type) {
    case Blockly.Events.SELECTED:
      rememberObjectBlock(workspace.getBlockById(event.newElementId));
      break;
    case Blockly.Events.BLOCK_DELETE:
      if (!window.loadingCode) forgetMissingObjects(workspace);
      break;
    case Blockly.Events.VAR_RENAME:
    case Blockly.Events.VAR_DELETE:
      refreshCurrentMesh();
      break;
    case Blockly.Events.FINISHED_LOADING:
      resetRecentObjects(workspace);
      break;
  }
}
