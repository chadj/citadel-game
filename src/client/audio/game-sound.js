// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The game screen's sound (spec 11): effects placed by where they are
// compared with the view, sounds that follow what made them, the
// interface sounds, the aide and the music.

import { cuesFor, interfaceCues, placeSound } from '../core/sound-cues.js';
import { Aide, aideKeysFor } from '../core/aide.js';
import { MoodTracker, moodOf } from '../core/mood.js';
import { screenAt, LIFT } from '../core/view.js';
import { PX, WET } from '../../rules/constants.js';
import { canSee } from '../../rules/fog.js';
import { findUnit } from '../../rules/units.js';
import { sampleTerrain } from '../../rules/terrain/terrain.js';
import { onVent } from '../../rules/shots.js';

const BLASTS = new Set(['extractor', 'charge', 'rover']);

export class GameSound {
  constructor(scene) {
    this.scene = scene;
    const audio = scene.registry.get('audio');
    this.engine = audio?.engine ?? null;
    this.music = audio?.music ?? null;
    this.voice = audio?.voice ?? null;
    this.followers = [];
    this.aide = new Aide({ chatter: scene.prefs.aideChatter });
    this.aideFor = null;
    this.mood = new MoodTracker();
    this.music?.play('game');
  }

  get game() {
    return this.scene.session.game;
  }

  // The player whose sound this is: the one at the screen.
  get me() {
    return this.scene.viewer;
  }

  listener() {
    const cam = this.scene.cam;
    return { x: cam.x * PX, y: cam.y * PX };
  }

  pointOf(id) {
    const u = findUnit(this.game.state, id);
    if (u) return { x: u.x, y: u.y, z: u.base };
    return this.scene.world.effects.lastSeen.get(id) ?? null;
  }

  where(e) {
    if (e.x !== undefined) return { x: e.x, y: e.y };
    if (e.conduit !== undefined && e.index !== undefined) {
      const n = this.game.state.conduits.find((c) => c.id === e.conduit)?.nodes[e.index];
      if (n) return { x: n.x, y: n.y };
    }
    const id = e.unit ?? e.launcher;
    return id === undefined ? null : this.pointOf(id);
  }

  place(at) {
    const visible = this.scene.watching || canSee(this.game, this.me, at.x, at.y);
    return placeSound(this.listener(), at, this.game.map.size, visible);
  }

  onScreen(id) {
    const p = this.pointOf(id);
    if (!p) return false;
    const cam = this.scene.cam;
    const [sx, sy] = screenAt(cam, p.x / PX, (p.y - (p.z ?? 0) * LIFT) / PX);
    return sx >= 0 && sy >= 0 && sx <= cam.width && sy <= cam.height;
  }

  kindOf(id) {
    return findUnit(this.game.state, id)?.kind ?? null;
  }

  onEvent(e) {
    const game = this.game;
    if (e.client) {
      for (const name of interfaceCues(e, this.me)) this.engine?.play(name);
      if (!this.scene.watching) this.hearAide(e);
      return;
    }
    if (this.engine) {
      const look = {
        where: (x) => this.where(x),
        shotFrom: (id) => {
          const shots = game.state.shots.filter((s) => s.launcher === id);
          return shots.length > 0 ? shots[shots.length - 1].id : null;
        },
        kindOf: (id) => this.kindOf(id),
        wet: (at) => sampleTerrain(game.map, at.x, at.y).type === WET,
        blasts: (x) => BLASTS.has(x.kind),
      };
      for (const cue of cuesFor(e, look)) this.cue(cue);
      for (const name of interfaceCues(e, this.me)) this.engine.play(name);
    }
    if (!this.scene.watching) this.hearAide(e);
    const at = this.where(e);
    const feel = moodOf(e, this.context());
    if (feel.excite) feel.near = at ? this.place(at).gain : 0.5;
    this.mood.feel(feel);
  }

  cue({ sound, at, follow, gain }) {
    const p = this.place(at);
    const h = this.engine.play(sound, { gain: p.gain * gain, pan: p.pan });
    if (h && follow) this.followers.push({ h, follow, gain, at });
  }

  context() {
    const game = this.game;
    return {
      me: this.me,
      sides: game.sides,
      turnPlayer: game.state.turn.player,
      onScreen: (id) => this.onScreen(id),
      ventExtractor: (id) => {
        const u = findUnit(game.state, id);
        return !!u && onVent(game.map, u);
      },
      kindOf: (id) => this.kindOf(id),
      ownerOf: (id) => findUnit(game.state, id)?.owner,
    };
  }

  hearAide(e) {
    // Each player hears their own aide: in hot seat, the one at the
    // screen. A new player starts with a quiet aide.
    if (this.aideFor !== this.me) {
      this.aideFor = this.me;
      this.aide = new Aide({ chatter: this.scene.prefs.aideChatter });
      this.aide.citadelLost = !!this.game.state.players[this.me]?.knockedOut;
    }
    const s = this.game.state;
    for (const key of aideKeysFor(e, this.context())) {
      const turn = s.turn.player;
      // A reminder goes stale once the turn has passed, or something
      // is moving (spec 11).
      const stale = key === 'reminder' ? () => s.turn.player !== turn || s.phase !== 'turn' : null;
      this.aide.add(key, stale);
    }
  }

  update(ms) {
    // Sounds that follow what made them.
    const s = this.game.state;
    this.followers = this.followers.filter((f) => {
      if (!f.h.playing) return false;
      let p = null;
      if (f.follow.shot !== undefined) p = s.shots.find((x) => x.id === f.follow.shot);
      else if (f.follow.missile !== undefined) p = s.missiles.find((x) => x.id === f.follow.missile);
      else if (f.follow.unit !== undefined) p = s.drive && !s.drive.done && s.drive.rover === f.follow.unit ? findUnit(s, f.follow.unit) : null;
      if (!p) {
        // A loop ends with what made it; a one-off sound plays on.
        if (f.h.loop) f.h.stop(0.15);
        return false;
      }
      const place = this.place({ x: p.x, y: p.y });
      f.h.place(place.gain * f.gain, place.pan);
      return true;
    });

    if (this.voice && !this.scene.watching) {
      this.aide.chatter = this.scene.prefs.aideChatter;
      const line = this.aide.update(ms, this.voice.busy);
      if (line) this.voice.say(line, this.scene.session.setup.players[this.me].faction);
    }

    this.mood.update(ms);
    this.music?.setState(this.mood.intensity, this.mood.tone);
  }

  // Leaving the game: the music fades over about a second, then the
  // menu song starts (spec 11).
  leave() {
    for (const f of this.followers) f.h.stop();
    this.followers = [];
    this.voice?.stop();
    this.music?.fadeOut(1000, 'menu');
  }

  // The game is over: its effects stop; the summary plays its song.
  end() {
    for (const f of this.followers) f.h.stop();
    this.followers = [];
  }
}
