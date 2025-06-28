import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import { getHelpUrlFor } from "../blocks.js";

export function defineConditionBlocks() {
	Blockly.Blocks["controls_if"] = Blockly.Blocks["dynamic_if"];

	const oldInit = Blockly.Blocks["controls_if"].init;

	  Blockly.Blocks["controls_if"].init = function () {
		this.setHelpUrl(getHelpUrlFor(this.type));
		// Call the original init function
		oldInit.call(this);

		// Override the tooltip after the original init
		this.setTooltip(() => {
		  let tooltip = "Execute actions if a condition is true.";

		  tooltip += ` Drag additional conditions to create else if branches.`;

		  tooltip += " Drag a statement at the end to create an else branch.";

		  return tooltip;
		});
	  };

	Blockly.Blocks['controls_if_custom'] = {
		  init: function () {
			this.elseifCount_ = 0;
			this.elseCount_ = 0;
			this.setColour(210);
			this.setPreviousStatement(true);
			this.setNextStatement(true);
			this.setTooltip("Custom if/else block with inline icons and no 'do'");
			this.updateShape_();
		  },

		  preserveConnections_: function () {
			const connections = {};
			for (const input of this.inputList) {
			  if (input.connection && input.connection.targetConnection) {
				connections[input.name] = input.connection.targetConnection;
			  }
			}
			return connections;
		  },

		  restoreConnections_: function (connections) {
			for (const name in connections) {
			  const input = this.getInput(name);
			  if (input && input.connection && !input.connection.isConnected()) {
				input.connection.connect(connections[name]);
			  }
			}
		  },

		  makePlusIcon_: function (onClick) {
			return new Blockly.FieldImage(
			  'data:image/svg+xml;utf8,' + encodeURIComponent(`
				<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\">
				  <circle cx=\"10\" cy=\"10\" r=\"9\" fill=\"transparent\" stroke=\"white\" stroke-width=\"2\"/>
				  <line x1=\"5\" y1=\"10\" x2=\"15\" y2=\"10\" stroke=\"white\" stroke-width=\"2.5\"/>
				  <line x1=\"10\" y1=\"5\" x2=\"10\" y2=\"15\" stroke=\"white\" stroke-width=\"2.5\"/>
				</svg>`),
			  20, 20, '+', onClick
			);
		  },

		  makeMinusIcon_: function (onClick) {
			return new Blockly.FieldImage(
			  'data:image/svg+xml;utf8,' + encodeURIComponent(`
				<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\">
				  <circle cx=\"10\" cy=\"10\" r=\"9\" fill=\"transparent\" stroke=\"white\" stroke-width=\"2\"/>
				  <line x1=\"5\" y1=\"10\" x2=\"15\" y2=\"10\" stroke=\"white\" stroke-width=\"2.5\"/>
				</svg>`),
			  20, 20, '-', onClick
			);
		  },

		  updateShape_: function () {
			const savedConnections = this.preserveConnections_();
			while (this.inputList.length) this.removeInput(this.inputList[0].name);

			// IF0 row
			const if0Input = this.appendValueInput('IF0').setCheck('Boolean').appendField('if');
			this.appendDummyInput('ICONS_IF0')
			  .setAlign(Blockly.ALIGN_RIGHT)
			  .appendField(this.makePlusIcon_(() => this.addElseIfAt(0)));
			this.appendStatementInput('DO0').appendField(new Blockly.FieldLabel(''));

			// ELSE IFs
			for (let i = 1; i <= this.elseifCount_; i++) {
			  const input = this.appendValueInput('IF' + i).setCheck('Boolean').appendField('else if');
			  this.appendDummyInput('ICONS_' + i)
				.setAlign(Blockly.ALIGN_RIGHT)
				.appendField(this.makePlusIcon_(() => this.addElseIfAt(i)))
				.appendField(this.makeMinusIcon_(() => this.removeElseIf_(i)));
			  this.appendStatementInput('DO' + i).appendField(new Blockly.FieldLabel(''));
			}

			// ELSE
			if (this.elseCount_) {
			  const elseInput = this.appendDummyInput('ELSE_ROW');
			  elseInput.appendField('else');
			  elseInput.appendField(this.makeMinusIcon_(() => this.removeElse_()));

			  this.appendStatementInput('ELSE')
				.setCheck(null)
				.appendField(new Blockly.FieldLabel(''));
			}

			const bottom = this.appendDummyInput('BOTTOM_ADD');
			bottom.setAlign(Blockly.ALIGN_RIGHT)
			  .appendField(this.makePlusIcon_(() => this.addElseOrElseIf()));

			this.restoreConnections_(savedConnections);
		  },

		  addElseOrElseIf: function () {
			if (this.elseCount_ === 0) {
			  this.elseCount_ = 1;
			} else {
			  this.elseifCount_++;
			}
			this.updateShape_();
		  },

		  addElseIfAt: function (index) {
			this.elseifCount_++;
			for (let i = this.elseifCount_ - 1; i >= index + 1; i--) {
			  this.renameInput_('IF' + i, 'IF' + (i + 1));
			  this.renameInput_('DO' + i, 'DO' + (i + 1));
			  this.renameInput_('ICONS_' + i, 'ICONS_' + (i + 1));
			}
			this.updateShape_();
		  },

		  removeElseIf_: function (index) {
			this.removeInput('IF' + index);
			this.removeInput('DO' + index);
			this.removeInput('ICONS_' + index);
			for (let i = index + 1; i <= this.elseifCount_; i++) {
			  this.renameInput_('IF' + i, 'IF' + (i - 1));
			  this.renameInput_('DO' + i, 'DO' + (i - 1));
			  this.renameInput_('ICONS_' + i, 'ICONS_' + (i - 1));
			}
			this.elseifCount_--;
			this.updateShape_();
		  },

		  removeElse_: function () {
			this.removeInput('ELSE');
			this.removeInput('ELSE_ROW');
			this.elseCount_ = 0;
			this.updateShape_();
		  },

		  renameInput_: function (oldName, newName) {
			const input = this.getInput(oldName);
			if (input) input.name = newName;
		  },

		  mutationToDom: function () {
			const container = document.createElement('mutation');
			if (this.elseifCount_) container.setAttribute('elseif', this.elseifCount_);
			if (this.elseCount_) container.setAttribute('else', 1);
			return container;
		  },

		  domToMutation: function (xmlElement) {
			this.elseifCount_ = parseInt(xmlElement.getAttribute('elseif')) || 0;
			this.elseCount_ = parseInt(xmlElement.getAttribute('else')) || 0;
			this.updateShape_();
		  },

		  saveExtraState: function () {
			return {
			  elseIfCount: this.elseifCount_,
			  hasElse: this.elseCount_ === 1
			};
		  },

		  loadExtraState: function (state) {
			this.elseifCount_ = state.elseIfCount || 0;
			this.elseCount_ = state.hasElse ? 1 : 0;
			this.updateShape_();
		  }
		};

		//Blockly.Blocks["controls_if"] = Blockly.Blocks["controls_if_custom"];
}
