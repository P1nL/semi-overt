import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
function load(path, mocks = {}, globals = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(read(path).replaceAll('import.meta.env.DEV', 'true'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, ...globals, require(name) {
    if (name in mocks) return mocks[name]
    throw new Error('Unexpected dependency: ' + name)
  } })
  return module.exports
}
const motion = load('src/features/page-transition/model/choreography.ts')
const frames = load('src/shared/utils/animationFrame.ts')

test('view-only query changes do not run page replacement choreography', () => {
  const navigation = load('src/shared/utils/resultViewNavigation.ts')
  const route = { path: '/search', hash: '', query: { keyword: 'motion' } }
  assert.equal(navigation.isResultViewOnlyChange(route, { ...route, query: { view: 'list', keyword: 'motion' } }), true)
  assert.equal(navigation.isResultViewOnlyChange(route, { ...route, query: { view: 'list', keyword: 'different' } }), false)
  assert.equal(navigation.isResultViewOnlyChange(route, { ...route, path: '/category/QUICK' }), false)
  assert.equal(navigation.isResultViewOnlyChange(route, { ...route, hash: '#article' }), false)
  assert.match(read('src/features/page-transition/ui/PageTransition.vue'), /current\.kind === 'results' && isResultViewOnlyChange/)
})

test('infinite-to-list requests the native held target before receding, then admits the list', () => {
  const view = load('src/widgets/article-result-stream/view-motion.ts')
  const start = { press: 0, infiniteOpacity: 1, infiniteScale: 1, listX: 1 }
  assert.equal(view.viewSwitchPose('list', 0, start).press, 1, 'the native damping must receive the held target immediately')
  const held = view.viewSwitchPose('list', 180, start)
  assert.equal(held.press, 1)
  assert.equal(held.infiniteOpacity, 1)
  assert.equal(held.listX, 1)
  for (let time = 180; time <= 820; time += 20) {
    const hold = view.viewSwitchPose('list', time, start)
    assert.equal(hold.press, 1); assert.equal(hold.infiniteOpacity, 1)
    assert.equal(hold.infiniteScale, 1); assert.equal(hold.listX, 1)
  }
  const middle = view.viewSwitchPose('list', 1000, start)
  assert.ok(middle.infiniteOpacity > 0 && middle.infiniteOpacity < 1)
  assert.ok(middle.infiniteScale < 1)
  assert.equal(middle.listX, 1, 'list waits outside the viewport until the sphere has disappeared')
  const entering = view.viewSwitchPose('list', 1400, start)
  assert.equal(entering.infiniteOpacity, 0)
  assert.ok(entering.listX > 0 && entering.listX < 1)
  const end = view.viewSwitchPose('list', view.VIEW_SWITCH_DURATION.list, start)
  assert.equal(end.infiniteOpacity, 0); assert.equal(end.listX, 0)
})

test('scripted press and physical press share the unchanged native camera damping', () => {
  const camera = load('src/widgets/article-infinite-menu/model/press-camera.ts')
  for (const velocity of [0, .02]) {
    let expected = 3, actual = 3
    for (let i = 0; i < 100; i++) {
      const pressed = i < 40
      const dt = [1000 / 60, 16, 32, 12][i % 4]
      const scale = dt / (1000 / 60) + .0001
      const target = 3 + (pressed ? velocity * 80 + 2.5 : 0)
      expected += (target - expected) / ((pressed ? 7 : 5) / scale)
      actual = camera.stepPressCamera(actual, 3, pressed, velocity, dt, 1000 / 60)
      assert.equal(actual, expected)
    }
  }
  const renderer = read('src/widgets/article-infinite-menu/model/infinite-grid-menu.js')
  assert.match(renderer, /this\.control\.update\(deltaTime, this\.TARGET_FRAME_DURATION,[\s\S]*?this\.presentationPress === null \? null : this\.presentationPress > 0\)/)
  assert.match(renderer, /const held = heldOverride === null \? this\.isPointerDown : heldOverride/)
  assert.match(renderer, /const pressed = controlled \? this\.presentationPress > 0 : this\.control\.isPointerDown/)
  assert.match(renderer, /this\.camera\.position\[2\] = stepPressCamera/)
})

