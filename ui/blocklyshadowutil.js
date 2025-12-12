import { objectColours } from "../config.js";

export function roundPositionValue(value) {
	return Math.round(value * 10) / 10; // 1 decimal place
}

export function addNumberShadow(spec, inputName, value) {
	spec.inputs ||= {};
	spec.inputs[inputName] = {
		shadow: { type: "math_number", fields: { NUM: value } },
	};
}

export function addXYZShadows(spec, pos) {
	const round =
		typeof roundPositionValue === "function"
			? roundPositionValue
			: (v) => v;
	addNumberShadow(spec, "X", round(pos?.x ?? 0));
	addNumberShadow(spec, "Y", round(pos?.y ?? 0));
	addNumberShadow(spec, "Z", round(pos?.z ?? 0));
}

export function addColourShadow(spec, inputName, shadowType, hex) {
	spec.inputs ||= {};
	spec.inputs[inputName] = {
		shadow: { type: shadowType, fields: { COLOR: hex } },
	};
}

export function addPositionShadows(spec, pos) {
	const rx =
		typeof roundPositionValue === "function"
			? roundPositionValue
			: (v) => v;
	addNumberShadow(spec, "X", rx(pos?.x ?? 0));
	addNumberShadow(spec, "Y", rx(pos?.y ?? 0));
	addNumberShadow(spec, "Z", rx(pos?.z ?? 0));
}

export function addColourShadowSpec(spec, name, hex, shadowType = "colour") {
	spec.inputs ||= {};
	spec.inputs[name] = {
		shadow: { type: shadowType, fields: { COLOR: hex } },
	};
}

export function buildColorsListShadowSpec(objectName) {
	const colours = objectColours?.[objectName] || [
		"#000000",
		"#FFFFFF",
		"#CCCCCC",
	];

	const listSpec = {
		type: "lists_create_with",
		// Modern serializer:
		extraState: { itemCount: colours.length },
		// Older builds read mutation for count:
		mutation: { items: colours.length },
		inline: true,
		inputs: {},
	};

	colours.forEach((hex, i) => {
		listSpec.inputs["ADD" + i] = {
			shadow: { type: "colour", fields: { COLOR: hex } },
		};
	});

	return listSpec;
}

export function createBlockWithShadows(shapeType, position, colour) {
	const workspace = Blockly.getMainWorkspace();
	const spec = __CREATE_SPEC[shapeType];
	if (!spec) return null;

	const c = colour ? colour : flock.randomColour();
	const posX = position?.x !== undefined ? roundPos(position.x) : 0;
	const posY = position?.y !== undefined ? roundPos(position.y) : 0;
	const posZ = position?.z !== undefined ? roundPos(position.z) : 0;

	const defaults = { ...spec.defaults({ c }), X: posX, Y: posY, Z: posZ };

	let allInputs;
	if (shapeType === "set_sky_color") {
		allInputs = [...spec.inputs];
	} else {
		allInputs = [...spec.inputs, "X", "Y", "Z"];
	}

	const data = { type: shapeType, inputs: {} };
	for (const name of allInputs) {
		const { type, field } = __metaFor(name);
		data.inputs[name] = {
			shadow: makeShadowSpec(type, { [field]: defaults[name] }),
		};
	}

	const existingGroup = Blockly.Events.getGroup();
	const startTempGroup = !existingGroup;
	if (startTempGroup) Blockly.Events.setGroup(true);
	const groupId = Blockly.Events.getGroup();

	const eventsWereEnabled = Blockly.Events.isEnabled();
	if (!eventsWereEnabled) Blockly.Events.enable();

	try {
		Blockly.Events.setGroup(groupId);

		let block;
		try {
			// Modern signature
			block = Blockly.serialization.blocks.append(data, workspace, {
				recordUndo: true,
			});
		} catch {
			block = Blockly.serialization.blocks.append(data, workspace);
			const ev = new Blockly.Events.BlockCreate(block);
			ev.group = groupId;
			ev.recordUndo = true;
			Blockly.Events.fire(ev);
		}

		block?.initSvg?.();
		block?.render?.();
		return block;
	} finally {
		if (startTempGroup) Blockly.Events.setGroup(false);
		else Blockly.Events.setGroup(existingGroup);
		if (!eventsWereEnabled) Blockly.Events.disable();
	}
}

function makeShadowSpec(type, fields) {
	return { type, fields };
}
function roundPos(v) {
	return typeof roundPositionValue === "function" ? roundPositionValue(v) : v;
}

const __CREATE_SPEC = {
	create_box: {
		defaults: ({ c }) => ({ COLOR: c, WIDTH: 1, HEIGHT: 1, DEPTH: 1 }),
		inputs: ["COLOR", "WIDTH", "HEIGHT", "DEPTH"],
	},
	create_sphere: {
		defaults: ({ c }) => ({
			COLOR: c,
			DIAMETER_X: 1,
			DIAMETER_Y: 1,
			DIAMETER_Z: 1,
		}),
		inputs: ["COLOR", "DIAMETER_X", "DIAMETER_Y", "DIAMETER_Z"],
	},
	create_cylinder: {
		defaults: ({ c }) => ({
			COLOR: c,
			HEIGHT: 1,
			DIAMETER_TOP: 1,
			DIAMETER_BOTTOM: 1,
			TESSELLATIONS: 24,
		}),
		inputs: [
			"COLOR",
			"HEIGHT",
			"DIAMETER_TOP",
			"DIAMETER_BOTTOM",
			"TESSELLATIONS",
		],
	},
	create_capsule: {
		defaults: ({ c }) => ({ COLOR: c, DIAMETER: 1, HEIGHT: 2 }),
		inputs: ["COLOR", "DIAMETER", "HEIGHT"],
	},
	create_plane: {
		defaults: ({ c }) => ({ COLOR: c, WIDTH: 2, HEIGHT: 2 }),
		inputs: ["COLOR", "WIDTH", "HEIGHT"],
	},
	set_sky_color: {
		defaults: ({ c }) => ({ COLOR: c }),
		inputs: ["COLOR"],
	},
};

function __metaFor(name) {
	return name === "COLOR"
		? { type: "colour", field: "COLOR" }
		: { type: "math_number", field: "NUM" };
}
