import * as Blockly from 'blockly';

// Moves keyboard focus into the toolbox. Blockly's FocusManager restores the
// last-visited item (a category or the search box) when the toolbox root
// gains focus; on first use there is nothing to restore and focus falls
// through, so land on the first real category instead of the search box.
export function focusToolboxRestoringCategory(workspace = Blockly.getMainWorkspace()) {
  Blockly.keyboardNavigationController?.setIsActive(true);
  const toolbox = workspace?.getToolbox?.();
  if (!toolbox) return false;

  const hasHistory = !!(toolbox.getSelectedItem?.() || toolbox.getPreviouslySelectedItem?.());
  if (hasHistory) {
    const root = toolbox.HtmlDiv || document.querySelector('.blocklyToolboxDiv');
    root?.focus();
    if (root?.contains(document.activeElement)) return true;
  }

  const SearchCategory = Blockly.registry.getClass(Blockly.registry.Type.TOOLBOX_ITEM, 'search');
  const isSearchItem = (item) => {
    if (!item) return false;
    const def = item.getToolboxItemDef?.() || item.toolboxItemDef;
    const kind = (def?.kind || '').toLowerCase();
    return (SearchCategory && item instanceof SearchCategory) || kind === 'search';
  };

  const target = (toolbox.getToolboxItems?.() || []).find((item) => {
    const def = item.getToolboxItemDef?.() || item.toolboxItemDef;
    const kind = (def?.kind || '').toLowerCase();
    if (isSearchItem(item) || kind === 'sep' || kind === 'label') {
      return false;
    }
    return typeof item.isSelectable === 'function' ? item.isSelectable() : true;
  });
  if (!target) return false;

  const focusManager = Blockly.getFocusManager?.();
  focusManager?.focusTree?.(toolbox);
  toolbox.setSelectedItem?.(target);
  focusManager?.focusNode?.(target);
  return true;
}
