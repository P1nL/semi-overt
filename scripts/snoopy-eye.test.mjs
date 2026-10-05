import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createSnoopyEyeTarget, eyeOpeningEase, eyeOpeningPath } from '../src/shared/utils/snoopyEye.ts'

function sequence(values) { let index = 0; return () => values[index++] }
test('eyelids open continuously from the slit with fixed corners and a gentle start/stop',()=>{
  assert.equal(eyeOpeningEase(-1),0)
  assert.equal(eyeOpeningEase(2),1)
  assert.equal(eyeOpeningEase(.5),.5)
  assert.ok(eyeOpeningEase(.25)<.2)
  let previous=0
  for(let i=0;i<=100;i++) {
    const p=eyeOpeningEase(i/100)
    assert.ok(p>=previous)
    const points=eyeOpeningPath(p).match(/-?\d+(?:\.\d+)?/g).map(Number)
    assert.deepEqual([points[0],points[1],points[4],points[5],points[8],points[9]],[7.5,50,92.5,50,7.5,50])
    assert.ok(Math.abs(points[3]+points[7]-100)<1e-9)
    assert.ok(Math.abs((points[7]-points[3])-100*p)<1e-9)
    previous=p
  }
  assert.ok(eyeOpeningEase(.001)<.00001)
  assert.ok(1-eyeOpeningEase(.999)<.00001)
})
test('intro morphs one opaque slit contour while the iris is revealed by the same aperture',()=>{
  const overlay=readFileSync(new URL('../src/features/home-intro/ui/HomeIntroOverlay.vue',import.meta.url),'utf8')
  const eye=readFileSync(new URL('../src/shared/components/SnoopyEye.vue',import.meta.url),'utf8')
  const component=overlay.match(/<SnoopyEye[^>]+>/)[0]
  assert.match(component,/:openness="opened"/)
  assert.match(component,/:disc-opacity="blend"/)
  assert.match(component,/:outline-opacity="0"/)
  assert.doesNotMatch(component,/:style|v-if/)
  assert.match(overlay,/const opening = computed\(\(\) => eyeOpeningPath\(opened.value\)\)/)
  const lids=overlay.match(/<path class="home-intro-eyelids"[^>]+>/)[0]
  assert.match(lids,/:d="opening"/)
  assert.doesNotMatch(lids,/opacity|v-if/)
  assert.doesNotMatch(overlay.match(/<svg class="home-intro-eye-lines"[^>]+>/)[0],/opacity/)
  assert.match(eye,/<clipPath[^>]+><path :d="opening"/)
  assert.match(eye,/discOpacity: 1, outlineOpacity: 1/)
  assert.match(eye,/props.openness < 1 \|\| !props.autonomous/)
})
test('random gaze occasionally returns to center', () => {
  const pose = createSnoopyEyeTarget(sequence([0, 0.1, 0.5, 0.5]))
  assert.deepEqual(pose.iris, { xPercent: 0, yPercent: 0 })
  assert.deepEqual(pose.pupil, { xPercent: 0, yPercent: 0 })
})
test('iris and pupil move in the same randomly selected direction', () => {
  const pose = createSnoopyEyeTarget(sequence([0, 0.9, 1, 0, 0]))
  assert.equal(pose.iris.xPercent, 2.375)
  assert.equal(pose.pupil.xPercent, 73.625)
  assert.equal(pose.pupil.yPercent, 0)
  assert.equal(pose.duration, 0.13)
  assert.equal(pose.pause, 900)
})
test('random poses remain bounded and include a fixation pause', () => {
  let seed = 123
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  for (let i = 0; i < 500; i++) {
    const pose = createSnoopyEyeTarget(random)
    assert.ok(Math.hypot(pose.pupil.xPercent, pose.pupil.yPercent) <= 77.5 * 0.95 + 1e-9)
    assert.ok(Math.hypot(pose.iris.xPercent, pose.iris.yPercent) <= 2.5 * 0.95 + 1e-9)
    assert.ok(pose.duration >= 0.13 && pose.duration <= 0.22)
    assert.ok(pose.pause >= 900 && pose.pause <= 2400)
  }
})

