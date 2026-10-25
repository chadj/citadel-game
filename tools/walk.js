// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Every .js file under `dir`, recursively, in sorted order. A missing
// directory gives an empty list.
export function listJsFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJsFiles(path));
    else if (entry.name.endsWith('.js')) files.push(path);
  }
  return files.sort();
}
