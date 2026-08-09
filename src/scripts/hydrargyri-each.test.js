// Covers the whole surface: the rows region contract (fallback until first
// data, repainted after), item-relative bind painting including `.` and the
// `$index` / `$key` coordinates, arrays and plain objects, `template="id"` and
// the region it widens, keyed reuse — nodes kept, moved, dropped, the
// duplicate and missing-key fallbacks, and the key warning waiting for the
// model to settle so a splice is not reported as a mistake — per-row repaint:
// an item that is its own reactive() model repaints only its row, standing
// rows with an unchanged reactive or primitive item are skipped, and plain
// items keep the full repaint their mutations depend on — handler and condition
// fallthrough to the closest hydrargyri ancestor, scope around nested hydrargyri
// elements, hg-each's own instance binds, share, reconnect, and the command
// listener surviving a repaint.
// Deliberately not covered: the bind and on grammars themselves — hydrargyri's own
// suite owns them, hg-each only routes through them; and focus surviving a keyed
// reorder, because jsdom's focus does not model what a browser does when a node
// moves — the node identity the reuse rests on is asserted instead.
import { jest } from '@jest/globals'
import hydrargyri, { reactive } from 'hydrargyri'
import HgEach from './hydrargyri-each.js'

let n = 0
const tag = () => `x-e${++n}`