function mountEye({ hidden = false, reduce = false } = {}) {
  // Execute component setup against mocks only: no browser or DOM.
  const source = readFileSync(new URL('../src/shared/components/SnoopyEye.vue', import.meta.url), 'utf8')
  const setup = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const code = ts.transpileModule(setup, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const events = new Map(), mediaEvents = new Map(), timers = new Map()
  const tweens = [], resets = [], killed = []
  let id = 0, mount, unmount
  const media = {
    matches: reduce,
    addEventListener: (name, fn) => mediaEvents.set(name, fn),
    removeEventListener: name => mediaEvents.delete(name),
  }
  const documentMock = {
    visibilityState: hidden ? 'hidden' : 'visible',
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: name => events.delete(name),
  }
  const windowMock = {
    setTimeout: (callback, delay) => { timers.set(++id, { callback, delay }); return id },
    clearTimeout: timer => timers.delete(timer),
    addEventListener: () => { throw Error('Eye must not listen to mouse or resize events') },
  }
  const gsapMock = {
    to: (element, pose) => tweens.push({ element, pose }),
    set: (element, pose) => resets.push({ element, pose }),
    killTweensOf: element => killed.push(element),
  }
  const pose = { iris: { xPercent: 1, yPercent: -1 }, pupil: { xPercent: 31, yPercent: -31 }, duration: 0.2, pause: 1500 }
  new Function('onBeforeUnmount', 'onMounted', 'ref', 'gsap', 'createSnoopyEyeTarget', 'window', 'document', 'matchMedia', 'defineProps', 'withDefaults', 'computed', 'useId', 'watch', 'eyeOpeningPath', code)(
    fn => { unmount = fn }, fn => { mount = fn }, () => ({ value: {} }), gsapMock,
    () => pose, windowMock, documentMock, () => media,
    () => ({}), (props, defaults) => Object.assign(props, defaults), fn => ({ get value() { return fn() } }), () => 'test', () => {}, eyeOpeningPath,
  )
  mount()
  const fireTimer = () => { const [key, timer] = timers.entries().next().value; timers.delete(key); timer.callback() }
  return { media, mediaEvents, document: documentMock, events, timers, tweens, resets, killed, fireTimer, unmount }
}
test('eye moves by timer then pauses, without mouse listeners', () => {
  const h = mountEye()
  assert.equal(h.timers.size, 1)
  assert.equal([...h.timers.values()][0].delay, 700)
  h.fireTimer()
  assert.equal(h.tweens.length, 2)
  assert.equal(h.tweens.at(-1).pose.xPercent, 31)
  assert.equal([...h.timers.values()][0].delay, 1700)
  h.fireTimer()
  assert.equal(h.tweens.length, 4)
  assert.equal(h.timers.size, 1)
  h.unmount()
})
test('reduced motion and hidden pages suspend and resume random gaze', () => {
  const h = mountEye()
  h.media.matches = true
  h.mediaEvents.get('change')()
  assert.equal(h.timers.size, 0)
  assert.equal(h.resets.at(-1).pose.xPercent, 0)
  h.media.matches = false
  h.mediaEvents.get('change')()
  assert.equal(h.timers.size, 1)
  h.document.visibilityState = 'hidden'
  h.events.get('visibilitychange')()
  assert.equal(h.timers.size, 0)
  h.document.visibilityState = 'visible'
  h.events.get('visibilitychange')()
  assert.equal(h.timers.size, 1)
  h.unmount()
})
test('initial reduced-motion / hidden state never schedules movement', () => {
  for (const options of [{ reduce: true }, { hidden: true }]) {
    const h = mountEye(options)
    assert.equal(h.timers.size, 0)
    assert.equal(h.tweens.length, 0)
    h.unmount()
  }
})
test('unmount clears timers/listeners/tweens and late callbacks cannot restart', () => {
  const h = mountEye()
  const callback = [...h.timers.values()][0].callback
  h.unmount()
  assert.equal(h.timers.size, 0)
  assert.equal(h.events.size, 0)
  assert.equal(h.mediaEvents.size, 0)
  assert.ok(h.killed.length >= 2)
  callback()
  assert.equal(h.timers.size, 0)
  assert.equal(h.tweens.length, 0)
})
