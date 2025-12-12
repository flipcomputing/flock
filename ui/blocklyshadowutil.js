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