function mount(html) {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

// The painted rows: the template's element siblings.
function rows(el) {
  const template = el.querySelector('template')
  return [...template.parentNode.children].filter((child) => child !== template)
}

// jsdom has no CommandEvent yet, so command events are simulated as plain
// events wearing a `command` property — the router only reads that field.
function commandEvent(command) {
  return Object.assign(new Event('command'), { command })
}

afterEach(() => {
  document.body.innerHTML = ''
  delete HgEach._shared
  jest.restoreAllMocks()
})

test('a row is cloned per item, in item order, and the fallback rows are gone', () => {
  const root = mount(`<hg-each><ul>
    <template><li bind="name"></li></template>
    <li>fallback</li>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = [{ name: 'salt' }, { name: 'stone' }]
  expect(rows(el).map((li) => li.textContent)).toEqual(['salt', 'stone'])
})

test('the fallback rows stand until items first arrives — the scriptless reader keeps them', () => {
  const root = mount(`<hg-each><ul>
    <template><li bind="name"></li></template>
    <li>fallback</li>
  </ul></hg-each>`)
  const el = root.firstElementChild
  expect(rows(el).map((li) => li.textContent)).toEqual(['fallback'])
})

test('bind="." renders the item itself', () => {
  const root = mount(`<hg-each><ul><template><li bind="."></li></template></ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt', 'stone']
  expect(rows(el).map((li) => li.textContent)).toEqual(['salt', 'stone'])
})

test('a dotted path reaches into the item, and a missing branch leaves the node as authored', () => {
  const root = mount(`<hg-each><ul><template><li bind="user.name">nobody</li></template></ul></hg-each>`)
  const el = root.firstElementChild
  el.items = [{ user: { name: 'ada' } }, {}]
  expect(rows(el).map((li) => li.textContent)).toEqual(['ada', 'nobody'])
})

test('the full bind grammar paints rows — attr, value, semicolons, multi-root templates and all', () => {
  const root = mount(`<hg-each><div>
    <template><p bind="name; id:attr#data-id"></p><input bind="draft:value"></template>
  </div></hg-each>`)
  const el = root.firstElementChild
  el.items = [{ name: 'salt', id: 7, draft: 'hi' }]
  const [p, input] = rows(el)
  expect(p.textContent).toBe('salt')
  expect(p.getAttribute('data-id')).toBe('7')
  expect(input.value).toBe('hi')
})

test('markup arriving through a row text bind stays text, it cannot become elements', () => {
  const root = mount(`<hg-each><ul><template><li bind="."></li></template></ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['<img src=x onerror="boom()">']
  expect(el.querySelector('img')).toBe(null)
  expect(rows(el)[0].textContent).toContain('<img')
})

test('null clears the rows once the element has data, and an empty array paints none', () => {
  const root = mount(`<hg-each><ul>
    <template><li bind="."></li></template>
    <li>fallback</li>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt']
  el.items = null
  expect(rows(el)).toEqual([])
  el.items = []
  expect(rows(el)).toEqual([])
})

test('a reactive items model repaints on mutation — push grows a row, splice removes one', async () => {
  const root = mount(`<hg-each><ul><template><li bind="."></li></template></ul></hg-each>`)
  const el = root.firstElementChild
  const items = reactive(['salt'])
  el.items = items
  items.push('stone')
  await null
  expect(rows(el).map((li) => li.textContent)).toEqual(['salt', 'stone'])
  items.splice(0, 1)
  await null
  expect(rows(el).map((li) => li.textContent)).toEqual(['stone'])
})

test('a repaint clears the whole region, not only its elements — nothing piles up', () => {
  const root = mount(`<hg-each><ul>
    <template>
      <li bind="."></li>
    </template>
    <li>fallback</li>
  </ul></hg-each>`)
  const el = root.firstElementChild
  const region = el.querySelector('ul')
  el.items = ['salt', 'stone']
  const painted = region.childNodes.length
  for (let i = 0; i < 4; i++) el.items = ['salt', 'stone']
  expect(region.childNodes.length).toBe(painted)
  expect(rows(el).map((li) => li.textContent)).toEqual(['salt', 'stone'])
})

test('a plain object paints a row per entry, in insertion order, with $key naming each one', () => {
  const root = mount(`<hg-each><ul>
    <template><li><b bind="$key"></b> <span bind="role"></span> <i bind="$index"></i></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = { ada: { role: 'admin' }, grace: { role: 'member' } }
  expect(rows(el).map((li) => li.querySelector('b').textContent)).toEqual(['ada', 'grace'])
  expect(rows(el).map((li) => li.querySelector('span').textContent)).toEqual(['admin', 'member'])
  expect(rows(el).map((li) => li.querySelector('i').textContent)).toEqual(['0', '1'])
})

test('hg-row stays the position over an object — the key lives in $key, never in the attribute', () => {
  const root = mount(`<hg-each><ul>
    <template><li bind="."></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = { ada: 'admin', grace: 'member' }
  expect(rows(el).map((li) => li.getAttribute('hg-row'))).toEqual(['0', '1'])
  expect(rows(el).map((li) => li.hgItem)).toEqual(['admin', 'member'])
})

test('a reactive object repaints on mutation, the same door an array has', async () => {
  const root = mount(`<hg-each><ul>
    <template><li bind="$key"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  const items = reactive({ ada: 'admin' })
  el.items = items
  items.grace = 'member'
  await null
  expect(rows(el).map((li) => li.textContent)).toEqual(['ada', 'grace'])
  delete items.ada
  await null
  expect(rows(el).map((li) => li.textContent)).toEqual(['grace'])
})

test('a non-array items value warns and leaves the rows standing', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`<hg-each><ul><template><li bind="."></li></template></ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt']
  el.items = 42
  expect(rows(el).map((li) => li.textContent)).toEqual(['salt'])
  expect(warn).toHaveBeenCalled()
})

test('without a template child hg-each warns and leaves the markup as authored', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`<hg-each><ul><li>as authored</li></ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt']
  expect(el.querySelectorAll('li')).toHaveLength(1)
  expect(el.querySelector('li').textContent).toBe('as authored')
  expect(warn).toHaveBeenCalled()
})

test('a template holding no element warns and leaves the markup as authored — there is nothing to clone', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`<hg-each><ul><template>text alone binds nothing</template><li>as authored</li></ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt', 'stone']
  expect(rows(el).map((li) => li.textContent)).toEqual(['as authored'])
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('no element to clone'))
})

test('template="id" clones a template from outside, and then hg-each itself is the rows region', () => {
  const root = mount(`
    <template id="card-row"><article bind="."></article></template>
    <hg-each template="card-row"><article>fallback</article></hg-each>
  `)
  const el = root.querySelector('hg-each')
  expect(el.querySelector('article').textContent).toBe('fallback')
  el.items = ['salt', 'stone']
  expect([...el.children].map((node) => node.textContent)).toEqual(['salt', 'stone'])
})

test('an external template is looked up at the first paint, so it may be authored after hg-each', () => {
  const root = mount(`<hg-each template="late-row"><p>fallback</p></hg-each>`)
  const el = root.querySelector('hg-each')
  root.insertAdjacentHTML('beforeend', '<template id="late-row"><p bind="."></p></template>')
  el.items = ['salt']
  expect([...el.children].map((node) => node.textContent)).toEqual(['salt'])
})

test('template="id" naming nothing warns and leaves the markup as authored', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`<hg-each template="nowhere"><p>as authored</p></hg-each>`)
  const el = root.querySelector('hg-each')
  el.items = ['salt']
  expect([...el.children].map((node) => node.textContent)).toEqual(['as authored'])
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('nowhere'))
})

