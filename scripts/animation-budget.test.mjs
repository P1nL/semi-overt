import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createFrameLimiter } from '../src/shared/utils/animationFrame.ts'
import * as introChoreography from '../src/features/home-intro/model/choreography.ts'

for (const refresh of [30, 60, 90, 120, 144, 240]) {
  test('60fps cap preserves elapsed time on ' + refresh + 'Hz input', () => {
    const clock = createFrameLimiter(60)
    let updates = 0, elapsed = 0
    for (let frame = 0; frame <= refresh * 10; frame++) {
      const delta = clock.consume(frame * 1000 / refresh)
      if (delta !== null) { updates++; elapsed += delta }
    }
    assert.ok(updates <= 601)
    assert.ok(updates >= Math.min(refresh, 60) * 10)
    assert.ok(Math.abs(elapsed - 10000) < 1000 / refresh + 0.01)
  })
}
test('pause reset discards hidden time and does not burst catch-up updates', () => {
  const clock = createFrameLimiter(60)
  assert.equal(clock.consume(0), 0)
  assert.equal(clock.consume(4), null)
  clock.reset()
  assert.equal(clock.consume(100000), 0)
  assert.equal(clock.consume(100001), null)
  assert.ok(clock.consume(100017) < 18)
  assert.ok(clock.consume(200000) > 99000)
  assert.equal(clock.consume(200001), null)
})

