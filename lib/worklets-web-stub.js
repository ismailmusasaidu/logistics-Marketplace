'use strict';

export const RuntimeKind = {
  ReactNative: 'ReactNative',
  UI: 'UI',
  Worker: 'Worker',
};

export const WorkletsModule = {};

export function callMicrotasks() {}

export function createSerializable(fn) {
  return fn;
}

export function createSynchronizable(fn) {
  return fn;
}

export function executeOnUIRuntimeSync(fn) {
  return (...args) => fn(...args);
}

export function isWorkletFunction() {
  return false;
}

export function makeShareable(value) {
  return value;
}

export function runOnJS(fn) {
  return fn;
}

export function runOnUI(fn) {
  return fn;
}

export function runOnRuntime(_runtime, fn) {
  return fn;
}

export function createWorkletRuntime(_name, _initializer) {
  return {};
}

export function scheduleOnRuntime(_runtime, fn, ...args) {
  fn(...args);
}

export const serializableMappingCache = new WeakMap();
