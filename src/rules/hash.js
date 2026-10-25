// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// State hashing for the determinism checks (spec 12, Determinism
// checks; decision D27). The game state is plain data: objects, arrays,
// whole numbers, strings, booleans and null. A number that isn't a
// whole number is refused, so a float that leaks into the rules shows
// up at once.

// The state as one canonical string. Object keys are sorted, so the
// order they were added in doesn't matter.
export function canonical(value) {
  const out = [];
  write(value, out, '$');
  return out.join('');
}

function write(value, out, path) {
  if (value === null) out.push('n');
  else if (typeof value === 'boolean') out.push(value ? 't' : 'f');
  else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`${path} is ${value}; the game state holds only whole numbers`);
    }
    // -0 and 0 are the same whole number.
    out.push('i', String(value === 0 ? 0 : value), ';');
  } else if (typeof value === 'string') {
    out.push('s', String(value.length), ':', value);
  } else if (value instanceof Uint16Array) {
    // Fog counts: one 16-bit character per entry, which the hash reads
    // whole.
    out.push('u', String(value.length), ':');
    for (let k = 0; k < value.length; k += 4096) out.push(String.fromCharCode(...value.subarray(k, k + 4096)));
  } else if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    out.push('[');
    for (let k = 0; k < value.length; k++) write(value[k], out, `${path}[${k}]`);
    out.push(']');
  } else if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    out.push('{');
    for (const key of Object.keys(value).sort()) {
      const v = value[key];
      if (v === undefined) continue;
      out.push('s', String(key.length), ':', key);
      write(v, out, `${path}.${key}`);
    }
    out.push('}');
  } else {
    throw new TypeError(`${path} is a ${typeof value}; the game state holds only plain data`);
  }
}

// A 64-bit hash of the canonical form, as 16 hex digits. Two
// independent 32-bit FNV-1a lanes, one fed in reverse byte order.
export function hashState(value) {
  const text = canonical(value);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let k = 0; k < text.length; k++) {
    const c = text.charCodeAt(k);
    a = Math.imul(a ^ (c & 0xff), 0x01000193);
    a = Math.imul(a ^ (c >>> 8), 0x01000193);
    b = Math.imul(b ^ (c >>> 8), 0x01000193);
    b = Math.imul(b ^ (c & 0xff), 0x01000193);
    b ^= b >>> 15;
  }
  const hex = (h) => (h >>> 0).toString(16).padStart(8, '0');
  return hex(a) + hex(b);
}
