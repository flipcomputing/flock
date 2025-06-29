import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
import {
  nextVariableIndexes,
  handleBlockCreateEvent,
  getHelpUrlFor,
} from "../blocks.js";
import {
  audioNames,
} from "../config.js";

export function defineSoundBlocks() {
	 Blockly.Blocks["play_sound"] = {
		init: function () {
		  let nextVariableName = "sound" + nextVariableIndexes["sound"];
		  this.jsonInit({
			type: "play_sound",
			message0:
			  "add sound %1 %2 from %3 \nspeed %4 volume %5 mode %6 async %7",
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
				  return audioNames.map((name) => [name, name]);
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
				options: [
				  ["once", "ONCE"],
				  ["loop", "LOOP"],
				],
			  },
			  {
				type: "field_dropdown",
				name: "ASYNC",
				options: [
				  ["start", "START"],
				  ["await", "AWAIT"],
				],
			  },
			],
			inputsInline: true,
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Sound"],
			tooltip:
			  "Play the selected sound on a mesh with adjustable speed, volume, and mode.\nKeyword: sound",
			extensions: ["dynamic_mesh_dropdown"], // Attach the extension
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	Blockly.Blocks["stop_all_sounds"] = {
		init: function () {
		  this.jsonInit({
			message0: "stop all sounds",
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Sound"],
			tooltip:
			  "Stop all sounds currently playing in the scene.\nKeyword:nosound",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["midi_note"] = {
		init: function () {
		  this.jsonInit({
			type: "midi_note",
			message0: "MIDI note %1",
			args0: [
			  {
				type: "field_number",
				name: "NOTE",
				value: 60, // Default is Middle C
				min: 0,
				max: 127,
				precision: 1,
			  },
			],
			output: "Number",
			colour: categoryColours["Sound"],
			tooltip: "A MIDI note value between 0 and 127.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["rest"] = {
		init: function () {
		  this.jsonInit({
			type: "rest",
			message0: "rest",
			output: "Null",
			colour: categoryColours["Sound"],
			tooltip: "A rest (silence) in a musical sequence.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["play_notes"] = {
		init: function () {
		  this.jsonInit({
			type: "play_notes",
			message0:
			  "play notes on %1\nnotes %2 durations %3\ninstrument %4 mode %5",
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
				options: [
				  ["start", "START"],
				  ["await", "AWAIT"],
				],
			  },
			],
			inputsInline: true,
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Sound"],
			tooltip:
			  "Play a sequence of MIDI notes and rests with corresponding durations, using mesh for panning. Can return immediately or after the notes have finished playing.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["set_scene_bpm"] = {
		init: function () {
		  this.jsonInit({
			type: "set_scene_bpm",
			message0: "set scene BPM to %1",
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
			tooltip: "Set the BPM for the entire scene",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["set_mesh_bpm"] = {
		init: function () {
		  this.jsonInit({
			type: "set_mesh_bpm",
			message0: "set BPM of %1 to %2",
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
			tooltip: "Set the BPM for a selected mesh",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

	  Blockly.Blocks["create_instrument"] = {
		init: function () {
		  const variableNamePrefix = "instrument";
		  let nextVariableName =
			variableNamePrefix + nextVariableIndexes[variableNamePrefix];
		  this.jsonInit({
			type: "create_instrument",
			message0:
			  "instrument %1 wave %2 frequency %3 attack %4 decay %5 sustain %6 release %7",
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
				  ["sine", "sine"],
				  ["square", "square"],
				  ["sawtooth", "sawtooth"],
				  ["triangle", "triangle"],
				],
			  },
			  {
				type: "field_number",
				name: "FREQUENCY",
				value: 440,
				min: 20,
				max: 20000,
				precision: 1,
			  },
			  {
				type: "field_number",
				name: "ATTACK",
				value: 0.1,
				min: 0,
				max: 5,
				precision: 0.01,
			  },
			  {
				type: "field_number",
				name: "DECAY",
				value: 0.5,
				min: 0,
				max: 5,
				precision: 0.01,
			  },
			  {
				type: "field_number",
				name: "SUSTAIN",
				value: 0.7,
				min: 0,
				max: 1,
				precision: 0.01,
			  },
			  {
				type: "field_number",
				name: "RELEASE",
				value: 1.0,
				min: 0,
				max: 5,
				precision: 0.01,
			  },
			],
			previousStatement: null,
			nextStatement: null,
			colour: categoryColours["Sound"],
			tooltip:
			  "Create an instrument and assigns it to the selected variable.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		  this.setOnChange((changeEvent) => {
			handleBlockCreateEvent(
			  this,
			  changeEvent,
			  variableNamePrefix,
			  nextVariableIndexes,
			);
		  });
		},
	  };

	  Blockly.Blocks["instrument"] = {
		init: function () {
		  this.jsonInit({
			type: "instrument",
			message0: "instrument %1",
			args0: [
			  {
				type: "field_dropdown",
				name: "INSTRUMENT_TYPE",
				options: [
				  ["Default Instrument (Sine)", "default"],
				  ["Piano (Square)", "piano"],
				  ["Guitar (Sawtooth)", "guitar"],
				  ["Violin (Triangle)", "violin"],
				],
			  },
			],
			output: "Instrument",
			colour: categoryColours["Sound"],
			tooltip: "Select an instrument to use for playing notes.",
		  });
		  this.setHelpUrl(getHelpUrlFor(this.type));
		},
	  };

}
