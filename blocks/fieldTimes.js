import * as Blockly from 'blockly';
import { FieldDate } from '@blockly/field-date';
import { normaliseDateTime, normaliseTime } from '../api/tables.js';
import { translate } from '../main/translation.js';

const pad = (n) => String(n).padStart(2, '0');

function todayText() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const asUtc = (time) => new Date(`1970-01-01T${time}Z`);
const dateTimeAsUtc = (value) => new Date(`${value}Z`);

export function formatTime(value, style = 'short') {
  return new Intl.DateTimeFormat(undefined, { timeStyle: style, timeZone: 'UTC' }).format(
    asUtc(value)
  );
}

export function formatDateTime(value, dateStyle = 'medium', timeStyle = 'short') {
  return new Intl.DateTimeFormat(undefined, { dateStyle, timeStyle, timeZone: 'UTC' }).format(
    dateTimeAsUtc(value)
  );
}

class FieldTime extends FieldDate {
  static fromJson(options) {
    const { value, ...config } = options;
    return new this(value, undefined, config);
  }

  doClassValidation_(newValue) {
    return newValue ? normaliseTime(newValue) : null;
  }

  getText_() {
    const value = this.getValue();
    return value ? formatTime(value) : null;
  }

  getAriaTypeName() {
    return translate('table_column_type_time');
  }

  getAriaValue() {
    const value = this.getValue();
    return value ? formatTime(value, 'short') : super.getAriaValue();
  }

  widgetCreate_() {
    const input = super.widgetCreate_();
    input.type = 'time';
    input.value = input.defaultValue;
    return input;
  }
}

FieldTime.prototype.DEFAULT_VALUE = '12:00';

class FieldDateTime extends FieldDate {
  static fromJson(options) {
    const { value, ...config } = options;
    return new this(value, undefined, config);
  }

  doClassValidation_(newValue) {
    return newValue ? normaliseDateTime(newValue) : null;
  }

  getText_() {
    const value = this.getValue();
    return value ? formatDateTime(value, 'short') : null;
  }

  getAriaTypeName() {
    return translate('table_column_type_datetime');
  }

  getAriaValue() {
    const value = this.getValue();
    return value ? formatDateTime(value, 'long') : super.getAriaValue();
  }

  widgetCreate_() {
    const input = super.widgetCreate_();
    input.type = 'datetime-local';
    input.value = input.defaultValue;
    return input;
  }
}

FieldDateTime.prototype.DEFAULT_VALUE = `${todayText()}T12:00`;

Blockly.fieldRegistry.register('field_time', FieldTime);
Blockly.fieldRegistry.register('field_datetime', FieldDateTime);
