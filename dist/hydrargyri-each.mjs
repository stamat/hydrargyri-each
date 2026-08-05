/* hydrargyri-each v1.0.0 | https://github.com/stamat/hydrargyri-each | MIT License */
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/scripts/hydrargyri-each.js
import { HgElement, parseBinds } from "hydrargyri";
function resolve(item, path) {
  if (path.length === 2 && path[0] === "" && path[1] === "") return item;
  return path.reduce((value, key) => value !== null && value !== void 0 ? value[key] : void 0, item);
}
var HgEach = class extends HgElement {
  constructor() {
    super();
    this._template = null;
    this._painted = false;
    this._scanningBinds = false;
  }
  _init() {
    this._template = this._findTemplate();
    if (!this._template) {
      console.warn("hydrargyri-each: <hg-each> has no <template> child \u2014 markup left as authored");
    }
    super._init();
  }
  _findTemplate() {
    for (const template of this.querySelectorAll("template")) {
      if (this._scope(template)) return template;
    }
    return null;
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
    const parent = this._template && this._template.parentNode;
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
    if (!this._template) return;
    if (!this._painted && !this._assigned.has("items") && this.items === null) return;
    const items = this.items;
    if (items !== null && !Array.isArray(items)) {
      console.warn("hydrargyri-each: <hg-each> items takes an array or null \u2014 rows left standing");
      return;
    }
    this._painted = true;
    const parent = this._template.parentNode;
    for (const child of [...parent.children]) {
      if (child !== this._template) child.remove();
    }
    const rows = [];
    if (items && items.length) {
      const fragment = document.createDocumentFragment();
      items.forEach((item, index) => {
        const clone = document.importNode(this._template.content, true);
        for (const root of clone.children) {
          root.setAttribute("hg-row", index);
          root.hgItem = item;
        }
        rows.push({ item, roots: [...clone.children] });
        fragment.appendChild(clone);
      });
      parent.insertBefore(fragment, this._template.nextSibling);
    }
    for (const { item, roots } of rows) {
      for (const root of roots) this._paintRow(root, item);
    }
    this._scanHandlers();
    const listener = (e) => this._act(e);
    this.addEventListener("command", listener);
    this._listeners.push({ el: this, event: "command", listener });
  }
  _paintRow(root, item) {
    const nodes = [root, ...root.querySelectorAll("[bind],[data-bind]")];
    for (const node of nodes) {
      const raw = node.getAttribute("bind") || node.getAttribute("data-bind");
      if (!raw || !super._scope(node)) continue;
      for (const entry of parseBinds(raw)) {
        this._render({ ...entry, el: node }, resolve(item, entry.path));
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
  // does not hold is asked of the closest hydrargyri ancestor.
  _render(bind, value) {
    if (bind.attr && (bind.type === "if" || bind.type === "unless") && typeof this.conditions[bind.attr] !== "function") {
      const owner = this._hgAncestor();
      if (owner && typeof owner.conditions[bind.attr] === "function") return owner._render(bind, value);
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
