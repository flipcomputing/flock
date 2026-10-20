import * as Blockly from 'blockly';
import { workspace } from './blocklyinit.js';
import { translate } from './translation.js';
import { getMetadata } from 'meta-png';
import {
  AUTOSAVE_KEY,
  AUTOSAVE_TO_FILE_ENABLED,
  FLOCK_FORMAT_VERSION,
  isTrustedProjectUrl,
} from '../config.js';
import { flock } from '../flock.js';
import { showStatus } from '../ui/status.js';
import { showBanner, dismissBanner } from '../ui/notifications.js';
import { openUnsavedChangesModal } from '../ui/unsavedChangesModal.js';
import { openUntrustedProjectUrlModal } from '../ui/untrustedProjectUrlModal.js';
import { syncCollapsedBlockIcons } from '../blocks/blockIcons.js';
import { replaceUnrecognisedBlocks } from '../blocks/unknownBlock.js';
import { convertLegacyInitialTransforms } from '../ui/legacyTransforms.js';
import { setProjectLoading } from './projectLoading.js';
import { DEFAULT_CANVAS_ASPECT, getCanvasAspectName, setCanvasAspectName } from './canvasAspect.js';

// Limits applied to every project source — file, drag-and-drop and fetched URL.
const MAX_PROJECT_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PROJECT_TEXT_LENGTH = 4 * 1024 * 1024;
// A JavaScript string unit takes at most 3 bytes in UTF-8.
const MAX_PROJECT_TEXT_UTF8_BYTES = 3 * MAX_PROJECT_TEXT_LENGTH;

// Typed so callers can pick the right alert without matching message strings.
class ProjectTooLargeError extends Error {
  constructor() {
    super('File content is too large');
    this.name = 'ProjectTooLargeError';
  }
}

class ProjectReadError extends Error {
  constructor(options) {
    super('Failed to read project file', options);
    this.name = 'ProjectReadError';
  }
}

class ProjectFetchError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ProjectFetchError';
  }
}

function alertKeyForProjectError(error) {
  if (error instanceof ProjectTooLargeError) return 'file_too_large_alert';
  if (error instanceof ProjectReadError) return 'failed_to_read_file_alert';
  if (error instanceof ProjectFetchError) return 'project_url_load_failed_alert';
  return 'invalid_project_alert';
}

// Event types that count as an edit, vs. selection/scroll/other UI-only events.
const CONTENT_CHANGE_EVENT_TYPES = new Set([
  Blockly.Events.BLOCK_CREATE,
  Blockly.Events.BLOCK_DELETE,
  Blockly.Events.BLOCK_CHANGE,
  Blockly.Events.BLOCK_MOVE,
  Blockly.Events.VAR_CREATE,
  Blockly.Events.VAR_DELETE,
  Blockly.Events.VAR_RENAME,
  Blockly.Events.COMMENT_CREATE,
  Blockly.Events.COMMENT_DELETE,
  Blockly.Events.COMMENT_CHANGE,
  Blockly.Events.COMMENT_MOVE,
]);

// Tracks changes since the last load or file save (not the last localStorage
// autosave, which isn't durable).
let projectModified = false;
let restoringAutosave = false;
let fileSaveUnknown = false;

// `workspace` is still null at module load time, so this listener can't be
// attached until createBlocklyWorkspace() has run.
export function initProjectModifiedTracking(ws) {
  ws.addChangeListener((event) => {
    if (event.type === Blockly.Events.FINISHED_LOADING) {
      projectModified = false;
      fileSaveUnknown = restoringAutosave;
      restoringAutosave = false;
    } else if (CONTENT_CHANGE_EVENT_TYPES.has(event.type)) {
      projectModified = true;
    }
  });
}

export function markProjectModified() {
  projectModified = true;
}

export function isProjectModified() {
  return projectModified;
}

export function isFileSaveUnknown() {
  return fileSaveUnknown;
}

// Resolves true if the caller should proceed to replace the workspace.
async function confirmDiscardIfModified() {
  if (!projectModified && !fileSaveUnknown) return true;

  saveWorkspace(workspace);

  const choice = await openUnsavedChangesModal({ uncertain: !projectModified });
  if (choice === 'cancel') return false;
  if (choice === 'save') {
    const saved = await exportCode(workspace);
    if (!saved) return false;
  }
  return true;
}

