export const FEATURES = Object.freeze({
  dataScience: true,
});

export function isFeatureEnabled(name) {
  return FEATURES[name] === true;
}
