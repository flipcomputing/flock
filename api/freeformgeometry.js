// Freeform shapes are a list of points and a list of faces. Each face lists
// point indices, clockwise seen from outside. A valid shape is closed, every
// edge is shared by exactly two faces, and the surface never touches itself.

export const CUBE_POINTS = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, -0.5, 0.5],
  [-0.5, -0.5, 0.5],
  [-0.5, 0.5, -0.5],
  [0.5, 0.5, -0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
];

export const CUBE_FACES = [
  [0, 1, 2, 3],
  [4, 7, 6, 5],
  [0, 4, 5, 1],
  [3, 2, 6, 7],
  [0, 3, 7, 4],
  [1, 5, 6, 2],
];

const EPS = 1e-7;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a) => Math.sqrt(dot(a, a));

const roundToTenth = (v) => Math.round(v * 10) / 10 + 0;

// Fan triangles in the order the mesh is built from.
export function faceTriangles(face) {
  const triangles = [];
  for (let k = 1; k < face.length - 1; k++) triangles.push([face[0], face[k + 1], face[k]]);
  return triangles;
}

function outwardNormal(a, b, c) {
  return cross(sub(c, a), sub(b, a));
}

export function faceNormal(points, face) {
  const sum = faceTriangles(face).reduce(
    (total, [a, b, c]) => add(total, outwardNormal(points[a], points[b], points[c])),
    [0, 0, 0]
  );
  const len = length(sum);
  return len > EPS ? scale(sum, 1 / len) : [0, 1, 0];
}

export function faceCentre(points, face) {
  return scale(
    face.reduce((total, i) => add(total, points[i]), [0, 0, 0]),
    1 / face.length
  );
}

export function topologyError(pointCount, faces) {
  if (!Array.isArray(faces) || faces.length < 4) return 'too few faces';
  const directed = new Set();
  const used = new Set();
  for (const face of faces) {
    if (!Array.isArray(face) || face.length < 3) return 'face needs 3 points';
    if (new Set(face).size !== face.length) return 'face repeats a point';
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      if (!Number.isInteger(a) || a < 0 || a >= pointCount) return 'face uses a missing point';
      const key = `${a},${b}`;
      if (directed.has(key)) return 'edge used twice';
      directed.add(key);
      used.add(a);
    }
  }
  if (used.size !== pointCount) return 'unused point';
  for (const key of directed) {
    const [a, b] = key.split(',');
    if (!directed.has(`${b},${a}`)) return 'open edge';
  }

  // Around each point the faces must form a single fan, not two cones
  // touching at a tip.
  const around = new Map();
  for (const face of faces) {
    for (let i = 0; i < face.length; i++) {
      const v = face[i];
      const next = face[(i + 1) % face.length];
      const prev = face[(i - 1 + face.length) % face.length];
      if (!around.has(v)) around.set(v, new Map());
      around.get(v).set(next, prev);
    }
  }
  for (const links of around.values()) {
    const start = links.keys().next().value;
    let current = start;
    let steps = 0;
    do {
      current = links.get(current);
      steps++;
    } while (current !== start && current !== undefined && steps <= links.size);
    if (current !== start || steps !== links.size) return 'shapes touch at a point';
  }
  return null;
}

// Drop the axis the normal points along most, to work in 2D.
function projector(normal) {
  const ax = Math.abs(normal[0]);
  const ay = Math.abs(normal[1]);
  const az = Math.abs(normal[2]);
  if (ax >= ay && ax >= az) return (p) => [p[1], p[2]];
  if (ay >= az) return (p) => [p[0], p[2]];
  return (p) => [p[0], p[1]];
}

const orient2d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function onSegment2d(p, a, b) {
  return (
    Math.min(a[0], b[0]) - EPS <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) + EPS &&
    Math.min(a[1], b[1]) - EPS <= p[1] &&
    p[1] <= Math.max(a[1], b[1]) + EPS
  );
}

function segmentsTouch2d(p1, p2, q1, q2) {
  const d1 = orient2d(q1, q2, p1);
  const d2 = orient2d(q1, q2, p2);
  const d3 = orient2d(p1, p2, q1);
  const d4 = orient2d(p1, p2, q2);
  if (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  ) {
    return true;
  }
  return (
    (Math.abs(d1) <= EPS && onSegment2d(p1, q1, q2)) ||
    (Math.abs(d2) <= EPS && onSegment2d(p2, q1, q2)) ||
    (Math.abs(d3) <= EPS && onSegment2d(q1, p1, p2)) ||
    (Math.abs(d4) <= EPS && onSegment2d(q2, p1, p2))
  );
}