test('template="id" naming something that is not a template warns rather than cloning it', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`
    <p id="not-a-template">prose</p>
    <hg-each template="not-a-template"><p>as authored</p></hg-each>
  `)
  const el = root.querySelector('hg-each')
  el.items = ['salt']
  expect([...el.children].map((node) => node.textContent)).toEqual(['as authored'])
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('not-a-template'))
})

test('an inline template beside template="id" warns — the region would clear the inline one away', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`
    <template id="outer-row"><p bind="."></p></template>
    <hg-each template="outer-row"><template><p>ignored</p></template></hg-each>
  `)
  const el = root.querySelector('hg-each')
  el.items = ['salt']
  expect([...el.children].map((node) => node.textContent)).toEqual(['salt'])
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('both'))
})

test('binds in fallback rows are item-relative, not hg-each state, and the scan does not warn', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  mount(`<hg-each><ul>
    <template><li bind="name"></li></template>
    <li bind="name">fallback copied from the template</li>
  </ul></hg-each>`)
  expect(warn).not.toHaveBeenCalled()
})

test('$index binds the row position, and it is a coordinate rather than a field of the item', () => {
  const root = mount(`<hg-each><ul>
    <template><li><b bind="$index"></b> <span bind="."></span></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt', 'stone', 'sulphur']
  expect(rows(el).map((li) => li.querySelector('b').textContent)).toEqual(['0', '1', '2'])
  el.items = [{ $index: 'the item said so' }]
  expect(rows(el)[0].querySelector('b').textContent).toBe('0')
})

test('$key is the object key, so over an array it resolves to nothing and the node stays as authored', () => {
  const root = mount(`<hg-each><ul>
    <template><li bind="$key">as authored</li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt']
  expect(rows(el)[0].textContent).toBe('as authored')
})

test('a $ name that is not a coordinate warns — there is no scope chain to reach for', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`<hg-each><ul>
    <template><li bind="$parent">as authored</li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt']
  expect(rows(el)[0].textContent).toBe('as authored')
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('$parent'))
})

test('a row carries its item and index, on the root, for the handler to read', () => {
  const root = mount(`<hg-each><ul><template><li bind="name"></li></template></ul></hg-each>`)
  const el = root.firstElementChild
  const stone = { name: 'stone' }
  el.items = [{ name: 'salt' }, stone]
  const [, second] = rows(el)
  expect(second.getAttribute('hg-row')).toBe('1')
  expect(second.hgItem).toBe(stone)
})

test('on in a row falls through to the closest hydrargyri ancestor, which owns the data', () => {
  const name = tag()
  const seen = []
  hydrargyri(name, {
    properties: ['list'],
    handlers: {
      pick(e, owner) {
        const row = e.target.closest('[hg-row]')
        seen.push([owner.tagName.toLowerCase(), row.hgItem.name])
      }
    }
  })
  const root = mount(`<${name}>
    <hg-each><ul><template><li><button on="click:pick" bind="name"></button></li></template></ul></hg-each>
  </${name}>`)
  const each = root.querySelector('hg-each')
  each.items = [{ name: 'salt' }, { name: 'stone' }]
  rows(each)[1].querySelector('button').click()
  expect(seen).toEqual([[name, 'stone']])
})

test('an unresolved handler still warns when no ancestor answers either', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`<hg-each><ul><template><li><button on="click:nope"></button></li></template></ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt']
  rows(el)[0].querySelector('button').click()
  expect(warn).toHaveBeenCalled()
})

