import { expect } from 'chai';
import { isValidColourInput, normaliseColourInput } from '../blocks/colourvalidation.js';

export function runColourValidationTests() {
  describe('blocks/colourvalidation @colourvalidation', function () {
    describe('isValidColourInput', function () {
      it('accepts 6-digit hex with and without a leading #', function () {
        expect(isValidColourInput('800080')).to.equal(true);
        expect(isValidColourInput('#800080')).to.equal(true);
      });

      it('accepts 3-digit hex', function () {
        expect(isValidColourInput('f0c')).to.equal(true);
        expect(isValidColourInput('#f0c')).to.equal(true);
      });

      it('accepts 4 and 8-digit hex with an alpha', function () {
        expect(isValidColourInput('#6985')).to.equal(true);
        expect(isValidColourInput('6985')).to.equal(true);
        expect(isValidColourInput('#11223344')).to.equal(true);
        expect(isValidColourInput('11223344')).to.equal(true);
        expect(isValidColourInput('#11223')).to.equal(false);
      });

      it('trims surrounding whitespace', function () {
        expect(isValidColourInput('  ff0000  ')).to.equal(true);
      });

      it('accepts CSS named colors', function () {
        expect(isValidColourInput('red')).to.equal(true);
        expect(isValidColourInput('rebeccapurple')).to.equal(true);
        expect(isValidColourInput('transparent')).to.equal(true);
      });

      it('accepts rgb() and hsl() functional notation', function () {
        expect(isValidColourInput('rgb(1, 2, 3)')).to.equal(true);
        expect(isValidColourInput('hsl(210, 50%, 40%)')).to.equal(true);
      });

      it('rejects unresolved custom-property (var()) references', function () {
        expect(isValidColourInput('var(--brand)')).to.equal(false);
        expect(isValidColourInput('rgb(var(--r), 0, 0)')).to.equal(false);
      });

      it('rejects context-dependent CSS keywords', function () {
        expect(isValidColourInput('currentColor')).to.equal(false);
        expect(isValidColourInput('inherit')).to.equal(false);
        expect(isValidColourInput('initial')).to.equal(false);
        expect(isValidColourInput('unset')).to.equal(false);
        expect(isValidColourInput('revert')).to.equal(false);
      });

      it('rejects empty and unparseable strings', function () {
        expect(isValidColourInput('')).to.equal(false);
        expect(isValidColourInput('   ')).to.equal(false);
        expect(isValidColourInput('xyz')).to.equal(false);
        expect(isValidColourInput('notacolour')).to.equal(false);
      });

      it('rejects non-string input', function () {
        expect(isValidColourInput(null)).to.equal(false);
        expect(isValidColourInput(undefined)).to.equal(false);
        expect(isValidColourInput(123)).to.equal(false);
      });
    });

    describe('normaliseColourInput', function () {
      it('expands 4-digit hex and keeps 8-digit hex', function () {
        expect(normaliseColourInput('#6985')).to.equal('#66998855');
        expect(normaliseColourInput('11223344')).to.equal('#11223344');
      });
    });
  });
}
