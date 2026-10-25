import * as Blockly from 'blockly';

// Remembers the last main-workspace block/comment focused via Tab, so leaving
// the workspace for the same-tree trashcan (which drops Blockly's passive focus)
// can still return there.
let remembered = null;

export function isRestorableWorkspaceNode(node) {
  const el = node?.getFocusableElement?.();
  return (
    !!el?.isConnected &&
    !!el.closest?.('g.blocklyDraggable, g.blocklyComment') &&
    !el.closest?.('.blocklyFlyout')
  );
}

export function rememberWorkspaceFocus() {
  const node = Blockly.getFocusManager?.()?.getFocusedNode?.();
  if (isRestorableWorkspaceNode(node)) remembered = node;
}

export function focusRememberedWorkspaceNode() {
  const focusManager = Blockly.getFocusManager?.();
  if (!focusManager || !isRestorableWorkspaceNode(remembered)) return false;
  Blockly.keyboardNavigationController?.setIsActive?.(true);
  focusManager.focusNode(remembered);
  return true;
}
