let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockEffects = {
  /*    Category: Scene>Effects  */
  lightIntensity(intensity) {
    if (flock.mainLight) {
      flock.mainLight.intensity = intensity;
    } else {
      console.warn(
        "Main light is not defined. Please ensure flock.mainLight exists.",
      );
    }
  },
  lightColor(diffuse, groundColor) {
    if (flock.mainLight) {
      flock.mainLight.diffuse = flock.BABYLON.Color3.FromHexString(diffuse);
      flock.mainLight.groundColor =
        flock.BABYLON.Color3.FromHexString(groundColor);
    } else {
      console.warn(
        "Main light is not defined. Please ensure flock.mainLight exists.",
      );
    }
  },
  getMainLight() {
    return "__main_light__";
  },
  enableShadows({ enabled = true } = {}) {
    if (!flock.shadowLight) {
      console.warn(
        "Shadow light is not defined. Please ensure flock.shadowLight exists.",
      );
      return;
    }
    if (enabled) {
      if (!flock.shadowGenerator) {
        // Cartoony shadows: a small blur kernel softens the 512-map edges
        // just enough to kill the pixelation while staying cheap.
        const sg = new flock.BABYLON.ShadowGenerator(512, flock.shadowLight);
        sg.useBlurExponentialShadowMap = true;
        sg.blurKernel = 8;
        flock.shadowGenerator = sg;
      }
      // Turn the "sun" on so it both shades surfaces and casts shadows.
      flock.shadowLight.intensity = 0.4;
      if (flock.ground) flock.ground.receiveShadows = true;
      // Register any meshes already marked as casters (order-independent).
      flock.shadowCasters.forEach((m) => {
        if (!m.isDisposed()) flock.shadowGenerator.addShadowCaster(m);
      });
    } else {
      // Turn the directional light back off so the scene returns to its
      // flat hemispheric look (no shading, no cast shadows). Marked casters
      // are remembered so re-enabling restores them.
      flock.shadowLight.intensity = 0;
      if (flock.shadowGenerator) {
        flock.shadowGenerator.dispose();
        flock.shadowGenerator = null;
      }
    }
  },
  setShadow(meshName, { cast = true } = {}) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        const meshes = [mesh, ...mesh.getDescendants()].filter(
          (m) =>
            m instanceof flock.BABYLON.Mesh && m.getTotalVertices() > 0,
        );
        // Marking a caster does NOT turn shadows on — enableShadows is the
        // master switch. Track the intent and apply it live if a generator
        // already exists.
        meshes.forEach((m) => {
          if (cast) {
            flock.shadowCasters.add(m);
            flock.shadowGenerator?.addShadowCaster(m);
          } else {
            flock.shadowCasters.delete(m);
            flock.shadowGenerator?.removeShadowCaster(m);
          }
        });
        resolve();
      });
    });
  },
  createParticleEffect(
    name,
    {
      emitterMesh,
      emitRate,
      colors,
      alphas,
      sizes,
      lifetime,
      shape,
      gravity,
      direction,
      rotation,
    } = {},
  ) {
    const resultName = flock._reserveName(name);

    const particlePromise = new Promise((resolve) => {
      flock.whenModelReady(emitterMesh, (meshInstance) => {
        if (!(meshInstance instanceof flock.BABYLON.AbstractMesh)) {
          flock.reportBlockError({
            key: "particle_emitter_not_mesh",
            api: "createParticleEffect",
            values: { effect: resultName, emitter: emitterMesh },
          });
          resolve(null);
          return;
        }
        try {
          if (Array.isArray(flock.scene.particleSystems)) {
            flock.scene.particleSystems
              .filter((system) => system.emitter === meshInstance)
              .forEach((system) => {
                try {
                  system.dispose(true);
                } catch (error) {
                  console.error(`Error disposing system:`, error);
                }
              });
          }

          const particleSystem = new flock.BABYLON.ParticleSystem(
            resultName,
            500,
            flock.scene,
          );
          const texturePath = flock.texturePath + shape;
          particleSystem.particleTexture = new flock.BABYLON.Texture(
            texturePath,
            flock.scene,
          );
          particleSystem.emitter = meshInstance;

          const meshEmitter = new flock.BABYLON.MeshParticleEmitter(
            meshInstance,
          );
          particleSystem.particleEmitterType = meshEmitter;
          particleSystem.blendMode = 4;

          const startColor = flock.BABYLON.Color4.FromHexString(colors.start);
          const endColor = flock.BABYLON.Color4.FromHexString(colors.end);

          particleSystem.color1 = new flock.BABYLON.Color4(
            startColor.r,
            startColor.g,
            startColor.b,
            alphas.start,
          );
          particleSystem.color2 = new flock.BABYLON.Color4(
            endColor.r,
            endColor.g,
            endColor.b,
            alphas.end,
          );
          particleSystem.colorDead = new flock.BABYLON.Color4(
            endColor.r,
            endColor.g,
            endColor.b,
            0,
          );

          particleSystem.minSize = sizes.start;
          particleSystem.maxSize = sizes.end;

          particleSystem.minLifeTime = lifetime.min;
          particleSystem.maxLifeTime = lifetime.max;

          const MAX_EMIT_RATE = 500;
          particleSystem.emitRate = Math.min(emitRate, MAX_EMIT_RATE);

          particleSystem.gravity = gravity
            ? new flock.BABYLON.Vector3(0, -9.81, 0)
            : flock.BABYLON.Vector3.Zero();

          if (
            direction &&
            (direction.x !== 0 || direction.y !== 0 || direction.z !== 0)
          ) {
            particleSystem.minEmitPower = 1;
            particleSystem.maxEmitPower = 3;
            meshEmitter.useMeshNormalsForDirection = false;
            meshEmitter.direction1 = new flock.BABYLON.Vector3(
              direction.x,
              direction.y,
              direction.z,
            );
            meshEmitter.direction2 = new flock.BABYLON.Vector3(
              direction.x,
              direction.y,
              direction.z,
            );
          }

          if (rotation) {
            const toRad = Math.PI / 180;
            if (rotation.angularSpeed) {
              particleSystem.minAngularSpeed =
                rotation.angularSpeed.min * toRad;
              particleSystem.maxAngularSpeed =
                rotation.angularSpeed.max * toRad;
            }
            if (rotation.initialRotation) {
              particleSystem.minInitialRotation =
                rotation.initialRotation.min * toRad;
              particleSystem.maxInitialRotation =
                rotation.initialRotation.max * toRad;
            }
          }

          particleSystem.start();
          resolve(particleSystem);
        } catch (error) {
          flock.reportBlockError({
            key: "particle_effect_failed",
            api: "createParticleEffect",
            values: { effect: resultName },
            error,
          });
          resolve(null);
        }
      });
    });

    flock.modelReadyPromises.set(resultName, particlePromise);
    return resultName;
  },
  startParticleSystem(systemName) {
    const particleSystem = flock.scene.particleSystems.find(
      (system) => system.name === systemName,
    );
    if (particleSystem) {
      particleSystem.start();
    } else {
      console.warn(`Particle system '${systemName}' not found.`);
    }
  },
  stopParticleSystem(systemName) {
    const particleSystem = flock.scene.particleSystems.find(
      (system) => system.name === systemName,
    );

    if (particleSystem) {
      particleSystem.stop();
    } else {
      console.warn(`Particle system '${systemName}' not found.`);
    }
  },
  resetParticleSystem(systemName) {
    const particleSystem = flock.scene.particleSystems.find(
      (system) => system.name === systemName,
    );
    if (particleSystem) {
      particleSystem.reset();
    } else {
      console.warn(`Particle system '${systemName}' not found.`);
    }
  },
  setFog({
    fogColorHex,
    fogMode,
    fogDensity = 0.1,
    fogStart = 50,
    fogEnd = 100,
  } = {}) {
    const fogColorRgb = flock.BABYLON.Color3.FromHexString(
      flock.getColorFromString(fogColorHex),
    );

    switch (fogMode) {
      case "NONE":
        flock.scene.fogMode = flock.BABYLON.Scene.FOGMODE_NONE;
        break;
      case "EXP":
        flock.scene.fogMode = flock.BABYLON.Scene.FOGMODE_EXP;
        break;
      case "EXP2":
        flock.scene.fogMode = flock.BABYLON.Scene.FOGMODE_EXP2;
        break;
      case "LINEAR":
        flock.scene.fogMode = flock.BABYLON.Scene.FOGMODE_LINEAR;
        break;
    }

    flock.scene.fogColor = fogColorRgb;
    flock.scene.fogDensity = fogDensity;
    flock.scene.fogStart = fogStart;
    flock.scene.fogEnd = fogEnd;
    flock.updateFogAwareShaderMaterials?.();
  },
};