export function serializeProject(ws) {
  const canvasAspect = getCanvasAspectName();
  return {
    version: FLOCK_FORMAT_VERSION,
    ...(canvasAspect !== DEFAULT_CANVAS_ASPECT && { settings: { canvasAspect } }),
    ...Blockly.serialization.workspaces.save(ws),
  };
}

// Function to save the current workspace state
export function saveWorkspace(workspace) {
  try {
    if (!workspace || !workspace.getAllBlocks) return;
    const state = serializeProject(workspace);
    // Never overwrite a good autosave with an empty/transient workspace —
    // the error banner's Reload action restores the project from this entry.
    if (!state || !state.blocks || !state.blocks.blocks?.length) return;
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
    autosaveWarned = false;
    dismissBanner('autosave');
  } catch (error) {
    console.warn('Autosave failed; keeping previous saved state.', error);
    // Once per failure spell: this retries every 30s, so a dismissed warning stays dismissed.
    if (!autosaveWarned) {
      autosaveWarned = true;
      showBanner('autosave', { message: translate('error_autosave') });
    }
  }
}

let autosaveWarned = false;

function validateBlocklyJson(json) {
  // 1. Parse JSON safely
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error('Invalid JSON format');
  }

  // 2. Check for dangerous properties that could execute code
  const dangerousKeys = [
    '__proto__',
    'constructor',
    'prototype',
    'eval',
    'Function',
    'setTimeout',
    'setInterval',
    'innerHTML',
    'outerHTML',
    'onclick',
    'onerror',
    'onload',
  ];

  function checkForDangerousContent(obj, path = '') {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'object') {
      // Check for dangerous keys
      for (const key of Object.keys(obj)) {
        if (dangerousKeys.includes(key)) {
          throw new Error(`Dangerous property found: ${key} at ${path}`);
        }
        checkForDangerousContent(obj[key], path ? `${path}.${key}` : key);
      }
    }
  }

  function upgradeAnimationInputs(block) {
    if (!block || typeof block !== 'object') return;

    const legacyAnimationName = block.fields?.ANIMATION_NAME;
    const hasNewAnimationInput = block.inputs?.ANIMATION_NAME;

    if (
      legacyAnimationName &&
      !hasNewAnimationInput &&
      (block.type === 'play_animation' || block.type === 'switch_animation')
    ) {
      block.inputs = block.inputs || {};
      block.inputs.ANIMATION_NAME = {
        shadow: {
          type: 'animation_name',
          fields: { ANIMATION_NAME: legacyAnimationName },
        },
      };

      delete block.fields.ANIMATION_NAME;

      if (block.fields && Object.keys(block.fields).length === 0) {
        delete block.fields;
      }
    }

    if (block.inputs) {
      Object.values(block.inputs).forEach((input) => {
        upgradeAnimationInputs(input?.block);
        upgradeAnimationInputs(input?.shadow);
      });
    }

    upgradeAnimationInputs(block.next?.block);
  }

  // 3. Validate it's actually a Blockly workspace structure
  function validateBlocklyStructure(data) {
    if (data.version !== undefined && typeof data.version !== 'string') {
      throw new Error('Invalid project version');
    }

    if (
      data.settings !== undefined &&
      (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings))
    ) {
      throw new Error('Invalid project settings');
    }

    // Empty workspace is valid
    if (Object.keys(data).every((key) => key === 'version' || key === 'settings')) {
      return;
    }

    // Blockly workspace JSON should have specific structure
    // Check if data.blocks exists and is a non-null object (not an array)
    if (!data.blocks || typeof data.blocks !== 'object' || Array.isArray(data.blocks)) {
      throw new Error('Invalid Blockly structure: missing or invalid blocks object');
    }

    // Whitelist allowed properties at root level
    const allowedRootKeys = ['version', 'settings', 'blocks', 'variables', 'workspaceComments'];
    const rootKeys = Object.keys(data);

    for (const key of rootKeys) {
      if (!allowedRootKeys.includes(key)) {
        console.warn(`Unexpected property in Blockly JSON: ${key}`);
      }
    }

    // Whitelist allowed properties in blocks object
    const allowedBlocksKeys = ['languageVersion', 'blocks'];
    if (data.blocks) {
      for (const key of Object.keys(data.blocks)) {
        if (!allowedBlocksKeys.includes(key)) {
          console.warn(`Unexpected property in blocks object: ${key}`);
        }
      }
    }

    // Validate blocks array if present
    if (data.blocks.blocks) {
      if (!Array.isArray(data.blocks.blocks)) {
        throw new Error('Invalid Blockly structure: blocks.blocks must be an array');
      }
      data.blocks.blocks.forEach((block, index) => {
        validateBlock(block, `blocks.blocks[${index}]`);
      });
    }

    // Validate variables if present
    if (data.variables) {
      if (!Array.isArray(data.variables)) {
        throw new Error('Invalid Blockly structure: variables must be an array');
      }
      data.variables.forEach((variable, index) => {
        if (!variable.name || !variable.id) {
          throw new Error(`Invalid variable at variables[${index}]: must have name and id`);
        }
      });
    }
  }

  // 4. Validate individual block structure
  function validateBlock(block, path) {
    if (!block || typeof block !== 'object') {
      throw new Error(`Invalid block at ${path}`);
    }

    // Whitelist allowed block properties
    const allowedBlockKeys = [
      'type',
      'id',
      'x',
      'y',
      'collapsed',
      'disabled',
      'deletable',
      'movable',
      'editable',
      'inline',
      'data',
      'extraState',
      'icons',
      'fields',
      'inputs',
      'next',
      'shadow',
      'disabledReasons',
    ];

    for (const key of Object.keys(block)) {
      if (!allowedBlockKeys.includes(key)) {
        throw new Error(`Unexpected block property: ${key} at ${path}`);
      }
    }

    // Validate field values
    if (block.fields) {
      Object.entries(block.fields).forEach(([fieldName, fieldValue]) => {
        if (fieldValue && typeof fieldValue === 'object') {
          // Field values can be objects with 'id' property for variables
          if (!fieldValue.id) {
            checkForDangerousContent(fieldValue, `${path}.fields.${fieldName}`);
          }
        } else if (typeof fieldValue === 'string') {
          // Check string field values for dangerous content
          checkForDangerousContent(fieldValue, `${path}.fields.${fieldName}`);
        }
      });
    }

    // Recursively validate nested blocks
    if (block.inputs) {
      Object.entries(block.inputs).forEach(([inputName, input]) => {
        if (input.block) {
          validateBlock(input.block, `${path}.inputs.${inputName}.block`);
        }
        if (input.shadow) {
          validateBlock(input.shadow, `${path}.inputs.${inputName}.shadow`);
        }
      });
    }

    if (block.next?.block) {
      validateBlock(block.next.block, `${path}.next.block`);
    }
  }

  // Run all validations
  checkForDangerousContent(data);
  validateBlocklyStructure(data);

  if (data?.blocks?.blocks) {
    data.blocks.blocks.forEach((block) => upgradeAnimationInputs(block));
  }

  return data;
}

