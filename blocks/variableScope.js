import * as Blockly from 'blockly';

const PROCEDURE_DEFINITION_TYPES = new Set([
  'procedures_defnoreturn',
  'procedures_defreturn',
  'procedures_defprefab',
]);

function procedureParamIds(block) {
  if (!PROCEDURE_DEFINITION_TYPES.has(block.type)) return [];
  return (block.argData_ ?? []).map((arg) => arg.model.getId());
}

function paramIdsInScope(block) {
  const ids = new Set();
  for (
    let ancestor = block.getSurroundParent();
    ancestor;
    ancestor = ancestor.getSurroundParent()
  ) {
    procedureParamIds(ancestor).forEach((id) => ids.add(id));
  }
  return ids;
}

export function paramOnlyVariableIds(workspace) {
  const blocks = workspace.getAllBlocks(false);
  const ids = new Set(blocks.flatMap(procedureParamIds));
  if (!ids.size) return ids;
  for (const block of blocks) {
    const usedIds = [...block.getFields()]
      .filter((field) => field instanceof Blockly.FieldVariable && ids.has(field.getValue()))
      .map((field) => field.getValue());
    if (!usedIds.length) continue;
    const scope = paramIdsInScope(block);
    usedIds.filter((id) => !scope.has(id)).forEach((id) => ids.delete(id));
  }
  return ids;
}

export function outOfScopeParamIds(block) {
  if (!block?.workspace || block.isInFlyout || block.isDeadOrDying()) return new Set();
  const hidden = paramOnlyVariableIds(block.workspace);
  paramIdsInScope(block).forEach((id) => hidden.delete(id));
  return hidden;
}

function variableNameOptions(block, keepName) {
  const workspace = block?.workspace;
  if (!workspace) return [];
  const hidden = outOfScopeParamIds(block);
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
