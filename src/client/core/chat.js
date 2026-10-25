// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Chat lines and who they go to (spec 10, Chat).
//
// A line goes to everyone, unless it starts with a prefix:
//   /team words   or  /t words  — to the sender's team
//   @name words                 — to the one player whose name starts
//                                 with `name` (any case)
// A prefix that matches nobody, or more than one player, is just part
// of the message, and the line goes to everyone. Computer players don't
// receive messages.

export const CHAT_MAX = 120;

// Works out a line typed by `from`. `players` are the setup's players;
// `sides` each player's side. Returns { to, text }, where `to` is 'all',
// 'team' or a player's index.
export function routeChat(line, from, players, sides) {
  const text = line.slice(0, CHAT_MAX).trim();
  const team = /^\/(?:team|t)\s+(.*)$/i.exec(text);
  if (team && players[from].team !== null && sides.some((s, i) => i !== from && s === sides[from])) {
    return { to: 'team', text: team[1] };
  }
  const direct = /^@(\S+)\s+(.*)$/.exec(text);
  if (direct) {
    const start = direct[1].toLowerCase();
    const matches = players
      .map((p, i) => i)
      .filter((i) => i !== from && !players[i].computer && players[i].name.toLowerCase().startsWith(start));
    if (matches.length === 1) return { to: matches[0], text: direct[2] };
  }
  return { to: 'all', text };
}

// Whether `player` gets a message.
export function receives(message, player, players, sides) {
  if (players[player].computer) return false;
  if (player === message.from || message.to === 'all') return true;
  if (message.to === 'team') return sides[player] === sides[message.from];
  return message.to === player;
}

// How a message reads to `player`: the sender's name, a tag saying who
// it went to, and the text.
export function chatLine(message, player, players) {
  const name = players[message.from].name;
  let tag = '';
  if (player === message.from) {
    if (message.to === 'team') tag = '[to team] ';
    else if (message.to !== 'all') tag = `[to ${players[message.to].name}] `;
  } else if (message.to === 'team') {
    tag = '[team] ';
  } else if (message.to !== 'all') {
    tag = '[just for you] ';
  }
  return `${name}: ${tag}${message.text}`;
}
