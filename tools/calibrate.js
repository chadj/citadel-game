// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Prints how the flight constants measure up against spec 01's targets.
// Tune the values in src/rules/constants.js, then run again.
//
//   node tools/calibrate.js

import { flightCases } from '../test/helpers/flight-cases.js';

console.log('case'.padEnd(34), 'got'.padStart(18), 'target'.padStart(18));
for (const c of flightCases()) {
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : String(v));
  console.log(c.name.padEnd(34), fmt(c.got).padStart(18), fmt(c.target).padStart(18));
}
