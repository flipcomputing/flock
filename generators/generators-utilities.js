import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { meshMap, meshBlockIdMap } from "./mesh-state.js";

// ---------------------------------
//  Utility functions for generators
// ---------------------------------

export function getFieldValue(block, fieldName, defaultValue) {
  return (
    javascriptGenerator.valueToCode(
      block,
      fieldName,
      javascriptGenerator.ORDER_ATOMIC,
    ) || defaultValue
  );
}

export function getVariableInfo(block, fieldName) {
  const variableId = block.getFieldValue(fieldName);
  const generatedName = javascriptGenerator.nameDB_.getName(
    variableId,
    Blockly.Names.NameType.VARIABLE,
  );
  const variableModel = block.workspace
    ?.getVariableMap?.()
    ?.getVariableById(variableId);
  const userVariableName = variableModel?.name || generatedName;

  return { generatedName, userVariableName };
}

export function getPositionTuple(block) {
  const posX = getFieldValue(block, "X", "0");
  const posY = getFieldValue(block, "Y", "0");
  const posZ = getFieldValue(block, "Z", "0");

  return `[${posX}, ${posY}, ${posZ}]`;
}

export function createMesh(block, meshType, params) {
  const { generatedName: variableName, userVariableName } = getVariableInfo(
    block,
    "ID_VAR",
  );

  const meshId = `${userVariableName}__${block.id}`;

  meshMap[block.id] = block;
  meshBlockIdMap[block.id] = block.id;

  const doCode = block.getInput("DO")
    ? javascriptGenerator.statementToCode(block, "DO") || ""
    : "";

  const options = [...params];

  return `${variableName} = create${meshType}("${meshId}", { ${options.join(", ")} });\n${doCode}`;
}

export function emitSafeIdentifierLiteral(code) {
  const RESERVED_IDENTIFIERS = new Set([
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
    "arguments",
    "eval",
  ]);

  if (!code) {
    return "undefined";
  }

  // Match single, double, or template quoted literals
  const m = code.match(/^(['"`])(.*)\1$/s);
  if (!m) {
    return "undefined";
  }

  const rawBody = m[2];

  // Reject escapes entirely
  if (rawBody.includes("\\")) {
    return "undefined";
  }

  // Replace spaces and other whitespace with underscores
  const normalized = rawBody.replace(/\s+/g, "_");

  // Validate identifier
  if (!/^[A-Za-z$_][A-Za-z0-9$_]*$/.test(normalized)) {
    return "undefined";
  }

  // Check reserved keywords
  if (RESERVED_IDENTIFIERS.has(normalized)) {
    return "undefined";
  }

  return JSON.stringify(normalized);
}

export function sanitizeForCode(input) {
  let s = String(input);

  // Cut from the first *real* newline (\r, \n, or Unicode line separator)
  s = s.replace(/[\r\n\u2028\u2029].*$/s, "");
  // Cut from the first *escaped* newline sequence (\n, \r, \u2028, \u2029, \x0A, \x0D)
  s = s.replace(/\\(?:n|r|u(?:2028|2029|000a|000d)|x0(?:a|d)).*$/i, "");

  // Remove any trailing backslashes that could remain (edge cases)
  s = s.replace(/\\+$/, "");

  // Neutralize comment and template literal markers
  s = s.replace(/\*\//g, "*∕").replace(/\/\//g, "∕∕").replace(/`/g, "ˋ");

  // Strip control characters (optional, keeps tabs/spaces)
  s = s.replace(/[\u0000-\u001F\u007F]/g, "");

  return s;
}

export function emitSafeTextArg(code) {
  if (!code) return '""';
  const m = code.match(/^(['"`])(.*)\1$/s);
  if (!m) return code;

  const q = m[1];
  const body = m[2];

  // Decode literal safely (handles \', \\ , \n, \uXXXX, etc.)
  let decoded;
  try {
    decoded = JSON.parse(q + body + q);
  } catch {
    decoded = body
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
  }

  return JSON.stringify(sanitizeForCode(decoded));
}
