import { expect } from "chai";

export function runHavokMemoryTests(flock) {
  describe("Havok memory stability @memory @slow", function () {
    function snapshotHavokStats() {
      const stats = flock.hk?.getStatistics?.();
      expect(stats).to.exist;
      expect(stats).to.be.an("object");

      return Object.entries(stats).reduce((acc, [key, value]) => {
        if (typeof value === "number" && Number.isFinite(value)) {
          acc[key] = value;
        }
        return acc;
      }, {});
    }

    const alienPlanetSmokeCode = `
      flock.setSky(["#250b2e", "#a63f87"]);
      flock.createMap("uneven_terrain.png", ["#4a6b2c", "#a38b4f"]);

      const characterId = flock.createCharacter({
        modelName: "Liz3.glb",
        modelId: "alien_liz_runner",
        position: [0, 4, 0],
      });

      flock.createObject({
        modelName: "tree.glb",
        modelId: "alien_tree_anchor",
        position: [5, 2, -5],
      });

      flock.playAnimation(characterId, {
        animationName: "Walk",
        loop: true,
      });
    `;

    async function captureRunStatsPair() {
      await flock.runCode(alienPlanetSmokeCode);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const firstStats = snapshotHavokStats();

      await flock.runCode(alienPlanetSmokeCode);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const secondStats = snapshotHavokStats();

      return { firstStats, secondStats };
    }

    it("should expose at least one numeric Havok statistics property", async function () {
      this.timeout(30000);

      const { firstStats, secondStats } = await captureRunStatsPair();
      const keys = Object.keys(firstStats).filter((key) =>
        Object.prototype.hasOwnProperty.call(secondStats, key),
      );

      expect(keys.length).to.be.greaterThan(0);
    });

    it("should not increase each Havok getStatistics numeric property after a second alien-planet run", async function () {
      this.timeout(30000);

      const { firstStats, secondStats } = await captureRunStatsPair();
      const keys = Object.keys(firstStats).filter((key) =>
        Object.prototype.hasOwnProperty.call(secondStats, key),
      );

      expect(keys.length).to.be.greaterThan(0);

      keys.forEach((key) => {
        const firstValue = firstStats[key];
        const secondValue = secondStats[key];

        if (secondValue > firstValue) {
          console.error(
            `[havok-memory] ${key} increased after second run: ${firstValue} -> ${secondValue}`,
          );
        }

        expect(
          secondValue,
          `Havok stat '${key}' increased after second run (${firstValue} -> ${secondValue})`,
        ).to.be.at.most(firstValue);
      });
    });
  });
}
