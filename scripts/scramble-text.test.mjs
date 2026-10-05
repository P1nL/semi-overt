import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { isTitleEffectOccluded } from '../src/shared/utils/titleEffectOcclusion.ts'
import { createScrambleSampler, nextScrambleSymbol } from '../src/shared/utils/scrambleSampler.ts'

const source = readFileSync(new URL('../src/shared/components/ScrambleText.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const code = ts.transpile(script, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None })
function mount() {
  const props = { text: 'S' }, calls = [], mediaEvents = new Map(), docEvents = new Map(), windowEvents = new Map()
  const media = { matches: false, addEventListener: (n, f) => mediaEvents.set(n, f), removeEventListener: n => mediaEvents.delete(n) }
  const document = { hidden: false, addEventListener: (n, f) => docEvents.set(n, f), removeEventListener: n => docEvents.delete(n) }
  const window = { addEventListener: (n, f) => windowEvents.set(n, f), removeEventListener: n => windowEvents.delete(n) }
  let onMount, onUnmount, onWatch, killed = 0
  const gsap = { registerPlugin() {}, to: (target, options) => { calls.push({ target, options }); return { kill() { killed++ } } } }
  const state = new Function('isTitleEffectOccluded', 'gsap', 'nextScrambleSymbol', 'defineProps', 'withDefaults', 'ref', 'watch', 'onMounted', 'onBeforeUnmount', 'matchMedia', 'document', 'window', code + '; return { enter, glyphRef, scrambling };')(
    isTitleEffectOccluded, gsap, nextScrambleSymbol, () => props, (p, defaults) => Object.assign(p, defaults, { text: 'S' }), value => ({ value }),
    (_, callback) => { onWatch = callback }, callback => { onMount = callback }, callback => { onUnmount = callback }, () => media, document, window,
  )
  state.glyphRef.value = { textContent: 'S' }
  onMount()
  return { state, props, calls, media, document, mediaEvents, docEvents, windowEvents, unmount: () => onUnmount(), change: () => onWatch(), killed: () => killed }
}

test('only direct character entry triggers; no radius or global move handler', () => {
  assert.match(source, /@pointerenter="enter"/)
  assert.doesNotMatch(source, /@pointermove|@pointerleave|radius:|addEventListener\('pointermove'/)
  const a = mount(), b = mount()
  assert.equal(a.calls.length, 0)
  a.state.enter({ pointerType: 'mouse' })
  assert.equal(a.calls.length, 1)
  assert.equal(b.calls.length, 0)
  a.state.enter({ pointerType: 'mouse' })
  assert.equal(a.calls.length, 1)
  a.unmount(); b.unmount()
})
test('scrambles for full 2.5 seconds with a slow 0.3125-second symbol cadence', () => {
  const h = mount()
  h.state.enter({ pointerType: 'mouse' })
  const { options } = h.calls[0]
  assert.equal(options.duration, 2.5)
  assert.equal(options.elapsed, 2.5)
  assert.equal(h.props.speed, 0.16)
  const initial = h.state.glyphRef.value.textContent
  h.calls[0].target.elapsed = 0.3
  options.onUpdate()
  assert.equal(h.state.glyphRef.value.textContent, initial)
  h.calls[0].target.elapsed = 0.3125
  options.onUpdate()
  assert.notEqual(h.state.glyphRef.value.textContent, initial)
  assert.equal(new Set(Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(h.props.scrambleChars), part => part.segment)).size, 128)
  h.unmount()
})
test('completion restores original text and allows a later re-entry', () => {
  const h = mount()
  h.state.enter({ pointerType: 'mouse' })
  h.state.glyphRef.value.textContent = '★'
  h.calls[0].options.onComplete()
  assert.equal(h.state.glyphRef.value.textContent, 'S')
  assert.equal(h.state.scrambling.value, false)
  assert.equal(h.calls.length, 1)
  h.state.enter({ pointerType: 'pen' })
  assert.equal(h.calls.length, 2)
  h.unmount()
})
test('touch, reduced motion and hidden pages do not start effects', () => {
  const h = mount()
  h.state.enter({ pointerType: 'touch' })
  h.media.matches = true
  h.state.enter({ pointerType: 'mouse' })
  h.media.matches = false; h.document.hidden = true
  h.state.enter({ pointerType: 'mouse' })
  assert.equal(h.calls.length, 0)
  h.unmount()
})
test('visibility, blur, changed text and reduced motion restore the glyph', () => {
  const h = mount()
  for (const reset of [h.docEvents.get('visibilitychange'), h.windowEvents.get('blur'), h.mediaEvents.get('change'), h.change]) {
    h.state.enter({ pointerType: 'mouse' })
    h.state.glyphRef.value.textContent = '◆'
    reset()
    assert.equal(h.state.glyphRef.value.textContent, h.props.text)
    assert.equal(h.state.scrambling.value, false)
  }
  h.props.text = 'E'; h.change()
  assert.equal(h.state.glyphRef.value.textContent, 'E')
  h.unmount()
})
test('unmount kills animation and removes all listeners without restarting', () => {
  const h = mount()
  h.state.enter({ pointerType: 'mouse' })
  h.unmount()
  assert.equal(h.killed(), 1)
  assert.equal(h.mediaEvents.size + h.docEvents.size + h.windowEvents.size, 0)
  h.state.enter({ pointerType: 'mouse' })
  assert.equal(h.calls.length, 1)
})
test('only Zhaohua group uses ScrambleText; original width is reserved', () => {
  const ring = readFileSync(new URL('../src/widgets/hero-section/HeroTitleRing.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(ring, /WarpText|warpRegion/)
  assert.doesNotMatch(ring, /<ScrambleText text="O"/)
  assert.match(ring, /<span class="hero-orbit-eye-letter">O<\/span>/)
  assert.match(ring, /class="hero-orbit-pupil" :style="pupilStyle"/)
  assert.doesNotMatch(ring, /:has\(.scramble-text/)
  assert.match(ring, /<ScrambleText v-else-if="glyph.effect === 'scramble'"/)
  assert.match(ring, /<TextPressure v-else/)
  assert.match(source, /scramble-text__measure/)
  assert.match(source, /pointer-events: none/)
})

test('every pool symbol is used once per cycle, without boundary repeats', () => {
  for (const random of [() => 0, () => 0.5, () => 0.999]) {
    const draw = createScrambleSampler('ABCDEF', random)
    let last
    for (let cycle = 0; cycle < 10; cycle++) {
      const values = Array.from({ length: 6 }, draw)
      assert.equal(new Set(values).size, 6)
      assert.notEqual(values[0], last)
      last = values.at(-1)
    }
  }
})
test('emoji graphemes stay intact and duplicate/empty pool entries are handled', () => {
  const draw = createScrambleSampler('👀👨‍🚀🏳️‍🌈👀', () => 0.5)
  assert.deepEqual(new Set(Array.from({ length: 3 }, draw)), new Set(['👀', '👨‍🚀', '🏳️‍🌈']))
  assert.equal(createScrambleSampler('')(), '')
  assert.equal(createScrambleSampler('  ')(), '')
  const single = createScrambleSampler('⭐⭐')
  assert.equal(single(), '⭐')
  assert.equal(single(), '⭐')
})
test('letters and subsequent hovers share one 24-symbol cycle', () => {
  const seen = []
  for (let cycle = 0; cycle < 3; cycle++) {
    const h = mount()
    h.props.scrambleChars = 'ABCDEFGHIJKLMNOPQRSTUVWX'
    h.state.enter({ pointerType: 'mouse' })
    seen.push(h.state.glyphRef.value.textContent)
    for (let i = 1; i < 8; i++) {
      h.calls[0].target.elapsed = i * 0.3125
      h.calls[0].options.onUpdate()
      seen.push(h.state.glyphRef.value.textContent)
    }
    h.calls[0].options.onComplete()
    h.unmount()
  }
  assert.equal(seen.length, 24)
  assert.equal(new Set(seen).size, 24)
})

test('approved emoji pool contains 80 expressions and 48 other complete graphemes', () => {
  const h = mount()
  const groups = [
    '😀😃😄😁😆😅😂🤣', '😊😇🙂🙃😉😌😍🥰',
    '😘😗😙😚😋😛😝😜', '🤪🤨🧐🤓😎🥸🤩🥳',
    '😏😒😞😔😟😕🙁☹️', '😣😖😫😩🥺😢😭😤',
    '😠😡🤬🤯😳🥵🥶😱', '😨😰😥😓🤗🤔🫣🤭',
    '🫢🫡🤫🫠🤥😶😐😑', '😬🙄😯😮😲🥱😴🤤',
    '👀👻👽🤖💀🎃🤡👺', '🐸🐙🦊🐼🦋🦖🪼🦄',
    '🍄🌵🍀🌸🪐🌈⚡🔥', '🍒🍋🍉🍩🍕🍿🍭🧀',
    '🎲🧩🎯🎈🔮🧿🪩🗿', '📺📼📷🕹️💾🧲💎🚀',
  ]
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const split = text => Array.from(segmenter.segment(text), part => part.segment)
  assert.ok(groups.every(group => split(group).length === 8))
  assert.equal(split(groups.slice(0, 10).join('')).length, 80)
  assert.equal(h.props.scrambleChars, groups.join(''))
  const expected = new Set(split(h.props.scrambleChars))
  assert.equal(expected.size, 128)
  const draw = createScrambleSampler(h.props.scrambleChars)
  let previous
  for (let cycle = 0; cycle < 3; cycle++) {
    const values = Array.from({ length: 128 }, draw)
    assert.deepEqual(new Set(values), expected)
    assert.notEqual(values[0], previous)
    previous = values.at(-1)
  }
  h.unmount()
})

test('draft/card overlap prevents scrambling and stops a covered active glyph', () => {
  const h = mount()
  h.document.elementsFromPoint = () => [{ closest: () => ({}) }]
  h.state.enter({ pointerType: 'mouse', clientX: 50, clientY: 50 })
  assert.equal(h.calls.length, 0)
  h.document.elementsFromPoint = () => []
  h.state.enter({ pointerType: 'mouse', clientX: 50, clientY: 50 })
  assert.equal(h.calls.length, 1)
  h.document.elementsFromPoint = () => [{ closest: () => ({}) }]
  h.calls[0].target.elapsed = 0.3125
  h.calls[0].options.onUpdate()
  assert.equal(h.state.scrambling.value, false)
  assert.equal(h.state.glyphRef.value.textContent, 'S')
  assert.equal(h.killed(), 1)
  h.unmount()
})
