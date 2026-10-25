# Provenance

For each system built: the spec sections it implements, and the
entries in `decisions.md` it relies on.

## Rules version
- **Files:** `src/rules/version.js`
- **Spec:** 12 Replays (a replay records the rules' version).
- **Decisions:** none.

## Rules purity check
- **Files:** `tools/purity.js`, `tools/walk.js`, `test/purity.test.js`
- **Spec:** 12 Every machine plays the same game (nothing in the rules
  is random; results mustn't depend on the machine); CLAUDE.md,
  Architecture requirements (no Phaser or DOM in the rules).
- **What it checks:** code in `src/rules/` and `src/mapgen/` imports
  only files inside those folders, and doesn't use `Math.random`, Math
  functions that engines may compute differently, `**`, time, or
  browser, Node or Phaser globals. `Math.sqrt` is allowed: it's
  exactly rounded everywhere.
- **Decisions:** none. The map generator counts as rules code, because
  clients may rebuild a generated map from what the host sends
  (spec 02, Generated maps).

## License headers
- **Files:** `test/headers.test.js`, `LICENSE`
- **Spec:** none; CLAUDE.md, Conventions.
