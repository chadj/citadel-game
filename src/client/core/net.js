// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// This machine's connection to the server, for online play (spec 12;
// decision D52). It says hello with the player's name, keeps a token
// for taking back a seat, pings so the server knows it's there, and
// reconnects by itself if the connection drops.

import { encode, decode, NET_PATH, PING_MS } from '../../net/protocol.js';

const RETRY_MS = 2000;
const TOKEN_KEY = 'lunarCitadel.netToken';

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

export class Net {
  constructor(name, url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${NET_PATH}`) {
    this.url = url;
    this.name = name;
    this.token = storedToken();
    this.handlers = new Map();
    this.open = false;
    this.closed = false;
    this.connect();
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
      this.emit(m);
    });
    ws.addEventListener('close', () => {
      const was = this.open;
      this.open = false;
      if (this.closed) return;
      if (was) this.emit({ t: 'disconnected' });
      setTimeout(() => this.connect(), RETRY_MS);
    });
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
