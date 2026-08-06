// The inspector forces glTF validate=true, and the validator is a CDN fetch our
// CSP blocks, so once the inspector is loaded every model load would fail.
export async function disableGltfValidation() {
  const { GLTFValidation } = await import('@babylonjs/loaders');
  GLTFValidation.ValidateAsync = () =>
    Promise.resolve({
      issues: { numErrors: 0, numWarnings: 0, numInfos: 0, numHints: 0, messages: [] },
    });
}
