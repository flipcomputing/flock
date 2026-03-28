import { expect } from "chai";

export function runSceneTests(flock) {
  describe("Scene API Tests", function () {
    // ─── setSky ────────────────────────────────────────────────────────────────

    describe("setSky", function () {
      afterEach(function () {
        if (flock.sky) {
          flock.disposeMesh(flock.sky);
          flock.sky = null;
        }
      });

      it("should create a sky sphere for a single color string", function () {
        flock.setSky("#6495ed");
        expect(flock.sky).to.exist;
        expect(flock.sky.name).to.equal("sky");
      });

      it("should create a sky sphere for a 2-color gradient array", function () {
        flock.setSky(["#6495ed", "#ffffff"]);
        expect(flock.sky).to.exist;
        expect(flock.sky.material).to.exist;
      });

      it("should create a sky sphere for a 3-color gradient array", function () {
        flock.setSky(["#000033", "#6495ed", "#ffffff"]);
        expect(flock.sky).to.exist;
        expect(flock.sky.material).to.exist;
      });

      it("should create a sky sphere when passed a Material instance", function () {
        const mat = new flock.BABYLON.StandardMaterial(
          "testSkyMat",
          flock.scene,
        );
        mat.backFaceCulling = false;
        flock.setSky(mat);
        expect(flock.sky).to.exist;
        expect(flock.sky.material).to.equal(mat);
        mat.dispose();
      });

      it("should set clearColor and not create a sky sphere with clear:true", function () {
        flock.setSky("#ff0000", { clear: true });
        expect(flock.sky).to.not.exist;
      });

      it("should only have one sky mesh after calling setSky twice", function () {
        flock.setSky("#6495ed");
        const first = flock.sky;
        flock.setSky("#ff6347");
        const second = flock.sky;

        expect(second).to.exist;
        expect(second).to.not.equal(first);

        const skyMeshes = flock.scene.meshes.filter((m) => m.name === "sky");
        expect(skyMeshes.length).to.equal(1);
      });
    });

    // ─── createLinearGradientTexture ───────────────────────────────────────────

    describe("createLinearGradientTexture", function () {
      const createdTextures = [];

      afterEach(function () {
        createdTextures.forEach((t) => t.dispose());
        createdTextures.length = 0;
      });

      it("should return a DynamicTexture for a two-color array", function () {
        const tex = flock.createLinearGradientTexture(["#336633", "#88cc88"]);
        createdTextures.push(tex);
        expect(tex).to.exist;
        expect(tex.getClassName()).to.equal("DynamicTexture");
      });

      it("should return a DynamicTexture for a single-color array", function () {
        const tex = flock.createLinearGradientTexture(["#336633"]);
        createdTextures.push(tex);
        expect(tex).to.exist;
        expect(tex.getClassName()).to.equal("DynamicTexture");
      });

      it("should produce a taller-than-wide texture by default (vertical)", function () {
        const tex = flock.createLinearGradientTexture(["#336633", "#88cc88"], {
          size: 256,
        });
        createdTextures.push(tex);
        const { width, height } = tex.getSize();
        expect(height).to.be.greaterThan(width);
      });

      it("should produce a wider-than-tall texture with horizontal:true", function () {
        const tex = flock.createLinearGradientTexture(["#336633", "#88cc88"], {
          size: 256,
          horizontal: true,
        });
        createdTextures.push(tex);
        const { width, height } = tex.getSize();
        expect(width).to.be.greaterThan(height);
      });

      it("should respect the size option", function () {
        const tex = flock.createLinearGradientTexture(["#336633", "#88cc88"], {
          size: 128,
        });
        createdTextures.push(tex);
        const { height } = tex.getSize();
        expect(height).to.equal(128);
      });
    });

    // ─── createMap ─────────────────────────────────────────────────────────────

    describe("createMap", function () {
      // flock.ground is assigned immediately for heightmaps, but metadata is
      // only populated inside the async onReady callback. Poll until it lands.
      async function waitForGroundMetadata(timeout = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          if (flock.ground?.metadata) return flock.ground;
          await new Promise((r) => setTimeout(r, 50));
        }
        return flock.ground;
      }

      afterEach(function () {
        if (flock.ground) {
          flock.disposeMesh(flock.ground);
          flock.ground = null;
        }
      });

      it("should create a ground mesh for a plain color list", function () {
        const ground = flock.createMap("NONE", ["#336633", "#88cc88"]);
        expect(ground).to.exist;
        expect(ground.name).to.equal("ground");
      });

      it("should create a ground mesh for a material object with color list", function () {
        const ground = flock.createMap("NONE", {
          color: ["#336633", "#88cc88"],
          materialName: "none.png",
        });
        expect(ground).to.exist;
        expect(ground.name).to.equal("ground");
      });

      it("should set flock.ground to the returned mesh", function () {
        const ground = flock.createMap("NONE", ["#336633", "#88cc88"]);
        expect(flock.ground).to.equal(ground);
      });

      it("should set correct metadata on the ground mesh", function () {
        const ground = flock.createMap("NONE", ["#336633", "#88cc88"]);
        expect(ground.metadata).to.exist;
        expect(ground.metadata.blockKey).to.equal("ground");
        expect(ground.metadata.heightMapImage).to.equal("NONE");
      });

      it("should attach a physics body to the ground mesh", function () {
        const ground = flock.createMap("NONE", ["#336633", "#88cc88"]);
        expect(ground.physics).to.exist;
      });

      it("should reuse the same mesh when called again with the same image", function () {
        const first = flock.createMap("NONE", ["#336633", "#88cc88"]);
        const second = flock.createMap("NONE", ["#cc8833", "#88cc88"]);
        expect(second).to.equal(first);
        const groundMeshes = flock.scene.meshes.filter(
          (m) => m.name === "ground",
        );
        expect(groundMeshes.length).to.equal(1);
      });

      it("should not accumulate ground meshes across repeated calls", function () {
        flock.createMap("NONE", ["#336633", "#88cc88"]);
        flock.createMap("NONE", ["#cc8833", "#336633"]);
        flock.createMap("NONE", ["#ffffff", "#000000"]);
        const groundMeshes = flock.scene.meshes.filter(
          (m) => m.name === "ground",
        );
        expect(groundMeshes.length).to.equal(1);
      });

      it("should apply a texture material to a flat ground", function () {
        const mat = flock.createMaterial({ materialName: "test.png" });
        const ground = flock.createMap("NONE", mat);
        expect(ground).to.exist;
        expect(ground.name).to.equal("ground");
        expect(ground.material).to.exist;
      });

      it("should create a ground mesh from a heightmap image @slow", async function () {
        this.timeout(10000);
        flock.createMap("Islands.png", ["#336633", "#88cc88"]);
        const ground = await waitForGroundMetadata();
        expect(ground).to.exist;
        expect(ground.name).to.equal("ground");
        expect(ground.metadata.heightMapImage).to.equal("Islands.png");
      });

      it("should replace a flat ground with a heightmap ground @slow", async function () {
        this.timeout(10000);
        flock.createMap("NONE", ["#336633", "#88cc88"]);
        flock.createMap("Islands.png", ["#336633", "#88cc88"]);
        const ground = await waitForGroundMetadata();
        expect(ground.metadata.heightMapImage).to.equal("Islands.png");
        const groundMeshes = flock.scene.meshes.filter(
          (m) => m.name === "ground",
        );
        expect(groundMeshes.length).to.equal(1);
      });
    });

    // ─── getGroundLevelAt ──────────────────────────────────────────────────────

    describe("getGroundLevelAt", function () {
      afterEach(function () {
        if (flock.ground) {
          flock.disposeMesh(flock.ground);
          flock.ground = null;
        }
      });

      it("should return 0 when no ground exists", function () {
        const level = flock.getGroundLevelAt(0, 0);
        expect(level).to.equal(0);
      });

      it("should return a number after a flat ground is created", function () {
        flock.createMap("NONE", ["#336633", "#88cc88"]);
        const level = flock.getGroundLevelAt(0, 0);
        expect(level).to.be.a("number");
      });

      it("should return 0 at the centre of a flat ground", function () {
        flock.createMap("NONE", ["#336633", "#88cc88"]);
        const level = flock.getGroundLevelAt(0, 0);
        expect(level).to.equal(0);
      });

      it("should accept custom rayStartY and rayLength options without error", function () {
        flock.createMap("NONE", ["#336633", "#88cc88"]);
        const level = flock.getGroundLevelAt(0, 0, {
          rayStartY: 500,
          rayLength: 1000,
        });
        expect(level).to.be.a("number");
      });
    });

    // ─── waitForGroundReady ────────────────────────────────────────────────────

    describe("waitForGroundReady", function () {
      afterEach(function () {
        if (flock.ground) {
          flock.disposeMesh(flock.ground);
          flock.ground = null;
        }
      });

      it("should resolve immediately with the ground when flock.ground already exists", async function () {
        flock.createMap("NONE", ["#336633", "#88cc88"]);
        const ground = await flock.waitForGroundReady();
        expect(ground).to.equal(flock.ground);
      });

    });

    // ─── cloneMesh ─────────────────────────────────────────────────────────────

    describe("cloneMesh", function () {
      const createdIds = [];

      afterEach(function () {
        createdIds.forEach((id) => flock.dispose(id));
        createdIds.length = 0;
      });

      it("should return null for a missing sourceMeshName", function () {
        const result = flock.cloneMesh({ cloneId: "clone1" });
        expect(result).to.be.null;
      });

      it("should return null for a missing cloneId", function () {
        const boxId = flock.createBox("cloneSrc__1", {
          color: "#996633",
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        const result = flock.cloneMesh({ sourceMeshName: boxId });
        expect(result).to.be.null;
      });

      it("should return a string ID for valid inputs", function () {
        const boxId = flock.createBox("cloneSrc__2", {
          color: "#996633",
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        const cloneId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: "myClone",
        });
        createdIds.push(cloneId);
        expect(cloneId).to.be.a("string");
        expect(cloneId).to.include("myClone");
      });

      it("should return an ID starting with cloneId + '_'", function () {
        const boxId = flock.createBox("cloneSrc__3", {
          color: "#996633",
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        const cloneId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: "myClone",
        });
        createdIds.push(cloneId);
        expect(cloneId).to.match(/^myClone_/);
      });

      it("should invoke the callback after cloning", async function () {
        this.timeout(3000);
        const boxId = flock.createBox("cloneSrc__4", {
          color: "#996633",
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        let called = false;
        const cloneId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: "myClone",
          callback: () => {
            called = true;
          },
        });
        createdIds.push(cloneId);
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(called).to.be.true;
      });
    });
  });
}