export function hintIfXrModeMissing(workspace) {
  try {
    if (!workspace || workspace.getBlocksByType('set_xr_mode', false).length > 0) return;
    if (flock._xrAutoButtonAllowed?.() || !flock._vrHeadsetAvailable) return;
    Promise.resolve(flock._vrHeadsetAvailable())
      .then((onHeadset) => {
        if (onHeadset && workspace.getBlocksByType('set_xr_mode', false).length === 0) {
          showStatus(translate('xr_mode_missing_hint'), { owner: 'xr-mode-missing' });
        }
      })
      .catch(() => {});
  } catch {
    return;
  }
}

export function loadWorkspaceAndExecute(
  json,
  workspace,
  executeCallback,
  { focusCanvas = false, keepCanvasAspect = false } = {}
) {
  if (!workspace || !json) {
    throw new Error('Invalid workspace or json data.');
  }

  // Validation failures propagate to the caller; the catch below is only for a
  // workspace that broke mid-load, never for rejected JSON.
  const validatedJson = validateBlocklyJson(json);

  if (!keepCanvasAspect) setCanvasAspectName(validatedJson.settings?.canvasAspect);

  try {
    const unrecognised = replaceUnrecognisedBlocks(validatedJson);
    Blockly.serialization.workspaces.load(validatedJson, workspace);
    syncCollapsedBlockIcons(workspace);
    if (unrecognised > 0) {
      showStatus(translate('unrecognised_blocks_loaded'), { owner: 'unrecognised-blocks' });
    }

    workspace.scroll(0, 0);
    executeCallback({ focusCanvas });
    convertLegacyInitialTransforms(workspace);
    hintIfXrModeMissing(workspace);
  } catch (error) {
    console.error('Failed to load workspace:', error);
    // Blockly skips this event when a load throws; it ends the load, after
    // the partly loaded blocks' queued events.
    Blockly.Events.fire(new Blockly.Events.FinishedLoading(workspace));

    // Handle corruption errors
    if (error.message.includes('isDeadOrDying')) {
      console.warn('Workspace might be corrupted, attempting reset.');
      workspace.clear();
      // Note: localStorage usage - be aware this won't work in Claude artifacts
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(AUTOSAVE_KEY);
      }
    }
  }
}

