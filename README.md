# <sup>☿</sup> hydrargyri-each

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

|                                                                                     | Template lives in | Logic in markup            | Keyed reorder           | No-script fallback       | Pick it when                                    |
| ----------------------------------------------------------------------------------- | ----------------- | -------------------------- | ----------------------- | ------------------------ | ----------------------------------------------- |
| [Alpine `x-for`](https://alpinejs.dev/directives/for)                               | the page          | yes — evaluated JS         | yes, `:key`             | yes, template is inert   | you want expressions inline and accept the eval |
| [Lit `repeat`](https://lit.dev/docs/templates/lists/)                               | JS                | no — logic is JS anyway    | yes, key function       | no — JS renders the list | you are building an app, not upgrading a page   |
| [Stimulus](https://stimulus.hotwired.dev/handbook/origin)                           | the server        | no                         | no — server re-renders  | yes, by definition       | the server owns every list change               |
| [`<template>` alone](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template) | the page     | no                         | you write it            | yes                      | one list, and you enjoy `importNode`            |
| hg-each                                                                              | the page          | no — names, never code     | **no — naive re-clone** | yes                      | the markup exists first and hydrargyri is already on the page |

hg-each loses the keyed-reorder row on purpose, for now: every repaint clears
the rows and clones again, which discards row DOM state — focus, a
half-typed input, a playing video. A `key` attribute is reserved for the keyed
version and does nothing yet. Until it exists, a list the user types into
while it repaints wants Alpine or Lit.

## Install

Not on npm yet — the commands below describe the shape of the release, not a
package you can pull today.

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
  { "imports": { "hydrargyri": "https://cdn.jsdelivr.net/npm/hydrargyri/dist/hydrargyri.mjs" } }
</script>
<script type="module">
  import "https://cdn.jsdelivr.net/npm/hydrargyri-each/dist/hydrargyri-each.mjs";
</script>
```

## The contract

**`items` takes an array or `null`.** The property starts `null`, meaning "no
data yet" — the fallback rows stand. From your first assignment the rows
region belongs to hg-each: an array paints a row per item, `null` or `[]`
paints none, anything else warns and touches nothing. Assign a
[`reactive()`](https://stamat.github.io/hydrargyri/docs/api.html#reactivemodel)
array and mutation repaints — `items.push(...)` grows a row, no second call.

**The template's element siblings are the rows region.** Everything beside the
`<template>` inside its parent is hg-each's to clear and repaint — fallback
rows before the first paint, clones after. Content that must survive goes
outside the template's parent:

```html
<hg-each>
  <p bind="items.length">3</p>   <!-- hg-each's own bind, safe here -->
  <ul>
    <template><li bind="."></li></template>
    <li>fallback</li>             <!-- rows region: replaced at first paint -->
  </ul>
</hg-each>
```

`<template>` is script-supporting content, valid directly inside `<ul>`,
`<tbody>`, `<select>` — hg-each wraps the list container; it can never sit
between `<ul>` and its `<li>`s, that is not valid HTML.

**Binds in rows resolve into the item.** The full hydrargyri grammar —
`path[:type[#attr]][;more]`, so `text`, `html`, `value`, `attr#name`, `if`,
`unless` all work — with paths walked from the item: `bind="user.name"` reads
`item.user.name`. `bind="."` is the item itself, for arrays of primitives. A
path that hits nothing leaves the node as authored, exactly like hydrargyri. There
is no index bind and no scope chain: a row sees its item, not the enclosing
hg-each's, and numbering wants a CSS counter.

**Each row root carries its coordinates.** `hg-row="0"` (the index, also a
styling hook) as an attribute, the item itself as a `hgItem` property:

```js
handlers: {
  remove(e, el) {
    const row = e.target.closest("[hg-row]");
    el.list.splice(+row.getAttribute("hg-row"), 1); // reactive() repaints
  }
}
```

**`on` and `#conditions` in rows fall through to the closest hydrargyri ancestor.**
hg-each defines no handlers of its own, and the element that owns the data
usually owns what rows do — so `on="click:remove"` inside a row asks hg-each
first, then the hydrargyri element above it, and the handler receives the element
it was found on. Named conditions (`bind="done:if#overdue"`) resolve the same
way. No ancestor answering warns, as in hydrargyri.

## What hg-each does not do

- **Keyed diffing, yet.** Naive re-clone; `key` is reserved. Row DOM state
  does not survive a repaint — said above, worth saying twice.
- **Sorting, filtering, pagination.** The array is yours: transform it in JS
  and assign the result. An option here would be a query language growing in
  an attribute.
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
