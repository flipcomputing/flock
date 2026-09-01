import { expect } from 'chai';
import * as Blockly from 'blockly';
import { installDropdownTypeahead } from '../main/dropdownTypeahead.js';
import { ContextManager } from '../main/context.js';

const VARIABLES = ['boat', 'box1', 'box2', 'sphere', '🐦finch', '🐦fish'];

export function runDropdownTypeaheadTests() {
  describe('main/dropdownTypeahead @dropdowntypeahead', function () {
    let workspace;
    let container;
    let block;

    before(function () {
      installDropdownTypeahead();
      Blockly.Blocks['test_typeahead'] = {
        init: function () {
          this.appendDummyInput().appendField(new Blockly.FieldVariable('boat'), 'VAR');
        },
      };
    });

    after(function () {
      delete Blockly.Blocks['test_typeahead'];
    });

    beforeEach(function () {
      container = document.createElement('div');
      container.style.width = '400px';
      container.style.height = '300px';
      document.body.appendChild(container);
      workspace = Blockly.inject(container, {});
      for (const name of VARIABLES) workspace.getVariableMap().createVariable(name);

      block = workspace.newBlock('test_typeahead');
      block.initSvg();
      block.render();
    });

    afterEach(function () {
      Blockly.DropDownDiv.hideWithoutAnimation();
      workspace?.dispose();
      container?.remove();
    });

    function openMenu() {
      block.getField('VAR').showEditor_();
      return document.querySelector('.blocklyDropDownDiv .blocklyMenu');
    }

    function type(menuElement, keys, init = {}) {
      const events = [];
      for (const key of keys) {
        const event = new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
          ...init,
        });
        menuElement.dispatchEvent(event);
        events.push(event);
      }
      return events;
    }

    function highlighted() {
      const item = document.querySelector('.blocklyMenuItemHighlight');
      return item?.getAttribute('aria-label') ?? null;
    }

    describe('matching', function () {
      it('jumps to the first option matching the typed prefix', function () {
        const menu = openMenu();
        type(menu, ['s']);
        expect(highlighted()).to.equal('sphere');
      });

      it('narrows as more characters are typed', function () {
        const menu = openMenu();
        type(menu, ['b', 'o', 'x', '2']);
        expect(highlighted()).to.equal('box2');
      });

      it('cycles through options sharing a letter when the same key repeats', function () {
        const menu = openMenu();
        type(menu, ['b']);
        expect(highlighted()).to.equal('boat');
        type(menu, ['b']);
        expect(highlighted()).to.equal('box1');
        type(menu, ['b']);
        expect(highlighted()).to.equal('box2');
      });

      it('cycles on a repeated character outside the basic plane', function () {
        const menu = openMenu();
        type(menu, ['🐦']);
        expect(highlighted()).to.equal('🐦finch');
        type(menu, ['🐦']);
        expect(highlighted()).to.equal('🐦fish');
      });

      it('falls back to a substring match when nothing starts with the text', function () {
        const menu = openMenu();
        type(menu, ['a', 't']);
        expect(highlighted()).to.equal('boat');
      });

      it('never lets the delete action win a substring match on a variable name', function () {
        // "Delete the 'box1' variable" contains the name the user is typing.
        const menu = openMenu();
        type(menu, ['o', 'x', '1']);
        expect(highlighted()).to.equal('box1');
      });

      it('reaches the rename action by prefix', function () {
        const menu = openMenu();
        type(menu, ['r', 'e', 'n']);
        expect(highlighted()?.toLowerCase()).to.contain('rename');
      });

      it('leaves the highlight alone when nothing matches', function () {
        const menu = openMenu();
        type(menu, ['s']);
        type(menu, ['z', 'z']);
        expect(highlighted()).to.equal('sphere');
      });

      it('starts a fresh search once the buffer times out', function () {
        const menu = openMenu();
        const now = Date.now;
        try {
          let clock = now();
          Date.now = () => clock;
          type(menu, ['b', 'o']);
          expect(highlighted()).to.equal('boat');
          clock += 2000;
          type(menu, ['s']);
          expect(highlighted()).to.equal('sphere');
        } finally {
          Date.now = now;
        }
      });

      it('trims the search on backspace', function () {
        const menu = openMenu();
        type(menu, ['b', 'o', 'x']);
        expect(highlighted()).to.equal('box1');
        type(menu, ['Backspace']);
        type(menu, ['a']);
        expect(highlighted()).to.equal('boat');
      });
    });

    describe('screen reader state', function () {
      it('points aria-activedescendant at the matched option', function () {
        const menu = openMenu();
        type(menu, ['s']);
        const active = menu.getAttribute('aria-activedescendant');
        expect(active).to.be.a('string');
        expect(document.getElementById(active)?.getAttribute('aria-label')).to.equal('sphere');
      });

      it('leaves the committed option selected until Enter', function () {
        const menu = openMenu();
        type(menu, ['s']);
        const selected = menu.querySelector('[aria-selected="true"]');
        expect(selected?.getAttribute('aria-label')).to.equal('boat');

        type(menu, ['Enter']);
        expect(block.getField('VAR').getText()).to.equal('sphere');
      });
    });

    describe('other keyboard controls', function () {
      // Blockly binds its global shortcut handler to the drop-down div, so an unconsumed
      // letter reaches the workspace shortcuts behind the open menu.
      function countsShortcutLeaks() {
        const content = document.querySelector('.blocklyDropDownContent');
        const seen = [];
        const listener = (event) => seen.push(event.key);
        content.addEventListener('keydown', listener);
        return {
          seen,
          stop: () => content.removeEventListener('keydown', listener),
        };
      }

      it('keeps typed letters away from the workspace shortcuts', function () {
        const menu = openMenu();
        const leaks = countsShortcutLeaks();
        try {
          type(menu, ['c', 't', 'w', 'i']);
          expect(leaks.seen).to.deep.equal([]);
        } finally {
          leaks.stop();
        }
      });

      it('does not tidy the workspace when "c" is typed', function () {
        const menu = openMenu();
        let cleanUps = 0;
        const original = workspace.cleanUp.bind(workspace);
        workspace.cleanUp = () => {
          cleanUps++;
          original();
        };
        try {
          type(menu, ['c']);
          expect(cleanUps).to.equal(0);
        } finally {
          workspace.cleanUp = original;
        }
      });

      it('consumes backspace so it cannot delete the block', function () {
        const menu = openMenu();
        const leaks = countsShortcutLeaks();
        try {
          const [event] = type(menu, ['Backspace']);
          expect(event.defaultPrevented).to.equal(true);
          expect(leaks.seen).to.deep.equal([]);
        } finally {
          leaks.stop();
        }
      });

      it('lets Tab and modifier chords through', function () {
        const menu = openMenu();
        const leaks = countsShortcutLeaks();
        try {
          type(menu, ['Tab']);
          type(menu, ['s'], { ctrlKey: true });
          expect(leaks.seen).to.deep.equal(['Tab', 's']);
        } finally {
          leaks.stop();
        }
      });

      it('treats AltGr characters as typing, not as a chord', function () {
        const menu = openMenu();
        type(menu, ['s'], { ctrlKey: true, altKey: true });
        expect(highlighted()).to.equal('sphere');
      });

      it('ignores keystrokes that are mid-composition', function () {
        const menu = openMenu();
        const leaks = countsShortcutLeaks();
        try {
          expect(highlighted()).to.equal('boat');
          type(menu, ['s'], { isComposing: true });
          expect(highlighted()).to.equal('boat');
          expect(leaks.seen).to.deep.equal(['s']);
        } finally {
          leaks.stop();
        }
      });

      it('reports TYPING context while a menu is open', function () {
        openMenu();
        expect(ContextManager.getCurrentContext()).to.equal('TYPING');
        Blockly.DropDownDiv.hideWithoutAnimation();
        expect(ContextManager.getCurrentContext()).to.not.equal('TYPING');
      });
    });
  });
}