export function extractEmbeddedProjectJson(htmlText) {
  const match = htmlText.match(
    /<script\b[^>]*\btype\s*=\s*["']application\/(?:vnd\.)?flock\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) {
    throw new Error('No embedded Flock project (application/flock+json) found in HTML');
  }
  return match[1];
}

function parseProjectJsonResponse(response) {
  if (!response.ok) {
    throw new ProjectFetchError(
      `Failed to load project (${response.status} ${response.statusText})`
    );
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  return response.text().then((projectText) => {
    if (projectText.length > MAX_PROJECT_TEXT_LENGTH) {
      throw new ProjectTooLargeError();
    }

    const trimmedProjectText = projectText.trim();
    const isHtml =
      contentType.includes('text/html') ||
      trimmedProjectText.startsWith('<!doctype html') ||
      trimmedProjectText.startsWith('<html');

    const jsonText = isHtml ? extractEmbeddedProjectJson(projectText) : projectText;

    return parseProjectText(jsonText, {
      describeParseError: `Failed to parse project JSON from ${contentType || 'unknown content type'}`,
    });
  });
}

export function fetchProjectJson(projectPath) {
  return fetch(projectPath).then(parseProjectJsonResponse);
}

// Parses project text into validated Blockly JSON: enforces the size limit,
// parses, and checks the structure. Throws on any failure.
function parseProjectText(text, { describeParseError } = {}) {
  if (typeof text !== 'string') {
    throw new Error('File content is invalid (not a string)');
  }
  if (text.length > MAX_PROJECT_TEXT_LENGTH) {
    throw new ProjectTooLargeError();
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw describeParseError ? new Error(describeParseError, { cause: error }) : error;
  }

  if (!isValidProjectFileJson(json)) {
    throw new Error('Invalid Blockly project file structure');
  }

  return json;
}

// Same route for File sources: size check and read, then parseProjectText.
async function readProjectFile(file) {
  if (file.size > MAX_PROJECT_FILE_BYTES) {
    throw new ProjectTooLargeError();
  }

  let text;
  try {
    text = await file.text();
  } catch (error) {
    throw new ProjectReadError({ cause: error });
  }

  return parseProjectText(text, {
    describeParseError: `Failed to parse project file: ${file.name}`,
  });
}

const PROJECT_HASH_PREFIX = '#project=';

function isFramedByOtherSite() {
  if (window.top === window.self) return false;
  try {
    return window.top.location.origin !== window.location.origin;
  } catch {
    return true;
  }
}

async function readProjectFromHash(encoded) {
  if (encoded.length > MAX_PROJECT_FILE_BYTES) {
    throw new ProjectTooLargeError();
  }

  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader();

  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_PROJECT_TEXT_UTF8_BYTES) {
      await reader.cancel();
      throw new ProjectTooLargeError();
    }
    chunks.push(value);
  }

  const text = new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
  return parseProjectText(text, { describeParseError: 'Failed to parse project from link' });
}

