# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**How to use it:** land changes under `## [Unreleased]`, grouped under _Added_, _Changed_,
_Deprecated_, _Removed_, _Fixed_ or _Security_. Write entries for the person upgrading, not
for the person who wrote the code.

## [Unreleased]

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
- **`key` reserved, doing nothing.** Repaints are naive re-clone, which discards row DOM
  state — focus, half-typed input. The attribute is claimed now so the keyed version is
  not a breaking change later.
- **The [template](https://github.com/stamat/template) scaffolding.** CI on Node 22 and
  24, publishing over OIDC on a `v*` tag, issue forms, Dependabot, `.editorconfig`, and
  `AGENTS.md` symlinked as `CLAUDE.md` and `.github/copilot-instructions.md`.
