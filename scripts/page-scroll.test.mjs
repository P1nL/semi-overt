import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
function load(source, mocks = {}, globals = {}, suffix = '') {
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  const context = vm.createContext({ module, exports: module.exports, ...globals, require(name) {
    if (name in mocks) return mocks[name]
    throw new Error('Unexpected dependency: ' + name)
  } })
  vm.runInContext(code + suffix, context)
  return module.exports
}
function harness() {
  const calls = [], anchors = new Map()
  let reduced = false
  const document = { getElementById: id => anchors.get(id) ?? null, documentElement: { style: { overflow: '' } }, body: { style: { overflow: '', position: '', top: '', left: '', right: '', width: '' } } }
  const window = { matchMedia: () => ({ matches: reduced }), requestAnimationFrame: () => 1, cancelAnimationFrame() {}, addEventListener() {}, removeEventListener() {} }
  const api = load(read('src/shared/utils/pageScroll.ts'), {}, { document, window })
  const element = { scrollLeft: 0, scrollTop: 0, getBoundingClientRect: () => ({ top: 0 }), contains: target => [...anchors.values()].includes(target), scrollTo(options) { this.scrollLeft = options.left; this.scrollTop = options.top; calls.push({ ...options }) } }
  return { api, element, calls, anchors, document, window, setReduced: value => { reduced = value } }
}
function routerHarness(h) {
  let options
  const guards = [], after = []
  const router = { beforeEach: fn => guards.push(fn), afterEach: fn => after.push(fn) }
  const exports = load(read('src/app/router/index.ts'), {
    'vue-router': { createRouter: value => { options = value; return router }, createWebHistory: () => ({}) },
    '@/app/router/guards': { setupRouterGuards() {} },
    '@/app/router/routes/admin': { adminRoutes: [] },
    '@/app/router/routes/creator': { creatorRoutes: [] },
    '@/app/router/routes/public': { publicRoutes: [] },
    '@/shared/config/env': { ENV: { routerBase: '/' } },
    '@/shared/utils/pageScroll': h.api,
  })
  exports.createAppRouter()
  return { options, guards, after }
}
const route = (fullPath, sheet = false) => ({ fullPath, path: fullPath.split('?')[0], hash: '', meta: sheet ? { presentation: 'sheet' } : {} })

test('scroll requests wait for mounting and page transitions; latest request wins', () => {
  const h = harness()
  h.api.requestPageScroll({ top: 320 })
  assert.equal(h.calls.length, 0)
  h.api.setPageScrollContainer(h.element)
  assert.equal(h.element.scrollTop, 320)
  h.api.beginPageScrollTransition()
  h.api.requestPageScroll({ top: 90 })
  h.api.requestPageScroll({ top: 180 })
  h.api.beginPageScrollTransition()
  assert.equal(h.element.scrollTop, 320)
  h.api.finishPageScrollTransition()
  assert.equal(h.element.scrollTop, 180)
  h.api.beginPageScrollTransition()
  h.api.requestPageScroll({ top: 999 })
  h.api.cancelPageScrollTransition()
  h.api.finishPageScrollTransition()
  assert.equal(h.element.scrollTop, 180)
})

test('anchors use internal coordinates and respect reduced motion', () => {
  const h = harness()
  h.api.setPageScrollContainer(h.element)
  h.element.scrollTop = 350
  h.anchors.set('section one', { getBoundingClientRect: () => ({ top: 230 }) })
  h.api.requestPageScroll({ hash: '#section%20one', behavior: 'smooth' })
  assert.equal(h.element.scrollTop, 492)
  assert.equal(h.calls.at(-1).behavior, 'smooth')
  h.setReduced(true)
  h.api.scrollPageTo({ top: 0, behavior: 'smooth' })
  assert.equal(h.calls.at(-1).behavior, 'auto')
  assert.doesNotThrow(() => h.api.scrollPageTo({ hash: '#%bad' }))
})

