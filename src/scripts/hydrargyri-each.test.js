// Covers the whole surface: the rows region contract (fallback until first
// data, clear-and-clone after), item-relative bind painting including `.`,
// reactive repaint, handler and condition fallthrough to the closest hydrargyri
// ancestor, scope around nested hydrargyri elements, hg-each's own instance binds,
// share, reconnect, and the command listener surviving a repaint.
// Deliberately not covered: the bind and on grammars themselves — hydrargyri's own
// suite owns them, hg-each only routes through them; and row DOM state across
// repaints (focus, input values) — naive re-clone discards it by design, `key`
// is reserved for the keyed version.
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

test('a reactive items model repaints on mutation — push grows a row, splice removes one', () => {
  const root = mount(`<hg-each><ul><template><li bind="."></li></template></ul></hg-each>`)
  const el = root.firstElementChild
  const items = reactive(['salt'])
  el.items = items
  items.push('stone')
  expect(rows(el).map((li) => li.textContent)).toEqual(['salt', 'stone'])
  items.splice(0, 1)
  expect(rows(el).map((li) => li.textContent)).toEqual(['stone'])
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

test('binds in fallback rows are item-relative, not hg-each state, and the scan does not warn', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  mount(`<hg-each><ul>
    <template><li bind="name"></li></template>
    <li bind="name">fallback copied from the template</li>
  </ul></hg-each>`)
  expect(warn).not.toHaveBeenCalled()
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

test('items shared tag-wide replace the fallback at first paint, share applied before init included', () => {
  HgEach.share({ items: ['salt'] })
  const root = mount(`<hg-each><ul>
    <template><li bind="."></li></template>
    <li>fallback</li>
  </ul></hg-each>`)
  const el = root.firstElementChild
  expect(rows(el).map((li) => li.textContent)).toEqual(['salt'])
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
