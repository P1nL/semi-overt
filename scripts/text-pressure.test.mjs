import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { isTitleEffectOccluded } from '../src/shared/utils/titleEffectOcclusion.ts'
import { getPressureWeight, isPressureTriggerTarget } from '../src/shared/utils/textPressure.ts'
import { createTextPressureScheduler } from './helpers/pressureScheduler.mjs'

test('idle remains 900 regardless of pointer distance', () => {
  for (const distance of [0, 100, 500, 1000]) assert.equal(getPressureWeight(distance, 500, false), 900)
})
test('hover center exceeds idle 900 and distant glyphs reach 100', () => {
  assert.equal(getPressureWeight(0, 500, true), 1000)
  assert.equal(getPressureWeight(250, 500, true), 550)
  assert.equal(getPressureWeight(500, 500, true), 100)
  assert.equal(getPressureWeight(1000, 500, true), 100)
})
test('weight decreases continuously as distance grows', () => {
  let previous = 1001
  for (let distance = 0; distance <= 500; distance += 5) {
    const weight = getPressureWeight(distance, 500, true)
    assert.ok(weight < previous)
    assert.ok(weight >= 100 && weight <= 1000)
    previous = weight
  }
})
test('zero-width containers and negative distance remain bounded', () => {
  assert.equal(getPressureWeight(0, 0, true), 1000)
  assert.equal(getPressureWeight(1, 0, true), 100)
  assert.equal(getPressureWeight(-20, 500, true), 1000)
})

test('close glyphs exceed 900 while farther glyphs get lighter', () => {
  assert.ok(getPressureWeight(25, 500, true) > 900)
  assert.ok(getPressureWeight(100, 500, true) < 900)
  assert.equal(getPressureWeight(0, 500, false), 900)
})
test('text and central eye activate but empty title space does not', () => {
  const glyph = { textContent: 'S', getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }) }, eye = { querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }) }
  const container = { contains: node => node === glyph || node === eye }
  const textTarget = { closest: selector => selector === '.text-pressure-glyph' ? glyph : null }
  const eyeTarget = { closest: selector => selector === '.hero-title-eye' ? eye : null }
  assert.equal(isPressureTriggerTarget(textTarget, container, { x: 50, y: 50 }), true)
  assert.equal(isPressureTriggerTarget(eyeTarget, container, { x: 50, y: 50 }), true)
  assert.equal(isPressureTriggerTarget(null, container), false)
  assert.equal(isPressureTriggerTarget({ closest: () => null }, container), false)
})
test('text/eyes outside this title and space-only glyphs do not activate', () => {
  assert.equal(isPressureTriggerTarget({ closest: () => ({ textContent: 'S' }) }, { contains: () => false }), false)
  const space = { closest: selector => selector === '.text-pressure-glyph' ? { textContent: '\u00a0' } : null }
  assert.equal(isPressureTriggerTarget(space, { contains: () => true }), false)
})