test('a named condition in a row asks the closest hydrargyri ancestor when hg-each has none', () => {
  const name = tag()
  hydrargyri(name, {
    conditions: { done: (value) => value === true }
  })
  const root = mount(`<${name}>
    <hg-each><ul><template><li><b bind="name"></b><s bind="done:if#done">done</s></li></template></ul></hg-each>
  </${name}>`)
  const each = root.querySelector('hg-each')
  each.items = [{ name: 'salt', done: true }, { name: 'stone', done: false }]
  const [first, second] = rows(each)
  expect(first.querySelector('s').hidden).toBe(false)
  expect(second.querySelector('s').hidden).toBe(true)
})

test('on and #conditions pass through an hg-each ancestor to the element that answers', () => {
  const name = tag()
  const seen = []
  hydrargyri(name, {
    handlers: {
      pick(e, owner) {
        seen.push([owner.tagName.toLowerCase(), e.target.closest('[hg-row]').hgItem.flag])
      }
    },
    conditions: { done: (value) => value === true }
  })
  const root = mount(`<${name}>
    <hg-each><ul>
      <template><li>
        <hg-each><ol><template><li><button on="click:pick"></button><s bind="flag:if#done">done</s></li></template></ol></hg-each>
      </li></template>
    </ul></hg-each>
  </${name}>`)
  const outer = root.querySelector('hg-each')
  outer.items = ['group']
  const inner = outer.querySelector('hg-each')
  inner.items = [{ flag: true }, { flag: false }]
  const [first, second] = rows(inner)
  expect(first.querySelector('s').hidden).toBe(false)
  expect(second.querySelector('s').hidden).toBe(true)
  second.querySelector('button').click()
  expect(seen).toEqual([[name, false]])
})

