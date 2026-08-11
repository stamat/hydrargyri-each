// Hand-written declarations for the JS source next door. Kept by hand on
// purpose: the surface is one class; a generator would need a toolchain the
// repo otherwise has no use for. Change the source, change this.

import { HgElement } from 'hydrargyri'

/**
 * `<hg-each>` — list rendering for hydrargyri. Clones a `<template>` once per
 * entry of `items`, painting the clone's binds with paths resolved into the
 * item plus the `$index` and `$key` coordinates. Defined as `hg-each` at
 * import time when a DOM exists.
 */
export default class HgEach extends HgElement {
  /** The list: an array, a plain object of key → item, or null for "no data yet" — anything else warns and leaves the rows standing. */
  items: unknown[] | Record<string, unknown> | null
}
