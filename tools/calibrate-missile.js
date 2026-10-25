// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Prints the Interceptor chase times against spec 06's targets, for
// tuning MISSILE_ACCEL and MISSILE_MAX_SPEED.

import { chaseCases } from '../test/helpers/missile-cases.js';

const cases = chaseCases();
const times = cases.map((c) => c.seconds).filter((t) => t !== null).sort((a, b) => a - b);
for (const c of cases) console.log(`power ${c.power}, at (${c.ix}, ${c.iy}): ${c.seconds ?? 'missed'}`);
console.log(`caught ${times.length} of ${cases.length}; shortest ${times[0]} s, median ${times[times.length >> 1]} s, longest ${times.at(-1)} s`);
