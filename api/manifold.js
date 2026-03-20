import Module from "manifold-3d";

let manifoldModule = null;
let manifoldInitPromise = null;
let babylonCSG2Options = null;

function getBaseUrl() {
  let baseUrl = import.meta.env.BASE_URL || "/";
  if (!baseUrl.endsWith("/")) baseUrl += "/";
  return baseUrl;
}

export async function getManifoldModule() {
  if (manifoldModule) return manifoldModule;
  if (manifoldInitPromise) return manifoldInitPromise;

  manifoldInitPromise = (async () => {
    try {
      const baseUrl = getBaseUrl();
      const wasm = await Module({
        locateFile: (file) => {
          if (file.endsWith(".wasm")) {
            return `${baseUrl}wasm/manifold.wasm`;
          }
          return file;
        },
      });

      wasm.setup?.();

      manifoldModule = wasm;
      babylonCSG2Options = {
        manifoldInstance: wasm.Manifold,
        manifoldMeshInstance: wasm.Mesh,
      };
      return wasm;
    } catch (error) {
      manifoldInitPromise = null;
      babylonCSG2Options = null;
      throw error;
    }
  })();

  return manifoldInitPromise;
}

export async function getBabylonCSG2Options() {
  if (babylonCSG2Options) return babylonCSG2Options;
  const wasm = await getManifoldModule();
  return {
    manifoldInstance: wasm.Manifold,
    manifoldMeshInstance: wasm.Mesh,
  };
}