test('a nested hydrargyri element inside a row keeps its own binds — the row item never reaches them', () => {
  const name = tag()
  hydrargyri(name, { properties: ['label'] })
  const root = mount(`<hg-each><ul>
    <template><li><${name}><i bind="label"></i></${name}></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = [{ label: 'ROW' }]
  const chip = el.querySelector(name)
  expect(el.querySelector('i').textContent).not.toBe('ROW')
  chip.label = 'own'
  expect(el.querySelector('i').textContent).toBe('own')
})

test("hg-each's own binds outside the rows region paint from its state — items.length included", () => {
  const root = mount(`<hg-each>
    <p bind="items.length"></p>
    <ul><template><li bind="."></li></template></ul>
  </hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt', 'stone']
  expect(el.querySelector('p').textContent).toBe('2')
})

test('an empty list can say so — items.length carries the empty state, no directive needed', () => {
  const root = mount(`<hg-each>
    <p bind="items.length:unless">Nothing here yet</p>
    <ul><template><li bind="."></li></template></ul>
  </hg-each>`)
  const el = root.firstElementChild
  const empty = el.querySelector('p')
  el.items = []
  expect(empty.hasAttribute('hidden')).toBe(false)
  el.items = ['salt']
  expect(empty.hasAttribute('hidden')).toBe(true)
  el.items = []
  expect(empty.hasAttribute('hidden')).toBe(false)
})

test('items shared tag-wide replace the fallback at first paint, share applied before init included', () => {
  HgEach.share({ items: ['salt'] })
  const root = mount(`<hg-each><ul>
    <template><li bind="."></li></template>
    <li>fallback</li>
  </ul></hg-each>`)
  const el = root.firstElementChild
  expect(rows(el).map((li) => li.textContent)).toEqual(['salt'])
})

test('a shared null is still "no data" and the fallback stands — unlike an instance assignment of null', () => {
  HgEach.share({ items: null })
  const root = mount(`<hg-each><ul>
    <template><li bind="."></li></template>
    <li>fallback</li>
  </ul></hg-each>`)
  const el = root.firstElementChild
  expect(rows(el).map((li) => li.textContent)).toEqual(['fallback'])
  el.items = null
  expect(rows(el)).toEqual([])
})

test('a keyed row keeps its own nodes across a repaint — that is what row DOM state survives on', () => {
  const root = mount(`<hg-each key="id"><ul>
    <template><li><b bind="name"></b><input></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }]
  const [first, second] = rows(el)
  first.querySelector('input').value = 'half-typed'
  el.items = [{ id: 1, name: 'Ada Lovelace' }, { id: 2, name: 'Grace' }]
  expect(rows(el)[0]).toBe(first)
  expect(rows(el)[1]).toBe(second)
  expect(rows(el)[0].querySelector('input').value).toBe('half-typed')
  expect(rows(el)[0].querySelector('b').textContent).toBe('Ada Lovelace')
})

test('a keyed reorder moves the nodes it already has, and hg-row follows the new position', () => {
  const root = mount(`<hg-each key="id"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }, { id: 3, name: 'Klara' }]
  const [ada, grace, klara] = rows(el)
  el.items = [{ id: 3, name: 'Klara' }, { id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }]
  expect(rows(el)).toEqual([klara, ada, grace])
  expect(rows(el).map((li) => li.getAttribute('hg-row'))).toEqual(['0', '1', '2'])
})

test('a key that is gone takes its row with it, and a key that is new arrives as a clone', () => {
  const root = mount(`<hg-each key="id"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }]
  const [ada, grace] = rows(el)
  el.items = [{ id: 2, name: 'Grace' }, { id: 3, name: 'Klara' }]
  expect(rows(el)[0]).toBe(grace)
  expect(rows(el)[1]).not.toBe(ada)
  expect(rows(el).map((li) => li.textContent)).toEqual(['Grace', 'Klara'])
  expect(ada.isConnected).toBe(false)
})

test('key="$key" keys an object by its own keys, and key="." keys an array of primitives by value', () => {
  const object = mount(`<hg-each key="$key"><ul>
    <template><li bind="."></li></template>
  </ul></hg-each>`).firstElementChild
  object.items = { ada: 'admin', grace: 'member' }
  const ada = rows(object)[0]
  object.items = { grace: 'member', ada: 'owner' }
  expect(rows(object)[1]).toBe(ada)
  expect(rows(object)[1].textContent).toBe('owner')

  const primitives = mount(`<hg-each key="."><ul>
    <template><li bind="."></li></template>
  </ul></hg-each>`).firstElementChild
  primitives.items = ['salt', 'stone']
  const salt = rows(primitives)[0]
  primitives.items = ['stone', 'salt']
  expect(rows(primitives)[1]).toBe(salt)
})

test('duplicate keys warn and the second row gets nodes of its own — one node cannot be in two places', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`<hg-each key="id"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = [{ id: 1, name: 'Ada' }, { id: 1, name: 'Grace' }]
  expect(rows(el).map((li) => li.textContent)).toEqual(['Ada', 'Grace'])
  expect(rows(el)[0]).not.toBe(rows(el)[1])
  await Promise.resolve()
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate'))
})

test('a key path that reaches nothing warns once and the rows go back to being re-cloned', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`<hg-each key="missing"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = [{ name: 'Ada' }]
  const ada = rows(el)[0]
  el.items = [{ name: 'Ada' }]
  expect(rows(el)[0]).not.toBe(ada)
  await Promise.resolve()
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing'))
})

test('a splice through a reactive model says nothing — the duplicate a keyed paint walks through is not one the author wrote', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`<hg-each key="id"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  const items = reactive([{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }, { id: 3, name: 'Hedy' }])
  el.items = items
  const grace = rows(el)[1]
  // A core that notifies per shifted element paints intermediate arrays that
  // hold an item in two slots; a batching core paints only the settled list.
  // Either way the settled list is the author's, and no warning belongs to it.
  items.splice(0, 1)
  await null
  expect(rows(el).map((li) => li.textContent)).toEqual(['Grace', 'Hedy'])
  expect(rows(el)[0]).toBe(grace)
  await null
  expect(warn).not.toHaveBeenCalled()
})

