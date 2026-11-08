import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { flockRuntimeUrl } from './urls.js';
import { handleError, isBenignAbort, isReported, markReported } from '../ui/notifications.js';
import sandboxWrapSource from './sandboxWrap.js?raw';

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

async function verifySesIntegrity(sesText) {
  const expected = typeof __FLOCK_SES_SRI__ !== 'undefined' ? __FLOCK_SES_SRI__ : null;
  if (!expected) return;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sesText));
  const actual = 'sha256-' + btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (actual !== expected) {
    throw new Error('SES lockdown integrity check failed — refusing to run project code');
  }
}

// Generated names avoid these, so a program never declares one of the browser's capabilities.
const RESERVED_IDENTIFIERS = [
  // dynamic code / reflection
  'eval',
  'Function',
  'AsyncFunction',
  'GeneratorFunction',
  'Proxy',
  'Reflect',
  // frames & globals
  'window',
  'document',
  'globalThis',
  'self',
  'parent',
  'top',
  'frames',
  'frameElement',
  // navigation & env
  'location',
  'history',
  'navigator',
  'opener',
  // network / ipc
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'postMessage',
  'MessageChannel',
  'MessagePort',
  'BroadcastChannel',
  // workers & worklets
  'Worker',
  'SharedWorker',
  'ServiceWorker',
  'Worklet',
  'importScripts',
  // storage / persistence
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'caches',
  'cookieStore',
  // file/blob/crypto
  'Blob',
  'File',
  'FileReader',
  'crypto',
  // urls & media constructors
  'URL',
  'URLSearchParams',
  'Image',
  'Audio',
  'RTCPeerConnection',
  'MediaDevices',
  'Notification',
  // popups / UI
  'open',
  'alert',
  'confirm',
  'prompt',
  'print',
  'showModalDialog',
  // timers (we’ll also do special checks)
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
  // module-ish
  'require',
];

const INDEX_GUARD = '__flockIndex';

export const SANDBOX_RESERVED_NAMES = [...RESERVED_IDENTIFIERS, INDEX_GUARD];

// Everything the generators emit. Code using anything else never runs, so a
// generator injection can only do what blocks can already do.
const ALLOWED_NODE_TYPES = new Set([
  'ArrayExpression',
  'ArrowFunctionExpression',
  'AssignmentExpression',
  'AwaitExpression',
  'BinaryExpression',
  'BlockStatement',
  'BreakStatement',
  'CallExpression',
  'CatchClause',
  'ConditionalExpression',
  'ContinueStatement',
  'ExpressionStatement',
  'ForInStatement',
  'ForStatement',
  'FunctionDeclaration',
  'FunctionExpression',
  'Identifier',
  'IfStatement',
  'Literal',
  'LogicalExpression',
  'MemberExpression',
  'NewExpression',
  'ObjectExpression',
  'Program',
  'Property',
  'ReturnStatement',
  'SpreadElement',
  'TryStatement',
  'UnaryExpression',
  'UpdateExpression',
  'VariableDeclaration',
  'VariableDeclarator',
  'WhileStatement',
]);

const ALLOWED_PROPERTIES = new Set([
  'E',
  'PI',
  'SQRT1_2',
  'SQRT2',
  'abs',
  'acos',
  'asin',
  'atan',
  'atan2',
  'ceil',
  'charAt',
  'cos',
  'exp',
  'filter',
  'floor',
  'indexOf',
  'isArray',
  'join',
  'lastIndexOf',
  'length',
  'log',
  'max',
  'min',
  'now',
  'pop',
  'pow',
  'push',
  'random',
  'reduce',
  'replace',
  'reverse',
  'round',
  'shift',
  'sin',
  'slice',
  'sort',
  'splice',
  'split',
  'sqrt',
  'substring',
  'tan',
  'toLowerCase',
  'toUpperCase',
  'trim',
  'unshift',
  'warn',
]);