// Function to load workspace from various sources
export async function loadWorkspace(workspace, executeCallback) {
  const urlParams = new URLSearchParams(window.location.search);
  const projectUrl = urlParams.get('project');
  const reset = urlParams.get('reset');
  const autoplay = urlParams.get('autoplay') !== 'false';
  const effectiveCallback = autoplay ? executeCallback : () => {};
  const savedState = localStorage.getItem(AUTOSAVE_KEY);
  const starter = 'examples/starter.flock';

  function loadStarter() {
    fetchProjectJson(starter)
      .then((json) => {
        loadWorkspaceAndExecute(json, workspace, effectiveCallback);
      })
      .catch((error) => {
        console.error('Error loading starter example:', error);
        setProjectLoading(false);
      });
  }

  if (reset) {
    console.warn('Resetting workspace and clearing local storage.');
    workspace.clear();
    localStorage.removeItem(AUTOSAVE_KEY);
    loadStarter();
    return;
  }

  if (window.location.hash.startsWith(PROJECT_HASH_PREFIX)) {
    const encoded = window.location.hash.slice(PROJECT_HASH_PREFIX.length);
    history.replaceState(null, '', window.location.pathname + window.location.search);

    if (isFramedByOtherSite()) {
      console.warn('Ignoring project link: Flock is embedded in another site.');
    } else if ((await openUntrustedProjectUrlModal('')) === 'open') {
      try {
        loadWorkspaceAndExecute(await readProjectFromHash(encoded), workspace, effectiveCallback);
        return;
      } catch (error) {
        console.error('Error loading project from link:', error);
        alert(translate(alertKeyForProjectError(error)));
      }
    }
  }

  if (projectUrl) {
    if (projectUrl === 'starter') {
      loadStarter();
    } else if (projectUrl === 'new') {
      fetchProjectJson('examples/new.flock')
        .then((json) => {
          loadWorkspaceAndExecute(json, workspace, effectiveCallback);
        })
        .catch((error) => {
          console.error('Error loading new project:', error);
          loadStarter();
        });
    } else {
      let validatedUrl;
      try {
        validatedUrl = new URL(projectUrl, window.location.href);
        if (!['http:', 'https:'].includes(validatedUrl.protocol)) {
          throw new Error('Project URL must use http or https protocol');
        }
        const path = validatedUrl.pathname.toLowerCase();
        if (!/(\.(json|flock|html?)|\/)$/.test(path)) {
          throw new Error('Project URL must point to a .flock, .json or .html file, or a folder');
        }
      } catch (error) {
        console.error('Invalid project URL:', error);
        loadStarter();
        return;
      }

      const newTabHref = isFramedByOtherSite()
        ? `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(validatedUrl.href)}`
        : null;

      if (!isTrustedProjectUrl(validatedUrl)) {
        const choice = await openUntrustedProjectUrlModal(validatedUrl.origin, { newTabHref });
        if (choice !== 'open') {
          loadStarter();
          return;
        }
      }

      try {
        const response = await fetch(validatedUrl.href).catch((error) => {
          throw new ProjectFetchError('Failed to fetch project', { cause: error });
        });
        // fetch follows redirects transparently, so the origin that actually
        // served the response can differ from the one the user approved.
        const finalUrl = new URL(response.url);
        if (finalUrl.origin !== validatedUrl.origin && !isTrustedProjectUrl(finalUrl)) {
          const choice = await openUntrustedProjectUrlModal(finalUrl.origin, { newTabHref });
          if (choice !== 'open') {
            loadStarter();
            return;
          }
        }
        const json = await parseProjectJsonResponse(response);
        loadWorkspaceAndExecute(json, workspace, effectiveCallback);
      } catch (error) {
        console.error('Error loading project from URL:', error);
        alert(translate(alertKeyForProjectError(error)));
        loadStarter();
      }
    }
  } else if (savedState) {
    try {
      const json = parseProjectText(savedState);
      restoringAutosave = true;
      loadWorkspaceAndExecute(json, workspace, effectiveCallback);
    } catch (error) {
      restoringAutosave = false;
      console.error('Error loading autosaved project:', error);
      loadStarter();
    }
  } else {
    loadStarter();
  }
}

// Function to strip filename from path
export function stripFilename(inputString) {
  const removeEnd = inputString.replace(/\(\d+\)/g, '');
  let lastIndex = Math.max(removeEnd.lastIndexOf('/'), removeEnd.lastIndexOf('\\'));

  if (lastIndex === -1) {
    return removeEnd.trim();
  }

  return removeEnd.substring(lastIndex + 1).trim();
}

