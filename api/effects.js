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
    let resultName = name + "_" + flock.scene.getUniqueId();

    // Create a promise for the particle system creation
    const particlePromise = new Promise((resolve, reject) => {
      flock.whenModelReady(emitterMesh, (meshInstance) => {
        try {
          // Create the particle system
          const particleSystem = new flock.BABYLON.ParticleSystem(
            resultName,
            500,
            flock.scene,
          );

          // Texture of each particle
          const texturePath = flock.texturePath + shape;
          particleSystem.particleTexture = new flock.BABYLON.Texture(
            texturePath,
            flock.scene,
          );

          // Set the emitter mesh
          particleSystem.emitter = meshInstance;

          // Use a MeshParticleEmitter to emit particles from the mesh's surface
          const meshEmitter = new flock.BABYLON.MeshParticleEmitter(
            meshInstance,
          );
          particleSystem.particleEmitterType = meshEmitter;
          particleSystem.blendMode = 4;

          const startColor = flock.BABYLON.Color4.FromHexString(colors.start);
          const endColor = flock.BABYLON.Color4.FromHexString(colors.end);

          // Combine colors with alpha values
          const startColorWithAlpha = new flock.BABYLON.Color4(
            startColor.r,
            startColor.g,
            startColor.b,
            alphas.start,
          );
          const endColorWithAlpha = new flock.BABYLON.Color4(
            endColor.r,
            endColor.g,
            endColor.b,
            alphas.end,
          );

          // Set colors with alpha
          particleSystem.addColorGradient(0, startColorWithAlpha);
          particleSystem.addColorGradient(1, endColorWithAlpha);

          // Add size gradients
          particleSystem.addSizeGradient(0, sizes.start);
          particleSystem.addSizeGradient(1, sizes.end);

          // Apply lifetime values
          particleSystem.minLifeTime = lifetime.min;
          particleSystem.maxLifeTime = lifetime.max;

          // Set the emit rate with a maximum limit
          const MAX_EMIT_RATE = 500;
          particleSystem.emitRate = Math.min(emitRate, MAX_EMIT_RATE);

          // Apply gravity if enabled
          particleSystem.gravity = gravity
            ? new flock.BABYLON.Vector3(0, -9.81, 0)
            : new flock.BABYLON.Vector3.Zero();

          if (direction) {
            const { x, y, z } = direction;

            if (x != 0 || y != 0 || z != 0) {
              particleSystem.minEmitPower = 1;
              particleSystem.maxEmitPower = 3;
              meshEmitter.useMeshNormalsForDirection = false;

              meshEmitter.direction1 = new flock.BABYLON.Vector3(x, y, z);
              meshEmitter.direction2 = new flock.BABYLON.Vector3(x, y, z);
            }
          }

          if (rotation) {
            // Convert angular speeds from degrees per second to radians per second
            if (rotation.angularSpeed) {
              particleSystem.minAngularSpeed =
                (rotation.angularSpeed.min * Math.PI) / 180;
              particleSystem.maxAngularSpeed =
                (rotation.angularSpeed.max * Math.PI) / 180;
            }
            // Convert initial rotations from degrees to radians
            if (rotation.initialRotation) {
              particleSystem.minInitialRotation =
                (rotation.initialRotation.min * Math.PI) / 180;
              particleSystem.maxInitialRotation =
                (rotation.initialRotation.max * Math.PI) / 180;
            }
          }

          // Start the particle system
          particleSystem.start();

          resolve(particleSystem);
        } catch (error) {
          console.error(`Error creating particle effect '${resultName}':`, error);
          reject(error);
        }
      });
    });

    // Store promise for whenModelReady coordination
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
  setFog({ fogColorHex, fogMode, fogDensity = 0.1 } = {}) {
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
    flock.scene.fogStart = 50;
    flock.scene.fogEnd = 100;
  },
}
