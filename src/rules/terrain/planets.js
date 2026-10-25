// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The six planets and how high their raised levels stand above Ground
// (spec 02, Planets, Levels; decision D24). Plateaus about 25 to 40 px,
// Mountains about 35 to 80 px. A planet changes nothing else in play.

import { px } from '../math/fixed.js';

export const PLANETS = Object.freeze({
  tundra: Object.freeze({ plateau: px(30), mountain: px(55) }),
  canyon: Object.freeze({ plateau: px(40), mountain: px(80) }),
  toxic: Object.freeze({ plateau: px(28), mountain: px(45) }),
  glacier: Object.freeze({ plateau: px(35), mountain: px(65) }),
  plains: Object.freeze({ plateau: px(25), mountain: px(38) }),
  desert: Object.freeze({ plateau: px(32), mountain: px(60) }),
});
