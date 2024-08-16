import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import "@blockly/block-plus-minus";

import { FlowGraphLog10Block } from "babylonjs";
import { flock } from "./flock.js";

export const meshMap = {};
export function defineGenerators() {
	javascriptGenerator.forBlock["show"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		return `await show(${modelName});\n`;
	};

	javascriptGenerator.forBlock["hide"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		return `await hide(${modelName});\n`;
	};

	function generateUUID() {
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
			/[xy]/g,
			function (c) {
				const r = (Math.random() * 16) | 0,
					v = c == "x" ? r : (r & 0x3) | 0x8;
				return v.toString(16);
			},
		);
	}

	function getFieldValue(block, fieldName, defaultValue) {
		return (
			javascriptGenerator.valueToCode(
				block,
				fieldName,
				javascriptGenerator.ORDER_ATOMIC,
			) || defaultValue
		);
	}

	javascriptGenerator.forBlock["wait"] = function (block) {
		const duration =
			javascriptGenerator.valueToCode(
				block,
				"DURATION",
				javascriptGenerator.ORDER_ATOMIC,
			) || "1000";

		return `await wait(${duration});\n`;
	};

	javascriptGenerator.forBlock["glide_to"] = function (block) {
		const x = getFieldValue(block, "X", "0");
		const y = getFieldValue(block, "Y", "0");
		const z = getFieldValue(block, "Z", "0");
		const meshName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MESH_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);
		const duration = getFieldValue(block, "DURATION", "0");
		const mode = block.getFieldValue("MODE");

		const asyncWrapper = mode === "AWAIT" ? "await " : "";
		return `${asyncWrapper}glideTo(${meshName}, ${x}, ${y}, ${z}, ${duration}, "${mode}");\n`;
	};

	javascriptGenerator.forBlock["start"] = function (block) {
		const branch = javascriptGenerator.statementToCode(block, "DO");
		return `(async () => {\n${branch}})();\n`;
	};

	javascriptGenerator.forBlock["create_ground"] = function (block) {
		const color = getFieldValue(block, "COLOR", "#6495ED");
		return `createGround(${color});\n`;
	};

	javascriptGenerator.forBlock["create_custom_map"] = function (block) {
		const colors = [];
		for (let i = 1; i <= 25; i++) {
			const color =
				javascriptGenerator.valueToCode(
					block,
					`COLOR_${i}`,
					javascriptGenerator.ORDER_ATOMIC,
				) || "#808080";
			colors.push(color);
		}
		return `await createCustomMap([${colors.join(", ")}]);\n`;
	};

	javascriptGenerator.forBlock["set_sky_color"] = function (block) {
		const color = getFieldValue(block, "COLOR", "#6495ED");
		return `setSky(${color});\n`;
	};

	javascriptGenerator.forBlock["button_controls"] = function (block) {
		const color = getFieldValue(block, "COLOR", "#6495ED");
		const control = block.getFieldValue("CONTROL");
		const enabled = block.getFieldValue("ENABLED") == "TRUE";
		return `buttonControls("${control}", ${enabled}, ${color});\n`;
	};

	javascriptGenerator.forBlock["print_text"] = function (block) {
		const text =
			javascriptGenerator.valueToCode(
				block,
				"TEXT",
				javascriptGenerator.ORDER_ATOMIC,
			) || "''";
		const duration =
			javascriptGenerator.valueToCode(
				block,
				"DURATION",
				javascriptGenerator.ORDER_ATOMIC,
			) || "0";
		const color = getFieldValue(block, "COLOR", "#9932CC");
		return `printText(${text}, ${duration}, ${color});\n`;
	};

	javascriptGenerator.forBlock["set_fog"] = function (block) {
		const fogColorHex = getFieldValue(block, "FOG_COLOR", "#9932CC");
		const fogMode = block.getFieldValue("FOG_MODE");
		const fogDensity =
			javascriptGenerator.valueToCode(
				block,
				"DENSITY",
				javascriptGenerator.ORDER_ATOMIC,
			) || "0.1"; // Default density

		return `setFog(${fogColorHex}, "${fogMode}", ${fogDensity});\n`;
	};

	javascriptGenerator.forBlock["say"] = function (block) {
		const text =
			javascriptGenerator.valueToCode(
				block,
				"TEXT",
				javascriptGenerator.ORDER_ATOMIC,
			) || '""';
		const duration =
			javascriptGenerator.valueToCode(
				block,
				"DURATION",
				javascriptGenerator.ORDER_ATOMIC,
			) || "0";
		const meshVariable = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MESH_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);
		const textColor = getFieldValue(block, "TEXT_COLOR", "#000000");
		const backgroundColor = getFieldValue(
			block,
			"BACKGROUND_COLOR",
			"#ffffff",
		);
		const alpha =
			javascriptGenerator.valueToCode(
				block,
				"ALPHA",
				javascriptGenerator.ORDER_ATOMIC,
			) || "1";
		const size =
			javascriptGenerator.valueToCode(
				block,
				"SIZE",
				javascriptGenerator.ORDER_ATOMIC,
			) || "24";
		const mode = block.getFieldValue("MODE");
		const asyncMode = block.getFieldValue("ASYNC");

		const asyncWrapper = asyncMode === "AWAIT" ? "await " : "";

		return `${asyncWrapper}say(${meshVariable}, ${text}, ${duration}, ${textColor}, ${backgroundColor}, ${alpha}, ${size}, "${mode}");\n`;
	};

	javascriptGenerator.forBlock["load_model"] = function (block) {
		const modelName = block.getFieldValue("MODELS");
		const scale = getFieldValue(block, "SCALE", "1");
		const x = getFieldValue(block, "X", "0");
		const y = getFieldValue(block, "Y", "0");
		const z = getFieldValue(block, "Z", "0");
		const variableName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("ID_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		const meshId = modelName + "_" + flock.scene.getUniqueId();
		meshMap[meshId] = block;

		return `${variableName} = newModel('${modelName}', '${meshId}', ${scale}, ${x}, ${y}, ${z});\n`;
	};

	javascriptGenerator.forBlock["load_character"] = function (block) {
		const modelName = block.getFieldValue("MODELS");
		const scale = getFieldValue(block, "SCALE", "1");
		const x = getFieldValue(block, "X", "0");
		const y = getFieldValue(block, "Y", "0");
		const z = getFieldValue(block, "Z", "0");
		const hairColor = getFieldValue(block, "HAIR_COLOR", "#000000");
		const skinColor = getFieldValue(block, "SKIN_COLOR", "#FFE0BD");
		const eyesColor = getFieldValue(block, "EYES_COLOR", "#0000FF");
		const sleevesColor = getFieldValue(block, "SLEEVES_COLOR", "#FFFFFF");
		const shortsColor = getFieldValue(block, "SHORTS_COLOR", "#000000");
		const tshirtColor = getFieldValue(block, "TSHIRT_COLOR", "#FF0000");
		const variableName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("ID_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		const meshId = modelName + "_" + flock.scene.getUniqueId();
		meshMap[meshId] = block;

		return `${variableName} = newCharacter('${modelName}', '${meshId}', ${scale}, ${x}, ${y}, ${z}, ${hairColor}, ${skinColor}, ${eyesColor}, ${sleevesColor}, ${shortsColor}, ${tshirtColor});\n`;
	};

	javascriptGenerator.forBlock["load_object"] = function (block) {
		const modelName = block.getFieldValue("MODELS");
		const scale = getFieldValue(block, "SCALE", "1");
		const x = getFieldValue(block, "X", "0");
		const y = getFieldValue(block, "Y", "0");
		const z = getFieldValue(block, "Z", "0");
		const color = getFieldValue(block, "COLOR", "#000000");
		const variableName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("ID_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		const meshId = modelName + "_" + flock.scene.getUniqueId();
		meshMap[meshId] = block;

		return `${variableName} = newObject('${modelName}', '${meshId}', ${scale}, ${x}, ${y}, ${z}, ${color});\n`;
	};

	javascriptGenerator.forBlock["create_box"] = function (block) {
		const color = getFieldValue(block, "COLOR", "#9932CC");
		const width = getFieldValue(block, "WIDTH", "1");
		const height = getFieldValue(block, "HEIGHT", "1");
		const depth = getFieldValue(block, "DEPTH", "1");
		const posX = getFieldValue(block, "X", "0");
		const posY = getFieldValue(block, "Y", "0");
		const posZ = getFieldValue(block, "Z", "0");

		let variableName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("ID_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		const boxId = `box_${generateUUID()}`;
		meshMap[boxId] = block;

		return `${variableName} = newBox(${color}, ${width}, ${height}, ${depth}, ${posX}, ${posY}, ${posZ}, "${boxId}");\n`;
	};

	javascriptGenerator.forBlock["create_sphere"] = function (block) {
		const color = getFieldValue(block, "COLOR", "#9932CC");
		const diameterX = getFieldValue(block, "DIAMETER_X", "1");
		const diameterY = getFieldValue(block, "DIAMETER_Y", "1");
		const diameterZ = getFieldValue(block, "DIAMETER_Z", "1");
		const posX = getFieldValue(block, "X", "0");
		const posY = getFieldValue(block, "Y", "0.5");
		const posZ = getFieldValue(block, "Z", "0");

		let variableName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("ID_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		const sphereId = `sphere_${generateUUID()}`;
		meshMap[sphereId] = block;

		return `${variableName} = newSphere(${color}, ${diameterX}, ${diameterY}, ${diameterZ}, ${posX}, ${posY}, ${posZ}, "${sphereId}");\n`;
	};

	javascriptGenerator.forBlock["create_cylinder"] = function (block) {
		const color = getFieldValue(block, "COLOR", "#9932CC");
		const height = getFieldValue(block, "HEIGHT", "2");
		const diameterTop = getFieldValue(block, "DIAMETER_TOP", "1");
		const diameterBottom = getFieldValue(block, "DIAMETER_BOTTOM", "1");
		const posX = getFieldValue(block, "X", "0");
		const posY = getFieldValue(block, "Y", "0.5");
		const posZ = getFieldValue(block, "Z", "0");

		let variableName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("ID_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		const cylinderId = `cylinder_${generateUUID()}`;
		meshMap[cylinderId] = block;

		return `${variableName} = newCylinder(${color}, ${height}, ${diameterTop}, ${diameterBottom}, ${posX}, ${posY}, ${posZ}, "${cylinderId}");\n`;
	};

	javascriptGenerator.forBlock["create_capsule"] = function (block) {
		const color = getFieldValue(block, "COLOR", "#9932CC");
		const radius = getFieldValue(block, "RADIUS", "1");
		const height = getFieldValue(block, "HEIGHT", "2");
		const posX = getFieldValue(block, "X", "0");
		const posY = getFieldValue(block, "Y", "1");
		const posZ = getFieldValue(block, "Z", "0");

		let variableName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("ID_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		const capsuleId = `capsule_${generateUUID()}`;
		meshMap[capsuleId] = block;

		return `${variableName} = newCapsule(${color}, ${radius}, ${height}, ${posX}, ${posY}, ${posZ}, "${capsuleId}");\n`;
	};

	javascriptGenerator.forBlock["create_plane"] = function (block) {
		const color = getFieldValue(block, "COLOR", "#9932CC");
		const width = getFieldValue(block, "WIDTH", "1");
		const height = getFieldValue(block, "HEIGHT", "1");
		const posX = getFieldValue(block, "X", "0");
		const posY = getFieldValue(block, "Y", "0");
		const posZ = getFieldValue(block, "Z", "0");

		let variableName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("ID_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		const planeId = `plane_${generateUUID()}`;
		meshMap[planeId] = block;

		return `${variableName} = newPlane(${color}, ${width}, ${height}, ${posX}, ${posY}, ${posZ}, "${planeId}");`;
	};

	javascriptGenerator.forBlock["set_background_color"] = function (block) {
		const color = getFieldValue(block, "COLOR", "#6495ED");
		return `flock.scene.clearColor = BABYLON.Color4.FromHexString(${color} + "FF");\n`;
	};

	javascriptGenerator.forBlock["move_by_vector"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("BLOCK_NAME"),
			Blockly.Names.NameType.VARIABLE,
		);

		const x = getFieldValue(block, "X", "0");
		const y = getFieldValue(block, "Y", "0");
		const z = getFieldValue(block, "Z", "0");

		return `await moveByVector(${modelName}, ${x}, ${y}, ${z});\n`;
	};

	javascriptGenerator.forBlock["scale"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("BLOCK_NAME"),
			Blockly.Names.NameType.VARIABLE,
		);
		const x = getFieldValue(block, "X", "0");
		const y = getFieldValue(block, "Y", "0");
		const z = getFieldValue(block, "Z", "0");

		return `await scaleMesh(${modelName}, ${x}, ${y}, ${z});\n`;
	};

	javascriptGenerator.forBlock["rotate_model_xyz"] = function (block) {
		const meshName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL"),
			Blockly.Names.NameType.VARIABLE,
		);

		const x = getFieldValue(block, "X", "0");
		const y = getFieldValue(block, "Y", "0");
		const z = getFieldValue(block, "Z", "0");

		return `await rotate(${meshName}, ${x}, ${y}, ${z});\n`;
	};

	javascriptGenerator.forBlock["get_property"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MESH"),
			Blockly.Names.NameType.VARIABLE,
		);
		const propertyName = block.getFieldValue("PROPERTY");

		const code = `await getProperty(${modelName}, '${propertyName}')`;
		return [code, javascriptGenerator.ORDER_NONE];
	};

	javascriptGenerator.forBlock["rotate_model_xyz"] = function (block) {
		const meshName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL"),
			Blockly.Names.NameType.VARIABLE,
		);

		const x = getFieldValue(block, "X", "0");
		const y = getFieldValue(block, "Y", "0");
		const z = getFieldValue(block, "Z", "0");

		return `await rotate(${meshName}, ${x}, ${y}, ${z});\n`;
	};

	javascriptGenerator.forBlock["forever"] = function (block) {
		const branch = javascriptGenerator.statementToCode(block, "DO");

		const code = `forever(async () => {\n${branch}});\n`;
		return code;
	};

	javascriptGenerator.forBlock["play_animation"] = function (block) {
		const animationName = block.getFieldValue("ANIMATION_NAME");
		const modelVar = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL"),
			Blockly.Names.NameType.VARIABLE,
		);

		return `await playAnimation(${modelVar}, "${animationName}");\n`;
	};

	javascriptGenerator.forBlock["play_sound"] = function (block) {
		const soundName = block.getFieldValue("SOUND_NAME");
		const speed = parseFloat(getFieldValue(block, "SPEED", 1));
		const volume = parseFloat(getFieldValue(block, "VOLUME", 1));
		const mode = block.getFieldValue("MODE");
		const async = block.getFieldValue("ASYNC");

		let options = {
			playbackRate: speed,
			volume: volume,
			loop: mode === "LOOP",
		};

		const optionsString = JSON.stringify(options);

		return async === "AWAIT"
			? `await flock.playSoundAsync(flock.scene, "${soundName}", ${optionsString});\n`
			: `new flock.BABYLON.Sound("${soundName}", "sounds/${soundName}", flock.scene, null, { autoplay: true, ...${optionsString} });\n`;
	};

	javascriptGenerator.forBlock["stop_all_sounds"] = function (block) {
		// JavaScript code to stop all sounds in a Babylon.js scene
		return "flock.scene.sounds.forEach(function(sound) { sound.stop(); });\n";
	};

	javascriptGenerator.forBlock["when_clicked"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		const trigger = block.getFieldValue("TRIGGER");
		const doCode = javascriptGenerator.statementToCode(block, "DO");

		return `onTrigger(${modelName}, "${trigger}", async function() {
				${doCode}
			});\n`;
	};

	javascriptGenerator.forBlock["when_touches"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
			true,
		);

		const otherModelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("OTHER_MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
			true,
		);

		const trigger = block.getFieldValue("TRIGGER");
		const doCode = javascriptGenerator.statementToCode(block, "DO");

		// Ensure the trigger is an intersection trigger
		if (
			trigger === "OnIntersectionEnterTrigger" ||
			trigger === "OnIntersectionExitTrigger"
		) {
			return `onIntersect(${modelName}, ${otherModelName}, "${trigger}", async function() {
		  ${doCode}
		});\n`;
		} else {
			console.error(
				"Invalid trigger type for 'when_touches' block:",
				trigger,
			);
			return "";
		}
	};

	javascriptGenerator.forBlock["when_key_pressed"] = function (block) {
		const key = block.getFieldValue("KEY");
		const statements_do = javascriptGenerator.statementToCode(block, "DO");

		return `whenKeyPressed("${key}", async () => {${statements_do}});\n`;
	};

	javascriptGenerator.forBlock["when_key_released"] = function (block) {
		const key = block.getFieldValue("KEY");
		const statements_do = javascriptGenerator.statementToCode(block, "DO");

		return `whenKeyReleased("${key}", async () => {${statements_do}});\n`;
	};

	javascriptGenerator.forBlock["broadcast_event"] = function (block) {
		const eventName = block.getFieldValue("EVENT_NAME");

		return `broadcastEvent("${eventName}");\n`;
	};

	javascriptGenerator.forBlock["on_event"] = function (block) {
		const eventName = block.getFieldValue("EVENT_NAME");
		const statements_do = javascriptGenerator.statementToCode(block, "DO");

		return `onEvent("${eventName}", async function() {\n${statements_do}});\n`;
	};

	javascriptGenerator.forBlock["highlight"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);
		const color = getFieldValue(block, "COLOR", "#FFD700");
		return `await highlight(${modelName}, ${color});\n`;
	};

	javascriptGenerator.forBlock["tint"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);
		const color = getFieldValue(block, "COLOR", "#AA336A");

		return `await tint(${modelName}, ${color});\n`;
	};

	javascriptGenerator.forBlock["change_colour"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);
		const color = getFieldValue(block, "COLOR", "#ffffff");

		return `await changeColour(${modelName}, ${color});\n`;
	};

	javascriptGenerator.forBlock["change_material"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("ID_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);
		const material = block.getFieldValue("MATERIALS");
		const color = getFieldValue(block, "COLOR", "#ffffff");

		console.log(modelName, material, color);
		return `await changeMaterial(${modelName}, "${material}", ${color});\n`;
	};

	javascriptGenerator.forBlock["set_alpha"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MESH"),
			Blockly.Names.NameType.VARIABLE,
		);

		const alphaValue = javascriptGenerator.valueToCode(
			block,
			"ALPHA",
			javascriptGenerator.ORDER_ATOMIC,
		);

		return `await setAlpha(${modelName}, ${alphaValue});\n`;
	};

	javascriptGenerator.forBlock["clear_effects"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		return `await clearEffects(${modelName});\n`;
	};

	javascriptGenerator.forBlock["switch_animation"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL"),
			Blockly.Names.NameType.VARIABLE,
		);
		const animationName = block.getFieldValue("ANIMATION_NAME");

		return `await switchAnimation(${modelName}, "${animationName}");\n`;
	};

	javascriptGenerator.forBlock["create_map"] = function (block) {
		const mapName = block.getFieldValue("MAP_NAME");
		const color = getFieldValue(block, "COLOR", "#6495ED");

		return `createMap("${mapName}", ${color});\n`;
	};

	javascriptGenerator.forBlock["move_forward"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL"),
			Blockly.Names.NameType.VARIABLE,
		);
		const speed =
			javascriptGenerator.valueToCode(
				block,
				"SPEED",
				javascriptGenerator.ORDER_ATOMIC,
			) || "0";

		return `moveForward(${modelName}, ${speed});\n`;
	};

	javascriptGenerator.forBlock["up"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);
		const upForce = getFieldValue(block, "UP_FORCE", "1"); // Default up force

		return `up(${modelName}, ${upForce});\n`;
	};

	javascriptGenerator.forBlock["apply_force"] = function (block) {
		// Get the name of the mesh variable
		const mesh = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MESH_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		// Get the force values
		const forceX =
			javascriptGenerator.valueToCode(
				block,
				"X",
				javascriptGenerator.ORDER_ATOMIC,
			) || "0";
		const forceY =
			javascriptGenerator.valueToCode(
				block,
				"Y",
				javascriptGenerator.ORDER_ATOMIC,
			) || "0";
		const forceZ =
			javascriptGenerator.valueToCode(
				block,
				"Z",
				javascriptGenerator.ORDER_ATOMIC,
			) || "0";

		// Generate the code
		var code = `applyForce(${mesh}, ${forceX}, ${forceY}, ${forceZ});\n`;
		return code;
	};

	javascriptGenerator.forBlock["touching_surface"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		return [
			`isTouchingSurface(${modelName})`,
			javascriptGenerator.ORDER_NONE,
		];
	};

	javascriptGenerator.forBlock["camera_follow"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MESH_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);
		return `await attachCamera(${modelName});\n`;
	};
	javascriptGenerator.forBlock["add_physics"] = function (block) {
		const modelName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MODEL_VAR"),
			Blockly.Names.NameType.VARIABLE,
		);

		const physicsType = block.getFieldValue("PHYSICS_TYPE");

		// Note: Ensure that the execution environment supports async/await at this level
		return `await setPhysics(${modelName}, "${physicsType}");\n`;
	};

	javascriptGenerator.forBlock["canvas_controls"] = function (block) {
		const controls = block.getFieldValue("CONTROLS") == "TRUE";
		return `canvasControls(${controls});\n`;
	};

	javascriptGenerator.forBlock["key_pressed"] = function (block) {
		const key = block.getFieldValue("KEY");
		return [`keyPressed("${key}")`, javascriptGenerator.ORDER_NONE];
	};

	// Blockly code generator for checking if two meshes are touching
	javascriptGenerator.forBlock["meshes_touching"] = function (block) {
		const mesh1VarName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MESH1"),
			Blockly.Names.NameType.VARIABLE,
		);
		const mesh2VarName = javascriptGenerator.nameDB_.getName(
			block.getFieldValue("MESH2"),
			Blockly.Names.NameType.VARIABLE,
		);

		const code = `checkMeshesTouching(${mesh1VarName}, ${mesh2VarName})`;
		return [code, javascriptGenerator.ORDER_ATOMIC];
	};

	javascriptGenerator.forBlock["random_colour"] = function (block) {
		const code = `randomColour()`;
		return [code, javascriptGenerator.ORDER_ATOMIC];
	};

	javascriptGenerator.forBlock["random_seeded_int"] = function (block) {
		const value_from = getFieldValue(block, "FROM", 0);
		const value_to = getFieldValue(block, "TO", FlowGraphLog10Block);
		const value_seed = getFieldValue(block, "SEED", 123456);

		const code = `seededRandom(${value_from}, ${value_to}, ${value_seed})`;

		return [code, javascriptGenerator.ORDER_NONE];
	};

	javascriptGenerator.forBlock["colour"] = function (block) {
		const colour = block.getFieldValue("COLOR");
		const code = `"${colour}"`;
		return [code, javascriptGenerator.ORDER_ATOMIC];
	};

	javascriptGenerator.forBlock["skin_colour"] = function (block) {
		const colour = block.getFieldValue("COLOR");
		const code = `"${colour}"`;
		return [code, javascriptGenerator.ORDER_ATOMIC];
	};

	javascriptGenerator.forBlock["greyscale_colour"] = function (block) {
		const colour = block.getFieldValue("COLOR");
		const code = `"${colour}"`;
		return [code, javascriptGenerator.ORDER_ATOMIC];
	};

	javascriptGenerator.forBlock["colour_from_string"] = function (block) {
		const color =
			javascriptGenerator.valueToCode(
				block,
				"COLOR",
				javascriptGenerator.ORDER_ATOMIC,
			) || "''";
		console.log(color);
		const code = `${color}`;
		return [code, javascriptGenerator.ORDER_ATOMIC];
	};

	javascriptGenerator.forBlock["procedures_defnoreturn"] = function (block) {
		const functionName = block.getFieldValue("NAME");
		// Retrieve the parameters as a comma-separated list
		const args = block.argData_.map((elem) => elem.model.name);
		const params = args.join(", ");
		console.log(block, args);
		const branch =
			javascriptGenerator.statementToCode(
				block,
				"STACK",
				javascriptGenerator.ORDER_NONE,
			) || "";

		console.log(params);
		// Generate the function code with async and parameters
		const code = `async function ${functionName}(${params}) {\n${branch}\n}`;
		return code;
	};

	// Generator for asynchronous function call with arguments
	javascriptGenerator.forBlock["procedures_callnoreturn"] = function (block) {
		const functionName = block.getFieldValue("NAME");
		// Retrieve the arguments as a comma-separated list that should match the parameters
		const args = [];
		const variables = block.arguments_;
		for (let i = 0; i < variables.length; i++) {
			args[i] =
				javascriptGenerator.valueToCode(
					block,
					"ARG" + i,
					javascriptGenerator.ORDER_NONE,
				) || "null";
		}
		const code = `await ${functionName}` + "(" + args.join(", ") + ");\n";
		return code;
	};

	javascriptGenerator.forBlock["procedures_defreturn"] = function (block) {
		const functionName = block.getFieldValue("NAME");
		const args = block.argData_.map((elem) => elem.model.name);
		const params = args.join(", ");
		const branch =
			javascriptGenerator.statementToCode(
				block,
				"STACK",
				javascriptGenerator.ORDER_NONE,
			) || "";
		const returnValue =
			javascriptGenerator.valueToCode(
				block,
				"RETURN",
				javascriptGenerator.ORDER_NONE,
			) || "";

		// Generate the function code with async, parameters, and return statement
		const code = `async function ${functionName}(${params}) {\n${branch}return ${returnValue}\n;}`;
		return code;
	};

	javascriptGenerator.forBlock["procedures_callreturn"] = function (block) {
		const functionName = block.getFieldValue("NAME");
		const args = [];
		const variables = block.arguments_ || []; // Ensure 'arguments_' is populated with the argument names
		for (let i = 0; i < variables.length; i++) {
			args[i] =
				javascriptGenerator.valueToCode(
					block,
					"ARG" + i,
					javascriptGenerator.ORDER_NONE,
				) || "null";
		}

		const code = `await ${functionName}\n(${args.join(", ")})\n`;

		return [code, javascriptGenerator.ORDER_ATOMIC];
	};

	javascriptGenerator.init = function (workspace) {
		console.log("Initializing JavaScript generator...");
		if (!javascriptGenerator.nameDB_) {
			javascriptGenerator.nameDB_ = new Blockly.Names(
				javascriptGenerator.RESERVED_WORDS_,
			);
		} else {
			javascriptGenerator.nameDB_.reset();
		}
		javascriptGenerator.nameDB_.setVariableMap(workspace.getVariableMap());
		javascriptGenerator.nameDB_.populateVariables(workspace);
		javascriptGenerator.nameDB_.populateProcedures(workspace);

		const defvars = [];
		// Add developer variables (not created or named by the user).
		const devVarList = Blockly.Variables.allDeveloperVariables(workspace);
		for (let i = 0; i < devVarList.length; i++) {
			defvars.push(
				javascriptGenerator.nameDB_.getName(
					devVarList[i],
					Blockly.NameType.DEVELOPER_VARIABLE,
				),
			);
		}

		// Add user variables, but only ones that are being used.
		const variables = Blockly.Variables.allUsedVarModels(workspace);
		for (let i = 0; i < variables.length; i++) {
			defvars.push(
				javascriptGenerator.nameDB_.getName(
					variables[i].getId(),
					Blockly.Names.NameType.VARIABLE,
				),
			);
		}

		// Declare all of the variables.
		if (defvars.length) {
			var variableDeclarations = "";
			/*var variableDeclarations = `function Mesh(id = "UNDEFINED") {
			  this.id = id;
			}\n
			flock.Mesh = Mesh
			Mesh.prototype.toString = function MeshToString() {
			console.log("Mesh.toString");
	  return\` ${this.id}\`;
	};`;*/

			defvars.map(function (name) {
				return `let ${name};`;
			});
			for (let v of defvars) {
				variableDeclarations += `var ${v} = new Mesh();\n console.log(${v});\n`;
			}
			javascriptGenerator.definitions_["variables"] =
				`// Made with Flock\n` + "var " + defvars.join(", ") + ";";
		}

		/*	javascriptGenerator.definitions_["variables"] = variableDeclarations;*/

		javascriptGenerator.isInitialized = true;
	};

	javascriptGenerator.forBlock["camera_control"] = function (block) {
		const key = block.getFieldValue("KEY");
		const action = block.getFieldValue("ACTION");

		return `cameraControl(${key}, "${action}");\n`;
	};

	javascriptGenerator.forBlock["keyword_block"] = function (block) {
		// Since this block is replaced with another block, we return an empty string.
		return "";
	};
}
