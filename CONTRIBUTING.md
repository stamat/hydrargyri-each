# Contributing to hydrargyri-each

Issues and pull requests are welcome. Taking part means keeping to the
[Code of Conduct](CODE_OF_CONDUCT.md).

hydrargyri-each is one idea kept small: a row per item, cloned from a `<template>`
the author wrote, painted through the hydrargyri `bind` grammar — names, never
code. It is the templating door hydrargyri refuses to open in its own house; being
a separate package is what lets that refusal stand. A change that grows this
idea is welcome; a change that grows the surface is probably for a different
library.

## What hydrargyri-each refuses to become

- **No expression language.** Row binds are paths into the item, parsed by
  hydrargyri's own `parseBinds` — the parser is imported, never copied, so the
  grammar cannot fork here.
- **No virtual DOM.** The one open door is keyed reuse: `key` is reserved so a
  future version can move and patch existing row nodes instead of re-cloning.
  Moving real nodes, ever; diffing a shadow copy of them, never.
- **No list operations.** Sorting, filtering, pagination, grouping — the array
  is the author's, transformed in JS and assigned. The moment an attribute
  orders a list, it is a query language.
- **No scope chain.** A row resolves names against its item, full stop. An
  inner hg-each's rows do not see the outer item; an "index" or "parent"
  variable is the first step toward a template language.
- **No two-way binding and no shadow DOM** — inherited from hydrargyri, same
  reasons.
- **No dependencies.** hydrargyri is a peer, and the only one. It must be a peer:
  two copies of hydrargyri keep two element registries, and nesting scope silently
  breaks across them — which is also why `dist/` marks hydrargyri external.

## Threat model

Same contract as hydrargyri: bind values are the author's state, not user input.
`:html` in a row is `innerHTML`, verbatim — sanitizing is out of scope.
`text` binds go through `textContent` and `attr` binds through
`setAttribute`, so payloads arriving there cannot become elements —
`hydrargyri-each.test.js` holds a test proving markup through a row text bind
stays text. A PR touching row painting keeps that test green.

## Getting set up

```bash
git clone https://github.com/stamat/hydrargyri-each.git
cd hydrargyri-each
script/bootstrap
```

```bash
script/build     # compiles dist/
script/test      # jest
script/lint      # eslint
```

The library is one file, `src/scripts/hydrargyri-each.js`, with its test beside it.
`dist/` is committed and never edited by hand.

## Reporting a bug

[Open an issue](../../issues/new/choose) — the form asks for what you ran, what
you expected, the version and the environment. Anything about rows needs the
markup and the JavaScript together — the template, the fallback rows and the
`items` assignment — because either half alone reproduces nothing.

## Pull requests

- **A test per change**, in `src/scripts/hydrargyri-each.test.js`. Test names are
  sentences stating the guarantee. A failing test means the code is wrong —
  never weaken or delete one to make it pass; if the test itself is wrong, say
  so in the PR and let review decide.
- **Docs in the same change.** The README is the manual — a new behaviour
  lands in the section that covers it, in the same PR.
- **Progressive enhancement intact.** Every sample must read sensibly with the
  script blocked — that is what the fallback rows are for.
- **Run `script/lint`.** eslint is the authority, and CI runs it on Node 22
  and 24.
- **Add a changelog entry** under `## [Unreleased]` in
  [CHANGELOG.md](CHANGELOG.md) — that file explains the format.
- **Keep the diff about one thing.** A rename bundled with a fix is two
  reviews wearing one hat.
- **Agent-written code is welcome — you still own it.** It meets the same bar
  as handwritten code: tests, lint, CI green. You understand every line well
  enough to answer review questions; "the agent wrote it" is not an answer.
  Point your agent at [AGENTS.md](AGENTS.md) before it starts.

Commit messages are freeform, write something that says what changed.

## How a release works

`script/publish [version]` bumps `package.json`, runs `script/changelog` to cut
`[Unreleased]` into a released entry, builds, commits, tags and pushes. Pushing
the tag triggers [publish.yml](.github/workflows/publish.yml), which publishes
to npm via trusted publishing — OIDC, no tokens stored anywhere. The changelog
entry becomes the body of the GitHub release verbatim.
