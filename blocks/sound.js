import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
  nextVariableIndexes,
  handleBlockCreateEvent,
  getHelpUrlFor,
  registerBlockHandler,
} from "./blocks.js";
import {
  audioNames,
  themeNames,
  getSoundDisplayName,
  getThemeDisplayName,
} from "../config.js";
import {
  translate,
  getTooltip,
  getDropdownOption,
} from "../main/translation.js";
import { announceToScreenReader } from "../main/input.js";

// ---------------------------------------------------------------------------
// Custom multi-line text field for ABC notation input
// ---------------------------------------------------------------------------

class FieldAbcInput extends Blockly.FieldTextInput {
  showEditor_() {
    const current = this.getValue() || "";

    // Build modal entirely with DOM APIs — no innerHTML, no user content in
    // attribute values — so there is no XSS surface.
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;" +
      "display:flex;align-items:center;justify-content:center";

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "abc-dlg-title");
    dialog.style.cssText =
      "background:#fff;border-radius:8px;padding:20px;display:flex;" +
      "flex-direction:column;gap:12px;width:520px;max-width:90vw;" +
      "box-shadow:0 8px 32px rgba(0,0,0,.3)";

    const titleEl = document.createElement("h2");
    titleEl.id = "abc-dlg-title";
    titleEl.textContent = "ABC notation";
    titleEl.style.cssText = "margin:0;font:bold 15px/1 sans-serif;color:#333";

    const hint = document.createElement("p");
    hint.textContent =
      "Paste or type ABC notation. Ctrl+Enter to import, Escape to cancel.";
    hint.style.cssText = "margin:0;font:12px/1.4 sans-serif;color:#666";

    const textarea = document.createElement("textarea");
    textarea.rows = 14;
    textarea.spellcheck = false;
    textarea.setAttribute("aria-label", "ABC notation");
    textarea.style.cssText =
      "width:100%;box-sizing:border-box;font:13px/1.5 monospace;" +
      "resize:vertical;border:1px solid #ccc;border-radius:4px;padding:8px";
    // Set via .value (textarea property), never via innerHTML
    textarea.value = current;

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;justify-content:flex-end;gap:8px";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText =
      "padding:7px 18px;border:1px solid #ccc;border-radius:4px;" +
      "cursor:pointer;background:#f5f5f5;font-size:13px";

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "Import tune";
    importBtn.style.cssText =
      "padding:7px 18px;border:none;border-radius:4px;cursor:pointer;" +
      "background:#4a90d9;color:#fff;font-size:13px";

    buttons.append(cancelBtn, importBtn);
    dialog.append(titleEl, hint, textarea, buttons);
    overlay.append(dialog);

    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
    };

    const confirm = () => {
      const newVal = textarea.value;
      if (newVal !== current) this.setValue(newVal);
      close();
    };

    cancelBtn.addEventListener("click", close);
    importBtn.addEventListener("click", confirm);
    // Clicking the dimmed backdrop dismisses without importing
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        confirm();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    document.body.append(overlay);
    // Defer focus so the overlay is in the DOM before the browser moves focus
    setTimeout(() => textarea.focus(), 0);
  }

  getText_() {
    const val = this.getValue();
    if (!val) return "click to enter ABC…";
    const titleLine = String(val)
      .split("\n")
      .find((l) => l.trim().startsWith("T:"));
    return titleLine ? titleLine.trim().slice(2).trim() : "ABC";
  }

  getAriaTypeName() {
    return "ABC notation";
  }
}

// ---------------------------------------------------------------------------
// ABC notation parser and block generator for play_tune
// ---------------------------------------------------------------------------

// Cap pasted ABC size — every note becomes several workspace blocks, so an
// oversized paste would freeze the tab creating them.
const ABC_MAX_INPUT_LENGTH = 20000;

const ABC_BASE_MIDI = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };

const ABC_KEY_ACCIDENTALS = {
  C: {}, Am: {},
  G: { F: 1 }, Em: { F: 1 },
  D: { F: 1, C: 1 }, Bm: { F: 1, C: 1 },
  A: { F: 1, C: 1, G: 1 }, "F#m": { F: 1, C: 1, G: 1 },
  E: { F: 1, C: 1, G: 1, D: 1 }, "C#m": { F: 1, C: 1, G: 1, D: 1 },
  B: { F: 1, C: 1, G: 1, D: 1, A: 1 }, "G#m": { F: 1, C: 1, G: 1, D: 1, A: 1 },
  "F#": { F: 1, C: 1, G: 1, D: 1, A: 1, E: 1 }, "D#m": { F: 1, C: 1, G: 1, D: 1, A: 1, E: 1 },
  "C#": { F: 1, C: 1, G: 1, D: 1, A: 1, E: 1, B: 1 },
  F: { B: -1 }, Dm: { B: -1 },
  Bb: { B: -1, E: -1 }, Gm: { B: -1, E: -1 },
  Eb: { B: -1, E: -1, A: -1 }, Cm: { B: -1, E: -1, A: -1 },
  Ab: { B: -1, E: -1, A: -1, D: -1 }, Fm: { B: -1, E: -1, A: -1, D: -1 },
  Db: { B: -1, E: -1, A: -1, D: -1, G: -1 }, Bbm: { B: -1, E: -1, A: -1, D: -1, G: -1 },
  Gb: { B: -1, E: -1, A: -1, D: -1, G: -1, C: -1 },
  Cb: { B: -1, E: -1, A: -1, D: -1, G: -1, C: -1, F: -1 },
};

