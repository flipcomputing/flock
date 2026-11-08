export function validateBlocklyJson(json) {
  // 1. Parse JSON safely
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error('Invalid JSON format');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid project: expected a JSON object');
  }

  // 2. Reject keys that a nested merge would follow onto Object.prototype
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  function checkForDangerousContent(obj, path = '') {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'object') {
      // Check for dangerous keys
      for (const key of Object.keys(obj)) {
        if (dangerousKeys.includes(key)) {
          throw new Error(`Dangerous property found: ${key} at ${path}`);
        }
        checkForDangerousContent(obj[key], path ? `${path}.${key}` : key);
      }
    }
  }

  const positionOf = (mesh, property) => ({
    type: 'get_property',
    fields: { MESH: mesh, PROPERTY: property },
  });

  function upgradeMoveUseY(block) {
    if (block.type !== 'move_to_xyz' && block.type !== 'move_to') return;
    if (!block.fields || !('USE_Y' in block.fields)) return;

    const useY = block.fields.USE_Y;
    delete block.fields.USE_Y;
    if (useY !== false && useY !== 'FALSE') return;

    if (block.type === 'move_to') {
      const { MODEL1: mesh, MODEL2: target } = block.fields;
      const number = { shadow: { type: 'math_number', fields: { NUM: 0 } } };
      block.type = 'move_to_xyz';
      block.fields = { MODEL: mesh };
      block.inputs = {
        X: { ...number, block: positionOf(target, 'POSITION_X') },
        Y: { ...number, block: positionOf(mesh, 'POSITION_Y') },
        Z: { ...number, block: positionOf(target, 'POSITION_Z') },
      };
      return;
    }

    block.inputs = block.inputs || {};
    block.inputs.Y = { ...block.inputs.Y, block: positionOf(block.fields.MODEL, 'POSITION_Y') };
  }

  function upgradeMoveToOffsets(block) {
    if (block.type !== 'move_to') return;
    block.inputs = block.inputs || {};
    for (const name of ['X_OFFSET', 'Y_OFFSET', 'Z_OFFSET']) {
      block.inputs[name] ??= { shadow: { type: 'math_number', fields: { NUM: 0 } } };
    }
  }

  const followSides = { TOP: 'PLACE_ON_TOP', CENTER: 'PLACE_CENTER', BOTTOM: 'PLACE_AT' };

  function upgradeFollowPosition(block) {
    if (block.type !== 'follow' || !block.fields || !('FOLLOW_POSITION' in block.fields)) return;
    block.fields.SIDE = followSides[block.fields.FOLLOW_POSITION] ?? 'PLACE_AT';
    delete block.fields.FOLLOW_POSITION;
  }

  function upgradeLegacyBlocks(block) {
    if (!block || typeof block !== 'object') return;

    upgradeMoveUseY(block);
    upgradeMoveToOffsets(block);
    upgradeFollowPosition(block);

    const legacyAnimationName = block.fields?.ANIMATION_NAME;
    const hasNewAnimationInput = block.inputs?.ANIMATION_NAME;

    if (
      legacyAnimationName &&
      !hasNewAnimationInput &&
      (block.type === 'play_animation' || block.type === 'switch_animation')
    ) {
      block.inputs = block.inputs || {};
      block.inputs.ANIMATION_NAME = {
        shadow: {
          type: 'animation_name',
          fields: { ANIMATION_NAME: legacyAnimationName },
        },
      };

      delete block.fields.ANIMATION_NAME;

      if (block.fields && Object.keys(block.fields).length === 0) {
        delete block.fields;
      }
    }

    if (block.inputs) {
      Object.values(block.inputs).forEach((input) => {
        upgradeLegacyBlocks(input?.block);
        upgradeLegacyBlocks(input?.shadow);
      });
    }

    upgradeLegacyBlocks(block.next?.block);
  }

  // 3. Validate it's actually a Blockly workspace structure
  function validateBlocklyStructure(data) {
    if (data.version !== undefined && typeof data.version !== 'string') {
      throw new Error('Invalid project version');
    }

    if (
      data.settings !== undefined &&
      (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings))
    ) {
      throw new Error('Invalid project settings');
    }

    // Empty workspace is valid
    if (Object.keys(data).every((key) => key === 'version' || key === 'settings')) {
      return;
    }

    // Blockly workspace JSON should have specific structure
    // Check if data.blocks exists and is a non-null object (not an array)
    if (!data.blocks || typeof data.blocks !== 'object' || Array.isArray(data.blocks)) {
      throw new Error('Invalid Blockly structure: missing or invalid blocks object');
    }

    // Whitelist allowed properties at root level
    const allowedRootKeys = ['version', 'settings', 'blocks', 'variables', 'workspaceComments'];
    const rootKeys = Object.keys(data);

    for (const key of rootKeys) {
      if (!allowedRootKeys.includes(key)) {
        console.warn(`Unexpected property in Blockly JSON: ${key}`);
      }
    }

    // Whitelist allowed properties in blocks object
    const allowedBlocksKeys = ['languageVersion', 'blocks'];
    if (data.blocks) {
      for (const key of Object.keys(data.blocks)) {
        if (!allowedBlocksKeys.includes(key)) {
          console.warn(`Unexpected property in blocks object: ${key}`);
        }
      }
    }

    // Validate blocks array if present
    if (data.blocks.blocks) {
      if (!Array.isArray(data.blocks.blocks)) {
        throw new Error('Invalid Blockly structure: blocks.blocks must be an array');
      }
      data.blocks.blocks.forEach((block, index) => {
        validateBlock(block, `blocks.blocks[${index}]`);
      });
    }

    // Validate variables if present
    if (data.variables) {
      if (!Array.isArray(data.variables)) {
        throw new Error('Invalid Blockly structure: variables must be an array');
      }
      data.variables.forEach((variable, index) => {
        if (!variable.name || !variable.id) {
          throw new Error(`Invalid variable at variables[${index}]: must have name and id`);
        }
      });
    }
  }

  // 4. Validate individual block structure
  function validateBlock(block, path) {
    if (!block || typeof block !== 'object') {
      throw new Error(`Invalid block at ${path}`);
    }

    // Whitelist allowed block properties
    const allowedBlockKeys = [
      'type',
      'id',
      'x',
      'y',
      'collapsed',
      'disabled',
      'deletable',
      'movable',
      'editable',
      'inline',
      'data',
      'extraState',
      'icons',
      'fields',
      'inputs',
      'next',
      'shadow',
      'disabledReasons',
    ];

    for (const key of Object.keys(block)) {
      if (!allowedBlockKeys.includes(key)) {
        throw new Error(`Unexpected block property: ${key} at ${path}`);
      }
    }

    // Validate field values
    if (block.fields) {
      Object.entries(block.fields).forEach(([fieldName, fieldValue]) => {
        if (fieldValue && typeof fieldValue === 'object') {
          // Field values can be objects with 'id' property for variables
          if (!fieldValue.id) {
            checkForDangerousContent(fieldValue, `${path}.fields.${fieldName}`);
          }
        } else if (typeof fieldValue === 'string') {
          // Check string field values for dangerous content
          checkForDangerousContent(fieldValue, `${path}.fields.${fieldName}`);
        }
      });
    }

    // Recursively validate nested blocks
    if (block.inputs) {
      Object.entries(block.inputs).forEach(([inputName, input]) => {
        if (input.block) {
          validateBlock(input.block, `${path}.inputs.${inputName}.block`);
        }
        if (input.shadow) {
          validateBlock(input.shadow, `${path}.inputs.${inputName}.shadow`);
        }
      });
    }

    if (block.next?.block) {
      validateBlock(block.next.block, `${path}.next.block`);
    }
  }

  // Run all validations
  checkForDangerousContent(data);
  validateBlocklyStructure(data);

  if (data?.blocks?.blocks) {
    data.blocks.blocks.forEach((block) => upgradeLegacyBlocks(block));
  }

  return data;
}