function pointInTriangle2d(p, a, b, c) {
  const d1 = orient2d(a, b, p);
  const d2 = orient2d(b, c, p);
  const d3 = orient2d(c, a, p);
  const hasNeg = d1 < -EPS || d2 < -EPS || d3 < -EPS;
  const hasPos = d1 > EPS || d2 > EPS || d3 > EPS;
  return !(hasNeg && hasPos);
}

function trianglesTouch2d(A, B) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (segmentsTouch2d(A[i], A[(i + 1) % 3], B[j], B[(j + 1) % 3])) return true;
    }
  }
  return pointInTriangle2d(A[0], ...B) || pointInTriangle2d(B[0], ...A);
}

function segmentTouchesTriangle(p, q, a, b, c) {
  const n = cross(sub(b, a), sub(c, a));
  const nn = dot(n, n);
  const dp = dot(n, sub(p, a));
  const dq = dot(n, sub(q, a));
  const tolerance = EPS * Math.sqrt(nn);
  if (Math.abs(dp) <= tolerance && Math.abs(dq) <= tolerance) {
    const flat = projector(n);
    const [P, Q, A, B, C] = [p, q, a, b, c].map(flat);
    return (
      segmentsTouch2d(P, Q, A, B) ||
      segmentsTouch2d(P, Q, B, C) ||
      segmentsTouch2d(P, Q, C, A) ||
      pointInTriangle2d(P, A, B, C)
    );
  }
  if ((dp > tolerance && dq > tolerance) || (dp < -tolerance && dq < -tolerance)) return false;
  const t = Math.abs(dp - dq) > 0 ? dp / (dp - dq) : 0;
  const x = add(p, scale(sub(q, p), Math.min(1, Math.max(0, t))));
  const limit = -EPS * nn;
  return (
    dot(n, cross(sub(b, a), sub(x, a))) >= limit &&
    dot(n, cross(sub(c, b), sub(x, b))) >= limit &&
    dot(n, cross(sub(a, c), sub(x, c))) >= limit
  );
}

function coplanar(n, origin, points) {
  const tolerance = EPS * length(n);
  return points.every((p) => Math.abs(dot(n, sub(p, origin))) <= tolerance);
}

// Wedges at a shared corner overlap if either reaches inside the other.
function wedgesOverlap(s, a1, a2, b1, b2, n) {
  const e = [sub(a1, s), sub(a2, s)];
  const f = [sub(b1, s), sub(b2, s)];
  const side = (u, v) => dot(cross(u, v), n);
  const strictlyInside = (v, [u1, u2]) => {
    const total = side(u1, u2);
    return Math.sign(side(u1, v)) === Math.sign(total) &&
      Math.sign(side(v, u2)) === Math.sign(total) &&
      Math.abs(side(u1, v)) > EPS &&
      Math.abs(side(v, u2)) > EPS;
  };
  if (f.some((v) => strictlyInside(v, e)) || e.some((v) => strictlyInside(v, f))) return true;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const sameDirection =
        Math.abs(side(e[i], f[j])) <= EPS * length(e[i]) * length(f[j]) && dot(e[i], f[j]) > 0;
      if (sameDirection && side(e[i], e[1 - i]) * side(f[j], f[1 - j]) > 0) return true;
    }
  }
  return false;
}