function mountPressure(overrides = {}, shared = null) {
  const source = readFileSync(new URL('../src/shared/components/TextPressure.vue', import.meta.url), 'utf8')
  const setup = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const code = ts.transpileModule(setup, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const timers = new Map(), frames = shared?.frames ?? new Map(), events = new Map(), mediaEvents = new Map(), fontEvents = new Map()
  let id = 0, mount, unmount, geometryReads = 0
  class ElementMock {
    textContent = 'S'
    style = {}
    offsetWidth = 100
    parentElement = { style: {}, getBoundingClientRect: () => this.getBoundingClientRect() }
    getBoundingClientRect() { geometryReads++; return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 } }
    closest(selector) { return selector === '.text-pressure-glyph' ? this : null }
  }
  const glyph = new ElementMock()
  const container = { contains: node => node === glyph || node === container, getBoundingClientRect: () => glyph.getBoundingClientRect() }
  const media = {
    matches: false,
    addEventListener: (name, fn) => mediaEvents.set(name, fn),
    removeEventListener: name => mediaEvents.delete(name),
  }
  const windowMock = {
    setTimeout: (callback, delay) => { timers.set(++id, { callback, delay }); return id },
    clearTimeout: timer => timers.delete(timer),
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: name => events.delete(name),
  }
  const documentMock = { fonts: {
    ready: Promise.resolve(),
    addEventListener: (name, fn) => fontEvents.set(name, fn),
    removeEventListener: name => fontEvents.delete(name),
  } }
  const props = { text: 'S', peakOffsets: [], containerRef: container, ...overrides }
  const scheduler = shared?.scheduler ?? createTextPressureScheduler({
    requestFrame: callback => { frames.set(++id, callback); return id },
    cancelFrame: frame => frames.delete(frame),
  })
  const state = new Function('textPressureScheduler', 'isTitleEffectOccluded', 'defineProps', 'withDefaults', 'computed', 'onBeforeUnmount', 'onMounted', 'ref', 'watch',
    'getPressureWeight', 'isPressureTriggerTarget', 'window', 'document', 'matchMedia', 'ResizeObserver',
    'requestAnimationFrame', 'cancelAnimationFrame', 'Element', code + '\nreturn { pointer: () => pointer, glyphRefs };')(
    scheduler, isTitleEffectOccluded, () => props, value => value, fn => ({ get value() { return fn() } }),
    fn => { unmount = fn }, fn => { mount = fn }, value => ({ value: value === null ? container : value }), () => {},
    getPressureWeight, isPressureTriggerTarget, windowMock, documentMock, () => media,
    class { observe() {} disconnect() {} }, callback => { frames.set(++id, callback); return id },
    frame => frames.delete(frame), ElementMock,
  )
  state.glyphRefs.value = [glyph]
  mount()
  const move = (x, y, target = glyph) => events.get('pointermove')({ pointerType: 'mouse', clientX: x, clientY: y, target })
  const fireTimer = () => { const [key, timer] = timers.entries().next().value; timers.delete(key); timer.callback() }
  const runFrame = time => {
    const entry = frames.entries().next().value
    if (!entry) return false
    frames.delete(entry[0]); entry[1](time)
    return true
  }
  return { move, state, timers, events, mediaEvents, media, fireTimer, unmount, runFrame,
    glyph, container, geometryReads: () => geometryReads, outside: new ElementMock(), document: documentMock }
}
test('brief text-boundary crossings are debounced and re-entry cancels release', () => {
  const h = mountPressure()
  h.move(10, 50)
  h.move(20, 50, null)
  assert.deepEqual(h.state.pointer(), { x: 10, y: 50 })
  assert.equal(h.timers.size, 1)
  assert.equal([...h.timers.values()][0].delay, 120)
  const timerKey = [...h.timers.keys()][0]
  h.move(30, 50, null)
  assert.equal([...h.timers.keys()][0], timerKey)
  h.move(11, 51)
  assert.equal(h.timers.size, 0)
  h.move(20, 50, null)
  h.fireTimer()
  assert.equal(h.state.pointer(), null)
  h.unmount()
})
test('pointer noise is ignored but deliberate motion still updates', () => {
  const h = mountPressure()
  h.move(10, 50)
  h.move(11, 51)
  assert.deepEqual(h.state.pointer(), { x: 10, y: 50 })
  h.move(14, 50)
  assert.deepEqual(h.state.pointer(), { x: 14, y: 50 })
  h.unmount()
})
test('empty areas never activate; blur and unmount cancel pending release', () => {
  const h = mountPressure()
  h.move(10, 50, null)
  assert.equal(h.state.pointer(), null)
  assert.equal(h.timers.size, 0)
  h.move(10, 50)
  h.move(20, 50, null)
  h.events.get('blur')()
  assert.equal(h.timers.size, 0)
  assert.equal(h.state.pointer(), null)
  h.move(10, 50)
  h.move(20, 50, null)
  h.unmount()
  assert.equal(h.timers.size, 0)
  assert.equal(h.events.size, 0)
})

