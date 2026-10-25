import { expect } from 'chai';
import * as Blockly from 'blockly';
import { defineTextBlocks } from '../blocks/text.js';
import { defineMaterialsBlocks } from '../blocks/materials.js';
import {
  contrastRatio,
  contrastWarningFor,
  installContrastWarnings,
} from '../blocks/colourcontrast.js';

const colour = (COLOR) => ({ shadow: { type: 'colour', fields: { COLOR } } });
const number = (NUM) => ({ shadow: { type: 'math_number', fields: { NUM } } });

function sayState({ text = '#000000', background = '#ffffff', alpha = 1 } = {}) {
  return {
    type: 'say',
    inputs: {
      TEXT_COLOR: typeof text === 'string' ? colour(text) : text,
      BACKGROUND_COLOR: typeof background === 'string' ? colour(background) : background,
      ALPHA: number(alpha),
    },
  };
}

export function runColourContrastTests() {
  describe('blocks/colourcontrast @colourcontrast', function () {
    before(function () {
      if (!Blockly.Blocks['say']) defineTextBlocks();
      if (!Blockly.Blocks['colour']) defineMaterialsBlocks();
    });

    describe('contrastRatio', function () {
      it('gives 21:1 for black on white and 1:1 for identical colours', function () {
        expect(contrastRatio([0, 0, 0], [255, 255, 255])).to.be.closeTo(21, 0.01);
        expect(contrastRatio([255, 255, 255], [0, 0, 0])).to.be.closeTo(21, 0.01);
        expect(contrastRatio([120, 40, 200], [120, 40, 200])).to.equal(1);
      });

      it('matches the WCAG value for grey #767676 on white', function () {
        expect(contrastRatio([0x76, 0x76, 0x76], [255, 255, 255])).to.be.closeTo(4.54, 0.01);
      });
    });

    describe('contrastWarningFor', function () {
      let workspace;

      beforeEach(function () {
        workspace = new Blockly.Workspace();
      });

      afterEach(function () {
        workspace.dispose();
      });

      const append = (state) => Blockly.serialization.blocks.append(state, workspace);

      it('has no warning for black text on white', function () {
        expect(contrastWarningFor(append(sayState()))).to.equal(null);
      });

      it('warns with the ratio for yellow text on white', function () {
        const warning = contrastWarningFor(append(sayState({ text: '#ffff00' })));
        expect(warning).to.include('1:1');
        expect(warning).to.include('4.5:1');
      });

      it('rounds the reported ratio down so it never shows the threshold', function () {
        const warning = contrastWarningFor(append(sayState({ text: '#777777' })));
        expect(warning).to.include('4.4:1');
      });

      it('resolves colour names', function () {
        const named = {
          block: { type: 'colour_from_string', fields: { COLOR: 'yellow' } },
        };
        expect(contrastWarningFor(append(sayState({ text: named })))).to.include('4.5:1');
      });

      it('skips colours that are only known when the project runs', function () {
        const random = { block: { type: 'random_colour' } };
        expect(contrastWarningFor(append(sayState({ text: random })))).to.equal(null);
      });

      it('skips a see-through background', function () {
        expect(contrastWarningFor(append(sayState({ text: '#ffff00', alpha: 0.5 })))).to.equal(
          null
        );
      });

      it('checks ui_text, which names its text colour input COLOR', function () {
        const block = append({
          type: 'ui_text',
          inputs: {
            COLOR: colour('#eeeeee'),
            BACKGROUND_COLOR: colour('#ffffff'),
            ALPHA: number(1),
          },
        });
        expect(contrastWarningFor(block)).to.include('4.5:1');
      });
    });

    describe('installContrastWarnings', function () {
      let workspace;
      let container;
      let refresh;

      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const flushEvents = async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        await nextFrame();
        await nextFrame();
      };
      const warningText = (block) =>
        block
          .getIcons()
          .map((icon) => icon.getText?.() ?? '')
          .join('\n');

      beforeEach(function () {
        container = document.createElement('div');
        container.style.width = '300px';
        container.style.height = '200px';
        document.body.appendChild(container);
        workspace = Blockly.inject(container, {});
        refresh = installContrastWarnings(workspace);
      });

      afterEach(function () {
        workspace.dispose();
        container.remove();
      });

      it('adds and clears the warning as the text colour changes', async function () {
        const say = Blockly.serialization.blocks.append(sayState({ text: '#ffff00' }), workspace);
        await flushEvents();
        expect(warningText(say)).to.include('4.5:1');

        say.getInputTargetBlock('TEXT_COLOR').setFieldValue('#000000', 'COLOR');
        await flushEvents();
        expect(warningText(say)).to.equal('');
      });

      it('restores warnings after a reload with events disabled', async function () {
        Blockly.serialization.blocks.append(sayState({ text: '#ffff00' }), workspace);
        await flushEvents();
        const xml = Blockly.Xml.workspaceToDom(workspace);
        Blockly.Events.disable();
        try {
          workspace.clear();
          Blockly.Xml.domToWorkspace(xml, workspace);
        } finally {
          Blockly.Events.enable();
        }
        const [reloaded] = workspace.getBlocksByType('say', false);
        expect(warningText(reloaded)).to.equal('');

        refresh();
        expect(warningText(reloaded)).to.include('4.5:1');
      });
    });
  });
}
