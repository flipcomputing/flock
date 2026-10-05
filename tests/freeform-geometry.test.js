import { expect } from 'chai';
import {
  CUBE_POINTS,
  CUBE_FACES,
  topologyError,
  geometryError,
  shapeError,
  extrudeFace,
  faceNormal,
  mergePoints,
} from '../api/freeformgeometry.js';

const cubePoints = () => CUBE_POINTS.map((p) => [...p]);
const cubeFaces = () => CUBE_FACES.map((f) => [...f]);

const moved = (index, point) => {
  const points = cubePoints();
  points[index] = point;
  return points;
};

export function runFreeformGeometryTests() {
  describe('api/freeformgeometry @freeformgeometry', function () {
    describe('topologyError', function () {
      it('accepts the cube', function () {
        expect(topologyError(8, CUBE_FACES)).to.equal(null);
      });

      it('rejects a missing face', function () {
        expect(topologyError(8, CUBE_FACES.slice(1))).to.equal('open edge');
      });

      it('rejects a flipped face', function () {
        const faces = cubeFaces();
        faces[0].reverse();
        expect(topologyError(8, faces)).to.equal('edge used twice');
      });

      it('rejects a face that uses a point not in the list', function () {
        expect(topologyError(7, CUBE_FACES)).to.equal('face uses a missing point');
      });

      it('rejects a point no face uses', function () {
        expect(topologyError(9, CUBE_FACES)).to.equal('unused point');
      });

      it('rejects two tetrahedra touching at a tip', function () {
        const faces = [
          [0, 1, 2],
          [0, 2, 3],
          [0, 3, 1],
          [1, 3, 2],
          [0, 4, 5],
          [0, 5, 6],
          [0, 6, 4],
          [4, 6, 5],
        ];
        expect(topologyError(7, faces)).to.equal('shapes touch at a point');
      });
    });

    describe('geometryError', function () {
      it('accepts the cube', function () {
        expect(geometryError(CUBE_POINTS, CUBE_FACES)).to.equal(null);
      });

      it('accepts a corner pulled out or pushed in a little', function () {
        expect(geometryError(moved(6, [1.5, 2, 1]), CUBE_FACES)).to.equal(null);
        expect(geometryError(moved(6, [0.3, 0.3, 0.3]), CUBE_FACES)).to.equal(null);
      });

      it('rejects a corner pushed through the opposite side', function () {
        expect(geometryError(moved(6, [-1, -1, -1]), CUBE_FACES)).to.not.equal(null);
      });

      it('rejects a corner pushed through a side face', function () {
        expect(geometryError(moved(6, [0.5, -1, 0.5]), CUBE_FACES)).to.not.equal(null);
      });

      it('rejects a corner dragged onto another corner', function () {
        expect(geometryError(moved(6, [0.5, 0.5, -0.5]), CUBE_FACES)).to.not.equal(null);
      });

      it('rejects a face folded flat onto its neighbour', function () {
        // Top corners dropped to the bottom squash the shape flat.
        const points = cubePoints().map(([x, , z]) => [x, -0.5, z]);
        expect(geometryError(points, CUBE_FACES)).to.not.equal(null);
      });

      it('gives the same answer checking only the moved point', function () {
        const bad = moved(6, [-1, -1, -1]);
        const good = moved(6, [1.5, 2, 1]);
        expect(geometryError(bad, CUBE_FACES, [6])).to.not.equal(null);
        expect(geometryError(good, CUBE_FACES, [6])).to.equal(null);
      });

      it('rejects an inside-out shape', function () {
        const faces = cubeFaces().map((f) => [...f].reverse());
        expect(geometryError(CUBE_POINTS, faces)).to.equal('inside out');
      });
    });

    describe('mergePoints', function () {
      it('turns the cube into a pyramid when the top corners merge', function () {
        let shape = { points: cubePoints(), faces: cubeFaces() };
        // Merging renumbers later points, so merge the highest index first.
        for (const [from, into] of [
          [7, 4],
          [6, 5],
          [5, 4],
        ]) {
          shape = mergePoints(shape.points, shape.faces, from, into);
          expect(shapeError(shape.points, shape.faces), `merge ${from}`).to.equal(null);
        }
        expect(shape.points).to.have.length(5);
        expect(shape.faces).to.have.length(5);
        expect(shape.faces.filter((f) => f.length === 3)).to.have.length(4);
      });

      it('turns the cube into a wedge when two top edges collapse', function () {
        let shape = mergePoints(CUBE_POINTS, CUBE_FACES, 7, 4);
        shape = mergePoints(shape.points, shape.faces, 6, 5);
        expect(shapeError(shape.points, shape.faces)).to.equal(null);
        expect(shape.points).to.have.length(6);
        expect(shape.faces).to.have.length(5);
      });

      it('keeps the remaining points in order', function () {
        const { points } = mergePoints(CUBE_POINTS, CUBE_FACES, 2, 1);
        expect(points).to.deep.equal(CUBE_POINTS.filter((_, i) => i !== 2));
      });

      it('refuses points that do not share an edge', function () {
        expect(mergePoints(CUBE_POINTS, CUBE_FACES, 0, 6)).to.equal(null);
        expect(mergePoints(CUBE_POINTS, CUBE_FACES, 0, 2)).to.equal(null);
      });

      it('undoes an extrude when the new corners merge back down', function () {
        let shape = extrudeFace(CUBE_POINTS, CUBE_FACES, 1, 1);
        for (const [from, into] of [
          [11, 5],
          [10, 6],
          [9, 7],
          [8, 4],
        ]) {
          shape = mergePoints(shape.points, shape.faces, from, into);
        }
        expect(shapeError(shape.points, shape.faces)).to.equal(null);
        expect(shape.points).to.deep.equal(CUBE_POINTS);
        expect(shape.faces).to.have.length(6);
      });

      it('refuses to merge a tetrahedron any further', function () {
        let shape = { points: cubePoints(), faces: cubeFaces() };
        for (const [from, into] of [
          [7, 4],
          [6, 5],
          [5, 4],
          [3, 0],
        ]) {
          shape = mergePoints(shape.points, shape.faces, from, into);
        }
        expect(shapeError(shape.points, shape.faces)).to.equal(null);
        expect(shape.points).to.have.length(4);
        const flattened = mergePoints(shape.points, shape.faces, 3, 0);
        expect(shapeError(flattened.points, flattened.faces)).to.not.equal(null);
      });
    });

    describe('extrudeFace', function () {
      it('keeps the shape closed and valid', function () {
        const { points, faces } = extrudeFace(CUBE_POINTS, CUBE_FACES, 1, 1);
        expect(points).to.have.length(12);
        expect(faces).to.have.length(10);
        expect(shapeError(points, faces)).to.equal(null);
      });

      it('moves the face out along its normal', function () {
        const { points, faces } = extrudeFace(CUBE_POINTS, CUBE_FACES, 1, 1);
        faces[1].forEach((i) => expect(points[i][1]).to.be.closeTo(1.5, 1e-9));
      });

      it('stays valid over repeated extrudes of different faces', function () {
        let shape = { points: cubePoints(), faces: cubeFaces() };
        for (const faceIndex of [1, 2, 1, 5, 0, 3]) {
          shape = extrudeFace(shape.points, shape.faces, faceIndex, 0.5);
          expect(shapeError(shape.points, shape.faces), `face ${faceIndex}`).to.equal(null);
        }
        // An extruded cap faces the same way as the face it came from.
        expect(faceNormal(shape.points, shape.faces[1])).to.deep.equal([0, 1, 0]);
      });

      it('rejects pushing a face in, as the new walls fold back over the sides', function () {
        [-0.5, -1.5].forEach((distance) => {
          const { points, faces } = extrudeFace(CUBE_POINTS, CUBE_FACES, 1, distance);
          expect(shapeError(points, faces), `distance ${distance}`).to.not.equal(null);
        });
      });

      it('rejects an extrude that runs into another part of the shape', function () {
        // An arch: two legs up from the bottom face, then pull the far leg's
        // inner side across into the near leg.
        let shape = { points: cubePoints(), faces: cubeFaces() };
        shape = extrudeFace(shape.points, shape.faces, 4, 1); // -x side
        shape = extrudeFace(shape.points, shape.faces, 5, 1); // +x side
        expect(shapeError(shape.points, shape.faces)).to.equal(null);
        // Push the +x cap back through the cube body.
        const pushed = extrudeFace(shape.points, shape.faces, 5, -3);
        expect(shapeError(pushed.points, pushed.faces)).to.not.equal(null);
      });
    });
  });
}