test('text activation keeps eight percent horizontal inset and uses sixteen percent vertical inset', () => {
  const glyph = { textContent: 'S', getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }) }
  const target = { closest: selector => selector === '.text-pressure-glyph' ? glyph : null }
  const container = { contains: node => node === glyph || node === container, getBoundingClientRect: () => glyph.getBoundingClientRect() }
  for (const [x, y] of [[0, 50], [5, 50], [50, 5], [50, 15], [95, 50], [50, 85], [50, 95]]) {
    assert.equal(isPressureTriggerTarget(target, container, { x, y }), false)
  }
  for (const [x, y] of [[8, 16], [50, 50], [92, 84]]) {
    assert.equal(isPressureTriggerTarget(target, container, { x, y }), true)
  }
})
test('central eye includes its visible outer circle but excludes the taller wrapper and empty corners', () => {
  const icon = { getBoundingClientRect: () => ({ left: 20, top: 30, width: 100, height: 100 }) }
  const eye = {
    querySelector: selector => { assert.equal(selector, 'svg'); return icon },
    getBoundingClientRect: () => { throw Error('Wrapper/spacer must not define the eye hit area') },
  }
  const target = { closest: selector => selector === '.hero-title-eye' ? eye : null }
  const container = { contains: node => node === eye }
  assert.equal(isPressureTriggerTarget(target, container, { x: 70, y: 80 }), true)
  for (const [x, y] of [[70, 10], [70, 29], [70, 131], [19, 80], [121, 80], [20, 30], [120, 30], [20, 130], [120, 130]]) {
    assert.equal(isPressureTriggerTarget(target, container, { x, y }), false)
  }
  for (const [x, y] of [[70, 30], [70, 40], [70, 130], [20, 80], [120, 80], [100, 55]]) {
    assert.equal(isPressureTriggerTarget(target, container, { x, y }), true)
  }
})
test('missing or hidden eye SVG does not activate', () => {
  for (const icon of [null, { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) }]) {
    const eye = { querySelector: () => icon }
    const target = { closest: selector => selector === '.hero-title-eye' ? eye : null }
    assert.equal(isPressureTriggerTarget(target, { contains: node => node === eye }, { x: 0, y: 0 }), false)
  }
})
test('zero-size glyphs cannot activate', () => {
  const glyph = { textContent: 'S', getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }) }
  const target = { closest: selector => selector === '.text-pressure-glyph' ? glyph : null }
  assert.equal(isPressureTriggerTarget(target, { contains: () => true }, { x: 0, y: 0 }), false)
})
test('glyph edge does not activate and exits the inset through existing debounce', () => {
  const h = mountPressure()
  h.move(5, 50)
  assert.equal(h.state.pointer(), null)
  h.move(50, 50)
  assert.deepEqual(h.state.pointer(), { x: 50, y: 50 })
  h.move(5, 50)
  assert.equal(h.timers.size, 1)
  h.fireTimer()
  assert.equal(h.state.pointer(), null)
  h.unmount()
})

