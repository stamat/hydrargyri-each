import { HgElement, parseBinds } from 'hydrargyri'

// `bind="."` parses to ['', ''] — the only shape a real path cannot take —
// and means the item itself, the Mustache implicit iterator.
function resolve(item, path) {
  if (path.length === 2 && path[0] === '' && path[1] === '') return item
  return path.reduce((value, key) => value !== null && value !== undefined ? value[key] : undefined, item)
}

/**
 * `<hg-each>` — list rendering for hydrargyri. Clones its `<template>` child once
 * per item of the `items` property, painting the clone's binds with paths
 * resolved into the item — names, never code, same grammar as hydrargyri.
 *
 * Everything beside the template inside its parent is the rows region,
 * hg-each's to clear and repaint: server-rendered fallback rows stand until
 * items first arrives, so the page reads without the script. Every repaint
 * re-clones from scratch — `key` is reserved for the keyed version and does
 * nothing yet.
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
    this._template = this._findTemplate()
    if (!this._template) {
      console.warn('hydrargyri-each: <hg-each> has no <template> child — markup left as authored')
    }
    super._init()
  }

  _findTemplate() {
    for (const template of this.querySelectorAll('template')) {
      if (this._scope(template)) return template
    }
    return null
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
    const parent = this._template && this._template.parentNode
    if (!parent || el === parent || !parent.contains(el)) return false
    let node = el
    while (node && node.parentNode !== parent) node = node.parentNode
    return !!node && node !== this._template
  }

  update(key) {
    super.update(key)
    if (this._initialized && (!key || key === 'items')) this._paint()
  }

  _paint() {
    if (!this._template) return
    // The declared default null is "no data yet" and the fallback rows stand.
    // The region is hg-each's from the author's first assignment — even of
    // null — or from a value already present at init, the share() path, whose
    // application erases the assigned mark before this runs.
    if (!this._painted && !this._assigned.has('items') && this.items === null) return
    const items = this.items
    if (items !== null && !Array.isArray(items)) {
      console.warn('hydrargyri-each: <hg-each> items takes an array or null — rows left standing')
      return
    }
    this._painted = true
    const parent = this._template.parentNode
    // childNodes, not children: a clone carries the template's own whitespace,
    // so an element-only sweep leaves those text nodes behind to pile up on
    // every repaint.
    for (const child of [...parent.childNodes]) {
      if (child !== this._template) child.remove()
    }
    const rows = []
    if (items && items.length) {
      const fragment = document.createDocumentFragment()
      items.forEach((item, index) => {
        const clone = document.importNode(this._template.content, true)
        for (const root of clone.children) {
          root.setAttribute('hg-row', index)
          root.hgItem = item
        }
        rows.push({ item, roots: [...clone.children] })
        fragment.appendChild(clone)
      })
      parent.insertBefore(fragment, this._template.nextSibling)
    }
    // Painted after insertion, not before: scope is closest(), and only the
    // attached tree can say a nested hydrargyri element owns its own binds.
    for (const { item, roots } of rows) {
      for (const root of roots) this._paintRow(root, item)
    }
    // The rescan wires `on` in the fresh rows — and tears down the command
    // listener _init wired outside the scan, so it comes back here.
    this._scanHandlers()
    const listener = (e) => this._act(e)
    this.addEventListener('command', listener)
    this._listeners.push({ el: this, event: 'command', listener })
  }

  _paintRow(root, item) {
    const nodes = [root, ...root.querySelectorAll('[bind],[data-bind]')]
    for (const node of nodes) {
      const raw = node.getAttribute('bind') || node.getAttribute('data-bind')
      if (!raw || !super._scope(node)) continue
      for (const entry of parseBinds(raw)) {
        this._render({ ...entry, el: node }, resolve(item, entry.path))
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
