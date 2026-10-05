import * as Blockly from 'blockly';

const PROCEDURE_DEFINITION_TYPES = new Set([
  'procedures_defnoreturn',
  'procedures_defreturn',
  'procedures_defprefab',
]);
const DECLARING_FIELDS = ['ID_VAR', 'CLONE_VAR'];
const LOCAL_BLOCK_TYPE = 'local_variable';
const LOOP_TYPES = new Set(['controls_for', 'controls_forEach']);
const WRITING_FIELDS = { variables_set: ['VAR'], math_change: ['VAR'] };

function procedureParamIds(block) {
  if (!PROCEDURE_DEFINITION_TYPES.has(block.type)) return [];
  return (block.argData_ ?? []).map((arg) => arg.model.getId());
}

function variableFieldIds(block, names) {
  const fields = names ? names.map((name) => block.getField(name)) : [...block.getFields()];
  return fields
    .filter((field) => field instanceof Blockly.FieldVariable && field.getValue())
    .map((field) => field.getValue());
}

function declaredVariableIds(block) {
  return variableFieldIds(block, DECLARING_FIELDS);
}

function localBlockVariableIds(block) {
  if (block.type !== LOCAL_BLOCK_TYPE) return [];
  const id = block.getFieldValue('VAR');
  return id ? [id] : [];
}

function scopedVariableIds(block) {
  if (block.type === LOCAL_BLOCK_TYPE) return localBlockVariableIds(block);
  if (LOOP_TYPES.has(block.type)) {
    const id = block.getFieldValue('VAR');
    return id ? [id] : [];
  }
  if (!PROCEDURE_DEFINITION_TYPES.has(block.type)) return [];
  const body = block.getInputTargetBlock('STACK')?.getDescendants(false) ?? [];
  return [...procedureParamIds(block), ...body.flatMap(declaredVariableIds)];
}

function coversChild(ancestor, child) {
  return !child || !LOOP_TYPES.has(ancestor.type) || child !== ancestor.getNextBlock();
}

function idsInScope(block, scopeOf = scopedVariableIds) {
  const ids = new Set();
  for (
    let child = null, ancestor = block;
    ancestor;
    child = ancestor, ancestor = ancestor.getParent()
  ) {
    if (coversChild(ancestor, child)) scopeOf(ancestor).forEach((id) => ids.add(id));
  }
  return ids;
}

function alwaysLocalVariableIds(block) {
  if (PROCEDURE_DEFINITION_TYPES.has(block.type)) return procedureParamIds(block);
  if (block.type === LOCAL_BLOCK_TYPE || LOOP_TYPES.has(block.type)) {
    return scopedVariableIds(block);
  }
  return [];
}

function writtenVariableIds(block) {
  return variableFieldIds(block, [...DECLARING_FIELDS, ...(WRITING_FIELDS[block.type] ?? [])]);
}

function analyseScopes(workspace) {
  const blocks = workspace.getAllBlocks(false);
  const scopes = new Map(
    blocks.map((block) => [block, scopedVariableIds(block)]).filter(([, ids]) => ids.length)
  );
  const local = new Set([...scopes.values()].flat());
  const declaredLocal = new Set(blocks.flatMap(alwaysLocalVariableIds));
  const outsideReads = new Map();
  for (const block of blocks) {
    const usedIds = variableFieldIds(block).filter((id) => local.has(id));
    if (!usedIds.length) continue;
    const scope = idsInScope(block, (ancestor) => scopes.get(ancestor) ?? []);
    const written = writtenVariableIds(block);
    for (const id of usedIds.filter((used) => !scope.has(used))) {
      if (declaredLocal.has(id) && !written.includes(id)) {
        outsideReads.set(block, [...(outsideReads.get(block) ?? []), id]);
      } else {
        local.delete(id);
      }
    }
  }
  for (const [block, ids] of outsideReads) {
    const unavailable = ids.filter((id) => local.has(id));
    if (unavailable.length) outsideReads.set(block, unavailable);
    else outsideReads.delete(block);
  }
  return { local, outsideReads };
}

export function localVariableIds(workspace) {
  return analyseScopes(workspace).local;
}

export function unavailableVariableUses(workspace) {
  return analyseScopes(workspace).outsideReads;
}

export function outOfScopeLocalIds(block) {
  if (!block?.workspace || block.isInFlyout || block.isDeadOrDying()) return new Set();
  const hidden = localVariableIds(block.workspace);
  idsInScope(block).forEach((id) => hidden.delete(id));
  return hidden;
}

export function procedureLocalVariables(definition) {
  const local = localVariableIds(definition.workspace);
  procedureParamIds(definition).forEach((id) => local.delete(id));
  for (let block = definition.getInputTargetBlock('STACK'); block; block = block.getNextBlock()) {
    localBlockVariableIds(block).forEach((id) => local.delete(id));
  }
  const variableMap = definition.workspace.getVariableMap();
  return [...new Set(scopedVariableIds(definition))]
    .filter((id) => local.has(id))
    .map((id) => variableMap.getVariableById(id))
    .filter(Boolean);
}

function variableNameOptions(block, keepName) {
  const workspace = block?.workspace;
  if (!workspace) return [];
  const hidden = outOfScopeLocalIds(block);
  return workspace
    .getVariableMap()
    .getAllVariables()
    .filter((variable) => variable.name === keepName || !hidden.has(variable.getId()))
    .map((variable) => [variable.name, variable.name]);
}

export class VariableNameDropdown extends Blockly.FieldDropdown {
  constructor(fixedOptions) {
    super(function () {
      return [
        ...fixedOptions(),
        ...variableNameOptions(this.getSourceBlock(), this.candidateValue_ ?? this.getValue()),
      ];
    });
    this.candidateValue_ = null;
  }

  doClassValidation_(newValue) {
    this.candidateValue_ = newValue;
    try {
      this.getOptions(false);
      return super.doClassValidation_(newValue);
    } finally {
      this.candidateValue_ = null;
    }
  }
}