test('list-to-infinite leaves left, reveals a held sphere, then smoothly releases it', () => {
  const view = load('src/widgets/article-result-stream/view-motion.ts')
  const start = { press: 1, infiniteOpacity: 0, infiniteScale: .88, listX: 0 }
  const held = view.viewSwitchPose('infinite', 350, start)
  assert.equal(held.press, 1)
  assert.ok(held.listX < 0 && held.infiniteOpacity > 0)
  assert.ok(view.viewSwitchPose('infinite', 750, start).press < 1)
  const end = view.viewSwitchPose('infinite', view.VIEW_SWITCH_DURATION.infinite, start)
  assert.equal(end.press, 0); assert.equal(end.listX, -1); assert.equal(end.infiniteOpacity, 1)
  const interrupted = view.viewSwitchPose('list', 470, { press: 0, infiniteOpacity: 1, infiniteScale: 1, listX: 1 })
  for (const key of Object.keys(interrupted)) assert.equal(view.viewSwitchPose('infinite', 0, interrupted)[key], interrupted[key])
})

test('full-bleed view stage does not clip edges or collapse the stationary toggle anchor', () => {
  const source = read('src/widgets/article-result-stream/ArticleResultStream.vue')
  assert.match(source, /\.article-result-stream \{[^}]*display: flex;[^}]*overflow: visible/)
  assert.match(source, /\.article-result-stream__stage \{[^}]*width: 100vw/)
  assert.match(source, /\.article-result-stream__panel \{[^}]*display: flow-root/)
  assert.ok(!source.includes('overflow-x: clip'))
  assert.ok(!source.includes('mode="out-in"'))
  assert.ok(source.indexOf('class="article-result-stream__view-toggle"') < source.indexOf('ref="stage"'))
  const renderer = read('src/widgets/article-infinite-menu/model/infinite-grid-menu.js')
  assert.match(renderer, /3 \* this\.scaleFactor \+ 2\.5 \* this\.presentationPress/)
  assert.match(renderer, /resume\(\) \{ if \(!this\.animationFrame/)
})

test('faster scene budgets include the full 2.5 second home exit', () => {
  for (const from of ['home', 'results', 'profile']) for (const to of ['home', 'results', 'profile']) {
    if (from === 'home' && to === 'home') continue
    assert.ok(motion.routeDuration(from, to) <= 4500)
  }
  assert.equal(motion.LEAVE_DURATION.home, 2500)
  assert.equal(motion.SCENE_DURATION.home, 2000)
  assert.equal(motion.RESULT_SCALE_DURATION.enter, 1100)
  assert.equal(motion.RESULT_SCALE_DURATION.leave, 850)
  assert.equal(motion.routeDuration('home', 'results'), 4500)
  assert.equal(motion.routeDuration('results', 'home'), 3500)
  assert.equal(motion.routeDuration('home', 'profile'), 4500)
  assert.equal(motion.routeDuration('profile', 'results'), 4000)
  assert.equal(motion.routeDuration('profile', 'profile'), 2000)
  assert.equal(motion.routeDuration('results', 'results'), 2000)
})

test('each glyph falls directly to its slot, keeps its pose and finishes within two seconds', () => {
  const angles = new Set()
  for (let index = 0; index < 32; index++) {
    const angle = -180 + index * 11.5
    const first = motion.fallingPose(0, index, 500, angle)
    const end = motion.fallingPose(2000, index, 500, angle)
    assert.equal(first.y, -500)
    assert.ok(Math.abs(end.y) < 1e-8)
    assert.equal(end.angle, angle)
    assert.equal(end.complete, true)
    angles.add(end.angle)
  }
  assert.ok(angles.size > 5)
  assert.ok([...angles].some(angle => Math.abs(angle) > 160))
})

test('fall starts fast, decelerates to zero landing speed and never rebounds', () => {
  const ys = [500, 700, 900, 1100].map(t => motion.fallingPose(t, 0, 500, 37).y)
  assert.ok(ys[3] - ys[2] < ys[2] - ys[1])
  assert.ok(ys[2] - ys[1] < ys[1] - ys[0])
  for (let index = 0; index < 32; index++) {
    const start = 40 + (index % 7) * 16
    const duration = 1260 + (index % 5) * 32
    const landingTime = start + duration
    assert.equal(motion.fallingPose(start + duration / 2, index, 500, 37).y, -125, 'quadratic ease-out covers 75% of the fall by halfway')
    const h = .001
    const endVelocity = (motion.fallingPose(landingTime, index, 500, 37).y - motion.fallingPose(landingTime - h, index, 500, 37).y) / h
    assert.ok(Math.abs(endVelocity) < 1e-6, 'one-sided landing velocity tends to zero, without a hard stop')
    for (let t = landingTime; t <= 2200; t += 10) {
      const pose = motion.fallingPose(t, index, 500, 37)
      assert.equal(pose.y, 0)
      assert.equal(pose.angle, 37)
      assert.equal(pose.complete, true)
    }
  }
  assert.equal(motion.fallingPose(1450, 0, 500, 37).angle, 37)
})

test('upper and lower home elements share one accelerating exit curve', () => {
  assert.equal(motion.homeExitProgress(1000), 0)
  assert.equal(motion.homeExitProgress(2500), 1)
  const p = [1000, 1300, 1600, 1900, 2200, 2500].map(time => motion.homeExitProgress(time))
  for (let i = 2; i < p.length; i++) assert.ok(p[i] - p[i - 1] > p[i - 1] - p[i - 2])
  const scene = read('src/features/page-transition/model/scene.ts')
  assert.equal((scene.match(/homeExitClock\.pull\(/g) ?? []).length, 2)
})

test('each entrance draws new poses, while a glyph keeps its sampled pose across frames', () => {
  let seed = 19
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  const first = Array.from({ length: 18 }, () => motion.randomLandingAngle(random))
  const second = Array.from({ length: 18 }, () => motion.randomLandingAngle(random))
  assert.notDeepEqual(first, second)
  assert.ok(first.every((angle, i) => angle !== second[i]))
  first.forEach((angle, i) => assert.equal(motion.fallingPose(4000, i, 500, angle).angle, angle))
  const ring = read('src/widgets/hero-section/HeroTitleRing.vue')
  assert.ok(!ring.includes('returnedHome'))
  assert.match(ring, /pageMotion\.phase\.value !== 'idle'/)
})

test('pixel refinement uses image blocks and reaches full resolution', () => {
  const steps = [0, .15, .35, .6, .8, 1].map(p => motion.pixelResolution(p, 80))
  assert.equal(steps[0], 4)
  assert.equal(steps[steps.length - 1], 80)
  assert.ok(new Set(steps).size >= 4)
  assert.ok(steps.every((n, i) => i === 0 || n >= steps[i - 1]))
})

test('every glyph uses a fresh local-plane roll without added XYZ tumbling', () => {
  let seed = 42
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  for (let run = 0; run < 18; run++) {
    const first = motion.randomLandingRotation(random)
    const second = motion.randomLandingRotation(random)
    assert.notDeepEqual(first, second)
    for (let t = 0; t <= 4000; t += 20) {
      const rotation = motion.fallingRotation(t, 0, first)
      assert.equal(rotation.x, 0); assert.equal(rotation.y, 0)
      if (t >= 1300) assert.deepEqual(rotation, first, 'landing must preserve the sampled pose without further motion')
    }
    assert.notEqual(first.z, 0)
  }
})

test('cold profile refresh starts hidden after router readiness and waits for actual content', () => {
  const main = read('src/app/main.ts')
  assert.ok(main.indexOf('router.isReady()') < main.indexOf("app.mount('#app')"))
  const transition = read('src/features/page-transition/ui/PageTransition.vue')
  assert.match(transition, /if \(initialEntry\) initial\.phase = 'enter'/)
  assert.match(transition, /scenes\.get\(initial\.id\)\?\.play/)
  const scene = read('src/features/page-transition/ui/PageScene.vue')
  assert.match(scene, /options\.kind === 'profile' \|\| options\.kind === 'results'/)
  assert.match(scene, /whenReady\(\(\) => \{ started = true; start\(\) \}\)/)
  assert.match(scene, /if \(!started\) cancel = release/)
})

test('flat glyphs have no added X/Y tilt in any frame, including before landing', () => {
  let seed = 20261008
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  let sideways = false, upsideDown = false
  for (let i = 0; i < 300; i++) {
    const landing = motion.randomLandingRotation(random)
    assert.equal(landing.x, 0)
    assert.equal(landing.y, 0)
    sideways ||= Math.abs(landing.z) > 70 && Math.abs(landing.z) < 110
    upsideDown ||= landing.z > 160
    for (let t = 0; t <= 4000; t += 16) {
      const rotation = motion.fallingRotation(t, i, landing)
      assert.equal(rotation.x, 0, 'X stays zero in every frame, not just at rest')
      assert.equal(rotation.y, 0)
    }
    assert.deepEqual(motion.fallingRotation(4000, i, landing), landing)
  }
  assert.ok(sideways && upsideDown, 'random Z still supports sideways and inverted poses')
  const scene = read('src/features/page-transition/model/scene.ts')
  assert.ok(!scene.includes('planarYaw'), 'never zero out inherited orbit yaw')
  assert.match(scene, /owned\.set\('--glyph-local-roll'/)
  assert.match(scene, /owned\.restore\(reverse \? \[\] : \['--glyph-local-roll'\]\)/)
})

test('local roll follows radial yaw, preserving the plane normal for letters, eye and cube', () => {
  const ring = read('src/widgets/hero-section/HeroTitleRing.vue')
  for (const yaw of ['glyph', 'eye']) {
    assert.ok(ring.includes(`rotateY(var(--${yaw}-orbit-yaw, 0rad)) rotateZ(var(--glyph-local-roll, 0deg))`))
  }
  const cube = read('src/widgets/hero-section/HeroCubeGlyph.vue')
  assert.match(cube, /rotateY\(calc\([^;]+\)\) rotateZ\(var\(--glyph-local-roll, 0deg\)\)/)
})

test('missing avatar animates the real initials, never a different bitmap, and restores on cancellation', () => {
  class Element {
    children = []
    style = {
      getPropertyValue(key) { return this[key] ?? '' },
      getPropertyPriority() { return '' },
      setProperty(key, value) { this[key] = value },
      removeProperty(key) { delete this[key] },
    }
    append(node) { this.children.push(node); node.parent = this }
    remove() { this.parent.children = this.parent.children.filter(n => n !== this) }
    setAttribute() {}
    querySelector() { return null }
    getBoundingClientRect() { return { width: 104 } }
  }
  const effects = load('src/features/page-transition/model/effects.ts', {
    '@/shared/utils/buttonBurst': {}, './choreography': motion,
  }, { HTMLElement: Element, document: {
    createElement() { assert.fail('a missing avatar must not allocate a canvas') },
    createElementNS() { return new Element() },
  } })
  for (const reverse of [false, true]) {
    const avatar = new Element(), initials = new Element()
    initials.textContent = 'TU'; initials.style.fontSize = '32px'; initials.style.opacity = '.9'
    avatar.style.background = 'var(--color-surface-elevated)'; avatar.append(initials)
    const effect = effects.avatarEffect(avatar, reverse)
    effect.paint(0)
    assert.equal(initials.style.opacity, reverse ? '1' : '0')
    effect.paint(900)
    assert.equal(initials.style.opacity, '1')
    assert.equal(initials.style.fontSize, '32px')
    assert.equal(initials.textContent, 'TU')
    assert.equal(avatar.style.background, 'var(--color-surface-elevated)')
    effect.dispose()
    assert.equal(avatar.children.length, 1)
    assert.equal(avatar.children[0], initials)
    assert.equal(initials.style.opacity, '.9')
  }
})

test('ropes interleave with orbit glyphs instead of a viewport foreground overlay', () => {
  const scene = read('src/features/page-transition/model/scene.ts')
  assert.match(scene, /orbit\.insertBefore\(rope, orbitGlyph\)/)
  assert.match(scene, /rope\.style\.zIndex = orbitGlyph\.style\.zIndex/)
  assert.match(scene, /rope\.getScreenCTM\(\)\?\.inverse\(\)/)
})

test('entrance stays hidden until first paint and text streams cannot paint premature ellipsis', () => {
  const scene = read('src/features/page-transition/ui/PageScene.vue')
  assert.ok(scene.indexOf('cancel = playScene(') < scene.indexOf('prepared.value = true'))
  assert.match(read('src/features/page-transition/ui/PageTransition.vue'), /data-motion-prepared="false"[\s\S]*opacity: 0 !important/)
  const effects = read('src/features/page-transition/model/effects.ts')
  assert.match(effects, /clone\.style\.textOverflow = 'clip'/)
  assert.match(effects, /owned\.set\('text-overflow', 'clip'\)/)
})

test('rope endpoint selects a real topmost silhouette point, not the box center', () => {
  const geometry = load('src/features/page-transition/model/ropeAnchor.ts', { './effects': {} })
  const top = geometry.topmostPoint([{ x: 12, y: 3 }, { x: 30, y: 10 }, { x: 22, y: 4 }], 22)
  assert.equal(top.x, 12)
  assert.equal(top.y, 3)
})

test('ropes remain invisible until their precise anchor is locked, then connect before lifting', () => {
  assert.equal(motion.ropeConnectProgress(0), 0)
  assert.equal(motion.ropeConnectProgress(motion.ROPE_CONNECT_START), 0)
  assert.equal(motion.ropeConnectProgress(1150), 1)
  assert.equal(motion.homeExitProgress(900), 0)
  const scene = read('src/features/page-transition/model/scene.ts')
  assert.match(scene, /attachment \? homeExitClock\.connection\(elapsed\) : 0/)
  assert.match(scene, /rope\.style\.visibility = attachment && homeExitClock\.ready \? 'visible' : 'hidden'/)
})

test('slow anchor preparation cannot skip the rope descent or start pulling before connection', () => {
  for (const readyAt of [550, 750, 1100]) {
    const clock = motion.createRopeDescentClock()
    assert.equal(clock.ready, false)
    assert.equal(clock.connection(readyAt), 0)
    assert.equal(clock.pull(readyAt), 0)
    clock.start(readyAt)
    assert.equal(clock.ready, true)
    assert.equal(clock.connection(readyAt), 0, 'first drawable frame must have zero length')
    assert.ok(clock.connection(readyAt + 16) < .03, 'next frame only grows a small segment from the top')
    assert.equal(clock.connection(readyAt + 300), .5)
    assert.equal(clock.connection(readyAt + 600), 1)
    assert.equal(clock.pull(readyAt + 600), 0, 'do not pull an unconnected rope')
    clock.start(readyAt + 400)
    assert.equal(clock.connection(readyAt + 600), 1, 'later glyph callbacks cannot reset the shared clock')
    assert.equal(clock.pull(2500), 1, 'upper and lower exits still finish at 2.5 seconds')
  }
  const scene = read('src/features/page-transition/model/scene.ts')
  assert.match(scene, /if \(!pendingHomeAnchors\.size\) homeExitClock\.start\(performance\.now\(\) - started\)/)
})

test('result hints do not transition from visible to hidden during preparation; dots are streamable text', () => {
  const widget = read('src/widgets/article-infinite-menu/ArticleInfiniteMenu.vue')
  assert.match(widget, /\.article-infinite-menu__hint \{[^}]*opacity: 0;/)
  assert.match(read('src/features/page-transition/ui/PageTransition.vue'), /:not\(\[data-motion-phase="idle"\]\) \.article-infinite-menu__hint,/)
  assert.ok(!widget.includes("content: '·'"))
  assert.equal((widget.match(/class="article-infinite-menu__separator" aria-hidden="true">·<\/span>/g) ?? []).length, 4)
})

test('profile review changes animate both directions and preserve the article layout on cancellation', () => {
  const effects = load('src/features/page-transition/model/effects.ts', {
    '@/shared/utils/buttonBurst': {}, './choreography': motion,
  })
  const layout = load('src/features/page-transition/model/profileLayout.ts', { './choreography': motion, './effects': effects }, { innerWidth: 1440 })
  class Node {
    children = []; dataset = {}; attrs = {}
    style = {
      getPropertyValue(key) { return this[key] ?? '' }, getPropertyPriority() { return '' },
      setProperty(key, value) { this[key] = value }, removeProperty(key) { delete this[key] },
    }
    constructor(top = 0) { this.top = top }
    getBoundingClientRect() { return { left: 100, top: this.top, width: 1000, height: 250 } }
    cloneNode() { return new Node(this.top) }
    querySelectorAll() { return [] }
    setAttribute(k, v) { this.attrs[k] = v }
    removeAttribute(k) { delete this.attrs[k] }
    append(node) { this.children.push(node); node.parent = this }
    remove() { this.parent.children = this.parent.children.filter(n => n !== this) }
  }
  const makeRoot = (hasReview, top) => {
    const root = new Node(top)
    root.articles = new Node(top + (hasReview ? 900 : 600))
    root.review = hasReview ? new Node(top + 550) : null
    root.querySelector = selector => selector === '.profile-content-layout' ? root.articles : root.review
    return root
  }
  for (const entering of [false, true]) {
    const previous = layout.snapshotProfileLayout(makeRoot(!entering, 80))
    const root = makeRoot(entering, -120)
    const effect = layout.profileLayoutEffect(root, previous)
    assert.ok(effect)
    effect.paint(0)
    assert.equal(root.articles.style.translate, entering ? '0 -300px' : '0 300px')
    if (entering) assert.equal(root.review.style.opacity, '0')
    else { assert.equal(root.children.length, 1); assert.equal(root.children[0].inert, true) }
    effect.paint(1500)
    assert.equal(root.articles.style.translate, '0 0px')
    if (entering) assert.equal(root.review.style.opacity, '1')
    else assert.equal(root.children[0].style.opacity, '0')
    effect.dispose()
    assert.equal(root.children.length, 0)
    assert.equal(root.articles.style.translate, undefined)
    const cancelled = layout.profileLayoutEffect(root, previous)
    cancelled.paint(200)
    assert.equal(root.articles.style.translate, entering ? '0 -300px' : '0 300px', 'late setup must still start at the old slot')
    cancelled.dispose()
    assert.equal(root.children.length, 0)
    assert.equal(root.articles.style.translate, undefined)
  }
  assert.equal(layout.profileLayoutEffect(makeRoot(true, 0), layout.snapshotProfileLayout(makeRoot(true, 0))), null)
})

test('canvas motion isolates main-card scale from surrounding-card opacity', () => {
  const bridge = load('src/shared/utils/resultCardMotion.ts')
  const canvas = { dataset: {} }
  bridge.setResultCardMotion(canvas, { mainScale: .3, othersOpacity: .8 })
  assert.equal(bridge.getResultCardMotion(canvas).mainScale, .3)
  assert.equal(bridge.getResultCardMotion(canvas).othersOpacity, .8)
  bridge.clearResultCardMotion(canvas)
  assert.equal(bridge.getResultCardMotion(canvas), undefined)
  const shader = read('src/widgets/article-infinite-menu/model/infinite-grid-menu.js')
  assert.match(shader, /if \(gl_InstanceID == uTransitionMain\)/)
  assert.match(shader, /mix\(centerNdc, gl_Position.xy \/ gl_Position.w, uMainScale\)/)
})

test('leave effects retain their offscreen endpoint until unmount, preventing a static-page flash', () => {
  const timers = []
  let translate = '', finished = false, now = 0
  const child = { dataset: { pageMotion: 'home-bottom' }, closest: () => null, getBoundingClientRect: () => ({ top: 100 }) }
  const root = { querySelectorAll: () => [child], dataset: {} }
  const scene = load('src/features/page-transition/model/scene.ts', {
    '@/shared/utils/motionClock': { motionTimer(duration, paint, done) { paint(0); timers.push({ duration, paint, done }); return () => {} } },
    '@/shared/utils/resultCardMotion': {},
    './choreography': motion,
    './ropeAnchor': {},
    './profileLayout': {},
    './effects': { styles() { return { set(key, value) { if (key === 'translate') translate = value }, restore() { translate = '' } } } },
  }, { performance: { now: () => now }, innerHeight: 900, MutationObserver: class { observe() {} disconnect() {} } })
  const stop = scene.playScene(root, { kind: 'home', phase: 'leave' }, () => { finished = true })
  now = 2500
  timers.forEach(t => { t.paint(t.duration); t.done() })
  assert.ok(finished)
  assert.equal(translate, '0 832px')
  stop()
  assert.equal(translate, '')
})

test('canvas stays hidden until the renderer consumes the current motion state', () => {
  const bridge = load('src/shared/utils/resultCardMotion.ts')
  const canvas = { dataset: {} }
  const first = { mainScale: 0, othersOpacity: 0 }
  const next = { mainScale: .05, othersOpacity: 0 }
  bridge.setResultCardMotion(canvas, first)
  assert.ok('resultMotionPending' in canvas.dataset)
  bridge.markResultCardMotionRendered(canvas, undefined)
  assert.ok('resultMotionPending' in canvas.dataset, 'static frame cannot reveal the canvas')
  bridge.setResultCardMotion(canvas, next)
  bridge.markResultCardMotionRendered(canvas, first)
  assert.ok('resultMotionPending' in canvas.dataset, 'stale frame cannot reveal the canvas')
  bridge.markResultCardMotionRendered(canvas, next)
  assert.ok(!('resultMotionPending' in canvas.dataset))
  assert.equal(canvas.dataset.renderedMainScale, '0.0500')
  bridge.setResultCardMotion(canvas, { mainScale: .1, othersOpacity: .1 })
  assert.ok(!('resultMotionPending' in canvas.dataset), 'do not hide on every later frame')
  bridge.clearResultCardMotion(canvas)
  assert.deepEqual(canvas.dataset, {})
  const renderer = read('src/widgets/article-infinite-menu/model/infinite-grid-menu.js')
  assert.ok(renderer.indexOf('gl.drawElementsInstanced(') < renderer.indexOf('markResultCardMotionRendered(this.canvas, motion)'))
  assert.match(read('src/widgets/article-infinite-menu/ArticleInfiniteMenu.vue'), /\[data-result-motion-pending\][^}]*visibility: hidden/)
})

test('staged descendants cannot expose themselves; profile text and whole cover use the corrected hooks', () => {
  assert.match(read('src/features/page-transition/ui/PageTransition.vue'), /page-motion-scene--staged[^}]*opacity: 0 !important/)
  assert.match(read('src/widgets/profile-header/ProfileHeader.vue'), /white-space: nowrap/)
  const scene = read('src/features/page-transition/model/scene.ts')
  assert.match(scene, /el\.matches\('\.profile-header-tilt'\)/)
  assert.match(scene, /role === 'writing-stats'/)
})

for (const hz of [60, 120, 144, 165, 240]) test(`${hz} Hz input produces at most 60 updates per second without slowing time`, () => {
  const limiter = frames.createFrameLimiter(60)
  let count = 0, elapsed = 0
  for (let i = 0; i < hz * 4; i++) {
    const dt = limiter.consume(i * 1000 / hz)
    if (dt !== null) { count++; elapsed += dt }
  }
  assert.ok(count <= 240, String(count))
  assert.ok(count >= 238, String(count))
  assert.ok(elapsed > 3950)
})

test('one global clock cancels jobs and does not double-schedule when a completion starts the next scene', () => {
  const raf = new Map()
  let now = 0, id = 0
  const clock = load('src/shared/utils/motionClock.ts', { './animationFrame': frames }, {
    performance: { now: () => now },
    requestAnimationFrame(fn) { raf.set(++id, fn); return id },
    cancelAnimationFrame(key) { raf.delete(key) },
  })
  let completed = 0, paints = 0
  clock.motionTimer(100, () => paints++, () => {
    completed++
    clock.motionTimer(100, () => paints++, () => completed++)
  })
  for (now = 0; now < 300; now += 1000 / 120) {
    const pending = [...raf.values()]; raf.clear()
    assert.ok(pending.length <= 1)
    pending.forEach(fn => fn(now))
  }
  assert.equal(completed, 2)
  assert.equal(raf.size, 0)
  assert.ok(paints <= 17)
  const stop = clock.motionTimer(1000, () => {}, () => assert.fail('cancelled job completed'))
  stop()
  assert.equal(raf.size, 0)
})

test('opening and route bursts share identical ray geometry', () => {
  const burst = load('src/shared/utils/buttonBurst.ts')
  assert.equal(burst.BUTTON_BURST_RAYS.length, 12)
  assert.equal(burst.buttonBurstRay(0, 0).x1, 20)
  assert.equal(burst.buttonBurstRay(0, 0).x2, 32)
  assert.equal(burst.buttonBurstRay(0, 1).x1, 40)
  assert.equal(burst.buttonBurstRay(0, 1).x2, 40)
  assert.match(read('src/widgets/app-header/HeaderIntroEffects.vue'), /buttonBurstRay/)
})
