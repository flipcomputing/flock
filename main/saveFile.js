// Opens the save picker before any slow work so the click's user activation
// is still live. Resolves to null if the picker is cancelled.
export async function openSaveTarget(fileName, type, extension, fileDescription) {
  if (!('showSaveFilePicker' in window)) {
    return { write: async (blob) => downloadBlob(blob, fileName) };
  }
  let fileHandle;
  try {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: fileDescription, accept: { [type]: [extension] } }],
    });
  } catch (error) {
    if (error?.name === 'AbortError') return null;
    throw error;
  }
  return {
    async write(blob) {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    },
  };
}

export async function saveBlob(blob, fileName, extension, fileDescription) {
  const target = await openSaveTarget(fileName, blob.type, extension, fileDescription);
  if (!target) return false;
  await target.write(blob);
  return true;
}

function downloadBlob(blob, fileName) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