function trianglesTouch(ta, tb, points) {
  const shared = ta.filter((v) => tb.includes(v));
  const [a, b, c] = ta.map((i) => points[i]);
  const [d, e, f] = tb.map((i) => points[i]);
  const nA = cross(sub(b, a), sub(c, a));

  if (shared.length === 3) return true;

  if (shared.length === 2) {
    const [s0, s1] = shared.map((i) => points[i]);
    const otherA = points[ta.find((v) => !shared.includes(v))];
    const otherB = points[tb.find((v) => !shared.includes(v))];
    if (!coplanar(nA, a, [otherB])) return false;
    const edge = sub(s1, s0);
    return dot(cross(edge, sub(otherA, s0)), cross(edge, sub(otherB, s0))) > 0;
  }

  if (shared.length === 1) {
    const s = points[shared[0]];
    const [a1, a2] = ta.filter((v) => v !== shared[0]).map((i) => points[i]);
    const [b1, b2] = tb.filter((v) => v !== shared[0]).map((i) => points[i]);
    if (coplanar(nA, a, [b1, b2])) return wedgesOverlap(s, a1, a2, b1, b2, nA);
    return segmentTouchesTriangle(a1, a2, s, b1, b2) || segmentTouchesTriangle(b1, b2, s, a1, a2);
  }

  if (coplanar(nA, a, [d, e, f])) {
    const flat = projector(nA);
    return trianglesTouch2d([a, b, c].map(flat), [d, e, f].map(flat));
  }
  const A = [a, b, c];
  const B = [d, e, f];
  for (let i = 0; i < 3; i++) {
    if (segmentTouchesTriangle(A[i], A[(i + 1) % 3], d, e, f)) return true;
    if (segmentTouchesTriangle(B[i], B[(i + 1) % 3], a, b, c)) return true;
  }
  return false;
}

function bounds(triangle, points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const i of triangle) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], points[i][axis]);
      max[axis] = Math.max(max[axis], points[i][axis]);
    }
  }
  return { min, max };
}

const boundsApart = (p, q) =>
  [0, 1, 2].some((axis) => p.max[axis] < q.min[axis] - EPS || q.max[axis] < p.min[axis] - EPS);

// `moved` limits the check to triangles touching those points, for drags.
export function geometryError(points, faces, moved = null) {
  const triangles = faces.flatMap(faceTriangles);
  let volume = 0;
  for (const [a, b, c] of triangles) {
    const n = outwardNormal(points[a], points[b], points[c]);
    if (length(n) < 1e-6) return 'flat face';
    volume += dot(points[a], cross(points[c], points[b]));
  }
  if (volume <= EPS) return 'inside out';

  const box = triangles.map((t) => bounds(t, points));
  const movedSet = moved ? new Set(moved) : null;
  const isMoved = (t) => !movedSet || t.some((v) => movedSet.has(v));
  for (let i = 0; i < triangles.length; i++) {
    for (let j = i + 1; j < triangles.length; j++) {
      if (!isMoved(triangles[i]) && !isMoved(triangles[j])) continue;
      if (boundsApart(box[i], box[j])) continue;
      if (trianglesTouch(triangles[i], triangles[j], points)) return 'shape crosses itself';
    }
  }
  return null;
}

export function shapeError(points, faces, moved = null) {
  return topologyError(points.length, faces) ?? geometryError(points, faces, moved);
}

export function sharesEdge(faces, a, b) {
  return faces.some((face) =>
    face.some((v, i) => {
      const next = face[(i + 1) % face.length];
      return (v === a && next === b) || (v === b && next === a);
    })
  );
}

// Merges `from` into `into`, which must share an edge. Faces lose the merged
// corner, and any left with fewer than three corners disappear. Returns null
// for points that don't share an edge, as merging them would pinch the shape.
export function mergePoints(points, faces, from, into) {
  if (from === into || !sharesEdge(faces, from, into)) return null;
  const renumber = (v) => {
    const merged = v === from ? into : v;
    return merged > from ? merged - 1 : merged;
  };
  const newFaces = faces
    .map((face) =>
      face.map(renumber).filter((v, i, f) => v !== f[(i - 1 + f.length) % f.length])
    )
    .filter((face) => face.length >= 3);
  const newPoints = points.filter((_, i) => i !== from).map((p) => [...p]);
  return { points: newPoints, faces: newFaces };
}

// Pull a face out along its normal; the new side walls keep the shape closed.
export function extrudeFace(points, faces, faceIndex, distance) {
  const face = faces[faceIndex];
  const offset = scale(faceNormal(points, face), distance);
  const added = face.map((_, i) => points.length + i);
  const newPoints = [
    ...points,
    ...face.map((i) => add(points[i], offset).map(roundToTenth)),
  ];
  const newFaces = faces.map((f, i) => (i === faceIndex ? added : f));
  face.forEach((a, i) => {
    const next = (i + 1) % face.length;
    newFaces.push([a, face[next], added[next], added[i]]);
  });
  return { points: newPoints, faces: newFaces };
}