const ALLOWED_GLOBALS = [
  'Array',
  'Infinity',
  'Math',
  'Number',
  'Promise',
  'RegExp',
  'String',
  'console',
  'isNaN',
  'parseFloat',
  'parseInt',
  'undefined',
];

const SCOPE_TYPES = new Set([
  'Program',
  'BlockStatement',
  'ForStatement',
  'ForInStatement',
  'CatchClause',
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

export const flockSandbox = {
  validateCode(code) {
    if (typeof code !== 'string') {
      throw new Error('Code must be a string');
    }

    // Length check (reasonable)
    if (code.length > 100000) {
      throw new Error('Code too long (max 100KB)');
    }

    // Basic syntax check
    try {
      new Function(code); // Just check if it parses
    } catch (e) {
      throw new Error(`Syntax error: ${e.message}`, { cause: e });
    }

    // Optional: Warn about patterns (don't block)
    const warnings = [];
    if (/eval\s*\(/.test(code)) {
      warnings.push("Warning: eval() detected - this won't work in the sandbox");
    }

    if (warnings.length > 0) {
      console.warn(warnings.join('\n'));
    }

    return true;
  },
  // Refuses anything outside the allowlists, then routes every computed key
  // through the index guard so no string can name `constructor` and the like.
  prepareUserCode(src) {
    const refuse = (what) => {
      throw new Error(`Flock sandbox: generated code cannot use ${what}`);
    };
    const ast = acorn.parse(src, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      allowAwaitOutsideFunction: true,
    });

    walk.full(ast, (node) => {
      if (!ALLOWED_NODE_TYPES.has(node.type)) refuse(node.type);
    });

    const declared = new Map();
    const declare = (scope, name) => {
      if (!declared.has(scope)) declared.set(scope, new Set());
      declared.get(scope).add(name);
    };
    const enclosingScope = (ancestors) => ancestors.findLast((n) => SCOPE_TYPES.has(n.type));
    walk.ancestor(ast, {
      VariableDeclarator(node, _st, ancestors) {
        declare(enclosingScope(ancestors.slice(0, -1)), node.id.name);
      },
      Function(node, _st, ancestors) {
        for (const param of node.params) declare(node, param.name);
        if (node.id && node.type === 'FunctionDeclaration') {
          declare(enclosingScope(ancestors.slice(0, -1)), node.id.name);
        } else if (node.id) {
          declare(node, node.id.name);
        }
      },
      CatchClause(node) {
        if (node.param) declare(node, node.param.name);
      },
    });

    const computedKeys = [];
    const checkName = (node, _st, ancestors) => {
      if (node.name === INDEX_GUARD) refuse(`'${INDEX_GUARD}'`);
      if (ancestors.some((scope) => declared.get(scope)?.has(node.name))) return;
      if (!ALLOWED_FREE_NAMES.has(node.name)) refuse(`'${node.name}'`);
    };
    walk.ancestor(ast, {
      Identifier: checkName,
      VariablePattern: checkName,
      MemberExpression(node) {
        if (node.computed) computedKeys.push(node.property);
        else if (!ALLOWED_PROPERTIES.has(node.property.name)) refuse(`'.${node.property.name}'`);
      },
      Property(node) {
        if (node.kind !== 'init' || node.computed) refuse('this kind of object property');
        if ((node.key.name ?? node.key.value) === '__proto__') refuse("'__proto__'");
      },
    });

    const edits = computedKeys
      .flatMap((key) => [
        [key.start, 1, `${INDEX_GUARD}((`],
        [key.end, 0, '))'],
      ])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let prepared = '';
    let last = 0;
    for (const [position, , text] of edits) {
      prepared += src.slice(last, position) + text;
      last = position;
    }
    return prepared + src.slice(last);
  },
  async runCode(code, options = {}) {
    const { focusCanvas = true, startCamera = null } = options;
    // Banner source for a failure in Flock's own setup, which the project's blocks can't cause.
    // Null while the project's code is in charge.
    let setupSource = null;
    let timeoutId;

    try {
      const prepared = flock.prepareUserCode(code);
      setupSource = 'run-setup';
      await flock.disposeOldScene();

      // --- remove any existing iframe ---
      const oldIframe = document.getElementById('flock-iframe');
      if (oldIframe) {
        try {
          await oldIframe.contentWindow?.flock?.disposeOldScene?.();
        } catch {
          /* ignore cleanup errors */
        }
        try {
          oldIframe.onload = oldIframe.onerror = null;
        } catch {
          /* ignore cleanup errors */
        }
        try {
          oldIframe.src = 'about:blank';
        } catch {
          /* ignore cleanup errors */
        }
        try {
          oldIframe.remove();
        } catch {
          /* ignore cleanup errors */
        }
      }

      // --- create fresh same-origin iframe ---
      const { win, doc } = await flock.replaceSandboxIframe({ id: 'flock-iframe' });

      // --- load SES text in parent and inject inline into iframe (CSP allows inline) ---
      setupSource = 'chunk-load';
      const sesResp = await fetch(flockRuntimeUrl('vendor/ses/lockdown.umd.min.js'));
      if (!sesResp.ok) throw new Error(`Failed to fetch SES: ${sesResp.status}`);
      const sesText = await sesResp.text();
      setupSource = 'run-setup';
      await verifySesIntegrity(sesText);
      const sesScript = doc.createElement('script');
      sesScript.type = 'text/javascript';
      sesScript.text = sesText;
      doc.head.appendChild(sesScript);

      // Re-wraps a host-realm fn into this realm; lockdown only tames this
      // realm, so a raw host fn would leak the untamed Function via
      // `.constructor` (sandbox escape). Must run before lockdown.
      const wrapScript = doc.createElement('script');
      wrapScript.type = 'text/javascript';
      // Both directions copy into fresh objects only this script holds, so neither
      // side ever calls the other's code; never pass an object through unchanged.
      wrapScript.text = sandboxWrapSource;
      // Host errors never reach user code; they're reported on the host page.
      win.__flockReportHostError = (error) => {
        if (!isBenignAbort(error)) Promise.reject(error);
      };
      win.__flockReportProjectError = (key, error) =>
        flock.reportBlockError({ key, api: 'user-code', error });
      doc.head.appendChild(wrapScript);

      // Lock down the iframe realm. Disable SES's own unhandled-rejection
      // reporter (the SES_UNHANDLED_REJECTION console dump); the win backstop
      // below handles those and routes them to the friendly warn path.
      win.lockdown({ unhandledRejectionTrapping: 'none' });

      // initialise scene
      await this.initializeNewScene?.();
      if (startCamera && this.defaultCamera) {
        this.defaultCamera.position.copyFrom(startCamera.position);
        this.defaultCamera.setTarget(startCamera.target);
      }
      if (this.memoryDebug) this.startMemoryMonitoring?.();

      // abort plumbing
      this.__runToken = (this.__runToken || 0) + 1;
      const runToken = this.__runToken;
      this.abortController?.abort?.();
      this.abortController = new AbortController();
      const signal = this.abortController.signal;
      const guard =
        (fn) =>
        (...args) => {
          if (signal.aborted || runToken !== this.__runToken) return;
          return fn(...args);
        };

      const whitelist = this.createWhitelist({
        win,
        signal,
        guard,
      });

      // Create an endowments object in the iframe's realm
      const endowments = new win.Object();

      for (const [key, value] of Object.entries(whitelist)) {
        const t = typeof value;
        if (t === 'function') {
          // Wrap into the iframe realm: a host-realm fn leaks the untamed host
          // Function via `.constructor` (sandbox escape). bind(null) drops host `this`.
          endowments[key] = win.__flockWrapHostFn(value.bind(null), key);
        } else if (value == null || (t !== 'object' && t !== 'symbol')) {
          // primitives only
          endowments[key] = value;
        } else {
          // skip complex objects (meshes, DOM nodes, etc). Expose via functions instead.
        }
      }

      // win.Object, not a host `{}`: a host literal leaks host Function via
      // obj.constructor.constructor.
      endowments.performance = new win.Object();
      endowments.performance.now = win.performance.now.bind(win.performance);

      // Host window, not the display:none iframe: Firefox never fires rAF for
      // an unpainted document, so loop yields would hang. The host window
      // outlives the iframe, so guard the callback (which iframe teardown used
      // to cancel implicitly) or a stale run's frames fire into the next run.
      // Wrapped so the endowment carries no host `.constructor`.
      const hostRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      const frameYield = flock.makeFreezeAwareYield(
        (settle) => hostRequestAnimationFrame(settle),
        signal
      );
      endowments.requestAnimationFrame = win.__flockWrapHostFn(
        (callback) => frameYield(guard(callback)),
        'requestAnimationFrame'
      );
      endowments.__flockLoopYield = win.__flockWrapHostFn(
        flock.makeLoopYield(guard, signal),
        '__flockLoopYield'
      );
      endowments.__flockLoopPacer = win.__flockWrapHostFn(() => {
        const pace = flock.makeLoopPacer(signal);
        return win.__flockWrapHostFn((callback) => pace(guard(callback)), '__flockLoopPace');
      }, '__flockLoopPacer');

      endowments.Date = new win.Object();
      endowments.Date.now = win.Date.now.bind(win.Date);
      endowments[INDEX_GUARD] = win.__flockIndex;

      // Undefine unwanted globals
      // --- shadow unsafe / unneeded globals ---
      const toUndefine = [
        // Host / DOM / cross-frame
        'flock',
        'window',
        'self',
        'globalThis',
        'parent',
        'top',
        'frames',
        'opener',
        'frameElement',
        'document',

        // SES meta
        'lockdown',
        'harden',
        'Compartment',

        // Legacy / GC / crypto
        'escape',
        'unescape',
        'FinalizationRegistry',
        'WeakRef',
        'crypto',

        // Dynamic code creation
        'eval',
        'Function',
        'AsyncFunction',
        'GeneratorFunction',
        'AsyncGeneratorFunction',

        // Threads / native
        'SharedArrayBuffer',
        'Atomics',
        'WebAssembly',

        // Workers & messaging
        'Worker',
        'SharedWorker',
        'MessageChannel',
        'BroadcastChannel',
        'queueMicrotask',

        // Network / storage / env
        'fetch',
        'XMLHttpRequest',
        'navigator',
        'location',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'caches',

        // UX
        'Notification',

        //Events
        'addEventListener',
        'removeEventListener',
        'dispatchEvent',
      ];

      for (const k of toUndefine) endowments[k] = undefined;

      for (const key of toUndefine) {
        endowments[key] = undefined;
      }

      Object.freeze(endowments);

      const wrapped =
        '(async function () {\n"use strict";\n' +
        prepared +
        '\n}).call(undefined)\n//# sourceURL=user-code.js';

      // Evaluate in SES Compartment
      const c = new win.Compartment(endowments);
      win.Object.defineProperty(c.globalThis, INDEX_GUARD, { writable: false, configurable: false });

      // Top-level code only defines functions and starts hats, so outlasting this is a Flock fault.
      setupSource = null;
      await Promise.race([
        win.__flockSettle(c.evaluate(wrapped)),
        new Promise((_, rej) => {
          timeoutId = window.setTimeout(() => {
            setupSource = 'run-setup';
            rej(new Error('User code timed out'));
          }, this.userCodeTimeoutMs);
        }),
      ]);
      window.clearTimeout(timeoutId);

      if (focusCanvas === true) {
        // focus canvas if present
        (document.getElementById('renderCanvas') || doc.getElementById('renderCanvas'))?.focus();
      }

      try {
        await this._showXRButtonOnHeadset?.();
      } catch (xrError) {
        console.error('XR button setup failed:', xrError);
      }
    } catch (error) {
      window.clearTimeout(timeoutId);
      if (setupSource && !isReported(error) && !isBenignAbort(error)) {
        handleError(error, { source: setupSource, fatal: true });
        markReported(error);
      }
      // Read the (possibly user-thrown) error through safe primitives here;
      // re-throw the original so downstream identity checks (e.g. isBenignAbort's
      // WebAssembly.RuntimeError test for physics OOM) still work.
      const safe = this.sanitizeError?.(error) ?? error;
      const enhancedError = this.createEnhancedError?.(safe, code) ?? safe;
      console.error('Enhanced error details:', enhancedError);

      try {
        // Abort first: start-block timers otherwise outlive the teardown.
        this.abortController?.abort?.();
        // stopAllSounds honours the context ownership rules; close() does not.
        this.stopAllSounds?.();
        this.engine?.stopRenderLoop?.();
        this.removeEventListeners?.();
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }

      throw error;
    }
  },
  createWhitelist({ guard } = {}) {
    const api = {
      // Flock API methods — bound to host `this`
      playAnimation: this.playAnimation?.bind(this),
      playSound: guard(this.playSound?.bind(this)),
      stopAllSounds: this.stopAllSounds?.bind(this),
      playNotes: guard(this.playNotes?.bind(this)),
      playMusic: guard(this.playMusic?.bind(this)),
      setBPM: guard(this.setBPM?.bind(this)),
      setMusicSpeed: guard(this.setMusicSpeed?.bind(this)),
      createInstrument: this.createInstrument?.bind(this),
      speak: guard(this.speak?.bind(this)),
      switchAnimation: this.switchAnimation?.bind(this),
      highlight: this.highlight?.bind(this),
      glow: this.glow?.bind(this),
      createCharacter: this.createCharacter?.bind(this),
      createObject: this.createObject?.bind(this),
      createParticleEffect: this.createParticleEffect?.bind(this),
      create3DText: this.create3DText?.bind(this),
      createModel: this.createModel?.bind(this),
      createBox: this.createBox?.bind(this),
      createGroup: this.createGroup?.bind(this),
      addPrefab: this.addPrefab?.bind(this),
      createSphere: this.createSphere?.bind(this),
      createCylinder: this.createCylinder?.bind(this),
      createCapsule: this.createCapsule?.bind(this),
      createWedge: this.createWedge?.bind(this),
      createFreeform: this.createFreeform?.bind(this),
      createDonut: this.createDonut?.bind(this),
      createRing: this.createRing?.bind(this),
      createPlane: this.createPlane?.bind(this),
      createMarker: this.createMarker?.bind(this),
      createCamera: this.createCamera?.bind(this),
      cloneMesh: this.cloneMesh?.bind(this),
      runDo: this.runDo?.bind(this),
      runThen: this.runThen?.bind(this),
      parentChild: this.parentChild?.bind(this),
      setParent: this.setParent?.bind(this),
      mergeMeshes: this.mergeMeshes?.bind(this),
      subtractMeshes: this.subtractMeshes?.bind(this),
      embedMeshes: this.embedMeshes?.bind(this),
      intersectMeshes: this.intersectMeshes?.bind(this),
      createHull: this.createHull?.bind(this),
      combineMeshes: this.combineMeshes?.bind(this),
      hold: this.hold?.bind(this),
      attach: this.attach?.bind(this),
      drop: this.drop?.bind(this),
      makeFollow: this.makeFollow?.bind(this),
      stopFollow: this.stopFollow?.bind(this),
      removeParent: this.removeParent?.bind(this),
      createMap: this.createMap?.bind(this),
      setSky: this.setSky?.bind(this),
      lightIntensity: this.lightIntensity?.bind(this),
      lightColor: this.lightColor?.bind(this),
      lightStyle: this.lightStyle?.bind(this),
      enableShadows: this.enableShadows?.bind(this),
      setShadow: this.setShadow?.bind(this),
      buttonControls: this.buttonControls?.bind(this),
      onScreenControls: this.onScreenControls?.bind(this),
      getCamera: this.getCamera?.bind(this),
      switchCamera: this.switchCamera?.bind(this),
      getMainLight: this.getMainLight?.bind(this),
      cameraControl: this.cameraControl?.bind(this),
      setCameraBackground: this.setCameraBackground?.bind(this),
      setXRMode: this.setXRMode?.bind(this),
      setXRViewMode: this.setXRViewMode?.bind(this),
      setXRCameraMotionMode: this.setXRCameraMotionMode?.bind(this),
      setXRUIPlacement: this.setXRUIPlacement?.bind(this),
      setARSceneSize: this.setARSceneSize?.bind(this),
      setVRComfort: this.setVRComfort?.bind(this),
      addTeleportTarget: this.addTeleportTarget?.bind(this),
      removeTeleportTarget: this.removeTeleportTarget?.bind(this),
      applyForce: this.applyForce?.bind(this),
      setSpeed: this.setSpeed?.bind(this),
      moveToObject: this.moveToObject?.bind(this),
      setBounciness: this.setBounciness?.bind(this),
      setMass: this.setMass?.bind(this),
      moveByVector: this.moveByVector?.bind(this),
      glideTo: this.glideTo?.bind(this),
      glideToObject: this.glideToObject?.bind(this),
      glideDirection: this.glideDirection?.bind(this),
      rotateToObject: this.rotateToObject?.bind(this),
      wait: this.wait?.bind(this),
      createAnimation: this.createAnimation?.bind(this),
      animateFrom: this.animateFrom?.bind(this),
      playAnimationGroup: this.playAnimationGroup?.bind(this),
      pauseAnimationGroup: this.pauseAnimationGroup?.bind(this),
      stopAnimationGroup: this.stopAnimationGroup?.bind(this),
      startParticleSystem: this.startParticleSystem?.bind(this),
      stopParticleSystem: this.stopParticleSystem?.bind(this),
      resetParticleSystem: this.resetParticleSystem?.bind(this),
      animateKeyFrames: this.animateKeyFrames?.bind(this),
      setAnchor: this.setAnchor?.bind(this),
      setPivot: this.setPivot?.bind(this),
      rotate: this.rotate?.bind(this),
      lookAt: this.lookAt?.bind(this),
      moveTo: this.moveTo?.bind(this),
      rotateTo: this.rotateTo?.bind(this),
      rotateAnim: this.rotateAnim?.bind(this),
      animateProperty: this.animateProperty?.bind(this),
      positionAt: this.positionAt?.bind(this),
      positionAtSingleCoordinate: this.positionAtSingleCoordinate?.bind(this),
      distanceTo: this.distanceTo?.bind(this),
      groundLevelAt: this.groundLevelAt?.bind(this),
      groundReady: this.groundReady?.bind(this),
      waitUntil: this.waitUntil?.bind(this),
      createTag: this.createTag?.bind(this),
      tagObject: this.tagObject?.bind(this),
      getObjectsWithTag: this.getObjectsWithTag?.bind(this),
      getClonesOf: this.getClonesOf?.bind(this),
      show: this.show?.bind(this),
      hide: this.hide?.bind(this),
      clearEffects: this.clearEffects?.bind(this),
      stopAnimations: this.stopAnimations?.bind(this),
      tint: this.tint?.bind(this),
      setAlpha: this.setAlpha?.bind(this),
      dispose: this.dispose?.bind(this),
      setFog: this.setFog?.bind(this),
      keyPressed: this.keyPressed?.bind(this),
      setActionKey: this.setActionKey?.bind(this),
      actionPressed: this.actionPressed?.bind(this),
      isTouchingSurface: this.isTouchingSurface?.bind(this),
      meshExists: this.meshExists?.bind(this),
      seededRandom: this.seededRandom?.bind(this),
      randomColour: this.randomColour?.bind(this),
      scale: this.scale?.bind(this),
      resize: this.resize?.bind(this),
      flip: this.flip?.bind(this),
      mirror: this.mirror?.bind(this),
      changeColor: this.changeColor?.bind(this),
      changeMaterial: this.changeMaterial?.bind(this),
      setMaterial: this.setMaterial?.bind(this),
      moveForward: this.moveForward?.bind(this),
      moveSideways: this.moveSideways?.bind(this),
      strafe: this.strafe?.bind(this),
      jump: this.jump?.bind(this),
      attachCamera: this.attachCamera?.bind(this),
      canvasControls: this.canvasControls?.bind(this),
      interactIndicator: this.interactIndicator?.bind(this),
      setPhysics: this.setPhysics?.bind(this),
      setPhysicsShape: this.setPhysicsShape?.bind(this),
      showPhysics: this.showPhysics?.bind(this),
      checkMeshesTouching: this.checkMeshesTouching?.bind(this),
      say: this.say?.bind(this),
      describeMesh: this.describeMesh?.bind(this),
      onTrigger: this.onTrigger?.bind(this),
      onEvent: this.onEvent?.bind(this),
      broadcastEvent: this.broadcastEvent?.bind(this),
      restartProject: this.restartProject?.bind(this),
      addMicrobit: this.addMicrobit?.bind(this),
      onMicrobitEvent: this.onMicrobitEvent?.bind(this),
      microbitShowImage: this.microbitShowImage?.bind(this),
      microbitScrollText: this.microbitScrollText?.bind(this),
      start: this.start?.bind(this),
      forever: this.forever?.bind(this),
      loadSection: this.loadSection?.bind(this),
      unloadSection: this.unloadSection?.bind(this),
      switchSection: this.switchSection?.bind(this),
      unloadAllSections: this.unloadAllSections?.bind(this),
      loadSectionQueued: this.loadSectionQueued?.bind(this),
      switchSectionQueued: this.switchSectionQueued?.bind(this),
      unloadSectionQueued: this.unloadSectionQueued?.bind(this),
      unloadAllSectionsQueued: this.unloadAllSectionsQueued?.bind(this),
      whenActionEvent: this.whenActionEvent?.bind(this),
      whenKeyEvent: this.whenKeyEvent?.bind(this),
      randomInteger: this.randomInteger?.bind(this),
      printText: this.printText?.bind(this),
      enableSubtitles: this.enableSubtitles?.bind(this),
      showSubtitle: this.showSubtitle?.bind(this),
      UIText: this.UIText?.bind(this),
      UIButton: this.UIButton?.bind(this),
      UIInput: this.UIInput?.bind(this),
      UISlider: this.UISlider?.bind(this),
      onIntersect: this.onIntersect?.bind(this),
      getProperty: this.getProperty?.bind(this),
      getTime: this.getTime?.bind(this),
      exportMesh: this.exportMesh?.bind(this),
      createVector3: this.createVector3?.bind(this),
    };

    // Guard side-effecting APIs so stale runs no-op
    const SIDE_EFFECT_APIS = [
      'printText',
      'enableSubtitles',
      'showSubtitle',
      'UIText',
      'UIButton',
      'UIInput',
      'UISlider',
      'say',
      'highlight',
      'glow',
      'createParticleEffect',
      'startParticleSystem',
      'stopParticleSystem',
      'resetParticleSystem',
      'playSound',
      'stopAllSounds',
      'speak',
      'broadcastEvent',
      'onEvent',
      'restartProject',
      'addMicrobit',
      'onMicrobitEvent',
      'microbitShowImage',
      'microbitScrollText',
      'onTrigger',
      'start',
      'forever',
      'canvasControls',
      'interactIndicator',
      'buttonControls',
      'onScreenControls',
      'setActionKey',
      'cameraControl',
      'attachCamera',
      'switchCamera',
      'setSky',
      'setFog',
      'setCameraBackground',
      'setXRViewMode',
      'setXRCameraMotionMode',
      'setXRUIPlacement',
      'setARSceneSize',
      'setVRComfort',
      'addTeleportTarget',
      'removeTeleportTarget',
      'lightIntensity',
      'lightColor',
      'lightStyle',
      'enableShadows',
      'setShadow',
      'create3DText',
      'createModel',
      'createBox',
      'createGroup',
      'addPrefab',
      'createSphere',
      'createCylinder',
      'createCapsule',
      'createWedge',
      'createFreeform',
      'createDonut',
      'createRing',
      'createPlane',
      'createMarker',
      'createCamera',
      'createTag',
      'tagObject',
      'mergeMeshes',
      'subtractMeshes',
      'embedMeshes',
      'intersectMeshes',
      'createHull',
      'combineMeshes',
      'describeMesh',
      'dispose',
      'clearEffects',
      'stopAnimations',
    ];
    for (const name of SIDE_EFFECT_APIS) {
      if (typeof api[name] === 'function') api[name] = guard(api[name]);
    }

    // Avoid hard errors if freezing fails in some environments
    try {
      return Object.freeze(api);
    } catch {
      return api;
    }
  },
  async replaceSandboxIframe({ id = 'flock-iframe', srcdocHtml } = {}) {
    const old = document.getElementById(id);

    // --- 1) Hard teardown of the old iframe (if any) ---
    if (old) {
      try {
        // Detach handlers first
        old.onload = null;
        old.onerror = null;

        // Best-effort stop inside the old realm
        const w = old.contentWindow;
        try {
          w?.cancelAnimationFrame?.(w.__raf);
        } catch {
          /* ignore teardown errors */
        }
        try {
          w?.stop?.();
        } catch {
          /* ignore teardown errors */
          // stops loading
        }
        try {
          w?.close?.();
        } catch {
          /* ignore teardown errors */
          // some browsers free resources
        }

        // Navigate to a harmless page to break references, then remove
        try {
          old.src = 'about:blank';
        } catch {
          /* ignore teardown errors */
        }
      } finally {
        // Remove from DOM to release the realm
        old.remove?.();
      }
    }

    // --- 2) Create a brand-new iframe (fresh realm) ---
    const iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.style.display = 'none';

    // Prefer srcdoc so CSP is present before any script runs
    const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval'`;
    const html =
      srcdocHtml ??
      `<!doctype html>
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        <canvas id="renderCanvas"></canvas>`;

    // Attach to DOM before setting src/srcdoc to ensure load events fire consistently
    document.body.appendChild(iframe);

    // Load and await readiness
    await new Promise((resolve, reject) => {
      iframe.onload = () => {
        iframe.onload = iframe.onerror = null;
        resolve();
      };
      iframe.onerror = () => {
        iframe.onload = iframe.onerror = null;
        reject(new Error('iframe failed to load'));
      };
      // Use srcdoc when possible; fallback to about:blank + injected head if needed
      try {
        iframe.srcdoc = html;
      } catch {
        iframe.src = 'about:blank';
      }
    });

    // If we fell back to about:blank, inject CSP meta now (runs before user code anyway)
    if (!('srcdoc' in document.createElement('iframe')) || !iframe.srcdoc) {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc.head) doc.documentElement.appendChild(doc.createElement('head'));
      const meta = doc.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = csp;
      doc.head.appendChild(meta);
    }

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument || win?.document;
    if (!win || !doc) throw new Error('New iframe is unavailable');

    return { iframe, win, doc };
  },
};

// Names user code receives from the Flock API, plus the globals a run sets beside
// them. A generated variable or function with one of these names would shadow it,
// so the generator must avoid them. Every API entry is `this.x?.bind(this)`, so
// the keys come out without a live flock.
export const SANDBOX_API_NAMES = [
  ...Object.keys(flockSandbox.createWhitelist.call({}, { guard: (fn) => fn })),
  'performance',
  'requestAnimationFrame',
  '__flockLoopYield',
  '__flockLoopPacer',
  'Date',
];

const ALLOWED_FREE_NAMES = new Set([...SANDBOX_API_NAMES, ...ALLOWED_GLOBALS]);