test('a key warning cancelled by one settled paint still fires for the next mistake', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const root = mount(`<hg-each key="id"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  const items = reactive([{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }])
  el.items = items
  items.splice(0, 1)
  await null
  await null
  expect(warn).not.toHaveBeenCalled()
  items.push({ id: 2, name: 'Hedy' })
  // Two ticks: a batching core paints on the first and the held key warning
  // prints on the second; a per-mutation core is already past both.
  await null
  await null
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate'))
})

test('without key a repaint still re-clones, keeping the naive contract for markup that does not opt in', () => {
  const root = mount(`<hg-each><ul>
    <template><li bind="."></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt']
  const salt = rows(el)[0]
  el.items = ['salt']
  expect(rows(el)[0]).not.toBe(salt)
})

test('keyed reuse holds over an external template, where the region is hg-each itself', () => {
  const root = mount(`
    <template id="keyed-card"><article bind="name"></article></template>
    <hg-each template="keyed-card" key="id"><article>fallback</article></hg-each>
  `)
  const el = root.querySelector('hg-each')
  el.items = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }]
  const [ada, grace] = [...el.children]
  el.items = [{ id: 2, name: 'Grace' }, { id: 1, name: 'Ada' }]
  expect([...el.children]).toEqual([grace, ada])
  expect([...el.children].map((node) => node.getAttribute('hg-row'))).toEqual(['0', '1'])
})