// Preserve user-facing imported filename characters (including spaces and
// punctuation) while still stripping potentially unsafe invisible chars.
function getSafeImportedFileBaseName(fileName) {
  const rawName = String(fileName || 'untitled');
  const cleanedName = rawName
    .replace(/\p{Cc}/gu, '')
    .replace(/[\u200B-\u200F\u2060-\u206F\uFEFF]/g, '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '');

  const withoutExtension = cleanedName.replace(/\.(json|flock)$/i, '');
  const baseName = stripFilename(withoutExtension).trim();

  return baseName.substring(0, 50) || 'untitled';
}

// Holds the FileSystemFileHandle from the last explicit save (File System Access API)
let currentFileHandle = null;

export function updateSaveButtonState() {
  document
    .getElementById('exportCodeButton')
    ?.classList.toggle('no-autosave', AUTOSAVE_TO_FILE_ENABLED && !currentFileHandle);
}

// Clears the stored file handle (call whenever a new project is loaded)
export function clearFileHandle() {
  currentFileHandle = null;
  updateSaveButtonState();
}

function isFileAutosavePermissionError(error) {
  const name = error?.name || '';
  if (name === 'AbortError' || name === 'NotAllowedError') return true;

  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('permission') ||
    message.includes('denied') ||
    message.includes('aborted') ||
    message.includes('cancel')
  );
}

// Function to export project code
export async function exportCode(workspace) {
  try {
    const projectName = document.getElementById('projectName').value || 'default_project';

    // Ensure we have a valid workspace
    const ws = workspace && workspace.getAllBlocks ? workspace : Blockly.getMainWorkspace();
    if (!ws || !ws.getAllBlocks) {
      throw new Error('No valid workspace found');
    }

    let usedModels = Blockly.Variables.allUsedVarModels(ws);
    let allModels = ws.getVariableMap().getAllVariables();
    for (const model of allModels) {
      if (!usedModels.find((element) => element.getId() === model.getId())) {
        ws.getVariableMap().deleteVariable(model);
      }
    }

    const json = serializeProject(ws);
    const jsonString = JSON.stringify(json, null, 2);

    // Custom MIME type for Flock project files
    const FLOCK_MIME = 'application/vnd.flock+json';
    const FLOCK_EXT = '.flock';

    if ('showSaveFilePicker' in window) {
      const options = {
        suggestedName: `${projectName}${FLOCK_EXT}`,
        types: [
          {
            description: translate('project_file_description'),
            accept: {
              [FLOCK_MIME]: [FLOCK_EXT],
            },
          },
        ],
      };

      let fileHandle;
      try {
        fileHandle = await window.showSaveFilePicker(options);
      } catch (e) {
        // AbortError here is the user closing the picker; a write that aborts later is a failure.
        if (e?.name === 'AbortError') return false;
        throw e;
      }
      const writable = await fileHandle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      currentFileHandle = fileHandle;
      updateSaveButtonState();
      document.getElementById('projectName').value = getSafeImportedFileBaseName(fileHandle.name);
      projectModified = false;
      fileSaveUnknown = false;
    } else {
      const blob = new Blob([jsonString], { type: FLOCK_MIME });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${projectName}${FLOCK_EXT}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      projectModified = false;
      fileSaveUnknown = false;
    }
    return true;
  } catch (e) {
    console.error('Error exporting project:', e);
    alert(translate('save_failed_alert'));
    return false;
  }
}

// Autosave to the last explicitly-saved file handle (no picker shown)
export async function autoSaveToFile(workspace) {
  if (!currentFileHandle) return;
  try {
    if (typeof currentFileHandle.queryPermission === 'function') {
      const permission = await currentFileHandle.queryPermission({
        mode: 'readwrite',
      });
      if (permission !== 'granted') {
        if (permission === 'denied') {
          clearFileHandle();
        }
        return;
      }
    }

    const ws = workspace && workspace.getAllBlocks ? workspace : Blockly.getMainWorkspace();
    if (!ws || !ws.getAllBlocks) return;

    const json = serializeProject(ws);
    const jsonString = JSON.stringify(json, null, 2);
    const writable = await currentFileHandle.createWritable();
    await writable.write(jsonString);
    await writable.close();
  } catch (e) {
    if (isFileAutosavePermissionError(e)) {
      clearFileHandle();
    }
    console.error('Error during file autosave:', e);
  }
}

// Function to import snippet from file
export function importSnippet() {
  const fileInput = document.getElementById('importFile');
  fileInput.click();

  fileInput.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    await importSnippetFile(file);
    // Allow re-selecting the same file
    event.target.value = '';
  };
}

const MAX_SNIPPET_BYTES = 5 * 1024 * 1024;
// Custom MIME for Flock snippets (matches exportBlockSnippet)
const FLOCK_SNIP_MIME = 'application/vnd.flock-snippet+json';

// Carries the alert to show, so one catch can report every failure.
class SnippetImportError extends Error {
  constructor(alertKey) {
    super(alertKey);
    this.alertKey = alertKey;
  }
}

