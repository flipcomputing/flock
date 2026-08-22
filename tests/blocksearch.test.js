import { expect } from 'chai';
import * as Blockly from 'blockly';
import {
  matchBlockDefinitions,
  getBlockSearchLabel,
  getBlockCategoryInfo,
  indexesFieldValues,
  rebuildBlockCategoryMap,
} from '../main/blocksearch.js';
import { FieldBlockSearch } from '../blocks/fieldBlockSearch.js';

const CAMERA_FOLLOW = { kind: 'block', type: 'camera_follow', keyword: 'camfollow' };
const CAMERA = { kind: 'block', type: 'set_camera', keyword: 'cam' };
const CLONE = { kind: 'block', type: 'clone_mesh', keyword: 'clone' };

// Mirrors the shape buildSearchIndex produces: one entry per toolbox block,
// `text` being every search term joined and lowercased.
function stubIndex(workspace) {
  workspace.flockBlockLabelMap = new Map([
    ['camera_follow', 'camera follow ( ) radius ( )'],
    ['set_camera', 'set camera to ( )'],
    ['clone_mesh', 'clone ( ) as ( )'],
  ]);
  workspace.flockSearchIndexedBlocks = [
    { type: 'camera_follow', full: CAMERA_FOLLOW, text: 'camera follow camfollow radius' },
    { type: 'set_camera', full: CAMERA, text: 'set camera to cam free camera' },
    { type: 'clone_mesh', full: CLONE, text: 'clone as clone_mesh' },
  ];
}

// Blockly.Blocks is global, so every test block is registered and removed
// around the suite that needs it.
function defineTestSearchBlock(onSelect) {
  Blockly.Blocks['test_block_search'] = {
    init: function () {
      this.appendDummyInput().appendField(new FieldBlockSearch(''), 'KEYWORD');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
    },
    onBlockSearchSelect: onSelect,
  };
}

