const report = window.__flockReportHostError;
const reportProject = window.__flockReportProjectError;
const { create, defineProperty, freeze, getOwnPropertyDescriptor, getPrototypeOf, isFrozen, keys } = Object;
const { isArray } = Array;
const ObjectProto = Object.prototype;
const ArrayProto = Array.prototype;
const PromiseProto = Promise.prototype;
const MAX_DEPTH = 16;
const halts = new WeakSet();
const hostFnWrappers = new WeakSet();
const userFnWrappers = new WeakMap();
const userFnOriginals = new WeakMap();
const halt = () => {
  const error = defineProperty(new Error('aborted'), 'name', { value: 'AbortError' });
  halts.add(error);
  return error;
};
const refuse = (name, what) => new TypeError('Flock sandbox: ' + name + ' cannot take ' + what);
const drop = (source) => {
  console.warn('Flock sandbox: dropped a host object from ' + source);
  return undefined;
};
const isObjectLike = (v) => v !== null && (typeof v === 'object' || typeof v === 'function');
const readData = (v, key, onAccessor) => {
  const desc = getOwnPropertyDescriptor(v, key);
  if (!desc) return undefined;
  return 'value' in desc ? desc.value : onAccessor();
};
const copyData = (v, proto, convert, onAccessor) => {
  if (isArray(v)) {
    const length = readData(v, 'length', onAccessor);
    const copy = [];
    for (let i = 0; i < length; i++) copy.push(convert(readData(v, i, onAccessor)));
    return copy;
  }
  const copy = proto === null ? create(null) : {};
  for (const key of keys(v)) {
    const value = convert(readData(v, key, onAccessor));
    defineProperty(copy, key, { value, writable: true, enumerable: true, configurable: true });
  }
  return copy;
};
const toRealm = (v, source, depth = 0) => {
  if (!isObjectLike(v)) return v;
  if (typeof v === 'function') {
    if (hostFnWrappers.has(v)) return v;
    if (userFnOriginals.has(v)) return userFnOriginals.get(v);
    return drop(source);
  }
  if (depth >= MAX_DEPTH) return drop(source);
  const proto = getPrototypeOf(v);
  if (isArray(v) || proto === null || proto === ObjectProto) {
    const copy = copyData(v, proto, (item) => toRealm(item, source, depth + 1), () => drop(source));
    return !isArray(v) && isFrozen(v) ? freeze(copy) : copy;
  }
  if (typeof v.then !== 'function') return drop(source);
  return new Promise((resolve, reject) => {
    const fail = (e) => {
      report(e);
      reject(halt());
    };
    try {
      v.then((r) => {
        try {
          resolve(toRealm(r, source));
        } catch (e) {
          fail(e);
        }
      }, fail);
    } catch (e) {
      fail(e);
    }
  });
};
const readString = (get) => {
  try {
    const v = get();
    return v == null ? '' : String(v);
  } catch {
    return '';
  }
};
const toHostError = (e) => {
  if (!isObjectLike(e) || halts.has(e)) return e;
  const error = new Error(readString(() => e.message));
  const name = readString(() => e.name);
  if (name) defineProperty(error, 'name', { value: name, configurable: true });
  const stack = readString(() => e.stack);
  try {
    defineProperty(error, 'stack', { value: stack, configurable: true });
  } catch {
    /* ignore: the stack is optional */
  }
  return error;
};
const toHost = (v, name, depth = 0) => {
  if (!isObjectLike(v)) return v;
  if (typeof v === 'function') return wrapUserFn(v);
  if (depth >= MAX_DEPTH) throw refuse(name, 'values nested this deeply');
  const proto = getPrototypeOf(v);
  if (proto === PromiseProto) {
    return new Promise((resolve) => resolve(v)).then(
      (r) => toHost(r, name),
      (e) => {
        throw toHostError(e);
      }
    );
  }
  if (isArray(v) ? proto !== ArrayProto : proto !== null && proto !== ObjectProto) {
    throw refuse(name, 'this kind of object');
  }
  return copyData(
    v,
    proto,
    (item) => toHost(item, name, depth + 1),
    () => {
      throw refuse(name, 'getters or setters');
    }
  );
};
const wrapUserFn = (fn) => {
  let wrapper = userFnWrappers.get(fn);
  if (!wrapper) {
    wrapper = (...args) => {
      const safeArgs = args.map((arg) => toRealm(arg, 'a callback argument'));
      let result;
      try {
        result = fn(...safeArgs);
      } catch (e) {
        throw toHostError(e);
      }
      return toHost(result, 'a callback result');
    };
    userFnWrappers.set(fn, wrapper);
    userFnOriginals.set(wrapper, fn);
  }
  return wrapper;
};
window.__flockWrapHostFn = (fn, name) => {
  const wrapper = (...args) => {
    try {
      return toRealm(fn(...args.map((arg) => toHost(arg, name))), name);
    } catch (e) {
      report(e);
      throw halt();
    }
  };
  hostFnWrappers.add(wrapper);
  return freeze(wrapper);
};
window.addEventListener('unhandledrejection', (ev) => {
  ev.preventDefault();
  reportProject('unhandled_rejection', toHostError(ev.reason));
});
window.addEventListener('error', (ev) => {
  ev.preventDefault();
  reportProject('uncaught_error', toHostError(ev.error ?? ev.message));
});
window.__flockSettle = (p) =>
  new Promise((resolve) => resolve(p)).then(
    () => undefined,
    (e) => {
      throw toHostError(e);
    }
  );