// Shared by the import picker and drag-and-drop.
export async function importSnippetFile(file) {
  try {
    if (file.size > MAX_SNIPPET_BYTES) throw new SnippetImportError('snippet_too_large_alert');
    const isPng = file.type === 'image/png';
    const isJson =
      file.type === 'application/json' ||
      file.type === FLOCK_SNIP_MIME ||
      file.name.toLowerCase().endsWith('.fsnip');
    if (!isPng && !isJson) throw new SnippetImportError('invalid_snippet_alert');

    const content = await readSnippetFile(file, isPng);
    const snippet = isPng ? snippetFromPng(content) : JSON.parse(content);
    appendSnippetAtViewport(Blockly.getMainWorkspace(), snippet);
  } catch (error) {
    console.error('Error importing snippet:', error);
    alert(translate(error?.alertKey ?? 'invalid_snippet_alert'));
  }
}

function readSnippetFile(file, asBuffer) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new SnippetImportError('failed_to_read_file_alert'));
    if (asBuffer) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  });
}

function snippetFromPng(content) {
  const encoded = getMetadata(new Uint8Array(content), 'blockJson');
  if (!encoded) throw new SnippetImportError('snippet_png_no_blocks_alert');
  return JSON.parse(decodeURIComponent(encoded));
}

// The one intake route for snippets: validates its own input, so appending
// unvalidated blocks isn't reachable through a wrong-helper call.
function appendSnippetAtViewport(workspace, snippetData) {
  if (!snippetData) {
    throw new Error('Snippet data is empty or undefined');
  }

  // Support both raw block JSON and wrapped workspace snippets
  const blocks =
    snippetData?.blocks?.blocks ?? (Array.isArray(snippetData) ? snippetData : [snippetData]);

  const validated = validateBlocklyJson({ blocks: { blocks } });
  const blocksJson = validated.blocks.blocks;

  // Capture the set of existing top blocks so we can detect new ones.
  const before = new Set(workspace.getTopBlocks(false).map((b) => b.id));

  // Append
  blocksJson.forEach((b) => Blockly.serialization.blocks.append(b, workspace));

  // Collect the newly created top blocks
  const created = workspace.getTopBlocks(false).filter((b) => !before.has(b.id));
  if (!created.length) return;

  // Place them near the current viewport top-left, with a stagger.
  const m = workspace.getMetrics();
  const baseX = m.viewLeft + 40;
  const baseY = m.viewTop + 40;

  created.forEach((b, i) => {
    // If the block had x/y, keep it. If not, move it.
    // (Many snippets won't have x/y, so they'll move.)
    b.moveBy(baseX + i * 40, baseY + i * 40);
  });
}

function isValidProjectFileJson(json) {
  if (!json || typeof json !== 'object') {
    return false;
  }

  if (Object.keys(json).every((key) => key === 'version')) {
    return true;
  }

  return (
    !!json.blocks &&
    typeof json.blocks === 'object' &&
    !!json.blocks.blocks &&
    Array.isArray(json.blocks.blocks)
  );
}

// Private helper: process a project file (used by file input and drag-and-drop)
function processProjectFileDrop(file, workspace, executeCallback) {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.json') && !lowerName.endsWith('.flock')) {
    alert(translate('invalid_filetype_alert'));
    return;
  }

  setProjectLoading(true);
  readProjectFile(file)
    .then((json) => {
      document.getElementById('projectName').value = getSafeImportedFileBaseName(file.name);
      clearFileHandle();
      loadWorkspaceAndExecute(json, workspace, executeCallback, { keepCanvasAspect: true });
    })
    .catch((error) => {
      console.error('Error loading Blockly project:', error);
      alert(translate(alertKeyForProjectError(error)));
      setProjectLoading(false);
    });
}