// Exercise the actual SFC setup functions without a browser or extra test dependencies.
function harness() {
  const mounts = [], unmounts = [], watchers = [], intersections = []
  const frames = new Map(), documentEvents = new Map()
  let id = 0, draws = 0, physicsSteps = 0
  const visible = { value: true }, reducedMotion = { value: false }
  const rect = { width: 1280, height: 720, left: 0, top: 0 }
  const host = { clientWidth: 1280, style: { setProperty() {} }, getBoundingClientRect: () => rect, appendChild() {} }
  const ctx = { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { draws++ } }
  const canvas = { ...host, addEventListener() {}, removeEventListener() {}, getContext: () => ctx }
  const vue = {
    defineComponent: c => c, ref: value => ({ value }), shallowRef: value => ({ value }),
    computed: getter => ({ get value() { return getter() } }),
    watch: (_, callback) => watchers.push(callback), onMounted: f => mounts.push(f), onBeforeUnmount: f => unmounts.push(f), onUnmounted: f => unmounts.push(f),
    useTemplateRef: name => ({ value: name === 'canvasRef' ? canvas : host }), inject: () => null,
  }
  class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z) }
    set(x, y, z) { this.x = x; this.y = y; this.z = z }
    distanceTo(p) { return Math.hypot(this.x-p.x, this.y-p.y, this.z-p.z) }
  }
  class World { addBody() {} addConstraint() {} step() { physicsSteps++ } }
  class Body { constructor(props) { Object.assign(this, props) } applyForce() {} }
  class Geometry { constructor(_, props) { this.attributes = props } remove() {} }
  class Renderer {
    constructor() { this.gl = { canvas, clearColor() {}, DYNAMIC_DRAW: 1, getExtension: () => ({ loseContext() {} }) } }
    setSize() {} render() { draws++ }
  }
  class Camera { constructor() { this.position = { z: 0 } } orthographic() {} }
  class Mesh { constructor(_, props) { Object.assign(this, props) } }
  const sandbox = {
    console, Math, Float32Array, Uint16Array, performance: { now: () => 0 },
    document: { hidden: false, addEventListener: (name, fn) => documentEvents.set(name, fn), removeEventListener: name => documentEvents.delete(name) },
    window: { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: f => { frames.set(++id, f); return id }, cancelAnimationFrame: n => frames.delete(n),
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { constructor(callback) { this.callback = callback; intersections.push(this) } observe() {} disconnect() { this.disconnected = true } },
    Element: class {},
  }
  function load(path, sfc = false, dependencies = {}) {
    const text = readFileSync(new URL('../' + path, import.meta.url), 'utf8')
    const source = sfc ? compileScript(parse(text).descriptor, { id: path }).content : text
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const exports = {}
    vm.runInNewContext(js, { ...sandbox, exports, require: name => {
      if (name in dependencies) return dependencies[name]
      if (name === 'vue') return vue
      if (name === '@/features/home-intro') return { ...introChoreography, useIntroTarget: () => null }
      if (name.endsWith('/animationFrame')) return { createFrameLimiter }
      if (name.endsWith('/useAnimationVisibility')) return { useAnimationVisibility: () => ({ visible, reducedMotion }) }
      if (name.endsWith('/usePupilWander')) return { usePupilWander: () => ({ style: {} }) }
      if (name.endsWith('/titleOrbit')) return { createTitleOrbit: () => [], advanceTitleOrbit: (phase, delta) => phase + delta, getTitleOrbitPose: () => ({}), getTitleOrbitHitDistance: () => Infinity }
      if (name.endsWith('/tesseract')) return { projectTesseract: time => [{ x: time, y: time, z: 0 }], tesseractEdges: [] }
      if (name === 'ogl') return { Renderer, Camera, Geometry, Mesh, Program: class { remove() {} } }
      if (name === 'cannon-es') return { World, Body, Vec3, Particle: class {}, DistanceConstraint: class {}, GSSolver: class {}, SAPBroadphase: class {} }
      if (name.endsWith('.vue')) return {}
      throw new Error('Unexpected import: ' + name)
    } }, { filename: path })
    return exports
  }
  return {
    visible, reducedMotion, frames, documentEvents, intersections, host, vue, sandbox,
    get draws() { return draws }, get physicsSteps() { return physicsSteps },
    mount: () => mounts.forEach(f => f()), flush: () => watchers.forEach(f => f()), unmount: () => unmounts.forEach(f => f()),
    step: now => { const pending = [...frames.values()]; frames.clear(); pending.forEach(f => f(now)) }, load,
  }
}
for (const file of ['HeroTitleRing.vue', 'HeroTesseract.vue']) {
  test(file + ' pauses offscreen/reduced motion and resumes without hidden-time jumps', () => {
    const h = harness()
    const component = h.load('src/widgets/hero-section/' + file, true).default
    const state = component.setup({ title: 'SEMI•OVERT', containerRef: h.host }, { expose() {} })
    state.root.value = h.host
    h.mount()
    assert.equal(h.frames.size, 1)
    h.step(0); h.step(17)
    h.visible.value = false; h.flush()
    assert.equal(h.frames.size, 0)
    h.visible.value = true; h.flush()
    assert.equal(h.frames.size, 1)
    h.step(100000)
    h.reducedMotion.value = true; h.flush()
    assert.equal(h.frames.size, 0)
    h.reducedMotion.value = false; h.flush()
    assert.equal(h.frames.size, 1)
    h.unmount()
    assert.equal(h.frames.size, 0)
  })
}
test('Cloth never simulates while the light theme is active; frequency stays 30fps', () => {
  const h = harness(), props = { active: false }
  h.load('src/shared/components/backgrounds/Cloth.vue', true).default.setup(props, { expose() {} })
  h.mount()
  assert.equal(h.frames.size, 0)
  assert.equal(h.physicsSteps, 0)
  props.active = true; h.flush()
  const initialDraws = h.draws
  for (let t = 0; t <= 1000; t += 1000 / 120) h.step(t)
  assert.ok(h.draws - initialDraws <= 31)
  assert.ok(h.physicsSteps > 0 && h.physicsSteps <= 62)
  props.active = false; h.flush()
  const previousSteps = h.physicsSteps
  h.step(2000)
  assert.equal(h.frames.size, 0)
  assert.equal(h.physicsSteps, previousSteps)
  props.active = true; h.visible.value = false; h.flush()
  assert.equal(h.frames.size, 0)
  h.visible.value = true; h.reducedMotion.value = true; h.flush()
  assert.equal(h.frames.size, 0)
  h.reducedMotion.value = false; h.flush()
  assert.equal(h.frames.size, 1)
  h.unmount()
  assert.equal(h.frames.size, 0)
})
test('Waves draws at most 60fps and stops for inactive, offscreen and reduced states', () => {
  const h = harness(), props = { active: true, xGap: 20, yGap: 32, waveSpeedX: .0125, waveSpeedY: .005, waveAmpX: 32, waveAmpY: 16, friction: .85, tension: .005, maxCursorMove: 100 }
  h.load('src/shared/components/backgrounds/Waves.vue', true).default.setup(props, { expose() {} })
  h.mount()
  const initial = h.draws
  for (let i = 0; i <= 144; i++) h.step(i * 1000 / 144)
  assert.ok(h.draws - initial <= 61)
  for (const state of ['theme', 'offscreen', 'reduced']) {
    if (state === 'theme') props.active = false
    if (state === 'offscreen') h.visible.value = false
    if (state === 'reduced') h.reducedMotion.value = true
    h.flush()
    assert.equal(h.frames.size, 0)
    props.active = true; h.visible.value = true; h.reducedMotion.value = false; h.flush()
    assert.equal(h.frames.size, 1)
  }
  h.unmount()
  assert.equal(h.frames.size, 0)
})
test('visibility policy follows the internal viewport, page visibility and injected scene state', () => {
  const h = harness(), scene = { content: { value: true }, background: { value: true } }
  h.vue.inject = () => scene
  const module = h.load('src/shared/composables/useAnimationVisibility.ts')
  const state = module.useAnimationVisibility({ value: h.host })
  h.mount()
  assert.equal(state.visible.value, true)
  h.intersections[0].callback([{ target: h.host, isIntersecting: false }])
  assert.equal(state.visible.value, false)
  h.intersections[0].callback([{ target: h.host, isIntersecting: true }])
  scene.content.value = false
  assert.equal(state.visible.value, false)
  scene.content.value = true
  h.sandbox.document.hidden = true
  h.documentEvents.get('visibilitychange')()
  assert.equal(state.visible.value, false)
  h.sandbox.document.hidden = false
  h.documentEvents.get('visibilitychange')()
  assert.equal(state.visible.value, true)
  h.unmount()
  assert.ok(h.intersections[0].disconnected)
  assert.equal(h.documentEvents.size, 0)
})
