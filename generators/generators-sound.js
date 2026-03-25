import * as Blockly from "blockly";

export function registerSoundGenerators(javascriptGenerator) {
  // -------------------------------
  // SOUND
  // -------------------------------
  // Play theme -----------------------------------------------
  javascriptGenerator.forBlock["play_theme"] = function (block) {
    const idVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("ID_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const meshNameField = block.getFieldValue("MESH_NAME");
    const meshName = `"${meshNameField}"`;

    const themeName = block.getFieldValue("THEME_NAME");

    const speedCode =
      javascriptGenerator.valueToCode(
        block,
        "SPEED",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    const volumeCode =
      javascriptGenerator.valueToCode(
        block,
        "VOLUME",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    const loop = block.getFieldValue("MODE") === "LOOP";
    const asyncMode = block.getFieldValue("ASYNC");

    const code = `${idVar} = ${asyncMode === "AWAIT" ? "await " : ""}playSound(${meshName}, { soundName: "${themeName}", loop: ${loop}, volume: ${volumeCode}, playbackRate: ${speedCode} });\n`;

    return code;
  };

  // Play sound -----------------------------------------------
  javascriptGenerator.forBlock["play_sound"] = function (block) {
    const idVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("ID_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const meshNameField = block.getFieldValue("MESH_NAME");
    const meshName = `"${meshNameField}"`; // Always quoted

    const soundName = block.getFieldValue("SOUND_NAME");

    const speedCode =
      javascriptGenerator.valueToCode(
        block,
        "SPEED",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    const volumeCode =
      javascriptGenerator.valueToCode(
        block,
        "VOLUME",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    const loop = block.getFieldValue("MODE") === "LOOP";
    const asyncMode = block.getFieldValue("ASYNC");

    // Build the final code line
    const code = `${idVar} = ${asyncMode === "AWAIT" ? "await " : ""}playSound(${meshName}, { soundName: "${soundName}", loop: ${loop}, volume: ${volumeCode}, playbackRate: ${speedCode} });\n`;

    return code;
  };

  // Stop all sounds ---------------------------------------------
  javascriptGenerator.forBlock["stop_all_sounds"] = function (block) {
    // JavaScript code to stop all sounds in a Babylon.js scene
    return "stopAllSounds();\n";
  };

  // MIDI note ---------------------------------------------------
  javascriptGenerator.forBlock["midi_note"] = function (block) {
    const note =
      javascriptGenerator.valueToCode(
        block,
        "NOTE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "60";
    return [note, javascriptGenerator.ORDER_ATOMIC];
  };

  // Rest --------------------------------------------------------
  javascriptGenerator.forBlock["rest"] = function () {
    // Rest is represented as null in sequences
    return ["null", javascriptGenerator.ORDER_ATOMIC];
  };

  // Play notes --------------------------------------------------
  javascriptGenerator.forBlock["play_notes"] = function (block) {
    const meshVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const notes =
      javascriptGenerator.valueToCode(
        block,
        "NOTES",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "[]";
    const durations =
      javascriptGenerator.valueToCode(
        block,
        "DURATIONS",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "[]";
    const instrument = javascriptGenerator.valueToCode(
      block,
      "INSTRUMENT",
      javascriptGenerator.ORDER_ATOMIC,
    );
    const asyncMode = block.getFieldValue("ASYNC");

    // Use the appropriate function based on the async mode
    if (asyncMode === "AWAIT") {
      return `await playNotes(${meshVar}, { notes: ${notes}, durations: ${durations}, instrument: ${instrument} });\n`;
    } else {
      return `playNotes(${meshVar}, { notes: ${notes}, durations: ${durations}, instrument: ${instrument} });\n`;
    }
  };

  // Instrument -----------------------------------------------
  javascriptGenerator.forBlock["instrument"] = function (block) {
    const instrumentType = block.getFieldValue("INSTRUMENT_TYPE");

    let instrumentCode;
    switch (instrumentType) {
      case "piano":
        instrumentCode = `createInstrument("square", { attack: 0.1, decay: 0.3, sustain: 0.7, release: 1.0 })`;
        break;
      case "guitar":
        instrumentCode = `createInstrument("sawtooth", { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.9 })`;
        break;
      case "violin":
        instrumentCode = `createInstrument("triangle", { attack: 0.15, decay: 0.5, sustain: 0.8, release: 1.2 })`;
        break;
      default:
        instrumentCode = `createInstrument("sine")`;
    }

    return [instrumentCode, javascriptGenerator.ORDER_ATOMIC];
  };

  // Create Instrument -----------------------------------------
  javascriptGenerator.forBlock["create_instrument"] = function (block) {
    const instrumentVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("INSTRUMENT"),
      Blockly.Names.NameType.VARIABLE,
    );
    const type = block.getFieldValue("TYPE");
    const effect = block.getFieldValue("EFFECT");
    const volume =
      javascriptGenerator.valueToCode(
        block,
        "VOLUME",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";
    const effectRate =
      javascriptGenerator.valueToCode(
        block,
        "EFFECT_RATE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "5";
    const effectDepth =
      javascriptGenerator.valueToCode(
        block,
        "EFFECT_DEPTH",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0.5";
    const attack =
      javascriptGenerator.valueToCode(
        block,
        "ATTACK",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0.1";
    const decay =
      javascriptGenerator.valueToCode(
        block,
        "DECAY",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0.5";
    const sustain =
      javascriptGenerator.valueToCode(
        block,
        "SUSTAIN",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0.7";
    const release =
      javascriptGenerator.valueToCode(
        block,
        "RELEASE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    // Assign the instrument to a variable
    return `${instrumentVar} = createInstrument('${type}', { volume: ${volume}, effect: '${effect}', effectRate: ${effectRate}, effectDepth: ${effectDepth}, attack: ${attack}, decay: ${decay}, sustain: ${sustain}, release: ${release} });\n`;
  };

  // Speak ------------------------------------------------------
  javascriptGenerator.forBlock["speak"] = function (block) {
    const text =
      javascriptGenerator.valueToCode(
        block,
        "TEXT",
        javascriptGenerator.ORDER_ATOMIC,
      ) || '""';

    const voice = block.getFieldValue("VOICE") || "default";

    const rate =
      javascriptGenerator.valueToCode(
        block,
        "RATE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    const pitch =
      javascriptGenerator.valueToCode(
        block,
        "PITCH",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    const volume =
      javascriptGenerator.valueToCode(
        block,
        "VOLUME",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    const language = block.getFieldValue("LANGUAGE") || "en-US";
    const asyncMode = block.getFieldValue("ASYNC") || "START";

    // Get the mesh variable name from the dynamic dropdown - same approach as play_sound block
    const meshInput = block.getInput("MESH_INPUT");

    const meshDropdownField = meshInput
      ? meshInput.fieldRow.find((field) => field.name === "MESH_NAME")
      : null;

    const meshValue = meshDropdownField
      ? meshDropdownField.getValue()
      : "__everywhere__";

    const meshVariable = `"${meshValue}"`;

    // Safely handle asyncMode - ensure it's not null
    const safeAsyncMode = asyncMode || "START";
    const asyncWrapper = safeAsyncMode === "AWAIT" ? "await " : "";

    return `${asyncWrapper}speak(${meshVariable}, ${text}, { voice: "${voice}", rate: ${rate}, pitch: ${pitch}, volume: ${volume}, language: "${language}", mode: "${safeAsyncMode.toLowerCase()}" });\n`;
  };
}