test('normal navigation resets internally and browser back restores internal position', () => {
  const h = harness(), r = routerHarness(h)
  h.api.setPageScrollContainer(h.element)
  h.element.scrollTop = 475
  const from = route('/category/SHORT'), to = route('/search')
  r.guards.forEach(fn => fn(to, from))
  h.api.beginPageScrollTransition()
  assert.equal(r.options.scrollBehavior(to, from, null), false)
  assert.equal(h.element.scrollTop, 475)
  h.api.finishPageScrollTransition()
  assert.equal(h.element.scrollTop, 0)
  r.guards.forEach(fn => fn(from, to))
  h.api.beginPageScrollTransition()
  r.options.scrollBehavior(from, to, { left: 0, top: 0 })
  h.api.finishPageScrollTransition()
  assert.equal(h.element.scrollTop, 475)
})

test('sheet navigation preserves background and a different destination waits for its view', () => {
  const h = harness(), r = routerHarness(h)
  h.api.setPageScrollContainer(h.element)
  h.element.scrollTop = 630
  const background = route('/category/SHORT'), sheet = route('/articles/1', true)
  r.guards.forEach(fn => fn(sheet, background))
  r.options.scrollBehavior(sheet, background, null)
  assert.equal(h.element.scrollTop, 630)
  r.options.scrollBehavior(background, sheet, { left: 0, top: 0 })
  assert.equal(h.element.scrollTop, 630)
  r.guards.forEach(fn => fn(sheet, background))
  r.options.scrollBehavior(sheet, background, null)
  r.options.scrollBehavior(route('/search'), sheet, null)
  assert.equal(h.element.scrollTop, 630)
  h.api.beginPageScrollTransition()
  h.api.finishPageScrollTransition()
  assert.equal(h.element.scrollTop, 0)
})

test('sheet body locking does not translate the background by internal scroll distance', () => {
  const h = harness()
  h.api.setPageScrollContainer(h.element)
  h.element.scrollTop = 520
  const props = { open: true, backgroundScrollX: 0, backgroundScrollY: 520 }
  const setup = parse(read('src/widgets/page-sheet/PageSheet.vue')).descriptor.scriptSetup.content
  const controls = load(setup, {
    vue: { ref: value => ({ value }), watch: (source, callback, options) => { if (options?.immediate) callback(source()) }, onBeforeUnmount() {} },
    '@/shared/utils/pageScroll': h.api,
  }, { document: h.document, window: h.window, defineProps: () => props, withDefaults: (value, defaults) => ({ ...defaults, ...value }), defineEmits: () => () => {} }, '\nmodule.exports.controls = { restoreBodyLock };').controls
  assert.equal(h.document.body.style.top, '')
  assert.equal(h.document.body.style.position, '')
  assert.equal(h.document.body.style.width, '')
  h.element.scrollTop = 0
  controls.restoreBodyLock()
  assert.equal(h.element.scrollTop, 520)
  h.document.body.style.overflow = 'clip'
  controls.restoreBodyLock()
  assert.equal(h.document.body.style.overflow, 'clip')
})

test('viewport has no reserved scrollbar; embedded styling matches the editor', () => {
  const base = read('src/app/styles/base.css'), home = read('src/pages/home/HomePage.vue'), app = read('src/app/App.vue'), theme = read('src/app/styles/theme.css')
  const html = base.split('html {')[1].split('}')[0]
  assert.ok(html.includes('overflow: hidden;'))
  assert.ok(!base.includes('scrollbar-gutter: stable'))
  assert.ok(!home.includes('scrollbar-gutter: stable'))
  assert.ok(!base.includes('html::-webkit-scrollbar'))
  assert.ok(base.includes('.app-scrollbar::-webkit-scrollbar-thumb'))
  assert.ok(theme.includes('--scrollbar-size: 0.35rem;'))
  assert.ok(theme.includes('var(--color-text-faint) 42%'))
  assert.ok(theme.includes('var(--color-text-faint) 62%'))
  assert.ok(app.includes("'app-shell--home': motionDisplayRoute.name === ROUTE_NAME.HOME"))
  assert.ok(app.includes('@display="onBaseRouteDisplay"'))
  assert.ok(app.includes("'app-shell--locked': !!displayedSheetRoute || sheetOpening || authDialogOpen"))
  assert.ok(app.includes('@after-enter="finishPageScrollTransition"'))
})
