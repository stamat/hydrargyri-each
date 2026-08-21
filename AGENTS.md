# hydrargyri-each — agent notes

`<hg-each>` clones its `<template>` child once per item of `items`, painting
row binds through the hydrargyri grammar — names, never code. Read
[CONTRIBUTING.md](CONTRIBUTING.md) first — it defines what belongs in this
project and what a pull request needs.

Stack: vanilla ES modules, no framework and no TypeScript. Jest with jsdom,
built with [poops](https://github.com/stamat/poops). One peer dependency,
[hydrargyri](https://github.com/stamat/hydrargyri), 2.2.0 or newer — and it must stay a peer: two hydrargyri
copies keep two element registries and nesting scope breaks silently, which is
also why `poops.json` marks hydrargyri `external` for `dist/`.

## Commands

```bash
script/bootstrap # npm ci, from a fresh clone
script/build     # compiles dist/
script/test      # jest
script/lint      # eslint (the authority; CI runs it)
```

## Layout

- The library is one file, `src/scripts/hydrargyri-each.js`. Its test sits beside
  it as `src/scripts/hydrargyri-each.test.js`.
- `dist/` is committed; never edit it by hand.
- The README is the manual — there is no docs site. A behaviour change lands
  in the README section that covers it, same change.

## Principles

- **The template is the author's; the rows region is hg-each's.** Everything
  beside the template inside its parent is repainted every time — the whole of
  hg-each when `template="id"` points outside — and nothing else in the markup
  is ever touched.
- **Names, never code.** Row binds are parsed by hydrargyri's exported
  `parseBinds` — imported, never copied, so the grammar cannot fork.
- **Test-driven.** The test is the spec; write it first. Never weaken, skip,
  or delete a test to make it pass.
- **YAGNI, root cause, delete dead code** — as everywhere.

## Boundaries

- **Always:** run `script/lint` and `script/test` before calling work done;
  pair every fix or feature with a test; add a changelog entry under
  `## [Unreleased]`; keep the README section that covers a changed behaviour
  in the same diff.
- **Ask first:** the `items` contract, the rows-region rule, the `hg-row` /
  `hgItem` names, the `hg-each` tag, anything `key` — public API all of it;
  adding a dependency.
- **Never:** edit `dist/` (generated); bump the version or publish — a tag
  does that.

## Non-obvious rules

- **`_paint` hands the region over on first data, not on init.** The declared
  default `null` leaves the fallback rows standing; the gate is
  `_painted || _assigned.has('items') || items !== null`, because
  `_applyShared` erases the assigned mark right after writing — drop a clause
  and either share() stops painting or the fallback dies at init.
- **Keys are read back off the row roots, never kept in a field.** `_keyedRows`
  rebuilds the map from `hgKey` on the elements standing in the region, so a
  row the page removed takes its entry with it and no map goes stale. A row
  whose key is duplicated or missing is painted without `hgKey`, which keeps it
  out of the next paint's map.
- **The external template is resolved after the no-data gate in `_paint`, not
  in `_init`.** The element upgrades as the parser reaches it, so a
  `<template id>` further down the page does not exist yet; looking it up
  before the gate makes the init paint report it missing. The warn fires once
  per element for the same reason.
- **`_scanningBinds` is a flag, not a `_scope` override, on purpose.** The
  instance bind scan must skip the rows region (row binds are item-relative
  and would warn as unknown keys) while the handler scan must keep it (row
  `on` routes through `_handle`). Both scans share `_scope`.
- **Row listeners wire incrementally, never by rescan.** `_wireRows` prunes the
  listeners whose node left with last paint's rows and wires the fresh rows
  only — standing rows keep the listeners they have. `_wireNode` is the single
  door: it wires one node's `on` pairs and the `static wires` specs that named
  it, stamping every entry with the node that wired it, and the prune reads
  that stamp — by target alone a row's `@window` listener is unattributable,
  and the prune kept a fresh copy per repaint. Nothing here may reach for
  `_scanHandlers`: it tears down all of `_listeners`, the `command` listener
  `_init` wired outside the scan included, and Invoker Commands would die on
  the first repaint. The prune spares it because it sits on hg-each itself,
  unstamped.
- **`_wireNode` parses the `on` attribute itself rather than delegating to the
  peer's `_wireHandlers`.** Both jobs need the parsed pairs — wiring them, and
  knowing which keys the markup already claimed so a wires pair skips them — and
  a second parse would warn twice about one typo. Its return value is the
  markup's pair keys: hydrargyri 2.2.0 asks the `_wireHandlers` override for
  exactly that, so the local `pairKey` must keep spelling a pair the way the
  peer does.
- **A `reactive()` mutation repaints at microtask time, not on the spot** —
  the peer folds a whole synchronous burst into one repaint of the settled
  list. A test mutating a model asserts after `await null`; an assignment or
  `update()` is still synchronous and asserts immediately.
- **Row painting happens after insertion.** Scope is `closest()`: only the
  attached tree can say a nested hydrargyri element owns its own binds.
- **`bind="."` arrives from `parseBinds` as `['', '']`** — the one shape a
  real path cannot take; `resolve()` special-cases it as the item itself.
- **Row subscriptions are rebuilt on every `_paint`, keyed `$row:<index>`.**
  The sweep at the top of `_paint` drops them before the loop re-subscribes
  what stands — remove it and a replaced `items` leaves vanished rows' models
  repainting the element forever. The skip that spares an unchanged row is
  legal only for a reactive or primitive item; a plain object's row must
  repaint every paint, or mutation through the list's proxy goes stale.
