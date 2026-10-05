import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { HEADER_DOCK_LAYOUT_EVENT } from '../src/shared/utils/headerDockLayout.ts'
const source = readFileSync(new URL('../src/shared/composables/useDockMagnification.ts', import.meta.url), 'utf8')
const script = source.replace(/^import .*$/gm, '').replace('export function useDockMagnification', 'function useDockMagnification')
const code = ts.transpile(script, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None })
function setup() {
  const frames = new Map(), windowEvents = new Map(), docEvents = new Map(), hostEvents = new Map(), writes = [], notifications = [], watchers = []
  let id = 0, time = 0, mount, unmount
  class ElementMock { closest() { return this } matches() { return true } }
  const slots = [0, 1].map(index => {
    const values = new Map()
    const button = new ElementMock()
    button.getClientRects = () => [{}]
    button.getBoundingClientRect = () => {
      const left = 100 + slots.slice(0, index).reduce((sum, item) => sum + Number.parseFloat(item.values.get('--header-dock-width') || '40'), 0)
      const width = Number.parseFloat(values.get('--header-dock-width') || '40')
      return { x: left, y: 20, left, right: left + width, top: 20, bottom: 60, width, height: 40 }
    }
    return { values, button, dataset: {}, querySelector: () => button, style: {
      setProperty(name, value) { values.set(name, value); writes.push([index, name]) },
      removeProperty(name) { values.delete(name); writes.push([index, name]) },
    } }
  })
  const host = { dataset: {}, querySelectorAll: () => slots,
    addEventListener: (name, fn) => hostEvents.set(name, fn), removeEventListener: name => hostEvents.delete(name),
    dispatchEvent(event) { notifications.push({ name: event.type, writes: [...writes] }); writes.length = 0 },
  }
  const window = { innerWidth: 1280, innerHeight: 900, addEventListener: (name, fn) => windowEvents.set(name, fn), removeEventListener: name => windowEvents.delete(name) }
  const document = { addEventListener: (name, fn) => docEvents.set(name, fn), removeEventListener: name => docEvents.delete(name) }
  const interaction = { value: false }
  const create = new Function('computed', 'onBeforeUnmount', 'onMounted', 'watch', 'useMediaQuery', 'HEADER_DOCK_LAYOUT_EVENT', 'window', 'document', 'Element', 'HTMLElement', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', code + ';return useDockMagnification;')(
    fn => ({ get value() { return fn() } }), fn => { unmount = fn }, fn => { mount = fn },
    (target, fn) => { watchers.push({ target, fn }); return () => {} }, query => ({ value: !query.includes('prefers-reduced-motion') }),
    HEADER_DOCK_LAYOUT_EVENT, window, document, ElementMock, ElementMock, class { observe() {} disconnect() {} }, () => ({ width: '40px' }),
    fn => { frames.set(++id, fn); return id }, key => frames.delete(key),
  )
  create({ value: host }, { value: true }, interaction); mount()
  const tick = () => { const entry = frames.entries().next().value; if (!entry) return false; frames.delete(entry[0]); time += 16; entry[1](time); return true }
  const settle = () => { let count = 0; while(tick() && count++ < 300) {} assert.ok(count < 300) }
  return { slots, host, notifications, frames, tick, settle, unmount, writes,
    hover: (x, y) => windowEvents.get('pointermove')({ pointerType: 'mouse', clientX: x, clientY: y }),
    down: () => hostEvents.get('pointerdown')({ button: 0, target: slots[0].button }),
    up: () => windowEvents.get('pointerup')(),
    open: () => { interaction.value = true; watchers.find(item => item.target === interaction).fn(true) },
    blur: () => windowEvents.get('blur')(),
  }
}
test('dock publishes one shared notification after all changed slot writes', () => {
  const h = setup()
  h.hover(120, 40); h.tick()
  assert.equal(h.notifications.length, 1)
  assert.equal(h.notifications[0].name, HEADER_DOCK_LAYOUT_EVENT)
  assert.deepEqual(h.notifications[0].writes.map(([index]) => index), [0,0,0,1,1,1])
  h.unmount()
})
test('click hold remains unchanged; leaving publishes return frames including final rest', () => {
  const h = setup()
  h.hover(120,40); h.settle()
  h.down(); h.open(); h.up()
  assert.equal(h.frames.size,0)
  h.notifications.length = 0; h.writes.length = 0
  h.hover(900,500); h.settle()
  assert.ok(h.notifications.length > 1)
  assert.ok(h.notifications.every(item => item.name === HEADER_DOCK_LAYOUT_EVENT))
  assert.equal(h.host.dataset.headerDockRunning,'false')
  assert.ok(h.slots.every(slot => slot.values.get('--header-dock-scale') === '1.0000'))
  const count = h.notifications.length
  h.hover(901,501)
  assert.equal(h.frames.size,0)
  assert.equal(h.notifications.length,count)
  h.unmount()
})
test('reset notifies after removing magnification so anchored panels cannot retain a stale pose', () => {
  const h = setup()
  h.hover(120,40); h.settle()
  h.notifications.length=0; h.writes.length=0
  h.blur()
  assert.equal(h.notifications.length,1)
  assert.equal(h.notifications[0].writes.length,6)
  assert.ok(h.slots.every(slot => slot.values.size === 0))
  assert.equal(h.frames.size,0)
  h.unmount()
})