test('adding an item repaints only the new row — the standing rows keep their paint', async () => {
  const root = mount(`<hg-each key="id"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  const items = reactive([reactive({ id: 1, name: 'Ada' })])
  el.items = items
  const ada = rows(el)[0]
  ada.textContent = 'poked' // an out-of-band mark any repaint would erase
  items.push(reactive({ id: 2, name: 'Grace' }))
  await null
  expect(rows(el).map((li) => li.textContent)).toEqual(['poked', 'Grace'])
  expect(rows(el)[0]).toBe(ada)
})

test('removing the last item takes its row and repaints no other', async () => {
  const root = mount(`<hg-each key="id"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  const items = reactive([reactive({ id: 1, name: 'Ada' }), reactive({ id: 2, name: 'Grace' })])
  el.items = items
  const ada = rows(el)[0]
  ada.textContent = 'poked'
  items.splice(1, 1)
  await null
  expect(rows(el)).toEqual([ada])
  expect(ada.textContent).toBe('poked')
})

test('mutating one reactive item repaints its row alone', async () => {
  const root = mount(`<hg-each key="id"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  const ada = reactive({ id: 1, name: 'Ada' })
  el.items = [ada, reactive({ id: 2, name: 'Grace' })]
  const [adaRow, graceRow] = rows(el)
  graceRow.textContent = 'poked'
  ada.name = 'Ada Lovelace'
  await null
  expect(adaRow.textContent).toBe('Ada Lovelace')
  expect(graceRow.textContent).toBe('poked')
})

test('a reactive item repaints its row without a key attribute too', async () => {
  const root = mount(`<hg-each><ul><template><li bind="name"></li></template></ul></hg-each>`)
  const el = root.firstElementChild
  const ada = reactive({ name: 'Ada' })
  el.items = [ada]
  ada.name = 'Ada Lovelace'
  await null
  expect(rows(el)[0].textContent).toBe('Ada Lovelace')
})

test('a plain item repaints with the list — mutation through the array proxy cannot go stale', async () => {
  const root = mount(`<hg-each key="id"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  const items = reactive([{ id: 1, name: 'Ada' }])
  el.items = items
  items[0].name = 'Ada Lovelace'
  await null
  expect(rows(el)[0].textContent).toBe('Ada Lovelace')
})

test('a primitive row in an unchanged place is not repainted — its value is all it is', async () => {
  const root = mount(`<hg-each key="."><ul>
    <template><li bind="."></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt', 'stone']
  const [salt, stone] = rows(el)
  salt.textContent = 'poked'
  stone.textContent = 'poked too'
  el.items = ['salt', 'stone', 'sulphur']
  await null
  expect(rows(el).map((li) => li.textContent)).toEqual(['poked', 'poked too', 'sulphur'])
})

test('replacing items unsubscribes the rows — a dropped item mutation repaints nothing', async () => {
  const root = mount(`<hg-each key="id"><ul>
    <template><li bind="name"></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  const ada = reactive({ id: 1, name: 'Ada' })
  el.items = [ada]
  el.items = [{ id: 2, name: 'Grace' }]
  const update = jest.spyOn(el, 'update')
  ada.name = 'ghost'
  await null
  expect(update).not.toHaveBeenCalled()
})

test('a standing row keeps a working listener across paints that add and remove other rows', async () => {
  const root = mount(`<hg-each key="id"><ul>
    <template><li><button on="click:pick" bind="name"></button></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  const seen = []
  el.handlers.pick = (e) => seen.push(e.target.closest('[hg-row]').hgItem.name)
  const items = reactive([reactive({ id: 1, name: 'Ada' })])
  el.items = items
  items.push(reactive({ id: 2, name: 'Grace' }))
  await null
  rows(el)[1].querySelector('button').click()
  items.splice(1, 1)
  await null
  rows(el)[0].querySelector('button').click()
  expect(seen).toEqual(['Grace', 'Ada'])
})

test('no listener stays behind for a row that left', async () => {
  const root = mount(`<hg-each key="id"><ul>
    <template><li><button on="click:pick"></button></li></template>
  </ul></hg-each>`)
  const el = root.firstElementChild
  el.handlers.pick = () => {}
  const items = reactive([reactive({ id: 1 }), reactive({ id: 2 })])
  el.items = items
  items.splice(1, 1)
  await null
  const stray = el._listeners.filter(({ el: target }) => target instanceof Element && target !== el && !el.contains(target))
  expect(stray).toEqual([])
})

test('a moved hg-each rescans and repaints on reconnect', () => {
  const root = mount(`<hg-each><ul><template><li bind="."></li></template></ul></hg-each>`)
  const el = root.firstElementChild
  el.items = ['salt']
  const other = mount('<div></div>')
  other.appendChild(el)
  expect(rows(el).map((li) => li.textContent)).toEqual(['salt'])
})

test('the command listener survives a repaint', () => {
  const root = mount(`<hg-each><ul><template><li bind="."></li></template></ul></hg-each>`)
  const el = root.firstElementChild
  const seen = []
  el.handlers['--clear'] = (e) => seen.push(e.command)
  el.items = ['salt']
  el.dispatchEvent(commandEvent('--clear'))
  expect(seen).toEqual(['--clear'])
})
