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
	addNumberShadow(spec, "X", roundPositionValue(pos?.x ?? 0));
	addNumberShadow(spec, "Y", roundPositionValue(pos?.y ?? 0));
	addNumberShadow(spec, "Z", roundPositionValue(pos?.z ?? 0));
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
		extraState: { itemCount: colours.length },
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
