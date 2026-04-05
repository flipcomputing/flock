import { expect } from "chai";

export function runShapesTests(flock) {
  describe("Shapes API @shapes", function () {
    const createdIds = [];

    afterEach(function () {
      createdIds.forEach((id) => {
        try {
          flock.dispose(id);
        } catch (e) {
          console.warn(`Failed to dispose ${id}:`, e);
        }
      });
      createdIds.length = 0;
    });

    describe("createCapsule", function () {
      it("should return a string id and create the mesh in the scene", function () {
        const id = flock.createCapsule("testCapsule1", {
          color: "#ff6600",
          diameter: 1,
          height: 2,
          position: [0, 1, 0],
        });
        createdIds.push(id);

        expect(id).to.be.a("string");
        const mesh = flock.scene.getMeshByName(id);
        expect(mesh).to.exist;
      });

      it("should set blockKey metadata on the created capsule", function () {
        const id = flock.createCapsule("testCapsule2", {
          color: "#0066ff",
          diameter: 0.5,
          height: 1.5,
          position: [2, 1, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.metadata).to.exist;
        expect(mesh.metadata.blockKey).to.be.a("string");
      });

      it("should route capsule name allocation through _reserveName", function () {
        const originalReserveName = flock._reserveName;
        const reserveCalls = [];

        flock._reserveName = (name) => {
          reserveCalls.push(name);
          return originalReserveName.call(flock, name);
        };

        try {
          const firstId = flock.createCapsule("reserveCapsule", {
            color: "#0066ff",
            diameter: 0.5,
            height: 1.5,
            position: [2, 1, 0],
          });
          const secondId = flock.createCapsule("reserveCapsule", {
            color: "#0066ff",
            diameter: 0.5,
            height: 1.5,
            position: [3, 1, 0],
          });
          createdIds.push(firstId, secondId);

          expect(reserveCalls).to.deep.equal(["reserveCapsule", "reserveCapsule"]);
          expect(firstId).to.not.equal(secondId);
        } finally {
          flock._reserveName = originalReserveName;
        }
      });
    });

    describe("createPlane", function () {
      it("should return a string id and create the mesh in the scene", function () {
        const id = flock.createPlane("testPlane1", {
          color: "#00cc44",
          width: 3,
          height: 2,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        expect(id).to.be.a("string");
        const mesh = flock.scene.getMeshByName(id);
        expect(mesh).to.exist;
      });

      it("should set metadata.shape to 'plane'", function () {
        const id = flock.createPlane("testPlane2", {
          color: "#cc0044",
          width: 1,
          height: 1,
          position: [3, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.metadata).to.exist;
        expect(mesh.metadata.shape).to.equal("plane");
      });
    });

    describe("shared name reservation", function () {
      it("should route shape creators through _reserveName", function () {
        const originalReserveName = flock._reserveName;
        const reserveCalls = [];

        flock._reserveName = (name) => {
          reserveCalls.push(name);
          return originalReserveName.call(flock, name);
        };

        try {
          const boxA = flock.createBox("reserveBox", { position: [0, 0, 0] });
          const boxB = flock.createBox("reserveBox", { position: [1, 0, 0] });
          const sphereA = flock.createSphere("reserveSphere", {
            position: [0, 0, 0],
          });
          const sphereB = flock.createSphere("reserveSphere", {
            position: [1, 0, 0],
          });
          const cylinderA = flock.createCylinder("reserveCylinder", {
            height: 1,
            diameterTop: 1,
            diameterBottom: 1,
            position: [0, 0, 0],
          });
          const cylinderB = flock.createCylinder("reserveCylinder", {
            height: 1,
            diameterTop: 1,
            diameterBottom: 1,
            position: [1, 0, 0],
          });
          const planeA = flock.createPlane("reservePlane", {
            width: 1,
            height: 1,
            position: [0, 0, 0],
          });
          const planeB = flock.createPlane("reservePlane", {
            width: 1,
            height: 1,
            position: [1, 0, 0],
          });
          createdIds.push(
            boxA,
            boxB,
            sphereA,
            sphereB,
            cylinderA,
            cylinderB,
            planeA,
            planeB,
          );

          expect(reserveCalls).to.include.members([
            "reserveBox",
            "reserveSphere",
            "reserveCylinder",
            "reservePlane",
          ]);
          expect(boxA).to.not.equal(boxB);
          expect(sphereA).to.not.equal(sphereB);
          expect(cylinderA).to.not.equal(cylinderB);
          expect(planeA).to.not.equal(planeB);
        } finally {
          flock._reserveName = originalReserveName;
        }
      });
    });

    describe("create3DText @slow", function () {
      this.timeout(30000);

      it("should return a string id and create a text mesh in the scene", async function () {
        const id = flock.create3DText({
          text: "Hi",
          font: "/fonts/FreeSansBold.ttf",
          color: "#ffffff",
          size: 1,
          depth: 0.2,
          position: { x: 0, y: 0, z: 0 },
          modelId: "testText3D",
        });
        createdIds.push(id);

        expect(id).to.be.a("string");

        await new Promise((resolve, reject) => {
          flock.whenModelReady(id, resolve);
          setTimeout(
            () => reject(new Error("create3DText timed out")),
            25000,
          );
        });

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh).to.exist;
      });

      it("should route text mesh allocation through _reserveName", async function () {
        const originalReserveName = flock._reserveName;
        const reserveCalls = [];

        flock._reserveName = (name) => {
          reserveCalls.push(name);
          return originalReserveName.call(flock, name);
        };

        try {
          const firstId = flock.create3DText({
            text: "Name",
            font: "/fonts/FreeSansBold.ttf",
            color: "#ffffff",
            size: 1,
            depth: 0.2,
            position: { x: 0, y: 0, z: 0 },
            modelId: "reserveText",
          });
          const secondId = flock.create3DText({
            text: "Name2",
            font: "/fonts/FreeSansBold.ttf",
            color: "#ffffff",
            size: 1,
            depth: 0.2,
            position: { x: 1, y: 0, z: 0 },
            modelId: "reserveText",
          });
          createdIds.push(firstId, secondId);

          expect(reserveCalls).to.deep.equal(["reserveText", "reserveText"]);
          expect(firstId).to.not.equal(secondId);
        } finally {
          flock._reserveName = originalReserveName;
        }
      });
    });
  });
}
