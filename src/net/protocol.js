// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// How the machines of an online game talk (spec 12; decision D52). The
// server holds the lobby and each game's setup, and puts every game's
// moves in order: a player sends a move, the server checks it with the
// rules, then sends it to everyone, numbered. Every machine runs the
// whole game from the moves, and sends the server its state's hash
// after each one, for the server to compare with its own.
//
// Every message is JSON, { t: type, ...fields }.
//
// From a player:
//   hello      { name, token }      who they are; `token` takes back a seat
//   lobby      {}                   send the list of games, and keep it current
//   host       { name, settings }   host a game
//   join       { room }             join a game
//   leave      {}                   leave the game's setup screen
//   setHost    { settings, seats }  the host's choices
//   setMe      { faction, color }   a player's own choices
//   ready      { ready }
//   start      {}                   the host starts the game
//   move       { move }             a launch, a pass or a timeout
//   hash       { n, hash }          the state's hash after move n
//   chat       { to, text }         to 'all', 'team' or a player
//   quit       {}                   quit the game
//   ping       {}
//
// From the server:
//   welcome    { token }
//   games      { games }            the games waiting for players
//   room       { room, you }        the setup screen as it stands
//   closed     { reason }           the game's setup was closed
//   error      { reason }
//   start      { setup, you, moves }  the game begins (or resumes)
//   move       { n, move }          move n, for everyone to play
//   refused    { reason }           your move was refused
//   chat       { from, to, text }   or { system: text }
//   presence   { player, state }    'notResponding', 'back' or 'gone'
//   desync     { n }                a machine's state differs after move n

export const NET_PATH = '/net';

// Losing touch (spec 12, Losing touch): players send a ping this often;
// after about a minute of silence the others are warned, and after
// about two the player is disconnected.
export const PING_MS = 5000;
export const NOT_RESPONDING_MS = 60000;
export const DISCONNECT_MS = 120000;

// The turn's player's own machine says when its time is up. The server
// only steps in if that doesn't come, this long after it should have.
export const CLOCK_GRACE_MS = 10000;

export const GAME_NAME_MAX = 32;
export const NAME_MAX = 16;

export function encode(t, fields = {}) {
  return JSON.stringify({ t, ...fields });
}

export function decode(text) {
  try {
    const m = JSON.parse(text);
    return m && typeof m.t === 'string' ? m : null;
  } catch {
    return null;
  }
}
