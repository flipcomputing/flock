let flock;

export function setFlockReference(ref) {
	flock = ref;
}

export const flockMath = {
	/* 
		  Category: Math
  */

	createVector3(x, y, z) {
		return new flock.BABYLON.Vector3(x, y, z);
	},
	randomInteger(a, b) {
		if (a > b) {
			// Swap a and b to ensure a is smaller.
			var c = a;
			a = b;
			b = c;
		}
		return Math.floor(Math.random() * (b - a + 1) + a);
	},
	seededRandom(from, to, seed) {
		const x = Math.sin(seed) * 10000;
		const random = x - Math.floor(x);
		const result = Math.floor(random * (to - from + 1)) + from;
		return result;
	},
};