test('card pointer movement bypasses title region geometry after leaving the title', () => {
  let regionCalls = 0
  const h = mountPressure({ pointerRegion: point => { regionCalls++; return point.y < 100 } })
  h.move(50, 50)
  h.runFrame(16)
  regionCalls = 0
  for (let index = 0; index < 60; index++) h.move(index, 300, h.outside)
  assert.equal(regionCalls, 0, 'card movement must not run the orbit hit test')
  assert.equal(h.timers.size, 1)
  h.fireTimer()
  const reads = h.geometryReads()
  let frames = 0
  while (h.runFrame(32 + frames * 16) && frames < 120) frames++
  assert.ok(frames > 0 && frames < 120, 'weight still eases back and stops')
  assert.equal(h.geometryReads(), reads, 'idle return must not measure layout')
  assert.equal(h.glyph.style.fontVariationSettings, "'wght' 900.00")
  h.unmount()
})
test('group whitespace still enters the title hit strip and supports re-entry', () => {
  let calls = 0
  const h = mountPressure({ pointerRegion: () => { calls++; return true } })
  // Real heading whitespace targets the container rather than a letter.
  Object.setPrototypeOf(h.container, Object.getPrototypeOf(h.glyph))
  h.move(50, 50, h.container)
  assert.equal(calls, 1)
  assert.deepEqual(h.state.pointer(), { x: 50, y: 50 })
  h.move(200, 300, h.outside)
  h.move(55, 50)
  assert.equal(h.timers.size, 0)
  assert.deepEqual(h.state.pointer(), { x: 55, y: 50 })
  h.unmount()
})

test('overlapping card blocks pressure before region geometry, and uncovering restores it', () => {
  let calls = 0
  const h = mountPressure({ pointerRegion: () => { calls++; return true } })
  h.document.elementsFromPoint = () => [{ closest: () => ({}) }]
  h.move(50, 50)
  assert.equal(calls, 0)
  assert.equal(h.state.pointer(), null)
  h.document.elementsFromPoint = () => []
  h.move(50, 50)
  assert.equal(calls, 1)
  assert.deepEqual(h.state.pointer(), { x: 50, y: 50 })
  h.document.elementsFromPoint = () => [{ closest: () => ({}) }]
  h.move(51, 50)
  assert.equal(h.state.pointer(), null)
  h.unmount()
})


test('eight pressure instances share one frame, one heading read and all reads precede writes', () => {
  const frames = new Map(), log = []
  let id = 0, headingReads = 0
  const shared = { frames, scheduler: createTextPressureScheduler({
    requestFrame: callback => { frames.set(++id, callback); return id },
    cancelFrame: frame => frames.delete(frame),
  }) }
  const container = {
    contains: () => true,
    getBoundingClientRect: () => { headingReads++; log.push('read'); return { width: 1000, height: 100, left: 0, top: 0 } },
  }
  const instances = Array.from({ length: 8 }, () => mountPressure({ containerRef: container, pointerRegion: () => true }, shared))
  for (const h of instances) {
    let value = ''
    Object.defineProperty(h.glyph.style, 'fontVariationSettings', {
      get: () => value,
      set: next => { log.push('write'); value = next },
    })
    h.glyph.getBoundingClientRect = () => { log.push('read'); return { left: 0, top: 0, width: 100, height: 100 } }
    h.move(50, 50)
  }
  assert.equal(frames.size, 1, 'all eight instances must share one callback')
  instances[0].runFrame(0)
  assert.equal(headingReads, 1, 'shared heading is measured once per frame')
  const firstRead = log.indexOf('read'), lastRead = log.lastIndexOf('read')
  assert.ok(firstRead >= 0 && lastRead > firstRead)
  assert.ok(log.slice(firstRead, lastRead + 1).every(item => item === 'read'), 'no weight writes between geometry reads')
  log.length = 0
  headingReads = 0
  instances[0].runFrame(17)
  assert.equal(headingReads, 1)
  assert.ok(log.slice(0, log.lastIndexOf('read') + 1).every(item => item === 'read'))
  instances.forEach(h => h.unmount())
  assert.equal(frames.size, 0)
})
test('a settled idle glyph does not rewrite the same weight on repeated resets', () => {
  const h = mountPressure()
  h.runFrame(0)
  let writes = 0, value = h.glyph.style.fontVariationSettings
  Object.defineProperty(h.glyph.style, 'fontVariationSettings', {
    get: () => value, set: next => { value = next; writes++ },
  })
  h.events.get('blur')()
  h.runFrame(17)
  h.events.get('blur')()
  h.runFrame(34)
  assert.equal(writes, 0)
  h.unmount()
})
