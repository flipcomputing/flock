import * as Blockly from 'blockly';

const WARNING_ICON_SCALE = 1.4;

const BaseIconInitView = Object.getPrototypeOf(Blockly.icons.WarningIcon.prototype).initView;

function initView(pointerdownListener) {
  if (this.svgRoot) return;

  BaseIconInitView.call(this, pointerdownListener);

  const scaleGroup = Blockly.utils.dom.createSvgElement(
    Blockly.utils.Svg.G,
    { transform: `scale(${WARNING_ICON_SCALE})` },
    this.svgRoot
  );
  Blockly.utils.dom.createSvgElement(
    Blockly.utils.Svg.PATH,
    {
      class: 'blocklyIconShape',
      d: 'M2,15Q-1,15 0.5,12L6.5,1.7Q8,-1 9.5,1.7L15.5,12Q17,15 14,15z',
    },
    scaleGroup
  );
  Blockly.utils.dom.createSvgElement(
    Blockly.utils.Svg.PATH,
    {
      class: 'blocklyIconSymbol',
      d: 'm7,4.8v3.16l0.27,2.27h1.46l0.27,-2.27v-3.16z',
    },
    scaleGroup
  );
  Blockly.utils.dom.createSvgElement(
    Blockly.utils.Svg.RECT,
    { class: 'blocklyIconSymbol', x: '7', y: '11', height: '2', width: '2' },
    scaleGroup
  );
  Blockly.utils.dom.addClass(this.svgRoot, 'blocklyWarningIcon');
}

function getSize() {
  return new Blockly.utils.Size(17 * WARNING_ICON_SCALE, 17 * WARNING_ICON_SCALE);
}

export function patchWarningIconSize() {
  Blockly.icons.WarningIcon.prototype.initView = initView;
  Blockly.icons.WarningIcon.prototype.getSize = getSize;
}
