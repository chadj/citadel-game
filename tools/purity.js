// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Checks that rules code stays deterministic plain JavaScript (spec 12,
// Every machine plays the same game; CLAUDE.md, Architecture).
//
// This is a safety net, not a proof. It scans source text, so it can't
// see floats creeping in, and a regex literal holding a quote can
// confuse it. Cross-machine replay tests are the real check.

import { dirname, resolve, relative, sep } from 'node:path';

// Math functions whose results JavaScript engines don't promise to agree
// on. Math.sqrt is exactly rounded everywhere, so it's allowed.
const UNSAFE_MATH = [
  'random', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'pow', 'cbrt', 'hypot',
];

// Globals that reach time, randomness, the platform or the engine.
const FORBIDDEN_GLOBALS = [
  'Date', 'performance', 'crypto', 'Intl',
  'window', 'document', 'navigator', 'globalThis', 'self',
  'process', 'require', 'Buffer',
  'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask',
  'requestAnimationFrame', 'fetch', 'WebSocket', 'Worker',
  'localStorage', 'sessionStorage', 'indexedDB',
  'Phaser',
];

// Splits source into two views: `code` has comments removed but keeps
// string contents (for reading import paths); `bare` also blanks string
// contents (for looking at identifiers). Line breaks are kept in both,
// so line numbers still match.
export function strip(source) {
  let code = '';
  let bare = '';
  const templateDepths = []; // brace depth at each open `${`
  let depth = 0;
  let i = 0;
  const n = source.length;

  const emit = (c, inString) => {
    code += c;
    bare += inString && c !== '\n' ? ' ' : c;
  };

  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') emit('\n', false);
        i++;
      }
      i += 2;
    } else if (c === '"' || c === "'") {
      emit(c, false);
      i++;
      while (i < n && source[i] !== c && source[i] !== '\n') {
        if (source[i] === '\\') { emit(source[i], true); i++; }
        if (i < n) { emit(source[i], true); i++; }
      }
      if (i < n) { emit(source[i], false); i++; }
    } else if (c === '`' || (c === '}' && templateDepths.at(-1) === depth)) {
      // A template literal, or the rest of one after a `${ ... }`.
      if (c === '}') templateDepths.pop();
      emit(c, false);
      i++;
      while (i < n && source[i] !== '`') {
        if (source[i] === '\\') { emit(source[i], true); i++; }
        else if (source[i] === '$' && source[i + 1] === '{') {
          emit('$', false); emit('{', false);
          i += 2;
          templateDepths.push(depth);
          break;
        }
        if (i < n) { emit(source[i], true); i++; }
      }
      if (i < n && source[i] === '`') { emit('`', false); i++; }
    } else {
      if (c === '{') depth++;
      else if (c === '}') depth--;
      emit(c, false);
      i++;
    }
  }
  return { code, bare };
}

function lineOf(text, index) {
  let line = 1;
  for (let k = 0; k < index; k++) if (text[k] === '\n') line++;
  return line;
}

const IMPORT_PATTERNS = [
  /\bimport\s+(?:[\w$*{}\s,]+?\s+from\s+)?(['"])([^'"\n]*)\1/g,
  /\bexport\s+(?:[\w$*{}\s,]+?\s+)?from\s+(['"])([^'"\n]*)\1/g,
  /\bimport\s*\(\s*(['"])([^'"\n]*)\1/g,
];

// Problems in one file's source. `file` is its path; `roots` are the
// directories rules code may import from.
export function findViolations(source, file, roots) {
  const { code, bare } = strip(source);
  const problems = [];
  const report = (index, message) =>
    problems.push({ file, line: lineOf(code, index), message });

  for (const pattern of IMPORT_PATTERNS) {
    for (const m of code.matchAll(pattern)) {
      const spec = m[2];
      if (!spec.startsWith('./') && !spec.startsWith('../')) {
        report(m.index, `imports "${spec}"; rules code may only import its own files`);
        continue;
      }
      const target = resolve(dirname(file), spec);
      const inside = roots.some((root) => {
        const rel = relative(resolve(root), target);
        return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep);
      });
      if (!inside) report(m.index, `imports "${spec}", which is outside the rules code`);
    }
  }
  for (const m of code.matchAll(/\bimport\s*\(\s*[^'"\s]/g)) {
    report(m.index, 'uses a dynamic import with a computed path');
  }

  const math = new RegExp(`\\bMath\\s*\\.\\s*(${UNSAFE_MATH.join('|')})\\b`, 'g');
  for (const m of bare.matchAll(math)) {
    report(m.index, `uses Math.${m[1]}, which isn't the same on every machine`);
  }
  for (const m of bare.matchAll(/\bMath\s*\[/g)) {
    report(m.index, 'uses Math[...], which can hide an unsafe function');
  }
  for (const m of bare.matchAll(/\*\*/g)) {
    report(m.index, 'uses **, which isn\'t the same on every machine for all inputs');
  }
  const globals = new RegExp(`(?<![\\w$.])(${FORBIDDEN_GLOBALS.join('|')})(?![\\w$])`, 'g');
  for (const m of bare.matchAll(globals)) {
    report(m.index, `uses ${m[1]}, which rules code must not touch`);
  }

  return problems.sort((a, b) => a.line - b.line);
}