// Private helper: process a dropped snippet or PNG file
// Set up drag-and-drop for .flock, .json, .fsnip, and .png files
export function setupDragAndDrop(workspace, executeCallback) {
  // Create the drop overlay
  const overlay = document.createElement('div');
  overlay.id = 'drag-drop-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.textContent = translate('drag_drop_hint');
  document.body.appendChild(overlay);

  let dragCounter = 0;
  let isDraggingFromPage = false;

  document.addEventListener('dragstart', () => {
    isDraggingFromPage = true;
  });
  document.addEventListener('dragend', () => {
    isDraggingFromPage = false;
  });

  function isFileDrag(e) {
    if (isDraggingFromPage) return false;
    return e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files');
  }

  document.addEventListener('dragenter', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter++;
    overlay.classList.add('visible');
  });

  document.addEventListener('dragover', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('dragleave', (e) => {
    if (!isFileDrag(e)) return;
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) {
      overlay.classList.remove('visible');
    }
  });

  document.addEventListener('drop', (e) => {
    dragCounter = 0;
    overlay.classList.remove('visible');

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    const file = files[0];
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.flock') || lowerName.endsWith('.json')) {
      processProjectFileDrop(file, workspace, executeCallback);
    } else if (lowerName.endsWith('.fsnip') || file.type === 'image/png') {
      importSnippetFile(file);
    } else {
      alert(translate('drop_unsupported_file_alert'));
    }
  });
}

// Function to set up file input handler
export function setupFileInput(workspace, executeCallback) {
  const fileInput = document.getElementById('fileInput');

  fileInput.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.json') && !lowerName.endsWith('.flock')) {
      alert(translate('invalid_filetype_alert'));
      event.target.value = ''; // Reset the input
      return;
    }

    readProjectFile(file)
      .then(async (json) => {
        if (!(await confirmDiscardIfModified())) return;

        setProjectLoading(true);
        document.getElementById('projectName').value = getSafeImportedFileBaseName(file.name);

        clearFileHandle();
        loadWorkspaceAndExecute(json, workspace, executeCallback, { keepCanvasAspect: true });
      })
      .catch((error) => {
        console.error('Error loading Blockly project:', error);
        alert(translate(alertKeyForProjectError(error)));
        setProjectLoading(false);
      })
      .finally(() => {
        // Reset the input so the same file can be selected again
        event.target.value = '';
      });
  });
}

// Open a file using showOpenFilePicker (Chrome/Edge/Safari) with <input> fallback
export async function openFile(workspace, executeCallback) {
  if ('showOpenFilePicker' in window) {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        mode: 'readwrite',
        types: [
          {
            description: translate('project_file_description'),
            accept: {
              'application/vnd.flock+json': ['.flock'],
              'application/json': ['.json'],
            },
          },
        ],
      });
      const file = await fileHandle.getFile();
      const json = await readProjectFile(file);
      if (!(await confirmDiscardIfModified())) return;

      setProjectLoading(true);
      document.getElementById('projectName').value = getSafeImportedFileBaseName(file.name);
      clearFileHandle();
      loadWorkspaceAndExecute(json, workspace, executeCallback, { keepCanvasAspect: true });
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('Error opening file:', e);
      alert(translate(alertKeyForProjectError(e)));
      setProjectLoading(false);
    }
  } else {
    document.getElementById('fileInput').click();
  }
}

// Function to load example projects. `file` is the .flock path and `name` is
// the (already localised) display name used for the project name field.
export async function loadExample(file, name, executeCallback = window.executeCode) {
  if (!file) return;
  if (!(await confirmDiscardIfModified())) return;

  setProjectLoading(true);

  try {
    const json = await fetchProjectJson(file);
    console.log('Loading:', name || file);
    // Renamed only once loaded, so a failed load can't leave the old project under this name.
    const projectNameElement = document.getElementById('projectName');
    if (projectNameElement && name) {
      projectNameElement.value = name;
    }
    clearFileHandle();
    loadWorkspaceAndExecute(json, workspace, executeCallback, {
      focusCanvas: true,
      keepCanvasAspect: true,
    });
  } catch (error) {
    console.error('Error loading example:', error);
    // Clear the loading flag so a failed load doesn't wedge later actions.
    setProjectLoading(false);
    alert(translate('example_load_failed_alert'));
  }
}
window.loadExample = loadExample;

export async function newProject() {
  if (!(await confirmDiscardIfModified())) return;

  try {
    // Load the empty project template
    const json = await fetchProjectJson('examples/new.flock');
    const projectNameElement = document.getElementById('projectName');
    if (projectNameElement) {
      projectNameElement.value = 'New';
    }
    clearFileHandle();
    loadWorkspaceAndExecute(json, workspace, window.executeCode, { keepCanvasAspect: true });
  } catch (error) {
    console.error('Error loading new project:', error);
    alert(translate('example_load_failed_alert'));
  }
}

window.newProject = newProject;
