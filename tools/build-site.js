// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Builds the game's page as a static site, to host apart from the game
// server, such as on GitHub Pages (decision D66). The page plays hot
// seat, computers and replays by itself; for online play it connects to
// the game server given, which runs tools/serve.js.
//
//   node tools/build-site.js --server wss://example.com/net [--out site]
//
//   --server url  the game server's WebSocket address (wss:// for a page
//                 served over https). Without it, the page connects to
//                 its own host, as when tools/serve.js serves it.
//   --out dir     where the site goes (site/), emptied first
//
// The site has the page, the game's code (not the server's), its assets
// and the minified Phaser, with both licenses.

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const k = args.indexOf(`--${name}`);
  return k >= 0 ? args[k + 1] : fallback;
};
const SERVER = option('server', '');
const OUT = resolve(ROOT, option('out', 'site'));

if (SERVER && !/^wss?:\/\/[^\s"'<>]+$/.test(SERVER)) {
  console.error(`--server should be a WebSocket address, such as wss://example.com/net, not "${SERVER}"`);
  process.exit(1);
}
if (OUT === ROOT || !OUT.startsWith(ROOT + sep)) {
  console.error('--out should be a folder inside the project');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const copy = (from, to = from) => cpSync(join(ROOT, from), join(OUT, to), { recursive: true });

// The page: Phaser from the site itself, minified; the server, if given.
let page = readFileSync(join(ROOT, 'index.html'), 'utf8');
const unminified = './node_modules/phaser/dist/phaser.esm.js';
if (!page.includes(unminified)) throw new Error(`index.html no longer loads ${unminified}`);
page = page.replace(unminified, './vendor/phaser.esm.min.js');
if (SERVER) page = page.replace('</head>', `  <meta name="lunar-citadel-server" content="${SERVER}">\n</head>`);
writeFileSync(join(OUT, 'index.html'), page);

copy('manifest.webmanifest');
copy('assets');
copy('LICENSE');
copy('src', 'src');
rmSync(join(OUT, 'src', 'server'), { recursive: true, force: true });
copy(join('node_modules', 'phaser', 'dist', 'phaser.esm.min.js'), join('vendor', 'phaser.esm.min.js'));
copy(join('node_modules', 'phaser', 'LICENSE.md'), join('vendor', 'PHASER-LICENSE.md'));
// GitHub Pages serves files as they are.
writeFileSync(join(OUT, '.nojekyll'), '');

console.log(`site built in ${OUT}${SERVER ? `, playing online at ${SERVER}` : ''}`);
