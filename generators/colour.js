import * as Blockly from "blockly";
import { Order } from "./order.js";

export function defineColourGenerators() {

  // Basic colour picker generator
  Blockly.JavaScript['colour_picker'] = function(block) {
    const colour = block.getFieldValue('COLOUR');
    const code = `"${colour}"`;
    return [code, Order.ATOMIC];
  };

  // Random colour generator  
  Blockly.JavaScript['colour_random'] = function(block) {
    const code = 'flock.randomColour()';
    return [code, Order.FUNCTION_CALL];
  };

  // RGB colour generator
  Blockly.JavaScript['colour_rgb'] = function(block) {
    const red = Blockly.JavaScript.valueToCode(block, 'RED', Order.NONE) || '0';
    const green = Blockly.JavaScript.valueToCode(block, 'GREEN', Order.NONE) || '0';
    const blue = Blockly.JavaScript.valueToCode(block, 'BLUE', Order.NONE) || '0';
    
    const code = `flock.rgbToHex(Math.max(0, Math.min(255, ${red})), Math.max(0, Math.min(255, ${green})), Math.max(0, Math.min(255, ${blue})))`;
    return [code, Order.FUNCTION_CALL];
  };

  // Blend colours generator
  Blockly.JavaScript['colour_blend'] = function(block) {
    const colour1 = Blockly.JavaScript.valueToCode(block, 'COLOUR1', Order.NONE) || '"#000000"';
    const colour2 = Blockly.JavaScript.valueToCode(block, 'COLOUR2', Order.NONE) || '"#ffffff"';
    const ratio = Blockly.JavaScript.valueToCode(block, 'RATIO', Order.NONE) || '0.5';
    
    // Generate code to blend two colors
    const code = `(() => {
      const c1 = flock.hexToRgb(${colour1});
      const c2 = flock.hexToRgb(${colour2});
      const ratio = Math.max(0, Math.min(1, ${ratio}));
      const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio);
      const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio);
      const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio);
      return flock.rgbToHex(r, g, b);
    })()`;
    
    return [code, Order.FUNCTION_CALL];
  };
}