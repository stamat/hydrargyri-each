# ☿ hydrargyri-each [![npm version](https://img.shields.io/npm/v/hydrargyri-each)](https://www.npmjs.com/package/hydrargyri-each) [![ci](https://img.shields.io/github/actions/workflow/status/stamat/hydrargyri-each/ci.yml?branch=main&label=ci)](https://github.com/stamat/hydrargyri-each/actions/workflows/ci.yml) [![license mit](https://img.shields.io/badge/license-MIT-green)](https://github.com/stamat/hydrargyri-each/blob/main/LICENSE)

> List rendering for [hydrargyri](https://github.com/stamat/hydrargyri) — `<hg-each>`
> clones the `<template>` you wrote, one row per item, binding by names, never
> code.

Lists are where markup-first breaks down. You can write every state of a
counter into the page, but not a row per item of an array you have not seen —
somebody has to create nodes. Every library that does it makes one of two
moves: evaluate an expression out of your markup (Alpine's
`x-for="(color, index) in colors"` is JavaScript in an attribute), or make
JavaScript the source of the markup (Lit's templates live in the render
method). Hydrargyri refuses both, which is why
[it refuses templating entirely](https://github.com/stamat/hydrargyri/blob/main/CONTRIBUTING.md)
— and why this package exists outside it. `<hg-each>` is the one door, kept in
its own repo so the refusal in hydrargyri stands unamended.

The template is yours, in the page, and the binds in it carry names resolved
against each item — the same `bind` grammar as hydrargyri, parsed by hydrargyri:

```html
<hg-each>
  <ul>
    <template>
      <li><b bind="name"></b> — <span bind="role">member</span></li>
    </template>
    <li><b>Ada</b> — <span>admin</span></li>
  </ul>
</hg-each>
```

```js
import "hydrargyri-each";

document.querySelector("hg-each").items = [
  { name: "Ada", role: "admin" },
  { name: "Grace" },
];
```

That server-rendered `<li>Ada</li>` is not an example — it is the page working
before the script arrives. `<template>` renders nothing by itself, so the
scriptless reader gets the fallback rows, and the first assignment of `items`
replaces them.

## Against the alternatives

|                                                                                          | Template lives in | Logic in markup         | Keyed reorder          | No-script fallback       | Pick it when                                                  |
| ---------------------------------------------------------------------------------------- | ----------------- | ----------------------- | ---------------------- | ------------------------ | ------------------------------------------------------------- |
| [Alpine `x-for`](https://alpinejs.dev/directives/for)                                    | the page          | yes — evaluated JS      | yes, `:key`            | yes, template is inert   | you want expressions inline and accept the eval               |
| [Lit `repeat`](https://lit.dev/docs/templates/lists/)                                    | JS                | no — logic is JS anyway | yes, key function      | no — JS renders the list | you are building an app, not upgrading a page                 |
| [Stimulus](https://stimulus.hotwired.dev/handbook/origin)                                | the server        | no                      | no — server re-renders | yes, by definition       | the server owns every list change                             |
| [`<template>` alone](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template) | the page          | no                      | you write it           | yes                      | one list, and you enjoy `importNode`                          |
| hg-each                                                                                  | the page          | no — names, never code  | yes, `key`             | yes                      | the markup exists first and hydrargyri is already on the page |

Keyed reorder is opt-in and off by default: without `key` every repaint clears
the rows and clones again, which discards row DOM state — focus, a half-typed
input, a playing video. With `key` the rows that keep their key keep their
nodes, and a list the user is typing into survives its own repaints.

## Install

Needs [hydrargyri](https://github.com/stamat/hydrargyri) 2 or newer as a peer — the row
wiring and the key warnings both rest on what 2.0 added.

```bash
npm install hydrargyri hydrargyri-each
```

```js
import "hydrargyri-each"; // defines <hg-each>; hydrargyri is a peer, installed beside it
```

From a CDN, `dist/` keeps hydrargyri external, so an import map says where the one
shared copy lives — two copies of hydrargyri cannot see each other's elements:

```html
<script type="importmap">
  {
    "imports": {
      "hydrargyri": "https://cdn.jsdelivr.net/npm/hydrargyri/dist/hydrargyri.mjs"
    }
  }
</script>
<script type="module">
  import "https://cdn.jsdelivr.net/npm/hydrargyri-each/dist/hydrargyri-each.mjs";
</script>
```

## The contract

**`items` takes an array, a plain object or `null`.** The property starts
`null`, meaning "no data yet" — the fallback rows stand. From your first
assignment the rows region belongs to hg-each: an array paints a row per item
and an object one per entry, in `Object.entries` order, with the value as the
item and the key reachable as `$key`. `null`, `[]` and `{}` paint none;
anything else — a string, a `Map`, a class instance — warns and touches
nothing, because guessing what an entry means there is how a list quietly
paints the wrong thing. Assign a
[`reactive()`](https://stamat.github.io/hydrargyri/docs/api.html#reactivemodel)
array or object and mutation repaints — `items.push(...)` grows a row, no
second call. hydrargyri folds a synchronous burst of mutations into one repaint
at microtask time, so code reading the rows straight after a `push` or a
`splice` awaits a microtask first (`await null` is enough); assigning `items`
paints on the spot, as before.

**The template's siblings are the rows region.** Everything beside the
`<template>` inside its parent — elements, text and comments alike — is
hg-each's to clear and repaint: fallback rows before the first paint, clones
after. Content that must survive goes outside the template's parent:

```html
<hg-each>
  <p bind="items.length">3</p>
  <!-- hg-each's own bind, safe here -->
  <p bind="items.length:unless">Nothing here yet</p>
  <ul>
    <template><li bind="."></li></template>
    <li>fallback</li>
    <!-- rows region: replaced at first paint -->
  </ul>
</hg-each>
```

That second bind is the empty state, and it needs nothing new: `items.length`
is hg-each's own, `:unless` hides the node while the list has items and shows
it while it does not. `:if` is the other way round.

`<template>` is script-supporting content, valid directly inside `<ul>`,
`<tbody>`, `<select>` — hg-each wraps the list container; it can never sit
between `<ul>` and its `<li>`s, that is not valid HTML.

**A template that cannot paint rows warns and changes nothing.** No
`<template>` at all, or one holding text without an element to clone — either
way the markup stays exactly as authored, so a broken list degrades to the
server-rendered one rather than to an empty container.

**`template="id"` takes the template from elsewhere on the page**, for row
markup two lists share. The id is bare, as in `list=` and `for=` — a name, not
a selector — and it is looked up at the first paint rather than at upgrade, so
the template may be authored anywhere, including after the `<hg-each>` that
uses it:

```html
<template id="card"
  ><article><h3 bind="title"></h3></article
></template>

<hg-each template="card">
  <article><h3>Server-rendered fallback</h3></article>
</hg-each>
```

The cost is the rows region: with no template inside to divide it, **the whole
of hg-each is the region** — its own binds and an empty-state node included,
so those belong outside it, and an inline `<template>` beside the attribute
warns because the first paint would clear it away. An id naming nothing, or
naming something that is not a `<template>`, warns once and leaves the markup
as authored. This is the trade for sharing one template: an inline template
keeps a container to itself, an external one does not.

**Binds in rows resolve into the item.** The full hydrargyri grammar —
`path[:type[#attr]][;more]`, so `text`, `html`, `value`, `attr#name`, `if`,
`unless` all work — with paths walked from the item: `bind="user.name"` reads
`item.user.name`. `bind="."` is the item itself, for arrays of primitives. A
path that hits nothing leaves the node as authored, exactly like hydrargyri.

**A row's own coordinates live in the `$` namespace.** `bind="$index"` is the
position, `bind="$key"` the object key — nothing, on an array — and a plain
name always means a field of the item, so an item with an `$index` of its own
never shadows the coordinate. There is still no scope chain: a row sees its
item and its coordinates, never the enclosing hg-each's item, and any other
`$` name warns rather than resolving to nothing.

**Each row root carries those coordinates in the DOM too.** `hg-row="0"` (the
position, also a styling hook) as an attribute — the position even over an
object, where the key lives in `$key` and never in the attribute — and the
item itself as a `hgItem` property:

```js
handlers: {
  remove(e, el) {
    const row = e.target.closest("[hg-row]");
    el.list.splice(+row.getAttribute("hg-row"), 1); // reactive() repaints
  }
}
```

**`key` names what makes a row itself, and rows keep their nodes.** Without it
every repaint clones from scratch, which is fine for a list nobody is touching
and wrong for one holding focus, a half-typed input or a playing video. With
it, a row whose key comes back keeps the nodes it already had: they are moved
into the new order and repainted in place, new keys arrive as clones, and
vanished keys take their rows with them. Repainted in place has one exception,
earned by the item: a kept row whose item and position are unchanged is not
repainted at all when the item is a primitive — its value is all it is — or a
`reactive()` model of its own, which reports its mutations itself (next
paragraph). A plain object cannot report anything, so its row repaints with
every paint of the list; that is what keeps a mutation made through the list's
proxy from going stale.

**An item that is its own `reactive()` model repaints its row alone.** Make
the items reactive — `reactive([reactive({ … }), …])`, or each one before it
is pushed — and hg-each subscribes every row to its item: `item.name = '…'`
repaints that one row, and a push or a pop touches only the row it adds or
removes. This is hydrargyri's own composition rule doing the work — a nested
reactive model keeps its own subscribers — so it costs one `reactive()` call
per item and asks for no option here. Rows whose position shifts still repaint,
because `$index` is part of what a row shows.

Row listeners follow the same economy: a row's `on` wires once, when the row
arrives, and a paint touches no standing row's listeners — only the ones whose
node left with last paint's rows are dropped.

```html
<hg-each key="id">
  <!-- a path into the item -->
  <hg-each key="$key">
    <!-- the object's own keys -->
    <hg-each key=".">
      <!-- the item itself, for arrays of primitives --></hg-each
    ></hg-each
  ></hg-each
>
```

The path is the same grammar the binds use, resolved against the item, so
`key="user.id"` walks. Two rows claiming one key warns and the later one is
cloned fresh — one row's nodes cannot serve two — and a path that resolves to
nothing warns and falls back to re-cloning, both once per element rather than
once per repaint. A `reactive()` mutation cannot provoke either by accident:
hydrargyri folds a whole burst of them into one repaint of the settled list, so
no paint ever walks an intermediate array holding an item in two slots — a
`splice` reorders in silence, and what you hear about is a key you wrote twice.
`hg-row` keeps following the position, so a handler reading it after a reorder
reads where the row is now.

**`on` and `#conditions` in rows fall through to the closest hydrargyri ancestor.**
hg-each defines no handlers of its own, and the element that owns the data
usually owns what rows do — so `on="click:remove"` inside a row asks hg-each
first, then the hydrargyri element above it, and the handler receives the element
it was found on. Named conditions (`bind="done:if#overdue"`) resolve the same
way. No ancestor answering warns, as in hydrargyri.

## What hg-each does not do

- **Diffing.** `key` moves and repaints the real nodes it already has; nothing
  keeps a shadow copy of the DOM to compare against. Without `key` the rows are
  re-cloned, and row DOM state goes with them — said above, worth saying twice.
- **Sorting, filtering, pagination.** The array is yours: transform it in JS
  and assign the result. An option here would be a query language growing in
  an attribute.
- **Nested lists, declaratively.** A bind on a hydrargyri element's own root
  belongs to that element, so a bind written on an inner `<hg-each>` resolves
  against the inner element's state, never the outer row's item. A nested list
  is handed its data in JS, through the row's `hgItem`. (An ordinary custom
  element in a row is a different case: it is not a hydrargyri element, so its
  root bind is hg-each's to paint, and hydrargyri's `prop#name` hands it the
  value itself — `<my-chart bind="quarters:prop#series">` in a row carries the
  array across with no JS. Only a hydrargyri element's own root is out of
  reach, an inner `<hg-each>` included.)
- **Sanitizing.** `:html` in a row is `innerHTML`, verbatim, same threat model
  as hydrargyri: bind your own state, never user input. `text` and `attr` stay
  inert — there is a test proving markup through a text bind cannot become
  elements.
- **Creating anything but rows.** Outside the rows region hg-each is a plain
  hydrargyri element; your markup stays yours.

## Development

```bash
script/bootstrap # npm ci, from a fresh clone
script/build     # compile dist/
script/test      # jest
script/lint      # eslint
```

[CONTRIBUTING.md](CONTRIBUTING.md) says what belongs here and what a pull
request needs; [AGENTS.md](AGENTS.md) is the same for a coding agent.

## License

[MIT](LICENSE) © [Stamat](https://github.com/stamat)
