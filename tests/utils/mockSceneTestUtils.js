const CACHE_KEYS = [
  'modelCache',
  'modelsBeingLoaded',
  '_modelInstances',
  'geometryCache',
  'materialCache',
  'physicsShapeCache',
];

export function useMockPhysicsScene(flock) {
  const original = { engine: flock.engine, scene: flock.scene };
  for (const key of CACHE_KEYS) original[key] = flock[key];

  flock.engine = new flock.BABYLON.NullEngine();
  flock.scene = new flock.BABYLON.Scene(flock.engine);
  flock.BABYLON.SceneLoader.ShowLoadingScreen = false;
  flock.modelCache = {};
  flock.modelsBeingLoaded = {};
  flock._modelInstances = Object.create(null);
  flock.geometryCache = {};
  flock.materialCache = {};
  flock.physicsShapeCache = {};

  new flock.BABYLON.FreeCamera('testCamera', flock.BABYLON.Vector3.Zero(), flock.scene);

  const physicsMock = new Proxy(
    {
      name: 'MockPhysics',
      getPluginVersion: () => 2,
      isInitialized: () => true,
      _checkIsReady: () => true,
      onMeshRemovedObservable: new flock.BABYLON.Observable(),
      onBeforePhysicsObservable: new flock.BABYLON.Observable(),
      onAfterPhysicsObservable: new flock.BABYLON.Observable(),
      getTimeStep: () => 1 / 60,
      getMotionType: () => 1,
      dispose: () => {},
    },
    { get: (target, prop) => (prop in target ? target[prop] : () => {}) }
  );
  flock.scene.enablePhysics(new flock.BABYLON.Vector3(0, -9.81, 0), physicsMock);

  return function restore() {
    flock.engine.dispose();
    Object.assign(flock, original);
  };
}