function abcParseFraction(str) {
  const parts = str.split("/");
  if (parts.length === 2) return parseInt(parts[0]) / parseInt(parts[1]);
  return parseFloat(str) || 1;
}

function parseAbc(abcText) {
  const lines = abcText.split("\n");
  let title = "";
  let composer = "";
  let lFraction = 0.125;
  let bpm = 120;
  let keyAcc = {};
  const musicLines = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const hm = t.match(/^[a-z]*([A-Za-z]):(.*)/);
    if (hm) {
      const [, key, value] = hm;
      const v = value.trim();
      if (key === "T") title = v;
      else if (key === "C") composer = v;
      else if (key === "L") lFraction = abcParseFraction(v);
      else if (key === "Q") {
        const qm = v.match(/(\d+)$/);
        if (qm) bpm = parseInt(qm[1]);
      } else if (key === "K") {
        const keyName = v.split(" ")[0];
        keyAcc = Object.hasOwn(ABC_KEY_ACCIDENTALS, keyName)
          ? ABC_KEY_ACCIDENTALS[keyName]
          : {};
      }
    } else {
      musicLines.push(t);
    }
  }

  const fullTitle = composer ? `${title} - ${composer}` : title;
  const noteBase = lFraction * 4;
  const sections = abcParseSections(musicLines, noteBase, keyAcc);
  return { title: fullTitle, bpm, sections };
}

