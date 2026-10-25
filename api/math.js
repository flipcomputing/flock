let _flock;

export function setFlockReference(ref) {
  _flock = ref;
}

export function isVector(value) {
  return value != null && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value;
}

export const flockMath = {
  /* 
		  Category: Math
  */

  // No prototype: a host-realm prototype chain reaches the untamed host
  // Function via .constructor (sandbox escape).
  createVector3(x, y, z) {
    return Object.freeze(Object.assign(Object.create(null), { x, y, z }));
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
