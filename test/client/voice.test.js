// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The aide's voices (spec 11, The aide; decision D50): each faction gets
// its own system voice by name, never a novelty one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignVoices } from '../../src/client/audio/voice.js';

const voices = (list) => list.map(([name, lang]) => ({ name, lang, localService: true }));
const names = (assigned) => assigned.map((v) => v?.name ?? null);

// Factions in order: Ion Mercantile, Rivet & Ash, Toroid Drift, Crater Born.

test('on a Mac: four US English voices, two women\'s and two men\'s, and no novelty voices', () => {
  const mac = voices([
    ['Albert', 'en-US'], ['Bad News', 'en-US'], ['Bahh', 'en-US'], ['Daniel', 'en-GB'],
    ['Eddy (English (UK))', 'en-GB'], ['Eddy (English (US))', 'en-US'], ['Fred', 'en-US'], ['Karen', 'en-AU'],
    ['Reed (English (UK))', 'en-GB'], ['Reed (English (US))', 'en-US'], ['Samantha', 'en-US'],
    ['Shelley (English (UK))', 'en-GB'], ['Shelley (English (US))', 'en-US'], ['Zarvox', 'en-US'], ['Amélie', 'fr-CA'],
  ]);
  assert.deepEqual(names(assignVoices(mac)), ['Samantha', 'Reed (English (US))', 'Shelley (English (US))', 'Eddy (English (US))']);
});

test('the better voices come first where they\'re installed', () => {
  const safari = voices([['Samantha (Enhanced)', 'en-US'], ['Alex', 'en-US'], ['Zoe (Premium)', 'en-US'], ['Evan (Enhanced)', 'en-US'],
    ['Reed (English (US))', 'en-US']]);
  assert.deepEqual(names(assignVoices(safari)), ['Samantha (Enhanced)', 'Alex', 'Zoe (Premium)', 'Evan (Enhanced)']);
});

test('Chrome\'s own voices, and Windows\'s', () => {
  const chrome = voices([['Google US English', 'en-US'], ['Google UK English Female', 'en-GB'], ['Google UK English Male', 'en-GB']]);
  const [ion, rivet, toroid, crater] = assignVoices(chrome);
  assert.equal(ion.name, 'Google US English');
  // Only one US voice: the others keep to a woman's or a man's voice.
  assert.equal(rivet.name, 'Google UK English Male');
  assert.equal(toroid.name, 'Google UK English Female');
  assert.ok(crater, 'with only three voices, the fourth faction shares one');

  const windows = voices([['Microsoft David - English (United States)', 'en-US'], ['Microsoft Mark - English (United States)', 'en-US'],
    ['Microsoft Zira - English (United States)', 'en-US'], ['Microsoft Hazel - English (United Kingdom)', 'en-GB']]);
  assert.deepEqual(names(assignVoices(windows)).map((n) => n.split(' - ')[0]),
    ['Microsoft Zira', 'Microsoft David', 'Microsoft Hazel', 'Microsoft Mark'], 'one US woman\'s voice: a UK one stands in');
});

test('voices with unknown names (as on Android) are shared out in order, one each', () => {
  const android = voices([['English United States', 'en-US'], ['English United Kingdom', 'en-GB'],
    ['English India', 'en-IN'], ['English Australia', 'en-AU'], ['Deutsch Deutschland', 'de-DE']]);
  assert.equal(new Set(names(assignVoices(android))).size, 4);
});

test('no English voices: no voice, and the browser uses its default', () => {
  assert.deepEqual(names(assignVoices(voices([['Thomas', 'fr-FR']]))), [null, null, null, null]);
  assert.deepEqual(names(assignVoices([])), [null, null, null, null]);
});
