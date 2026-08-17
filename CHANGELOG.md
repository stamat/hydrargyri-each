# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**How to use it:** land changes under `## [Unreleased]`, grouped under _Added_, _Changed_,
_Deprecated_, _Removed_, _Fixed_ or _Security_. Write entries for the person upgrading, not
for the person who wrote the code.

## [Unreleased]

### Fixed

- **A row's `@window` / `@document` listener now leaves with its row.** The repaint
  prune told a departed row's listeners apart by their target, which a global target
  never matches — so a repainting list wired a fresh window listener per paint on top
  of the old ones, every copy still firing, and the pile only cleared on disconnect.
  Listener entries now carry the row node that wired them and are pruned when it
  leaves.

## [2.1.0] - 2026-08-11

### Added

- **TypeScript declarations ship with the package.** `HgEach` and the shapes `items`
  accepts are typed in a hand-written `src/scripts/hydrargyri-each.d.ts`, wired through
  `types` and the `exports` map — TS consumers had implicit `any` until now. The
  declarations import `HgElement` from the peer, so they resolve once a hydrargyri
  release carries its own; until then editors fall back to what they had.

### Changed

- **A repaint parses each distinct `bind` string once ever, not once per node per
  paint.** Row binds are read at every paint by design — no per-row parse state to go
  stale — but the grammar work was redone for every bound node of every row, a
  thousand-row list re-parsing the same handful of strings on each repaint. Parses now
  cache by the string itself, which also means a malformed row bind warns once instead
  of flooding the console on a repainting list.

### Fixed

- **A list model wrapping plain items no longer paints every row once per row.** Items
  read through the list's own `reactive()` proxy share its subscriber set, and each row
  subscribed to its item on top of that — so one mutation repainted the region and then
  echoed through every row's subscription, once per row, each echo scanning the region
  for its row. A row subscription that would only echo the list's is now undone at the
  paint that made it: one mutation, one repaint of the settled list. An item that is a
  reactive model of its own keeps its private subscribers and its row-alone repaint.

## [2.0.0] - 2026-08-09

### Added

- **Per-row repaint for items that are their own `reactive()` models.** Every paint of
  the list repainted every row's binds, however little had changed — a push rewrote the
  rows already standing, and a mutation inside one item rewrote all of them (or, for an
  item that was its own reactive model, none: its notifications had no subscriber and
  went nowhere). hg-each now subscribes each row to its item when the item is a
  `reactive()` model of its own: `item.name = '…'` repaints that one row alone, and a
  keyed paint skips the standing rows whose item and position are unchanged — a push
  touches the new row, a pop the leaving one. Primitives get the same skip, since an
  unchanged value in an unchanged place has nothing new to paint. Plain-object items keep
  the full repaint on purpose: they cannot report their own mutations, so skipping them
  would let `list[0].name = '…'` through the list's proxy go stale. Rows whose position
  shifts still repaint — `$index` is part of what a row shows.

### Changed

- **The peer floor is now hydrargyri 2.0.0, and a 1.x core no longer works.** Upgrade the
  pair together — `npm install hydrargyri@2 hydrargyri-each@2` — and from a CDN move the
  import map to the 2.x build, since the whole page shares that one copy. What forced it
  is below: the row wiring calls `_wireHandlers`, which 2.0.0 is the first release to
  have, and the key warnings now trust its batching to hand them a settled list. Nothing
  in the markup contract moved — `items`, `key`, `template`, `hg-row`, `hgItem` and the
  fallthrough rules are what they were — so a page whose core is already 2.x upgrades by
  version number alone.

- **Row listeners wire once, when the row arrives — no more full rescan per paint.**
  Every paint tore down every listener the element held and rescanned the whole subtree
  to wire them back, rows that had not moved included. A paint now wires only the fresh
  rows through the peer's `_wireHandlers` and prunes the listeners whose nodes left with
  last paint's — standing rows keep the listeners they already have. The version before
  this one carried both paths and picked one at paint time, because the core it wanted
  was unreleased; 2.0 released it, so the rescan fallback is gone rather than dormant.

