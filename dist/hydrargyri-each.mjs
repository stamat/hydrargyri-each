/* hydrargyri-each v1.0.1 | https://github.com/stamat/hydrargyri-each | MIT License */
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/scripts/hydrargyri-each.js
import { HgElement, parseBinds } from "hydrargyri";
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
var COORDINATES = /* @__PURE__ */ new Map([["$index", "index"], ["$key", "key"]]);
function resolve(row, path) {
  if (path.length === 2 && path[0] === "" && path[1] === "") return row.item;
  if (path.length === 1 && COORDINATES.has(path[0])) return row[COORDINATES.get(path[0])];
  if (path[0].startsWith("$")) {
    console.warn(`hydrargyri-each: <hg-each> has no row coordinate "${path.join(".")}" \u2014 ${[...COORDINATES.keys()].join(" and ")} are the only ones`);
    return void 0;
  }
  return path.reduce((value, key) => value !== null && value !== void 0 ? value[key] : void 0, row.item);
}
var HgEach = class extends HgElement {
  constructor() {
    super();
    this._template = null;
    this._painted = false;
    this._scanningBinds = false;
    this._pendingKey = null;
  }
  _init() {
    if (this.hasAttribute("template")) {
      if (this._findTemplate()) {
        console.warn('hydrargyri-each: <hg-each> has both a <template> child and template="\u2026" \u2014 the attribute wins, and the child stands in the rows region the first paint clears');
      }
    } else {
      this._template = this._usable(this._findTemplate());
      if (!this._template) {
        console.warn("hydrargyri-each: <hg-each> has no <template> child \u2014 markup left as authored");
      }
    }
    super._init();
  }
  _findTemplate() {
    for (const template of this.querySelectorAll("template")) {
      if (this._scope(template)) return template;
    }
    return null;
  }
  // Row binds live on elements, so a template of text alone can only paint that
  // text once per item. Null takes the no-template path: one bail, and the
  // fallback rows stay standing.
  _usable(template) {
    if (!template) return null;
    if (!template.content.firstElementChild) {
      console.warn("hydrargyri-each: <hg-each> template has no element to clone \u2014 markup left as authored");
      return null;
    }
    return template;
  }
  // Re-looked-up on every paint, because the page may have grown the template
  // since the last one — but warned about only once, or a repainting list turns
  // one authoring mistake into a console full of them.
  _findById() {
    const id = this.getAttribute("template");
    const root = this.getRootNode();
    const found = typeof root.getElementById === "function" ? root.getElementById(id) : null;
    if (!found || found.tagName !== "TEMPLATE") {
      if (!this._warnedById) {
        console.warn(`hydrargyri-each: <hg-each template="${id}"> found ${found ? "no <template>" : "no element"} with that id \u2014 markup left as authored`);
        this._warnedById = true;
      }
      return null;
    }
    return this._usable(found);
  }
  // With an external template there is no "beside the template" inside hg-each,
  // so hg-each itself is the region — everything in it is rows, its own binds
  // and an empty-state node included, which is why they belong outside.
  _regionParent() {
    if (this.hasAttribute("template")) return this;
    return this._template && this._template.parentNode;
  }
  // Rows carry item-relative binds painted per clone in _paint — the instance
  // scan must not read them (their first segment is an item field, not element
  // state, and would warn) — while the handler scan must, because row `on`
  // routes through _handle. One scan skips the rows region, the other keeps
  // it, hence the flag rather than a plain _scope override.
  _scanBinds() {
    this._scanningBinds = true;
    super._scanBinds();
    this._scanningBinds = false;
  }
  _scope(el) {
    if (this._scanningBinds && this._inRows(el)) return false;
    return super._scope(el);
  }
  _inRows(el) {
    const parent = this._regionParent();
    if (!parent || el === parent || !parent.contains(el)) return false;
    let node = el;
    while (node && node.parentNode !== parent) node = node.parentNode;
    return !!node && node !== this._template;
  }
  update(key) {
    super.update(key);
    if (this._initialized && (!key || key === "items")) this._paint();
  }
  _paint() {
    if (!this._painted && !this._assigned.has("items") && this.items === null) return;
    if (this.hasAttribute("template")) this._template = this._findById();
    if (!this._template) return;
    const items = this.items;
    if (items !== null && !Array.isArray(items) && !isPlainObject(items)) {
      console.warn("hydrargyri-each: <hg-each> items takes an array, a plain object or null \u2014 rows left standing");
      return;
    }
    const entries = [];
    if (Array.isArray(items)) {
      items.forEach((item, index) => entries.push({ item, index, key: void 0 }));
    } else if (items) {
      Object.entries(items).forEach(([key, item], index) => entries.push({ item, index, key }));
    }
    this._painted = true;
    const parent = this._regionParent();
    const inline = this._template.parentNode === parent;
    if (inline) while (parent.firstChild && parent.firstChild !== this._template) parent.firstChild.remove();
    for (const child of [...parent.childNodes]) {
      if (child !== this._template && child.nodeType !== 1) child.remove();
    }
    const previous = this._keyedRows(parent);
    const claimed = /* @__PURE__ */ new Set();
    const rows = [];
    let keysHeld = true;
    for (const row of entries) {
      const key = previous ? resolve(row, previous.path) : void 0;
      const claimable = previous !== null && key !== void 0 && !claimed.has(key);
      if (previous && key === void 0) {
        keysHeld = false;
        this._warnKey(`hydrargyri-each: <hg-each key="${previous.raw}"> found no key on an item \u2014 its rows are re-cloned until the path resolves`);
      } else if (previous && !claimable) {
        keysHeld = false;
        this._warnKey(`hydrargyri-each: <hg-each key="${previous.raw}"> has a duplicate key ${JSON.stringify(key)} \u2014 one row's nodes cannot serve two, so the later row is cloned fresh`);
      }
      let roots = claimable ? previous.rows.get(key) || null : null;
      if (claimable) claimed.add(key);
      if (!roots) roots = [...document.importNode(this._template.content, true).children];
      for (const root of roots) {
        root.setAttribute("hg-row", row.index);
        root.hgItem = row.item;
        if (claimable) root.hgKey = key;
      }
      rows.push({ ...row, roots });
    }
    if (keysHeld) this._pendingKey = null;
    let cursor = inline ? this._template.nextSibling : parent.firstChild;
    for (const row of rows) {
      for (const root of row.roots) {
        if (root === cursor) cursor = cursor.nextSibling;
        else parent.insertBefore(root, cursor);
      }
    }
    while (cursor) {
      const next = cursor.nextSibling;
      cursor.remove();
      cursor = next;
    }
    for (const row of rows) {
      for (const root of row.roots) this._paintRow(root, row);
    }
    this._scanHandlers();
    const listener = (e) => this._act(e);
    this.addEventListener("command", listener);
    this._listeners.push({ el: this, event: "command", listener });
  }
  // The keys are read back off the row roots rather than kept in a field: a row
  // the page removed takes its entry with it, so there is no map to go stale,
  // and a reconnect finds exactly the nodes that are still standing.
  _keyedRows(parent) {
    const raw = this.getAttribute("key");
    if (!raw) return null;
    const rows = /* @__PURE__ */ new Map();
    for (const node of parent.children) {
      if (node === this._template || !("hgKey" in node)) continue;
      const roots = rows.get(node.hgKey);
      if (roots) roots.push(node);
      else rows.set(node.hgKey, [node]);
    }
    return { raw, path: raw.split("."), rows };
  }
  // Once per element: a keying mistake is the same mistake on every repaint,
  // and a list that repaints on every keystroke would say so on every keystroke.
  //
  // Held to the end of the task rather than said at the paint that saw it: a
  // reactive() splice notifies once per element it shifts, and each of those
  // intermediate arrays holds the item it just copied in two slots — a
  // duplicate key the author never wrote. The paint that settles clears the
  // pending message, so only a key problem still standing when the mutation
  // finishes is ever printed.
  _warnKey(message) {
    if (this._warnedKey || this._pendingKey) return;
    this._pendingKey = message;
    queueMicrotask(() => {
      const pending = this._pendingKey;
      this._pendingKey = null;
      if (!pending || this._warnedKey) return;
      this._warnedKey = true;
      console.warn(pending);
    });
  }
  _paintRow(root, row) {
    const nodes = [root, ...root.querySelectorAll("[bind],[data-bind]")];
    for (const node of nodes) {
      const raw = node.getAttribute("bind") || node.getAttribute("data-bind");
      if (!raw || !super._scope(node)) continue;
      for (const entry of parseBinds(raw)) {
        this._render({ ...entry, el: node }, resolve(row, entry.path));
      }
    }
  }
  // What neither a method nor the registry answers walks up: the closest
  // hydrargyri ancestor owns the data the rows render, so it usually owns their
  // handlers too. An hg-each ancestor passes it on again.
  _handle(name, e) {
    if (typeof this[name] === "function" || typeof this.handlers[name] === "function") {
      return super._handle(name, e);
    }
    const owner = this._hgAncestor();
    if (owner) return owner._handle(name, e);
    super._handle(name, e);
  }
  // The mirror of _handle for `if#name` and `unless#name`: a condition hg-each
  // does not hold is asked of the closest hydrargyri ancestor — whose own _render
  // walks on if it is an hg-each too, so the warn lands on the last hop.
  _render(bind, value) {
    if (bind.attr && (bind.type === "if" || bind.type === "unless") && typeof this.conditions[bind.attr] !== "function") {
      const owner = this._hgAncestor();
      if (owner) return owner._render(bind, value);
    }
    return super._render(bind, value);
  }
  _hgAncestor() {
    let node = this.parentElement;
    while (node && !(node instanceof HgElement)) node = node.parentElement;
    return node;
  }
};
__publicField(HgEach, "properties", ["items"]);
if (typeof customElements !== "undefined" && !customElements.get("hg-each")) {
  customElements.define("hg-each", HgEach);
}
export {
  HgEach as default
};
//# sourceMappingURL=hydrargyri-each.mjs.map
