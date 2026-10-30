// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// This machine's connection to the server, for online play (spec 12;
// decision D52). It says hello with the player's name, keeps a token
// for taking back a seat, pings so the server knows it's there, and
// reconnects by itself if the connection drops.
//
// The token is kept per tab, so a reload takes the seat back. But a
// duplicated tab gets a copy of it; so before using a kept token, a tab
// asks the others whether one of them already holds it, and if one
// does, it starts afresh as a new player (decision D56).

import { encode, decode, NET_PATH, PING_MS } from '../../net/protocol.js';

const RETRY_MS = 2000;
const TOKEN_KEY = 'lunarCitadel.netToken';
const CHANNEL = 'lunarCitadel.net';
const ASK_MS = 200; // how long it waits for another tab to answer

function storedToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // not kept: a reload won't take the seat back
  }
}

function channel() {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}

// Whether another open tab holds `token`: it asks, and waits a moment
// for an answer.
export function heldElsewhere(token, ms = ASK_MS) {
  const ch = token ? channel() : null;
  if (!ch) return Promise.resolve(false);
  return new Promise((resolve) => {
    let timer = null;
    const done = (held) => {
      clearTimeout(timer);
      ch.close();
      resolve(held);
    };
    ch.onmessage = (e) => {
      if (e.data?.held === token) done(true);
    };
    timer = setTimeout(() => done(false), ms);
    ch.postMessage({ ask: token });
  });
}

// Answers other tabs asking about the token `current()` returns.
// Returns a function that stops.
export function answerAsks(current) {
  const ch = channel();
  if (!ch) return () => {};
  ch.onmessage = (e) => {
    const token = current();
    if (token && e.data?.ask === token) ch.postMessage({ held: token });
  };
  return () => ch.close();
}

// Where the game server is (decision D66): the page's
// <meta name="lunar-citadel-server"> when the page is hosted apart from
// the server (tools/build-site.js writes it), or else the page's own
// host.
export function serverUrl() {
  const set = globalThis.document?.querySelector('meta[name="lunar-citadel-server"]')?.content?.trim();
  if (set) return set;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${NET_PATH}`;
}

export class Net {
  constructor(name, url = serverUrl()) {
    this.url = url;
    this.name = name;
    this.token = null;
    this.handlers = new Map();
    this.open = false;
    this.closed = false;
    this.early = null;
    const kept = storedToken();
    heldElsewhere(kept).then((held) => {
      this.token = held ? null : kept;
      this.stopAnswering = answerAsks(() => this.token);
      this.connect();
    });
    this.pinger = setInterval(() => this.send('ping'), PING_MS);
  }

  connect() {
    if (this.closed) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.open = true;
      ws.send(encode('hello', { name: this.name, token: this.token }));
      this.emit({ t: 'connected' });
    });
    ws.addEventListener('message', (ev) => {
      const m = decode(ev.data);
      if (!m) return;
      if (m.t === 'welcome') {
        this.token = m.token;
        storeToken(m.token);
      }
      // A game's screen opens a frame after its start, and not at all
      // while the tab is hidden; the moves that arrive meanwhile wait
      // for it here.
      if (m.t === 'start') this.early = [];
      else if (m.t === 'move' && this.early) this.early.push(m);
      this.emit(m);
    });
    // The server may say why it closed the connection (D67).
    ws.addEventListener('close', (ev) => {
      const was = this.open;
      this.open = false;
      if (this.closed) return;
      if (was) this.emit({ t: 'disconnected', reason: ev.reason || null });
      setTimeout(() => this.connect(), RETRY_MS);
    });
  }

  // The moves that came since the game started, for its screen, which
  // takes them from here on.
  takeEarly() {
    const early = this.early ?? [];
    this.early = null;
    return early;
  }

  send(t, fields = {}) {
    if (this.open) this.ws.send(encode(t, fields));
  }

  // Listens for messages of type `t`. Returns a function that stops.
  on(t, fn) {
    if (!this.handlers.has(t)) this.handlers.set(t, new Set());
    this.handlers.get(t).add(fn);
    return () => this.handlers.get(t).delete(fn);
  }

  emit(m) {
    for (const fn of this.handlers.get(m.t) ?? []) fn(m);
    for (const fn of this.handlers.get('*') ?? []) fn(m);
  }

  close() {
    this.closed = true;
    clearInterval(this.pinger);
    this.stopAnswering?.();
    this.ws?.close();
  }
}

// The one connection, made when it's first needed.
export function netFor(registry, name) {
  let net = registry.get('net');
  if (!net) {
    net = new Net(name);
    registry.set('net', net);
  }
  return net;
}
