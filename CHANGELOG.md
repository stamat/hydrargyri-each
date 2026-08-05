# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**How to use it:** land changes under `## [Unreleased]`, grouped under _Added_, _Changed_,
_Deprecated_, _Removed_, _Fixed_ or _Security_. Write entries for the person upgrading, not
for the person who wrote the code.

## [Unreleased]

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
