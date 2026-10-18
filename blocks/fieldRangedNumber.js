import * as Blockly from 'blockly';
import { rangeForInput } from '../config.js';

export function rangeForField(field) {
  const block = field.getSourceBlock();
  const own = block && rangeForInput(block.type, field.name);
  if (own) return own;
  const parent = block?.getParent();
  const input = parent?.getInputWithBlock(block);
  return input ? rangeForInput(parent.type, input.name) : null;
}

function stepDecimals(step) {
  return (String(step).split('.')[1] ?? '').length;
}

export function wrapToRange(value, { min, max }) {
  const span = max - min;
  const wrapped = ((((value - min) % span) + span) % span) + min;
  return Number(wrapped.toFixed(stepDecimals(value)));
}

export function nudgeValue(value, direction, range) {
  const { min, max, step, clamp = true, wrap = false } = range;
  const limit = (n) => (wrap ? wrapToRange(n, range) : clamp ? Math.min(max, Math.max(min, n)) : n);
  const current = limit(Number(value) || 0);
  const steps = Math.round((current - min) / step) + direction;
  return limit(Number((min + steps * step).toFixed(stepDecimals(step))));
}

export class FieldRangedNumber extends Blockly.FieldNumber {
  slider_ = null;
  sliderEvents_ = [];

  showEditor_(e, quietInput = false) {
    const range = rangeForField(this);
    this.baseLimits_ ??= { min: this.min_, max: this.max_ };
    this.range_ = range;
    const limits =
      !range || range.clamp === false
        ? this.baseLimits_
        : range.wrap
          ? { min: -Infinity, max: Infinity }
          : range;
    this.min_ = limits.min;
    this.max_ = limits.max;
    if (!range || range.slider === false) {
      super.showEditor_(e, quietInput);
      return;
    }

    super.showEditor_(e, true, false);
    Blockly.DropDownDiv.getContentDiv().appendChild(this.createSlider_(range));
    Blockly.DropDownDiv.showPositionedByField(this, this.closeSlider_.bind(this));
    if (!quietInput) {
      this.htmlInput_.focus({ preventScroll: true });
      this.htmlInput_.select();
    }
  }

  doClassValidation_(newValue) {
    const value = super.doClassValidation_(newValue);
    return this.range_?.wrap && Number.isFinite(value) ? wrapToRange(value, this.range_) : value;
  }

  createSlider_({ min, max, step, wrap }) {
    const sliderMax = wrap ? max - step : max;
    const wrapper = document.createElement('div');
    wrapper.className = 'flockRangeSlider';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = `${min}`;
    slider.max = `${sliderMax}`;
    slider.step = `${step}`;
    slider.tabIndex = -1;
    slider.setAttribute('aria-hidden', 'true');
    const label = (text) => {
      const span = document.createElement('span');
      span.textContent = `${text}`;
      return span;
    };
    wrapper.append(label(min), slider, label(sliderMax));
    this.slider_ = slider;
    this.syncSlider_();
    this.sliderEvents_.push(
      Blockly.browserEvents.conditionalBind(slider, 'input', this, () =>
        this.setValueWhileEditing_(slider.value)
      ),
      Blockly.browserEvents.conditionalBind(slider, 'change', this, () =>
        this.htmlInput_?.focus({ preventScroll: true })
      )
    );
    return wrapper;
  }

  setValueWhileEditing_(value) {
    const oldValue = this.value_;
    this.setEditorValue_(value, false);
    this.syncSlider_();
    if (this.sourceBlock_ && oldValue !== this.value_) {
      Blockly.Events.fire(
        new (Blockly.Events.get(Blockly.Events.BLOCK_FIELD_INTERMEDIATE_CHANGE))(
          this.sourceBlock_,
          this.name || null,
          oldValue,
          this.value_
        )
      );
    }
    this.resizeEditor_();
  }

  syncSlider_() {
    if (!this.slider_ || !this.range_) return;
    const min = Number(this.slider_.min);
    const max = Number(this.slider_.max);
    const value = Math.min(max, Math.max(min, Number(this.getValue())));
    this.slider_.value = `${value}`;
    this.slider_.style.setProperty('--slider-fill', `${((value - min) / (max - min)) * 100}%`);
  }

  onHtmlInputKeyDown_(e) {
    if (this.slider_ && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      e.stopPropagation();
      this.setValueWhileEditing_(
        nudgeValue(this.htmlInput_.value, e.key === 'ArrowUp' ? 1 : -1, this.range_)
      );
      return;
    }
    super.onHtmlInputKeyDown_(e);
    if (this.htmlInput_) this.syncSlider_();
  }

  onHtmlInputChange(e) {
    super.onHtmlInputChange(e);
    this.syncSlider_();
  }

  widgetDispose_() {
    super.widgetDispose_();
    this.range_ = null;
    this.min_ = this.baseLimits_.min;
    this.max_ = this.baseLimits_.max;
    if (this.slider_) Blockly.DropDownDiv.hideIfOwner(this, true);
  }

  closeSlider_() {
    if (!this.slider_) return;
    for (const event of this.sliderEvents_) Blockly.browserEvents.unbind(event);
    this.sliderEvents_ = [];
    this.slider_ = null;
    Blockly.WidgetDiv.hideIfOwner(this);
  }
}

export function registerRangedNumberField() {
  Blockly.fieldRegistry.unregister('field_number');
  Blockly.fieldRegistry.register('field_number', FieldRangedNumber);
}