function abcParseSections(musicLines, noteBase, keyAcc) {
  const text = musicLines.join(" ").replace(/%[^\n]*/g, "");
  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }

    if (c === "|") {
      const n = text[i + 1];
      if (n === ":") { tokens.push({ t: "rs" }); i += 2; }
      else if (n === "]") { tokens.push({ t: "bar" }); i += 2; }
      else if (n === "1") { tokens.push({ t: "v1" }); i += 2; }
      else if (n === "2") { tokens.push({ t: "v2" }); i += 2; }
      else if (n === "|") { tokens.push({ t: "bar" }); i += 2; }
      else { tokens.push({ t: "bar" }); i++; }
    } else if (c === ":") {
      if (text[i + 1] === "|") {
        tokens.push({ t: "re" });
        i += 2;
        // Look ahead for volta markers (e.g. :|[1 or :|1)
        while (i < text.length && /\s/.test(text[i])) i++;
        if (text[i] === "[" && (text[i + 1] === "1" || text[i + 1] === "2")) {
          tokens.push({ t: text[i + 1] === "1" ? "v1" : "v2" }); i += 2;
        } else if (text[i] === "1") {
          tokens.push({ t: "v1" }); i++;
        } else if (text[i] === "2") {
          tokens.push({ t: "v2" }); i++;
        }
      } else { i++; }
    } else if (c === "[") {
      if (text[i + 1] === "1") { tokens.push({ t: "v1" }); i += 2; }
      else if (text[i + 1] === "2") { tokens.push({ t: "v2" }); i += 2; }
      else { i++; }
    } else {
      const sub = text.slice(i);
      const m = sub.match(/^([_^=]*)([A-Ga-gz])([',]*)(\d*)(\/\d*)?/);
      if (m) {
        const [full, accStr, letter, octStr, numStr, denomStr] = m;
        const num = numStr ? parseInt(numStr) : 1;
        let denom = 1;
        if (denomStr) denom = denomStr === "/" ? 2 : parseInt(denomStr.slice(1)) || 2;
        const beats = noteBase * (num / denom);
        const lo = letter.toLowerCase();

        if (lo === "z" || lo === "x") {
          tokens.push({ t: "rest", beats });
        } else {
          const base = letter.toUpperCase();
          let midi = ABC_BASE_MIDI[base] + (letter !== letter.toUpperCase() ? 12 : 0);
          for (const oc of octStr) {
            if (oc === "'") midi += 12;
            else if (oc === ",") midi -= 12;
          }
          let acc = 0;
          let hasAcc = false;
          if (accStr) {
            hasAcc = true;
            for (const a of accStr) {
              if (a === "^") acc++;
              else if (a === "_") acc--;
            }
          }
          tokens.push({ t: "note", base, midi, beats, hasAcc, acc });
        }
        i += full.length;
      } else { i++; }
    }
  }

  // State machine: parse tokens into sections
  const sections = [];
  let currentBars = [];
  let currentBar = [];
  let barAcc = {};
  let state = "plain";
  let repeatBars = null;
  let volta1Bars = null;

  const flushBar = () => {
    if (currentBar.length > 0) {
      currentBars.push(currentBar);
      currentBar = [];
      barAcc = {};
    }
  };

  const addNote = (tok) => {
    let midiAcc = 0;
    if (tok.hasAcc) {
      midiAcc = tok.acc;
      barAcc[tok.base] = midiAcc;
    } else if (barAcc[tok.base] !== undefined) {
      midiAcc = barAcc[tok.base];
    } else if (keyAcc[tok.base] !== undefined) {
      midiAcc = keyAcc[tok.base];
    }
    currentBar.push({ midi: tok.midi + midiAcc, beats: tok.beats });
  };

  for (let tokIdx = 0; tokIdx < tokens.length; tokIdx++) {
    const tok = tokens[tokIdx];
    switch (tok.t) {
      case "bar":
        flushBar();
        break;
      case "rs":
        flushBar();
        if (state === "volta" && repeatBars !== null) {
          // Finalize the preceding volta before starting a new repeat section
          sections.push({
            type: "volta",
            commonBars: repeatBars,
            firstBars: volta1Bars || [],
            secondBars: [...currentBars],
          });
          repeatBars = null;
          volta1Bars = null;
        } else if (currentBars.length > 0) {
          sections.push({ type: "plain", bars: [...currentBars] });
        }
        currentBars = [];
        state = "repeat";
        break;
      case "re":
        flushBar();
        if (state === "repeat" || state === "plain") {
          const nextTok = tokens[tokIdx + 1];
          if (nextTok?.t === "v1" || nextTok?.t === "v2") {
            // :| immediately followed by [1 or [2 — the body so far is the common part
            repeatBars = [...currentBars];
            volta1Bars = [];
            currentBars = [];
            state = "volta";
          } else if (currentBars.length > 0) {
            sections.push({ type: "repeat", bars: [...currentBars] });
            currentBars = [];
            state = "plain";
          }
        } else if (state === "volta") {
          const nextTok = tokens[tokIdx + 1];
          if (nextTok?.t === "v1" || nextTok?.t === "v2") {
            // Transitioning between endings — accumulate into firstBars
            volta1Bars = [...(volta1Bars || []), ...currentBars];
            currentBars = [];
          }
          // Closing :| of last ending — leave currentBars for secondBars
        }
        break;
      case "v1":
        flushBar();
        if (state !== "volta") {
          // v1 appearing without a preceding :| — current bars are the common part
          repeatBars = [...currentBars];
          volta1Bars = [];
          currentBars = [];
          state = "volta";
        }
        // already in volta (set by :| lookahead above) — leave repeatBars alone
        break;
      case "v2":
        flushBar();
        if (state !== "volta") {
          volta1Bars = [...currentBars];
          repeatBars = repeatBars || [];
          state = "volta";
        }
        currentBars = [];
        break;
      case "note":
        addNote(tok);
        break;
      case "rest":
        currentBar.push({ midi: null, beats: tok.beats });
        break;
    }
  }

  flushBar();
  if (state === "volta" && repeatBars !== null) {
    sections.push({
      type: "volta",
      commonBars: repeatBars,
      firstBars: volta1Bars || [],
      secondBars: [...currentBars],
    });
  } else if (currentBars.length > 0) {
    sections.push({ type: "plain", bars: currentBars });
  }

  return sections;
}


function buildPlayBlock(ws, bars, meshName) {
  const validBars = (bars || []).filter((b) => b && b.length > 0);
  if (validBars.length === 0) return null;

  const outerList = ws.newBlock("lists_create_with");
  outerList.loadExtraState({ itemCount: validBars.length });
  outerList.initSvg();
  outerList.render();

  validBars.forEach((bar, barIdx) => {
    const barBlock = ws.newBlock("lists_create_with");
    barBlock.loadExtraState({ itemCount: bar.length });
    barBlock.setInputsInline(true);
    barBlock.initSvg();
    barBlock.render();

    bar.forEach((note, noteIdx) => {
      const noteBlock = ws.newBlock("note");
      noteBlock.initSvg();
      noteBlock.render();

      if (note.midi === null) {
        const restBlock = ws.newBlock("rest");
        restBlock.initSvg();
        restBlock.render();
        noteBlock.getInput("PITCH").connection.connect(restBlock.outputConnection);
      } else {
        noteBlock.getInput("PITCH").connection.connect(makeNumBlock(ws, note.midi).outputConnection);
      }
      const dur = Math.round(note.beats * 1000) / 1000;
      noteBlock.getInput("DURATION").connection.connect(makeNumBlock(ws, dur).outputConnection);
      barBlock.getInput(`ADD${noteIdx}`).connection.connect(noteBlock.outputConnection);
    });

    outerList.getInput(`ADD${barIdx}`).connection.connect(barBlock.outputConnection);
  });

  const playBlock = ws.newBlock("play_tune_notes");
  playBlock.initSvg();
  playBlock.render();

  const instBlock = ws.newBlock("instrument");
  instBlock.setFieldValue("default", "INSTRUMENT_TYPE");
  instBlock.initSvg();
  instBlock.render();
  if (meshName) playBlock.setFieldValue(meshName, "MESH_NAME");
  playBlock.getInput("INSTRUMENT").connection.connect(instBlock.outputConnection);
  playBlock.getInput("NOTES").connection.connect(outerList.outputConnection);

  return playBlock;
}

// Walk blocks inside a statement chain and its nested statement inputs,
// updating MESH_NAME on every play_tune_notes found.
// Checks child.previousConnection to tell statement inputs from value inputs —
// value inputs connect to blocks with outputConnection, not previousConnection.
function propagateMesh(block, meshName) {
  while (block) {
    if (block.getField("MESH_NAME")) {
      block.setFieldValue(meshName, "MESH_NAME");
    }
    for (const input of block.inputList) {
      const child = input.connection?.targetBlock();
      if (child?.previousConnection) propagateMesh(child, meshName);
    }
    block = block.getNextBlock();
  }
}

function propagateInstrument(block, instrumentState) {
  const state = Object.assign({}, instrumentState);
  delete state.id;
  delete state.shadow;
  while (block) {
    if (block.type === "play_tune_notes") {
      const instrConn = block.getInput("INSTRUMENT")?.connection;
      if (instrConn) {
        const existing = instrConn.targetBlock();
        if (existing && !existing.isShadow()) existing.dispose(false);
        const newInstr = Blockly.serialization.blocks.append(state, block.workspace);
        if (newInstr?.outputConnection) instrConn.connect(newInstr.outputConnection);
      }
    }
    for (const input of block.inputList) {
      const child = input.connection?.targetBlock();
      if (child?.previousConnection) propagateInstrument(child, state);
    }
    block = block.getNextBlock();
  }
}

function makeNumBlock(ws, value) {
  const b = ws.newBlock("math_number");
  b.setFieldValue(String(value), "NUM");
  b.initSvg();
  b.render();
  return b;
}

function abcBuildDoBlocks(ws, doInput, sections, bpm, meshName) {
  const hasBars = sections.some((s) =>
    s.type === "plain" ? s.bars?.length > 0 :
    s.type === "repeat" ? s.bars?.length > 0 :
    (s.commonBars?.length > 0 || s.firstBars?.length > 0 || s.secondBars?.length > 0)
  );
  if (!hasBars) {
    console.warn("[play_tune] no bars found in ABC");
    return;
  }

  const speed = Math.round((bpm / 60) * 1000) / 1000;
  const speedBlock = ws.newBlock("set_music_speed");
  speedBlock.initSvg();
  speedBlock.render();
  speedBlock.getInput("SPEED").connection.connect(makeNumBlock(ws, speed).outputConnection);
  doInput.connection.connect(speedBlock.previousConnection);

  let prevNext = speedBlock.nextConnection;

  for (const section of sections) {
    if (section.type === "plain") {
      const playBlock = buildPlayBlock(ws, section.bars, meshName);
      if (!playBlock) continue;
      prevNext.connect(playBlock.previousConnection);
      prevNext = playBlock.nextConnection;

    } else if (section.type === "repeat") {
      const repeatBlock = ws.newBlock("controls_repeat_ext");
      repeatBlock.initSvg();
      repeatBlock.render();
      repeatBlock.getInput("TIMES").connection.connect(makeNumBlock(ws, 2).outputConnection);

      const playBlock = buildPlayBlock(ws, section.bars, meshName);
      if (playBlock) {
        repeatBlock.getInput("DO").connection.connect(playBlock.previousConnection);
      }

      prevNext.connect(repeatBlock.previousConnection);
      prevNext = repeatBlock.nextConnection;

    } else if (section.type === "volta") {
      const varModel =
        ws.getVariableMap().getVariable("_repeat", "") || ws.createVariable("_repeat");

      const forBlock = ws.newBlock("controls_for");
      forBlock.initSvg();
      forBlock.render();
      forBlock.getField("VAR").setValue(varModel.getId());
      forBlock.getInput("FROM").connection.connect(makeNumBlock(ws, 1).outputConnection);
      forBlock.getInput("TO").connection.connect(makeNumBlock(ws, 2).outputConnection);
      forBlock.getInput("BY").connection.connect(makeNumBlock(ws, 1).outputConnection);

      const ifBlock = ws.newBlock("controls_if");
      ifBlock.loadExtraState({ hasElse: true });
      ifBlock.initSvg();
      ifBlock.render();

      const compareBlock = ws.newBlock("logic_compare");
      compareBlock.setFieldValue("EQ", "OP");
      compareBlock.initSvg();
      compareBlock.render();

      const varGetBlock = ws.newBlock("variables_get");
      varGetBlock.getField("VAR").setValue(varModel.getId());
      varGetBlock.initSvg();
      varGetBlock.render();

      compareBlock.getInput("A").connection.connect(varGetBlock.outputConnection);
      compareBlock.getInput("B").connection.connect(makeNumBlock(ws, 1).outputConnection);
      ifBlock.getInput("IF0").connection.connect(compareBlock.outputConnection);

      const firstPlay = buildPlayBlock(ws, section.firstBars, meshName);
      if (firstPlay) {
        ifBlock.getInput("DO0").connection.connect(firstPlay.previousConnection);
      }

      const secondPlay = buildPlayBlock(ws, section.secondBars, meshName);
      if (secondPlay) {
        ifBlock.getInput("ELSE").connection.connect(secondPlay.previousConnection);
      }

      const commonPlay = buildPlayBlock(ws, section.commonBars, meshName);
      const doFirst = commonPlay || ifBlock;
      if (commonPlay) {
        commonPlay.nextConnection.connect(ifBlock.previousConnection);
      }
      forBlock.getInput("DO").connection.connect(doFirst.previousConnection);

      prevNext.connect(forBlock.previousConnection);
      prevNext = forBlock.nextConnection;
    }
  }
}

export function defineSoundBlocks() {
  Blockly.Blocks["play_theme"] = {
    init: function () {
      const variableNamePrefix = "sound";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: "play_theme",
        message0: translate("play_theme"),
        args0: [
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: nextVariableName,
          },
          {
            type: "field_dropdown",
            name: "THEME_NAME",
            options: function () {
              return themeNames.map((name) => [getThemeDisplayName(name), name]);
            },
          },
          {
            type: "input_dummy",
            name: "MESH_INPUT",
          },
          {
            type: "input_value",
            name: "SPEED",
            value: 1,
            min: 0.1,
            max: 3,
            precision: 0.1,
          },
          {
            type: "input_value",
            name: "VOLUME",
            value: 1,
            min: 0,
            max: 1,
            precision: 0.1,
          },
          {
            type: "field_dropdown",
            name: "MODE",
            options: [getDropdownOption("ONCE"), getDropdownOption("LOOP")],
          },
          {
            type: "field_dropdown",
            name: "ASYNC",
            options: [getDropdownOption("START"), getDropdownOption("AWAIT")],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip: getTooltip("play_theme"),
        extensions: ["dynamic_mesh_dropdown"],
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");

      registerBlockHandler(this, (changeEvent) => {
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
        );
      });
    },
  };

  Blockly.Blocks["play_sound"] = {
    init: function () {
      const variableNamePrefix = "sound";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: "play_sound",
        message0: translate("play_sound"),
        args0: [
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: nextVariableName,
          },
          {
            type: "field_dropdown",
            name: "SOUND_NAME",
            options: function () {
              return audioNames.map((name) => [getSoundDisplayName(name), name]);
            },
          },
          {
            type: "input_dummy",
            name: "MESH_INPUT", // Dummy input for the dropdown
          },
          {
            type: "input_value",
            name: "SPEED",
            value: 1,
            min: 0.1,
            max: 3,
            precision: 0.1,
          },
          {
            type: "input_value",
            name: "VOLUME",
            value: 1,
            min: 0,
            max: 1,
            precision: 0.1,
          },
          {
            type: "field_dropdown",
            name: "MODE",
            options: [getDropdownOption("ONCE"), getDropdownOption("LOOP")],
          },
          {
            type: "field_dropdown",
            name: "ASYNC",
            options: [getDropdownOption("START"), getDropdownOption("AWAIT")],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip: getTooltip("play_sound"),
        extensions: ["dynamic_mesh_dropdown"], // Attach the extension
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");

      registerBlockHandler(this, (changeEvent) => {
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
        );
      });
    },
  };

  Blockly.Blocks["stop_all_sounds"] = {
    init: function () {
      this.jsonInit({
        message0: translate("stop_all_sounds"),
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip: getTooltip("stop_all_sounds"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
    },
  };

  Blockly.Blocks["midi_note"] = {
    init: function () {
      this.jsonInit({
        type: "midi_note",
        message0: translate("midi_note"),
        args0: [
          {
            type: "input_value",
            name: "NOTE",
            check: "Number",
          },
        ],
        inputsInline: true,
        output: "Number",
        colour: categoryColours["Sound"],
        tooltip: getTooltip("midi_note"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
    },
  };

  Blockly.Blocks["note"] = {
    init: function () {
      this.jsonInit({
        type: "note",
        message0: translate("note"),
        args0: [
          {
            type: "input_value",
            name: "PITCH",
            check: "Number",
          },
          {
            type: "input_value",
            name: "DURATION",
            check: "Number",
          },
        ],
        inputsInline: true,
        output: "NoteEvent",
        colour: categoryColours["Sound"],
        tooltip: getTooltip("note"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
      this.getInput("PITCH").setAriaLabelProvider("pitch");
      this.getInput("DURATION").setAriaLabelProvider("duration");
    },
  };

  Blockly.Blocks["rest"] = {
    init: function () {
      this.jsonInit({
        type: "rest",
        message0: translate("rest"),
        inputsInline: true,
        output: "Number",
        colour: categoryColours["Sound"],
        tooltip: getTooltip("rest"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
    },
  };

  Blockly.Blocks["play_tune_notes"] = {
    init: function () {
      this.jsonInit({
        type: "play_tune_notes",
        message0: translate("play_tune_notes"),
        args0: [
          {
            type: "input_dummy",
            name: "MESH_INPUT",
          },
          {
            type: "input_value",
            name: "INSTRUMENT",
            check: "Instrument",
          },
          {
            type: "input_value",
            name: "NOTES",
            check: "Array",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip: getTooltip("play_tune_notes"),
        extensions: ["dynamic_mesh_dropdown"],
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");

      this.setOnChange(function (changeEvent) {
        if (this.workspace?.isFlyout) return;
        if (changeEvent.type !== Blockly.Events.BLOCK_MOVE) return;

        // When a bar (inner list) is connected to the outer tune list, make it inline.
        const outerList = this.getInputTargetBlock("NOTES");
        if (outerList && changeEvent.newParentId === outerList.id) {
          const movedBlock = this.workspace.getBlockById(changeEvent.blockId);
          if (movedBlock?.type === "lists_create_with") {
            movedBlock.setInputsInline(true);
          }
        }

        // Restore the default bar structure when NOTES is disconnected.
        if (
          changeEvent.oldParentId !== this.id ||
          changeEvent.oldInputName !== "NOTES"
        )
          return;
        if (this.getInputTargetBlock("NOTES")) return;

        const ws = this.workspace;
        const listBlock = Blockly.serialization.blocks.append(
          {
            type: "lists_create_with",
            extraState: { itemCount: 1 },
            inputs: {
              ADD0: {
                block: {
                  type: "lists_create_with",
                  extraState: { itemCount: 1 },
                  inline: true,
                  inputs: {
                    ADD0: {
                      block: {
                        type: "note",
                        inputs: {
                          PITCH: {
                            shadow: { type: "math_number", fields: { NUM: 60 } },
                          },
                          DURATION: {
                            shadow: { type: "math_number", fields: { NUM: 0.5 } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          ws,
        );

        const notesConn = this.getInput("NOTES")?.connection;
        if (notesConn && listBlock?.outputConnection)
          notesConn.connect(listBlock.outputConnection);
      });
    },
  };

  Blockly.Blocks["set_music_speed"] = {
    init: function () {
      this.jsonInit({
        type: "set_music_speed",
        message0: translate("set_music_speed"),
        args0: [
          {
            type: "input_dummy",
            name: "MESH_INPUT",
          },
          {
            type: "input_value",
            name: "SPEED",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip: getTooltip("set_music_speed"),
        extensions: ["dynamic_mesh_dropdown"],
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
    },
  };

  Blockly.Blocks["play_notes"] = {
    init: function () {
      this.jsonInit({
        type: "play_notes",
        message0: translate("play_notes"),
        args0: [
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "NOTES",
            check: "Array",
          },
          {
            type: "input_value",
            name: "DURATIONS",
            check: "Array",
          },
          {
            type: "input_value",
            name: "INSTRUMENT",
            check: "Instrument",
          },
          {
            type: "field_dropdown",
            name: "ASYNC",
            options: [getDropdownOption("START"), getDropdownOption("AWAIT")],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip: getTooltip("play_notes"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
    },
  };

  Blockly.Blocks["set_scene_bpm"] = {
    init: function () {
      this.jsonInit({
        type: "set_scene_bpm",
        message0: translate("set_scene_bpm"),
        args0: [
          {
            type: "input_value",
            name: "BPM",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"], // Assuming "Sound" category
        tooltip: getTooltip("set_scene_bpm"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
    },
  };

  Blockly.Blocks["set_mesh_bpm"] = {
    init: function () {
      this.jsonInit({
        type: "set_mesh_bpm",
        message0: translate("set_mesh_bpm"),
        args0: [
          {
            type: "field_variable",
            name: "MESH",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "BPM",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"], // Assuming "Sound" category
        tooltip: getTooltip("set_mesh_bpm"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
    },
  };

  Blockly.Blocks["create_instrument"] = {
    init: function () {
      const variableNamePrefix = "instrument";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: "create_instrument",
        message0: translate("create_instrument"),
        args0: [
          {
            type: "field_variable",
            name: "INSTRUMENT",
            variable: nextVariableName,
          },
          {
            type: "field_dropdown",
            name: "TYPE",
            options: [
              getDropdownOption("sine"),
              getDropdownOption("square"),
              getDropdownOption("sawtooth"),
              getDropdownOption("triangle"),
            ],
          },
          {
            type: "input_value",
            name: "VOLUME",
            check: "Number",
          },
          {
            type: "field_dropdown",
            name: "EFFECT",
            options: [
              getDropdownOption("none"),
              getDropdownOption("tremolo"),
              getDropdownOption("vibrato"),
              getDropdownOption("warble"),
              getDropdownOption("robot"),
            ],
          },
          {
            type: "input_value",
            name: "EFFECT_RATE",
            check: "Number",
          },
          {
            type: "input_value",
            name: "EFFECT_DEPTH",
            check: "Number",
          },
          {
            type: "input_value",
            name: "ATTACK",
            check: "Number",
          },
          {
            type: "input_value",
            name: "DECAY",
            check: "Number",
          },
          {
            type: "input_value",
            name: "SUSTAIN",
            check: "Number",
          },
          {
            type: "input_value",
            name: "RELEASE",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip: getTooltip("create_instrument"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");

      registerBlockHandler(this, (changeEvent) => {
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          "INSTRUMENT",
        );
      });
    },
  };

  Blockly.Blocks["instrument"] = {
    init: function () {
      this.jsonInit({
        type: "instrument",
        message0: translate("instrument"),
        args0: [
          {
            type: "field_dropdown",
            name: "INSTRUMENT_TYPE",
            options: [
              getDropdownOption("default"),
              getDropdownOption("piano"),
              getDropdownOption("guitar"),
              getDropdownOption("violin"),
            ],
          },
        ],
        output: "Instrument",
        colour: categoryColours["Sound"],
        tooltip: getTooltip("instrument"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
    },
  };

  Blockly.Blocks["play_tune"] = {
    init: function () {
      this.hasImported_ = false;

      this.appendDummyInput("ABC_INPUT")
        .appendField(translate("play_tune"))
        .appendField(new FieldAbcInput(""), "ABC_TEXT");

      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(categoryColours["Sound"]);
      this.setStyle("sound_blocks");
      this.setTooltip(getTooltip("play_tune"));
      this.setHelpUrl(getHelpUrlFor(this.type));

      setTimeout(() => {
        if (this.isDisposed()) return;
        const f = this.getField("ABC_TEXT");
        if (f && f.getSvgRoot && f.getSvgRoot()) {
          Blockly.utils.aria.setState(
            f.getSvgRoot(),
            Blockly.utils.aria.State.LABEL,
            "ABC notation, click away to import",
          );
        }
      }, 0);

      this.setOnChange(function (ev) {
        if (this.workspace?.isFlyout) return;

        if (ev.type === Blockly.Events.BLOCK_CHANGE && ev.blockId === this.id) {
          if (!this.hasImported_) {
            const value = this.getFieldValue("ABC_TEXT");
            if (!value) return;
            clearTimeout(this._abcTimer);
            this._abcTimer = setTimeout(() => {
              if (!this.isDisposed() && !this.hasImported_) this.importAbc(value);
            }, 150);
          } else if (ev.name === "MESH_NAME") {
            const meshName = this.getFieldValue("MESH_NAME");
            const doStart = this.getInputTargetBlock("DO");
            if (doStart && meshName) propagateMesh(doStart, meshName);
          }
        } else if (this.hasImported_ && ev.type === Blockly.Events.BLOCK_CHANGE) {
          const instrTarget = this.getInput("INSTRUMENT")?.connection?.targetBlock();
          if (instrTarget && ev.blockId === instrTarget.id) {
            const doStart = this.getInputTargetBlock("DO");
            if (doStart) {
              const instrState = Blockly.serialization.blocks.save(instrTarget);
              Blockly.Events.setGroup(true);
              try {
                propagateInstrument(doStart, instrState);
              } finally {
                Blockly.Events.setGroup(false);
              }
            }
          }
        } else if (
          this.hasImported_ &&
          ev.type === Blockly.Events.BLOCK_MOVE &&
          ev.newParentId === this.id &&
          ev.newInputName === "INSTRUMENT"
        ) {
          const instrBlock = this.getInput("INSTRUMENT")?.connection?.targetBlock();
          const doStart = this.getInputTargetBlock("DO");
          if (instrBlock && doStart) {
            const instrState = Blockly.serialization.blocks.save(instrBlock);
            Blockly.Events.setGroup(true);
            try {
              propagateInstrument(doStart, instrState);
            } finally {
              Blockly.Events.setGroup(false);
            }
          }
        }
      });
    },

    saveExtraState: function () {
      if (!this.hasImported_) return null;
      return {
        imported: true,
        title: this.getFieldValue("TITLE") || "",
        mesh: this.getFieldValue("MESH_NAME") || "__everywhere__",
      };
    },

    loadExtraState: function (state) {
      if (!state?.imported) return;
      this._buildImportedShape(state.title);
      if (state.mesh) this.setFieldValue(state.mesh, "MESH_NAME");
    },

    _buildImportedShape: function (title) {
      if (this.getInput("ABC_INPUT")) this.removeInput("ABC_INPUT");

      if (!this.getInput("TITLE_INPUT")) {
        this.appendDummyInput("TITLE_INPUT")
          .appendField(translate("play_tune"))
          .appendField(new Blockly.FieldTextInput(title || ""), "TITLE")
          .appendField(" on ")
          .appendField(
            new Blockly.FieldDropdown(function () {
              const options = [[translate("everywhere_option"), "__everywhere__"]];
              const ws = this.sourceBlock_?.workspace;
              if (ws) ws.getVariableMap().getAllVariables()
                .forEach((v) => options.push([v.name, v.name]));
              return options;
            }),
            "MESH_NAME",
          );

        const instrInput = this.appendValueInput("INSTRUMENT")
          .setCheck("Instrument")
          .appendField("instrument ");
        instrInput.connection.setShadowState({
          type: "instrument",
          fields: { INSTRUMENT_TYPE: "default" },
        });

        this.setInputsInline(true);
        this.appendStatementInput("DO");

        setTimeout(() => {
          if (this.isDisposed()) return;
          const tf = this.getField("TITLE");
          if (tf && tf.getSvgRoot && tf.getSvgRoot()) {
            Blockly.utils.aria.setState(tf.getSvgRoot(), Blockly.utils.aria.State.LABEL, "tune title");
          }
          const mf = this.getField("MESH_NAME");
          if (mf && mf.getSvgRoot && mf.getSvgRoot()) {
            Blockly.utils.aria.setState(mf.getSvgRoot(), Blockly.utils.aria.State.LABEL, "tune mesh");
          }
          const doInput = this.getInput("DO");
          if (doInput) doInput.setAriaLabelProvider("tune bars");
        }, 0);
      } else {
        this.setFieldValue(title || "", "TITLE");
      }

      this.hasImported_ = true;
    },

    importAbc: function (abcText) {
      if (abcText.length > ABC_MAX_INPUT_LENGTH) {
        console.warn("[play_tune] ABC input too long, not importing:", abcText.length);
        announceToScreenReader("tune too long to import");
        return;
      }
      const parsed = parseAbc(abcText);
      console.log("[play_tune] importing:", parsed.title, "sections:", parsed.sections.length, "bpm:", parsed.bpm);

      Blockly.Events.setGroup(true);
      try {
        this._buildImportedShape(parsed.title);

        const ws = this.workspace;
        if (!ws) return;

        const meshName = this.getFieldValue("MESH_NAME") || "__everywhere__";
        const doInput = this.getInput("DO");
        if (doInput) {
          const existing = doInput.connection.targetBlock();
          if (existing) existing.dispose(false);

          try {
            abcBuildDoBlocks(ws, doInput, parsed.sections, parsed.bpm, meshName);
          } catch (e) {
            console.error("[play_tune] DO block creation failed:", e);
          }
        }
      } finally {
        Blockly.Events.setGroup(false);
      }

      announceToScreenReader(`tune imported: ${parsed.title}`);
    },
  };

  Blockly.Blocks["speak"] = {
    init: function () {
      this.jsonInit({
        type: "speak",
        message0: translate("speak"),
        args0: [
          {
            type: "input_value",
            name: "TEXT",
            check: "String",
          },
          {
            type: "input_dummy",
            name: "MESH_INPUT", // Dummy input for the dropdown
          },

          {
            type: "field_dropdown",
            name: "VOICE",
            options: [getDropdownOption("female"), getDropdownOption("male")],
          },
          {
            type: "field_dropdown",
            name: "LANGUAGE",
            options: [getDropdownOption("en-GB"), getDropdownOption("en-US")],
          },
          {
            type: "input_value",
            name: "RATE",
            check: "Number",
          },
          {
            type: "input_value",
            name: "PITCH",
            check: "Number",
          },
          {
            type: "input_value",
            name: "VOLUME",
            check: "Number",
          },
          {
            type: "field_dropdown",
            name: "ASYNC",
            options: [getDropdownOption("START"), getDropdownOption("AWAIT")],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip: getTooltip("speak"),
        extensions: ["dynamic_mesh_dropdown"], // Attach the extension
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
    },
  };

  Blockly.Blocks["enable_subtitles"] = {
    init: function () {
      this.jsonInit({
        type: "enable_subtitles",
        message0: translate("enable_subtitles"),
        args0: [
          {
            type: "field_checkbox",
            name: "ENABLED",
            checked: true,
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Sound"],
        tooltip: getTooltip("enable_subtitles"),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle("sound_blocks");
    },
  };
}
