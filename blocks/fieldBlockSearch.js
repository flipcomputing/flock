import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';
import {
  matchBlockDefinitions,
  getBlockSearchLabel,
  getBlockCategoryInfo,
  isCompactSearchLayout,
} from '../main/blocksearch.js';

const LISTBOX_ID = 'block-search-listbox';
const OPTION_ID_PREFIX = 'block-search-option-';
const MAX_LIST_RESULTS = 50;
const MAX_FLYOUT_RESULTS = 12;
const FLYOUT_GAP = 4;
const FLYOUT_MAX_HEIGHT_FRACTION = 0.5;
const FLYOUT_MIN_HEIGHT = 120;
const SCROLLBAR_ALLOWANCE = 18;
const SEARCH_FONT_SIZE = 14; // matches the toolbox search input

// One flyout per workspace, reused by every keyword block on it.
function getPickerFlyout(workspace) {
  if (workspace.flockPickerFlyout) return workspace.flockPickerFlyout;

  const FlyoutClass = Blockly.registry.getClassFromOptions(
    Blockly.registry.Type.FLYOUTS_VERTICAL_TOOLBOX,
    workspace.options,
    true
  );
  if (!FlyoutClass) return null;

  const flyout = new FlyoutClass(workspace.copyOptionsForFlyout());
  flyout.autoClose = false;
  // Blockly's own position() docks the flyout to the workspace edge at full
  // height; this one is placed against the field instead (positionFlyout_).
  flyout.position = () => {};

  // Every scroll of this workspace — wheel, scrollbar drag, keyboard — would
  // otherwise hideChaff() and close the field editor driving the picker, and
  // Blockly's own wheel_ hides the widget div outright. Both have to be in
  // place before init(), which binds the wheel handler.
  const flyoutWorkspace = flyout.getWorkspace();
  flyoutWorkspace.hideChaff = () => {};
  flyout.wheel_ = (event) => {
    const delta = Blockly.browserEvents.getScrollDeltaPixels(event);
    if (delta.y) {
      const metricsManager = flyoutWorkspace.getMetricsManager();
      const y =
        metricsManager.getViewMetrics().top - metricsManager.getScrollMetrics().top + delta.y;
      flyoutWorkspace.scrollbar?.setY(y);
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const svg = flyout.createDom(Blockly.utils.Svg.SVG);
  svg.classList.add('block-search-flyout');
  // positionAt_ translates from the element's static position, so anchor the
  // flyout at the injection div's corner before Blockly starts moving it.
  svg.style.left = '0';
  svg.style.top = '0';
  const injectionDiv = workspace.getInjectionDiv();
  injectionDiv.insertBefore(svg, injectionDiv.firstChild);
  flyout.init(workspace);

  // Claim the click before the flyout's own handler turns it into a
  // drag-a-block-out gesture.
  svg.addEventListener(
    'pointerdown',
    (event) => {
      const field = flyout.flockPickerField;
      const index = field?.flyoutBlockIndexAt_(event.target);
      if (index === undefined || index === -1) return;
      event.preventDefault();
      event.stopPropagation();
      field.accept_(field.results_[index]);
    },
    true
  );

  workspace.flockPickerFlyout = flyout;
  return flyout;
}

// Text field with an inline block picker: typing filters the toolbox with the
// same matcher the toolbox search uses, arrow keys move through the results and
// Enter swaps the block. The source block supplies onBlockSearchSelect(def) and
// may narrow the results with getBlockSearchOptions().
// Wide screens get real blocks in a flyout, narrow ones a text list.
export class FieldBlockSearch extends Blockly.FieldTextInput {
  constructor(value, validator, config) {
    super(value, validator, config);
    this.results_ = [];
    this.activeIndex_ = -1;
    this.popup_ = null;
    this.listbox_ = null;
    this.status_ = null;
    this.flyout_ = null;
    this.boundInput_ = null;
    this.keyHost_ = null;
  }

  getText_() {
    return this.getValue() || translate('block_search_prompt');
  }

  usesFlyout_() {
    return !isCompactSearchLayout();
  }

  widgetCreate_() {
    // The floating block toolbar hovers exactly where the picker opens.
    window.flockBlockToolbar?.hide?.();
    const input = super.widgetCreate_();
    input.value = '';
    input.placeholder = translate('block_search_placeholder');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-label', translate('block_search_label'));
    input.setAttribute('autocomplete', 'off');
    // Blockly centres field editors and sizes them for block text; this one
    // should read like the toolbox search box.
    input.classList.add('block-search-input');
    input.style.fontSize = `${SEARCH_FONT_SIZE}px`;
    return input;
  }

  bindInputEvents_(input) {
    super.bindInputEvents_(input);
    this.boundInput_ = input;
    this.onSearchKeyDown_ = (event) => this.handleKeyDown_(event);
    this.onSearchInput_ = () => this.updateResults_();
    // Keys are captured on the widget div, not the input: a capture listener on
    // the input itself would still run after the base field's own keydown
    // handler (both are AT_TARGET, so registration order wins), leaving no way
    // to take Enter/Escape/Tab while the picker is open.
    this.keyHost_ = input.parentElement || input;
    this.keyHost_.addEventListener('keydown', this.onSearchKeyDown_, true);
    input.addEventListener('input', this.onSearchInput_);
  }

  unbindInputEvents_() {
    this.keyHost_?.removeEventListener('keydown', this.onSearchKeyDown_, true);
    this.keyHost_ = null;
    if (this.boundInput_) {
      this.boundInput_.removeEventListener('input', this.onSearchInput_);
      this.boundInput_ = null;
    }
    super.unbindInputEvents_();
  }

  widgetDispose_() {
    this.closePicker_();
    super.widgetDispose_();
  }

  getWorkspace_() {
    return this.getSourceBlock()?.workspace ?? null;
  }

  updateResults_() {
    const input = this.htmlInput_;
    if (!input) return;

    const query = input.value.trim();
    if (!query) {
      this.closePicker_();
      return;
    }

    const workspace = this.getWorkspace_();
    const limit = this.usesFlyout_() ? MAX_FLYOUT_RESULTS : MAX_LIST_RESULTS;
    // A picker in a value socket narrows the results to what fits it.
    const options = this.getSourceBlock()?.getBlockSearchOptions?.() ?? {};
    this.results_ = workspace
      ? matchBlockDefinitions(workspace, query, options).slice(0, limit)
      : [];
    this.activeIndex_ = this.results_.length ? 0 : -1;

    window.flockBlockToolbar?.hide?.();
    if (this.usesFlyout_()) {
      this.renderFlyout_();
    } else {
      this.renderList_();
    }
  }

  isOpen_() {
    return this.results_.length > 0 && Boolean(this.flyout_ || this.popup_);
  }

  handleKeyDown_(event) {
    const consume = () => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    switch (event.key) {
      case 'ArrowDown':
        if (!this.isOpen_()) return;
        consume();
        this.setActiveOption_(this.activeIndex_ + 1);
        return;
      case 'ArrowUp':
        if (!this.isOpen_()) return;
        consume();
        this.setActiveOption_(this.activeIndex_ - 1);
        return;
      case 'Enter':
      case 'Tab': {
        if (!this.isOpen_()) return;
        const def = this.results_[this.activeIndex_];
        if (!def) return;
        consume();
        this.accept_(def);
        return;
      }
      case 'Escape':
        // First Escape dismisses the picker; a second one closes the editor.
        if (!this.flyout_ && !this.popup_) return;
        consume();
        this.closePicker_();
        return;
      default:
    }
  }

  accept_(definition) {
    const block = this.getSourceBlock();
    this.closePicker_();
    Blockly.WidgetDiv.hide();
    block?.onBlockSearchSelect?.(definition);
  }

  closePicker_() {
    this.hideFlyout_();
    this.popup_?.remove();
    this.popup_ = null;
    this.listbox_ = null;
    this.status_?.remove();
    this.status_ = null;
    this.results_ = [];
    this.activeIndex_ = -1;
    const input = this.htmlInput_ || this.boundInput_;
    input?.setAttribute('aria-expanded', 'false');
    input?.removeAttribute('aria-activedescendant');
    input?.removeAttribute('aria-controls');
  }

  setStatus_(text) {
    const status = this.ensureStatus_();
    if (status.textContent !== text) status.textContent = text;
  }

  announceCount_() {
    if (!this.results_.length) {
      this.setStatus_(translate('search_no_matching'));
      return;
    }
    const countKey = this.results_.length === 1 ? 'block_search_result' : 'block_search_results';
    this.setStatus_(`${this.results_.length} ${translate(countKey)}`);
  }

  ensureStatus_() {
    if (this.status_?.isConnected) return this.status_;

    const status = document.createElement('div');
    status.className = 'block-search-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    if (this.popup_) {
      this.popup_.appendChild(status);
    } else {
      status.classList.add('block-search-status-offscreen');
      document.body.appendChild(status);
    }
    this.status_ = status;
    return status;
  }

  setActiveOption_(index) {
    if (!this.results_.length) return;
    const count = this.results_.length;
    this.activeIndex_ = ((index % count) + count) % count;
    if (this.flyout_) {
      this.highlightFlyoutBlock_();
    } else {
      this.highlightListOption_();
    }
  }

  getFlyoutBlocks_() {
    return (this.flyout_?.getContents() ?? [])
      .filter((item) => item.getType() === 'block')
      .map((item) => item.getElement());
  }

  flyoutBlockIndexAt_(target) {
    return this.getFlyoutBlocks_().findIndex((block) => block.getSvgRoot()?.contains(target));
  }

  renderFlyout_() {
    const workspace = this.getWorkspace_();
    const input = this.htmlInput_;
    if (!workspace || !input) return;

    if (!this.results_.length) {
      this.hideFlyout_();
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      this.announceCount_();
      return;
    }

    const flyout = getPickerFlyout(workspace);
    if (!flyout) {
      this.renderList_();
      return;
    }

    this.flyout_ = flyout;
    flyout.flockPickerField = this;
    // show() writes into the definitions it is given (enabled, disabledReasons,
    // x/y), and they are the live toolbox schema objects.
    flyout.show(this.results_.map((def) => structuredClone(def)));
    this.positionFlyout_();

    const canvas = flyout.getWorkspace().getCanvas();
    if (canvas && !canvas.id) canvas.id = 'block-search-flyout-listbox';
    if (canvas?.id) input.setAttribute('aria-controls', canvas.id);
    input.setAttribute('aria-expanded', 'true');

    this.highlightFlyoutBlock_();
    this.announceCount_();
  }

  positionFlyout_() {
    const flyout = this.flyout_;
    const workspace = this.getWorkspace_();
    const input = this.htmlInput_;
    if (!flyout || !workspace || !input) return;

    const injectionRect = workspace.getInjectionDiv().getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();

    // getHeight() is the docked column height, not the content's, so measure
    // the blocks themselves to size a free-floating flyout.
    const flyoutWorkspace = flyout.getWorkspace();
    const contentBox = flyoutWorkspace.getBlocksBoundingBox();
    const contentHeight =
      (contentBox.getHeight?.() ?? contentBox.bottom - contentBox.top) * flyoutWorkspace.scale +
      2 * flyout.MARGIN;

    // Stay attached to the field: take whichever side has more room and shrink
    // to fit it rather than jumping to the far edge of the workspace.
    const wanted = Math.min(contentHeight, injectionRect.height * FLYOUT_MAX_HEIGHT_FRACTION);
    const spaceBelow = injectionRect.bottom - inputRect.bottom - FLYOUT_GAP;
    const spaceAbove = inputRect.top - injectionRect.top - FLYOUT_GAP;
    const opensBelow = spaceBelow >= wanted || spaceBelow >= spaceAbove;
    const height = Math.max(
      FLYOUT_MIN_HEIGHT,
      Math.min(wanted, opensBelow ? spaceBelow : spaceAbove)
    );

    // Leave room for the scrollbar so it does not sit on top of the blocks.
    const width = flyout.getWidth() + (contentHeight > height ? SCROLLBAR_ALLOWANCE : 0);

    const y = opensBelow
      ? inputRect.bottom - injectionRect.top + FLYOUT_GAP
      : Math.max(0, inputRect.top - injectionRect.top - height - FLYOUT_GAP);
    const x = Math.max(
      0,
      Math.min(inputRect.left - injectionRect.left, injectionRect.width - width)
    );

    flyout.height_ = height;
    flyout.setBackgroundPath?.(width - flyout.CORNER_RADIUS, height - 2 * flyout.CORNER_RADIUS);
    flyout.positionAt_(width, height, x, y);

    // The scrollbar is a sibling of the flyout, so it needs its own stacking
    // rule to sit above the flyout's opaque background.
    const scrollbarSvg = flyoutWorkspace.scrollbar?.vScroll?.outerSvg;
    if (scrollbarSvg && !scrollbarSvg.classList.contains('block-search-scrollbar')) {
      scrollbarSvg.classList.add('block-search-scrollbar');
      // Dragging it must not pull focus out of the field editor.
      scrollbarSvg.addEventListener('pointerdown', (event) => event.preventDefault());
    }
  }

  highlightFlyoutBlock_() {
    const input = this.htmlInput_;
    const blocks = this.getFlyoutBlocks_();
    blocks.forEach((block, index) => {
      if (index === this.activeIndex_) {
        block.addSelect();
      } else {
        block.removeSelect();
      }
    });

    const active = blocks[this.activeIndex_];
    if (!active || !input) return;
    const id = active.getFocusableElement?.()?.id;
    if (id) input.setAttribute('aria-activedescendant', id);
    this.scrollFlyoutTo_(active);
  }

  scrollFlyoutTo_(block) {
    const flyoutWorkspace = this.flyout_?.getWorkspace();
    if (!flyoutWorkspace) return;

    const scale = flyoutWorkspace.scale;
    const metrics = flyoutWorkspace.getMetrics();
    const top = block.getRelativeToSurfaceXY().y * scale;
    const bottom = top + block.getHeightWidth().height * scale;

    let scrollY = null;
    if (top < metrics.viewTop) {
      scrollY = -top + this.flyout_.MARGIN;
    } else if (bottom > metrics.viewTop + metrics.viewHeight) {
      scrollY = -(bottom - metrics.viewHeight) - this.flyout_.MARGIN;
    }
    if (scrollY === null) return;

    flyoutWorkspace.scroll(flyoutWorkspace.scrollX, scrollY);
  }

  hideFlyout_() {
    if (!this.flyout_) return;
    this.getFlyoutBlocks_().forEach((block) => block.removeSelect());
    this.flyout_.hide();
    this.flyout_.flockPickerField = null;
    this.flyout_ = null;
  }

  ensurePopup_() {
    if (this.popup_) return this.popup_;

    const popup = document.createElement('div');
    popup.className = 'block-search-popup';

    const listbox = document.createElement('div');
    listbox.className = 'block-search-listbox';
    listbox.id = LISTBOX_ID;
    listbox.setAttribute('role', 'listbox');
    listbox.setAttribute('aria-label', translate('block_search_label'));

    popup.appendChild(listbox);
    document.body.appendChild(popup);

    this.popup_ = popup;
    this.listbox_ = listbox;
    this.status_?.remove();
    this.status_ = null;
    return popup;
  }

  renderList_() {
    const workspace = this.getWorkspace_();
    const input = this.htmlInput_;
    if (!input) return;

    this.ensurePopup_();
    this.listbox_.replaceChildren();
    input.setAttribute('aria-controls', LISTBOX_ID);

    if (!this.results_.length) {
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      this.announceCount_();
      this.status_?.classList.add('is-empty');
      this.positionPopup_();
      return;
    }

    this.results_.forEach((def, index) => {
      const option = document.createElement('div');
      option.className = 'block-search-option';
      option.id = `${OPTION_ID_PREFIX}${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');

      const name = document.createElement('span');
      name.className = 'block-search-option-name';
      name.textContent = getBlockSearchLabel(workspace, def);
      option.appendChild(name);

      const { name: category, color } = getBlockCategoryInfo(workspace, def.type);
      if (category) {
        const chip = document.createElement('span');
        chip.className = 'block-search-option-category';
        if (color) chip.style.backgroundColor = color;
        chip.textContent = category;
        option.appendChild(chip);
      }

      // Keep focus (and the caret) in the input so the field is not committed
      // out from under the click.
      option.addEventListener('pointerdown', (event) => event.preventDefault());
      option.addEventListener('click', () => this.accept_(def));

      this.listbox_.appendChild(option);
    });

    input.setAttribute('aria-expanded', 'true');
    this.highlightListOption_();
    this.announceCount_();
    this.status_?.classList.remove('is-empty');
    this.positionPopup_();
  }

  highlightListOption_() {
    const options = this.listbox_?.querySelectorAll('.block-search-option') ?? [];
    options.forEach((option, index) => {
      const isActive = index === this.activeIndex_;
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) option.scrollIntoView({ block: 'nearest' });
    });
    if (this.activeIndex_ >= 0) {
      this.htmlInput_?.setAttribute(
        'aria-activedescendant',
        `${OPTION_ID_PREFIX}${this.activeIndex_}`
      );
    }
  }

  positionPopup_() {
    const input = this.htmlInput_;
    if (!this.popup_ || !input) return;

    const rect = input.getBoundingClientRect();
    const popup = this.popup_;
    popup.style.minWidth = `${Math.max(rect.width, 220)}px`;
    popup.style.left = `${Math.min(rect.left, window.innerWidth - popup.offsetWidth - 8)}px`;

    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < popup.offsetHeight + 8 && rect.top > spaceBelow) {
      popup.style.top = `${Math.max(8, rect.top - popup.offsetHeight - 4)}px`;
    } else {
      popup.style.top = `${rect.bottom + 4}px`;
    }
  }
}

Blockly.fieldRegistry.register('field_block_search', FieldBlockSearch);
