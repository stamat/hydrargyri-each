import { HgElement, parseBinds } from 'hydrargyri'

// Plain objects only, the same gate `reactive()` keeps: a Map, a Set or a class
// instance has an iteration order and a meaning of "entry" that are its own,
// and guessing one is how a list quietly paints the wrong thing. A reactive()
// proxy passes — the prototype it reports is its target's.
function isPlainObject(value) {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

// A row's coordinates, reachable by name. `$` opens a namespace no item field
// can collide with — the item always wins a plain name, a coordinate always
// wins a `$` one.
const COORDINATES = new Map([['$index', 'index'], ['$key', 'key']])

// Row binds are read at every paint, unlike the peer's, which parse once at
// scan — so the grammar work is cached by the string itself: a thousand-row
// repaint parses each distinct bind attribute once ever, and a malformed one
// warns once instead of once per repaint. The entries are shared and no
// caller mutates them. The strings come from authored markup, so the map
// stays small; the cap is for a generated page that manufactures them.
const parsedBinds = new Map()
function parseRowBinds(raw) {
  let entries = parsedBinds.get(raw)
  if (!entries) {
    if (parsedBinds.size >= 1000) parsedBinds.clear()
    entries = parseBinds(raw)
    parsedBinds.set(raw, entries)
  }
  return entries
}

// `bind="."` parses to ['', ''] — the only shape a real path cannot take —
// and means the item itself, the Mustache implicit iterator.
function resolve(row, path) {
  if (path.length === 2 && path[0] === '' && path[1] === '') return row.item
  if (path.length === 1 && COORDINATES.has(path[0])) return row[COORDINATES.get(path[0])]
  // Anything else in the `$` namespace is a name hg-each does not carry —
  // `$parent` and friends warn here rather than resolving into the item and
  // painting nothing, because there is no scope chain to reach for.
  if (path[0].startsWith('$')) {
    console.warn(`hydrargyri-each: <hg-each> has no row coordinate "${path.join('.')}" — ${[...COORDINATES.keys()].join(' and ')} are the only ones`)
    return undefined
  }
  return path.reduce((value, key) => value !== null && value !== undefined ? value[key] : undefined, row.item)
}

/**
 * `<hg-each>` — list rendering for hydrargyri. Clones a `<template>` — its own child,
 * or the one `template="id"` names — once per entry of the `items` array or
 * object, painting the clone's binds with paths resolved into the item, plus
 * the `$index` and `$key` coordinates — names, never code, same grammar as
 * hydrargyri.
 *
 * Everything beside the template inside its parent is the rows region, hg-each's
 * to clear and repaint — the whole of hg-each when the template is external.
 * Server-rendered fallback rows stand until items first arrives, so the page
 * reads without the script. A repaint re-clones from scratch unless `key` names
 * what makes a row itself, and then the rows that keep their key keep their
 * nodes.
 *
 * @example
 * <hg-each>
 *   <ul>
 *     <template><li bind="name"></li></template>
 *     <li>Server-rendered fallback</li>
 *   </ul>
 * </hg-each>
 * document.querySelector('hg-each').items = [{ name: 'Ada' }]
 */
export default class HgEach extends HgElement {
  static properties = ['items']

  constructor() {
    super()
    this._template = null
    this._painted = false
    this._scanningBinds = false
  }

  _init() {
    // A template named by id is resolved at the first paint, never here: the
    // element upgrades as the parser reaches it, and a `<template id>` further
    // down the page does not exist yet.
    if (this.hasAttribute('template')) {
      if (this._findTemplate()) {
        console.warn('hydrargyri-each: <hg-each> has both a <template> child and template="…" — the attribute wins, and the child stands in the rows region the first paint clears')
      }
    } else {
      this._template = this._usable(this._findTemplate())
      if (!this._template) {
        console.warn('hydrargyri-each: <hg-each> has no <template> child — markup left as authored')
      }
    }
    super._init()
  }

  _findTemplate() {
    for (const template of this.querySelectorAll('template')) {
      if (this._scope(template)) return template
    }
    return null
  }

  // Row binds live on elements, so a template of text alone can only paint that
  // text once per item. Null takes the no-template path: one bail, and the
  // fallback rows stay standing.
  _usable(template) {
    if (!template) return null
    if (!template.content.firstElementChild) {
      console.warn('hydrargyri-each: <hg-each> template has no element to clone — markup left as authored')
      return null
    }
    return template
  }

  // Re-looked-up on every paint, because the page may have grown the template
  // since the last one — but warned about only once, or a repainting list turns
  // one authoring mistake into a console full of them.
  _findById() {
    const id = this.getAttribute('template')
    const root = this.getRootNode()
    const found = typeof root.getElementById === 'function' ? root.getElementById(id) : null
    if (!found || found.tagName !== 'TEMPLATE') {
      if (!this._warnedById) {
        console.warn(`hydrargyri-each: <hg-each template="${id}"> found ${found ? 'no <template>' : 'no element'} with that id — markup left as authored`)
        this._warnedById = true
      }
      return null
    }
    return this._usable(found)
  }

  // With an external template there is no "beside the template" inside hg-each,
  // so hg-each itself is the region — everything in it is rows, its own binds
  // and an empty-state node included, which is why they belong outside.
  _regionParent() {
    if (this.hasAttribute('template')) return this
    return this._template && this._template.parentNode
  }

  // Rows carry item-relative binds painted per clone in _paint — the instance
  // scan must not read them (their first segment is an item field, not element
  // state, and would warn) — while the handler scan must, because row `on`
  // routes through _handle. One scan skips the rows region, the other keeps
  // it, hence the flag rather than a plain _scope override.
  _scanBinds() {
    this._scanningBinds = true
    super._scanBinds()
    this._scanningBinds = false
  }

  _scope(el) {
    if (this._scanningBinds && this._inRows(el)) return false
    return super._scope(el)
  }

  _inRows(el) {
    const parent = this._regionParent()
    if (!parent || el === parent || !parent.contains(el)) return false
    let node = el
    while (node && node.parentNode !== parent) node = node.parentNode
    return !!node && node !== this._template
  }

  update(key) {
    // A `$row:i` key arrives from a row's own subscription — one reactive
    // item's mutation — and repaints that row alone, never the region.
    if (typeof key === 'string' && key.startsWith('$row:')) return this._paintRowAt(+key.slice(5))
    super.update(key)
    if (this._initialized && (!key || key === 'items')) this._paint()
  }

  // The row is found by the hg-row it wears and painted from the coordinates
  // it carries, so the other rows keep whatever the DOM holds for them. Roots
  // are looked up at call time, never remembered: a paint may have re-cloned
  // the row since the subscription was made. The lookup walks the region's
  // children, so one mutation pays O(rows) and a burst mutating every row
  // O(rows²) — an index map is the upgrade if a profile ever says so.
  _paintRowAt(index) {
    const parent = this._regionParent()
    if (!parent) return
    const at = String(index)
    for (const root of parent.children) {
      if (root === this._template || root.getAttribute('hg-row') !== at) continue
      this._paintRow(root, { item: root.hgItem, index, key: root.hgKey })
    }
  }

  _paint() {
    // The declared default null is "no data yet" and the fallback rows stand.
    // The region is hg-each's from the author's first assignment — even of
    // null — or from a value already present at init, the share() path, whose
    // application erases the assigned mark before this runs.
    if (!this._painted && !this._assigned.has('items') && this.items === null) return
    // Looked up after that gate, never before: the paint that runs during init
    // has no data yet, and a template authored further down the page would be
    // reported missing while the parser is still on its way to it.
    if (this.hasAttribute('template')) this._template = this._findById()
    if (!this._template) return
    const items = this.items
    if (items !== null && !Array.isArray(items) && !isPlainObject(items)) {
      console.warn('hydrargyri-each: <hg-each> items takes an array, a plain object or null — rows left standing')
      return
    }
    const entries = []
    if (Array.isArray(items)) {
      // forEach, not map: a hole in a sparse array is not an item, and forEach
      // skips holes where map keeps them as undefined rows.
      items.forEach((item, index) => entries.push({ item, index, key: undefined }))
    } else if (items) {
      Object.entries(items).forEach(([key, item], index) => entries.push({ item, index, key }))
    }
    this._painted = true
    const parent = this._regionParent()
    // Row subscriptions are rebuilt with the rows: whatever the last paint
    // subscribed drops here and the loop below re-subscribes what stands, so
    // a replaced items value cannot leave a vanished row's model repainting it.
    this._subscriptions = this._subscriptions.filter((sub) => {
      if (!sub.key.startsWith('$row:')) return true
      sub.subs.delete(sub.fn)
      return false
    })
    const listSub = this._subscriptions.find((sub) => sub.key === 'items')
    const inline = this._template.parentNode === parent
    // An inline template divides the region: rows are always written after it,
    // so anything before it is last paint's and goes now.
    if (inline) while (parent.firstChild && parent.firstChild !== this._template) parent.firstChild.remove()
    // Nothing but rows survives in the region — a clone carries the template's
    // own whitespace in with it, and leaving those text nodes both piles them
    // up on every repaint and puts non-rows in the way of the walk below.
    for (const child of [...parent.childNodes]) {
      if (child !== this._template && child.nodeType !== 1) child.remove()
    }
    const previous = this._keyedRows(parent)
    const claimed = new Set()
    const rows = []
    for (const row of entries) {
      const key = previous ? resolve(row, previous.path) : undefined
      // A key claimed twice, or one that resolves to nothing, identifies no row
      // — it paints as an unkeyed clone and stays out of the next paint's map,
      // because a key naming two rows would hand one row's nodes to both.
      const claimable = previous !== null && key !== undefined && !claimed.has(key)
      if (previous && key === undefined) {
        this._warnKey(`hydrargyri-each: <hg-each key="${previous.raw}"> found no key on an item — its rows are re-cloned until the path resolves`)
      } else if (previous && !claimable) {
        this._warnKey(`hydrargyri-each: <hg-each key="${previous.raw}"> has a duplicate key ${JSON.stringify(key)} — one row's nodes cannot serve two, so the later row is cloned fresh`)
      }
      let roots = claimable ? previous.rows.get(key) || null : null
      if (claimable) claimed.add(key)
      const reused = !!roots
      if (!roots) roots = [...document.importNode(this._template.content, true).children]
      // An item that is its own reactive() model gets its row subscribed to
      // it — the subscription only sticks for one, which is also the tell.
      const count = this._subscriptions.length
      this._subscribe('$row:' + row.index, row.item)
      let stuck = this._subscriptions.length > count
      // An item the list's own proxy wrapped shares the list's subscriber set,
      // so its row subscription would only echo the repaint the items
      // subscription already delivers — one mutation painting every row once
      // per row. Undone on the spot; the row then repaints with the region,
      // exactly as a plain item does.
      if (stuck && listSub && this._subscriptions[this._subscriptions.length - 1].subs === listSub.subs) {
        const sub = this._subscriptions.pop()
        sub.subs.delete(sub.fn)
        stuck = false
      }
      // A reused row whose item and place are unchanged skips its repaint —
      // but only when mutation inside the item cannot go unseen: a reactive
      // item reports its own, a primitive has no inside. A plain object only
      // ever reaches this paint through the list's notify, so its row
      // repaints every time. Judged before the stamping below overwrites the
      // evidence.
      const kept = reused && roots[0].hgItem === row.item && roots[0].getAttribute('hg-row') === String(row.index)
      const skip = kept && (stuck || row.item === null || typeof row.item !== 'object')
      for (const root of roots) {
        root.setAttribute('hg-row', row.index)
        root.hgItem = row.item
        if (claimable) root.hgKey = key
      }
      rows.push({ ...row, roots, skip, fresh: !reused })
    }
    // Walk the region against the rows it should hold: a node already in place
    // is stepped over, one that belongs earlier is moved, and whatever the walk
    // never reaches is last paint's and removed. Reused nodes that do not move
    // keep everything the DOM holds for them — focus, selection, scroll.
    // No LIS diffing: a full reversal moves every root, one insertBefore each
    // — the accepted ceiling, with the longest-stable-run upgrade waiting on
    // a list big enough to feel it.
    let cursor = inline ? this._template.nextSibling : parent.firstChild
    for (const row of rows) {
      for (const root of row.roots) {
        if (root === cursor) cursor = cursor.nextSibling
        else parent.insertBefore(root, cursor)
      }
    }
    while (cursor) {
      const next = cursor.nextSibling
      cursor.remove()
      cursor = next
    }
    // Painted after insertion, not before: scope is closest(), and only the
    // attached tree can say a nested hydrargyri element owns its own binds.
    for (const row of rows) {
      if (row.skip) continue
      for (const root of row.roots) this._paintRow(root, row)
    }
    this._wireRows(rows)
  }

  // Fresh rows wire alone and standing rows keep the listeners they already
  // have; the prune drops listeners whose node left with last paint's rows —
  // window/document targets and hg-each's own survive it.
  _wireRows(rows) {
    this._listeners = this._listeners.filter(({ el, event, listener }) => {
      if (!(el instanceof Element) || el === this || this.contains(el)) return true
      el.removeEventListener(event, listener)
      return false
    })
    for (const row of rows) {
      if (!row.fresh) continue
      for (const root of row.roots) {
        for (const node of [root, ...root.querySelectorAll('[on],[data-on]')]) {
          if (super._scope(node)) this._wireHandlers(node)
        }
      }
    }
  }

  // The keys are read back off the row roots rather than kept in a field: a row
  // the page removed takes its entry with it, so there is no map to go stale,
  // and a reconnect finds exactly the nodes that are still standing.
  _keyedRows(parent) {
    const raw = this.getAttribute('key')
    if (!raw) return null
    const rows = new Map()
    for (const node of parent.children) {
      if (node === this._template || !('hgKey' in node)) continue
      const roots = rows.get(node.hgKey)
      if (roots) roots.push(node)
      else rows.set(node.hgKey, [node])
    }
    // `key="."` splits to ['', ''], the shape resolve() reads as the item
    // itself, and `key="$key"` to a coordinate — both for free, same grammar.
    return { raw, path: raw.split('.'), rows }
  }

  // Once per element: a keying mistake is the same mistake on every repaint,
  // and a list that repaints on every keystroke would say so on every keystroke.
  // Said at the paint that saw it — the peer coalesces a reactive() mutation
  // into one repaint of the settled list, so no paint ever walks an
  // intermediate array holding an item in two slots.
  _warnKey(message) {
    if (this._warnedKey) return
    this._warnedKey = true
    console.warn(message)
  }

  _paintRow(root, row) {
    const nodes = [root, ...root.querySelectorAll('[bind],[data-bind]')]
    for (const node of nodes) {
      const raw = node.getAttribute('bind') || node.getAttribute('data-bind')
      if (!raw || !super._scope(node)) continue
      for (const entry of parseRowBinds(raw)) {
        this._render({ ...entry, el: node }, resolve(row, entry.path))
      }
    }
  }

  // What neither a method nor the registry answers walks up: the closest
  // hydrargyri ancestor owns the data the rows render, so it usually owns their
  // handlers too. An hg-each ancestor passes it on again.
  _handle(name, e) {
    if (typeof this[name] === 'function' || typeof this.handlers[name] === 'function') {
      return super._handle(name, e)
    }
    const owner = this._hgAncestor()
    if (owner) return owner._handle(name, e)
    super._handle(name, e)
  }

  // The mirror of _handle for `if#name` and `unless#name`: a condition hg-each
  // does not hold is asked of the closest hydrargyri ancestor — whose own _render
  // walks on if it is an hg-each too, so the warn lands on the last hop.
  _render(bind, value) {
    if (bind.attr && (bind.type === 'if' || bind.type === 'unless') && typeof this.conditions[bind.attr] !== 'function') {
      const owner = this._hgAncestor()
      if (owner) return owner._render(bind, value)
    }
    return super._render(bind, value)
  }

  _hgAncestor() {
    let node = this.parentElement
    while (node && !(node instanceof HgElement)) node = node.parentElement
    return node
  }
}

// Importing without a DOM — a server bundle, a test runner without jsdom —
// must not crash; it only means no element gets defined.
if (typeof customElements !== 'undefined' && !customElements.get('hg-each')) {
  customElements.define('hg-each', HgEach)
}
