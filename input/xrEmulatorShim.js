// IWER 2.3 expects a matrix here; retry only when its transform path returns NaN.

const IWER_SPACE = '@iwer/xr-space';

let patched = false;

export function patchEmulatorOffsetReferenceSpace() {
  if (patched || !import.meta.env?.DEV) return;
  const proto = globalThis.XRReferenceSpace?.prototype;
  const original = proto?.getOffsetReferenceSpace;
  if (typeof original !== 'function') return;

  patched = true;
  proto.getOffsetReferenceSpace = function (transform) {
    const space = original.call(this, transform);
    const key =
      space && Object.getOwnPropertySymbols(space).find((s) => s.description === IWER_SPACE);
    const offset = key && space[key]?.offsetMatrix;
    if (offset && Number.isNaN(offset[0]) && transform?.matrix) {
      return original.call(this, transform.matrix);
    }
    return space;
  };
}