export function runBlockSearchTests() {
  describe('main/blocksearch @blocksearch', function () {
    this.timeout(5000);

    let workspace;

    beforeEach(function () {
      workspace = new Blockly.Workspace();
      stubIndex(workspace);
    });

    afterEach(function () {
      workspace.dispose();
    });

    describe('matchBlockDefinitions', function () {
      it('returns nothing for an empty query', function () {
        expect(matchBlockDefinitions(workspace, '')).to.deep.equal([]);
        expect(matchBlockDefinitions(workspace, '   ')).to.deep.equal([]);
      });

      it('ranks an exactly typed keyword first', function () {
        const results = matchBlockDefinitions(workspace, 'cam');
        expect(results[0].type).to.equal('set_camera');
      });

      it('still finds blocks whose keyword only starts with the query', function () {
        const types = matchBlockDefinitions(workspace, 'camf').map((def) => def.type);
        expect(types).to.deep.equal(['camera_follow']);
      });

      it('matches indexed terms that are not the keyword', function () {
        const types = matchBlockDefinitions(workspace, 'radius').map((def) => def.type);
        expect(types).to.deep.equal(['camera_follow']);
      });

      it('de-duplicates repeated block types', function () {
        workspace.flockSearchIndexedBlocks.push({
          type: 'set_camera',
          full: CAMERA,
          text: 'set camera to cam',
        });
        const types = matchBlockDefinitions(workspace, 'camera').map((def) => def.type);
        expect(types.filter((type) => type === 'set_camera')).to.have.length(1);
      });

      it('builds the index on demand when one is not cached', function () {
        let built = 0;
        workspace.flockSearchIndexedBlocks = null;
        workspace.flockBuildSearchIndex = () => {
          built += 1;
          stubIndex(workspace);
        };
        expect(matchBlockDefinitions(workspace, 'cam')).to.have.length.greaterThan(0);
        expect(built).to.equal(1);
      });
    });

    describe('indexesFieldValues', function () {
      it('skips image fields, whose value is an inline SVG containing "viewBox"', function () {
        const icon = new Blockly.FieldImage(
          'data:image/svg+xml,%3csvg viewbox=%220 0 384 512%22%3e%3c/svg%3e',
          16,
          16
        );
        expect(indexesFieldValues(icon)).to.equal(false);
      });

      it('skips variable fields', function () {
        expect(indexesFieldValues(new Blockly.FieldVariable('item'))).to.equal(false);
      });

      it('indexes text and dropdown fields', function () {
        expect(indexesFieldValues(new Blockly.FieldTextInput('hello'))).to.equal(true);
        expect(indexesFieldValues(new Blockly.FieldDropdown([['a', 'A']]))).to.equal(true);
      });
    });

    describe('labels and categories', function () {
      it('uses the indexed label when there is one', function () {
        expect(getBlockSearchLabel(workspace, CLONE)).to.equal('clone ( ) as ( )');
      });

      it('falls back to a readable form of the block type', function () {
        expect(getBlockSearchLabel(workspace, { type: 'do_thing_now' })).to.equal('Do thing now');
      });

      it('maps blocks to the category they sit in', function () {
        rebuildBlockCategoryMap(workspace, {
          contents: [{ kind: 'category', name: 'Camera', contents: [CAMERA] }],
        });
        expect(getBlockCategoryInfo(workspace, 'set_camera').name).to.equal('Camera');
        expect(getBlockCategoryInfo(workspace, 'unknown_block').name).to.equal('');
      });
    });
  });

  describe('blocks/fieldBlockSearch text list @blocksearch', function () {
    this.timeout(5000);

    let container;
    let workspace;
    let block;
    let field;
    let selected;

    before(function () {
      defineTestSearchBlock(function (definition) {
        selected = definition;
      });
    });

    after(function () {
      delete Blockly.Blocks['test_block_search'];
    });

    beforeEach(function () {
      selected = null;
      container = document.createElement('div');
      container.style.width = '400px';
      container.style.height = '300px';
      document.body.appendChild(container);
      workspace = Blockly.inject(container, {});
      stubIndex(workspace);

      block = workspace.newBlock('test_block_search');
      block.initSvg();
      block.render();
      field = block.getField('KEYWORD');
      field.usesFlyout_ = () => false;
      field.showEditor_();
    });

    afterEach(function () {
      Blockly.WidgetDiv.hide();
      workspace.dispose();
      container.remove();
    });

    function type(text) {
      field.htmlInput_.value = text;
      field.htmlInput_.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function press(key) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      field.htmlInput_.dispatchEvent(event);
      return event;
    }

    it('shows the prompt on the block while the field is empty', function () {
      expect(field.getText()).to.equal('type to find a block');
    });

    it('opens the editor with an empty, labelled combobox', function () {
      const input = field.htmlInput_;
      expect(input.value).to.equal('');
      expect(input.getAttribute('role')).to.equal('combobox');
      expect(input.getAttribute('aria-expanded')).to.equal('false');
      expect(input.getAttribute('aria-label')).to.equal('Find a block');
    });

    it('lists matches and activates the best one', function () {
      type('cam');
      const options = document.querySelectorAll('.block-search-option');
      expect(options.length).to.equal(2);
      expect(options[0].getAttribute('aria-selected')).to.equal('true');
      expect(field.htmlInput_.getAttribute('aria-expanded')).to.equal('true');
      expect(field.htmlInput_.getAttribute('aria-activedescendant')).to.equal(
        'block-search-option-0'
      );
    });

    it('moves the active option with the arrow keys', function () {
      type('cam');
      press('ArrowDown');
      expect(field.htmlInput_.getAttribute('aria-activedescendant')).to.equal(
        'block-search-option-1'
      );
      press('ArrowUp');
      expect(field.htmlInput_.getAttribute('aria-activedescendant')).to.equal(
        'block-search-option-0'
      );
    });

    it('wraps around at the ends of the list', function () {
      type('cam');
      press('ArrowUp');
      expect(field.htmlInput_.getAttribute('aria-activedescendant')).to.equal(
        'block-search-option-1'
      );
    });

    it('reports when nothing matches', function () {
      type('zzzz');
      expect(document.querySelectorAll('.block-search-option')).to.have.length(0);
      expect(document.querySelector('.block-search-status').textContent).to.equal(
        'No matching blocks found'
      );
      expect(field.htmlInput_.getAttribute('aria-expanded')).to.equal('false');
    });

    it('hands the chosen definition to the block on Enter', function () {
      type('cam');
      press('ArrowDown');
      press('Enter');
      expect(selected).to.equal(CAMERA_FOLLOW);
      expect(document.querySelector('.block-search-popup')).to.equal(null);
    });

    it('takes Enter from the base field only while the picker is open', function () {
      const ignored = press('Enter');
      expect(ignored.defaultPrevented).to.equal(false);
      field.showEditor_();
      type('clone');
      const handled = press('Enter');
      expect(handled.defaultPrevented).to.equal(true);
      expect(selected).to.equal(CLONE);
    });

    it('dismisses the picker on Escape without choosing a block', function () {
      type('cam');
      press('Escape');
      expect(selected).to.equal(null);
      expect(document.querySelector('.block-search-popup')).to.equal(null);
    });

    it('removes the popup when the editor closes', function () {
      type('cam');
      Blockly.WidgetDiv.hide();
      expect(document.querySelector('.block-search-popup')).to.equal(null);
    });
  });

  describe('blocks/fieldBlockSearch flyout @blocksearch', function () {
    this.timeout(5000);

    const ALPHA = { kind: 'block', type: 'test_search_alpha', keyword: 'alpha' };
    const BETA = { kind: 'block', type: 'test_search_beta', keyword: 'beta' };

    let container;
    let workspace;
    let field;
    let selected;

    before(function () {
      defineTestSearchBlock(function () {});
      for (const [type, label] of [
        ['test_search_alpha', 'alpha block'],
        ['test_search_beta', 'beta block'],
      ]) {
        Blockly.Blocks[type] = {
          init: function () {
            this.appendDummyInput().appendField(label);
            this.setPreviousStatement(true);
            this.setNextStatement(true);
          },
        };
      }
    });

    after(function () {
      delete Blockly.Blocks['test_block_search'];
      delete Blockly.Blocks['test_search_alpha'];
      delete Blockly.Blocks['test_search_beta'];
    });

    beforeEach(function () {
      selected = null;
      container = document.createElement('div');
      container.style.width = '600px';
      container.style.height = '400px';
      document.body.appendChild(container);
      workspace = Blockly.inject(container, {});
      workspace.flockBlockLabelMap = new Map([
        ['test_search_alpha', 'alpha block'],
        ['test_search_beta', 'beta block'],
      ]);
      workspace.flockSearchIndexedBlocks = [
        { type: 'test_search_alpha', full: ALPHA, text: 'alpha block test search alpha' },
        { type: 'test_search_beta', full: BETA, text: 'beta block test search alpha beta' },
      ];

      const block = workspace.newBlock('test_block_search');
      block.onBlockSearchSelect = (definition) => {
        selected = definition;
      };
      block.initSvg();
      block.render();
      field = block.getField('KEYWORD');
      field.usesFlyout_ = () => true;
      field.showEditor_();
    });

    afterEach(function () {
      Blockly.WidgetDiv.hide();
      workspace.dispose();
      container.remove();
    });

    function type(text) {
      field.htmlInput_.value = text;
      field.htmlInput_.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function press(key) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      field.htmlInput_.dispatchEvent(event);
      return event;
    }

    function flyoutBlocks() {
      return workspace.flockPickerFlyout
        .getContents()
        .filter((item) => item.getType() === 'block')
        .map((item) => item.getElement());
    }

    it('renders the matches as real blocks in a flyout', function () {
      type('alpha');
      expect(workspace.flockPickerFlyout.isVisible()).to.equal(true);
      expect(flyoutBlocks().map((b) => b.type)).to.deep.equal([
        'test_search_alpha',
        'test_search_beta',
      ]);
      expect(document.querySelector('.block-search-popup')).to.equal(null);
    });

    it('left-aligns the search text and starts the caret at the front', function () {
      const input = field.htmlInput_;
      expect(input.classList.contains('block-search-input')).to.equal(true);
      expect(input.selectionStart).to.equal(0);
    });

    it('gives the flyout scrollbar its own stacking class', function () {
      type('alpha');
      expect(document.querySelector('.block-search-scrollbar')).to.not.equal(null);
    });

    it('points the combobox at the active flyout block', function () {
      type('alpha');
      const input = field.htmlInput_;
      expect(input.getAttribute('aria-expanded')).to.equal('true');
      expect(input.getAttribute('aria-activedescendant')).to.equal(
        flyoutBlocks()[0].getFocusableElement().id
      );
      expect(input.getAttribute('aria-controls')).to.equal(
        workspace.flockPickerFlyout.getWorkspace().getCanvas().id
      );
    });

    it('moves the highlight with the arrow keys', function () {
      type('alpha');
      press('ArrowDown');
      const blocks = flyoutBlocks();
      expect(field.htmlInput_.getAttribute('aria-activedescendant')).to.equal(
        blocks[1].getFocusableElement().id
      );
      expect(blocks[1].getSvgRoot().classList.contains('blocklySelected')).to.equal(true);
      expect(blocks[0].getSvgRoot().classList.contains('blocklySelected')).to.equal(false);
    });

    it('hands the highlighted definition to the block on Enter', function () {
      type('alpha');
      press('ArrowDown');
      press('Enter');
      expect(selected).to.equal(BETA);
      expect(workspace.flockPickerFlyout.isVisible()).to.equal(false);
    });

    it('hides the flyout on Escape and when the editor closes', function () {
      type('alpha');
      press('Escape');
      expect(workspace.flockPickerFlyout.isVisible()).to.equal(false);
      expect(selected).to.equal(null);

      field.showEditor_();
      type('beta');
      expect(workspace.flockPickerFlyout.isVisible()).to.equal(true);
      Blockly.WidgetDiv.hide();
      expect(workspace.flockPickerFlyout.isVisible()).to.equal(false);
    });

    it('hides the flyout when nothing matches', function () {
      type('alpha');
      type('zzzz');
      expect(workspace.flockPickerFlyout.isVisible()).to.equal(false);
      expect(field.htmlInput_.getAttribute('aria-expanded')).to.equal('false');
    });
  });

  describe('keyword block replacement @blocksearch', function () {
    this.timeout(5000);

    let container;
    let workspace;

    before(function () {
      for (const [type, config] of [
        ['test_replace_statement', { previous: true, next: true }],
        ['test_replace_terminal', { previous: true, next: false }],
        ['test_replace_hat', { previous: false, next: false }],
      ]) {
        Blockly.Blocks[type] = {
          init: function () {
            this.appendDummyInput().appendField(type);
            if (config.previous) this.setPreviousStatement(true);
            if (config.next) this.setNextStatement(true);
          },
        };
      }
    });

    after(function () {
      delete Blockly.Blocks['test_replace_statement'];
      delete Blockly.Blocks['test_replace_terminal'];
      delete Blockly.Blocks['test_replace_hat'];
    });

    beforeEach(function () {
      container = document.createElement('div');
      container.style.width = '500px';
      container.style.height = '400px';
      document.body.appendChild(container);
      workspace = Blockly.inject(container, {});
    });

    afterEach(function () {
      workspace.dispose();
      container.remove();
    });

    // head -> keyword -> tail, where head/tail are ordinary statement blocks.
    function buildStack() {
      const head = workspace.newBlock('test_replace_statement');
      const keyword = workspace.newBlock('keyword');
      const tail = workspace.newBlock('test_replace_statement');
      for (const block of [head, keyword, tail]) {
        block.initSvg();
        block.render();
      }
      head.nextConnection.connect(keyword.previousConnection);
      keyword.nextConnection.connect(tail.previousConnection);
      return { head, keyword, tail };
    }

    function stackTypes(head) {
      const types = [];
      let block = head;
      while (block) {
        types.push(block.type);
        block = block.getNextBlock();
      }
      return types;
    }

    it('splices a statement block into the stack', function () {
      const { head, keyword } = buildStack();
      keyword.onBlockSearchSelect({ kind: 'block', type: 'test_replace_statement' });
      expect(stackTypes(head)).to.deep.equal([
        'test_replace_statement',
        'test_replace_statement',
        'test_replace_statement',
      ]);
      expect(workspace.getAllBlocks().some((b) => b.type === 'keyword')).to.equal(false);
    });

    it('keeps the blocks below when the chosen block cannot be a statement', function () {
      const { head, keyword, tail } = buildStack();
      keyword.onBlockSearchSelect({ kind: 'block', type: 'test_replace_hat' });
      expect(tail.isDisposed()).to.equal(false);
      expect(stackTypes(head)).to.deep.equal(['test_replace_statement', 'test_replace_statement']);
      expect(workspace.getTopBlocks(false).map((b) => b.type)).to.include('test_replace_hat');
    });

    it('keeps the blocks below when the chosen block has no next connection', function () {
      const { head, keyword, tail } = buildStack();
      keyword.onBlockSearchSelect({ kind: 'block', type: 'test_replace_terminal' });
      expect(tail.isDisposed()).to.equal(false);
      expect(stackTypes(head)).to.deep.equal(['test_replace_statement', 'test_replace_terminal']);
      expect(workspace.getTopBlocks(false)).to.have.length(2);
    });

    it('replaces a lone keyword block with no stack around it', function () {
      const keyword = workspace.newBlock('keyword');
      keyword.initSvg();
      keyword.render();
      keyword.onBlockSearchSelect({ kind: 'block', type: 'test_replace_statement' });
      expect(workspace.getTopBlocks(false).map((b) => b.type)).to.deep.equal([
        'test_replace_statement',
      ]);
    });

    it('undoes the whole replacement in one step', async function () {
      const { head, keyword } = buildStack();
      keyword.onBlockSearchSelect({ kind: 'block', type: 'test_replace_terminal' });
      expect(stackTypes(head)).to.deep.equal(['test_replace_statement', 'test_replace_terminal']);
      // Blockly flushes its event queue on a later tick; the undo stack is only
      // populated once it has.
      await new Promise((resolve) => setTimeout(resolve, 0));
      workspace.undo(false);
      expect(workspace.getAllBlocks().some((b) => b.type === 'test_replace_terminal')).to.equal(
        false
      );
      expect(workspace.getAllBlocks().some((b) => b.type === 'keyword')).to.equal(true);
    });
  });
}
