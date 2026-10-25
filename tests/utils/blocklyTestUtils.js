import * as Blockly from 'blockly';

const previousMainWorkspaces = new WeakMap();

export function injectTestWorkspace(container, options) {
  const previous = Blockly.getMainWorkspace();
  const workspace = Blockly.inject(container, options);
  previousMainWorkspaces.set(workspace, previous);
  return workspace;
}

export function disposeTestWorkspace(workspace) {
  if (!workspace) return;
  const previous = previousMainWorkspaces.get(workspace);
  workspace.dispose();
  Blockly.common.setMainWorkspace(previous ?? new Blockly.Workspace());
}