- **A key warning is said at the paint that saw it again, not at the end of the task.**
  1.0.1 held both key messages back because a `reactive()` splice repainted once per
  element it shifted, and each of those intermediate arrays held an item in two slots —
  a duplicate the author never wrote. The 2.x core folds that whole burst into one
  repaint of the settled list, so there is no intermediate array left to misread and
  nothing to defer past: the warnings are synchronous, and the paint that cancels a
  pending one is gone with the field that held it. What changes for a test: after an
  assignment or `update()` the warning is there immediately, no microtask needed; after
  a `reactive()` mutation one `await null` still comes first, because the repaint itself
  is now what waits.

## [1.0.1] - 2026-08-05

### Fixed

- **A keyed list no longer calls a `reactive()` splice a duplicate-key mistake.** Removing
  an item from a keyed list printed _"has a duplicate key"_ once, about a list that was
  correct before and after. A `reactive()` mutation is not one repaint: `splice` notifies
  once per element it shifts, and each of those intermediate arrays holds the item it just
  copied in both its old slot and its new one — a duplicate the author never wrote, seen by
  a paint the author never asked for. Both key warnings now wait for the end of the task,
  and a paint that ends with every key accounted for cancels the pending message; a
  duplicate or an unresolvable key path still standing when the mutation finishes still
  warns, once per element as before. Painting itself is unchanged and still synchronous —
  only the message moved. A test asserting on `console.warn` immediately after a mutation
  now needs a microtask first.

## [1.0.0] - 2026-08-05

### Added

- **`<hg-each>` — list rendering for hydrargyri.** Clones its `<template>` child once per item
  of the `items` property, painting row binds with the hydrargyri grammar — paths resolved into
  the item, `bind="."` for the item itself, names never code. Everything beside the
  template inside its parent is the rows region: server-rendered fallback rows stand
  until `items` first arrives, so the page reads without the script, and every paint
  after clears and re-clones it. `null` and `[]` paint no rows; a non-array warns and touches nothing;
  a `reactive()` array repaints on mutation. A missing `<template>`, or one holding no element
  to clone, warns and leaves the markup as authored — a broken list degrades to the
  server-rendered one, never to an empty container.
- **Rows carry their coordinates.** Each row root wears `hg-row="<index>"` as an
  attribute — a styling hook too — and the item itself as a `hgItem` property, for
  handlers reached through `closest('[hg-row]')`.
- **`on` and named conditions fall through.** A handler or `#condition` no row or hg-each
  itself answers is asked of the closest hydrargyri ancestor — the element that owns the data
  usually owns what rows do. An hg-each ancestor passes it on again; nobody answering warns,
  as in hydrargyri.
- **`key` — rows that keep their key keep their nodes.** `key="id"` names a path into the
  item, `key="$key"` an object's own keys, `key="."` the item itself; a repaint then moves
  the real nodes into the new order and repaints them in place, clones only for new keys
  and drops the rows whose keys are gone, so focus and a half-typed input survive. Nothing
  diffs a shadow copy of the DOM. Without the attribute every repaint re-clones, as before.
  A duplicate key, or a path resolving to nothing, warns once per element and falls back to
  cloning.
- **`items` takes a plain object.** One row per entry in `Object.entries` order, the value
  as the item and the key as `$key`. `{}` paints none, like `[]`; a `Map`, a `Set` or a
  class instance still warns, because what an "entry" means there is its own question.
- **Row coordinates in the `$` namespace.** `bind="$index"` is the row's position and
  `bind="$key"` its object key — nothing over an array. A plain name always means a field
  of the item, so an item carrying its own `$index` never shadows the coordinate, and any
  other `$` name warns rather than resolving to nothing. `hg-row` keeps holding the
  position, over objects included.
- **`template="id"` clones a template from elsewhere on the page**, for row markup two
  lists share. The id is bare, as in `list=` and `for=`, and it is resolved at the first
  paint rather than at upgrade, so the template may be authored after the element that
  uses it. With no template inside to divide it, the whole of hg-each becomes the rows
  region: its own binds belong outside, and an inline `<template>` beside the attribute
  warns because the first paint would clear it away.
- **The [template](https://github.com/stamat/template) scaffolding.** CI on Node 22 and
  24, publishing over OIDC on a `v*` tag, issue forms, Dependabot, `.editorconfig`, and
  `AGENTS.md` symlinked as `CLAUDE.md` and `.github/copilot-instructions.md`.
