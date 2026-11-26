let holds = 0;

export function holdAutosave() {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
  };
}

export function autosaveHeld() {
  return holds > 0;
}
