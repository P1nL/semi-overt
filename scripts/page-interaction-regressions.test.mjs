import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { computed, nextTick, reactive, ref, watch } from 'vue'

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const ROUTE_NAME = { HOME: 'home', PROFILE: 'profile', CATEGORY: 'category', SEARCH: 'search', ARTICLE_READ: 'article-read', ARTICLE_EDITOR: 'article-editor', ARTICLE_EDITOR_NEW: 'article-editor-new', ARTICLE_REVIEW: 'article-review' }
function load(source, globals = {}, mocks = {}, suffix = '') {
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(code + suffix, { module, exports: module.exports, ...globals, require(name) {
    if (name in mocks) return mocks[name]
    throw new Error('Unexpected dependency: ' + name)
  } })
  return module.exports
}
function pick(file, variables = [], functions = [], watchText = null) {
  const setup = parse(read(file)).descriptor.scriptSetup.content
  const ast = ts.createSourceFile(file + '.ts', setup, ts.ScriptTarget.Latest, true)
  return ast.statements.filter(node => {
    if (ts.isVariableStatement(node)) return node.declarationList.declarations.some(decl => variables.includes(decl.name.getText(ast)))
    if (ts.isFunctionDeclaration(node)) return functions.includes(node.name?.text)
    return watchText && ts.isExpressionStatement(node) && node.getText(ast).startsWith('watch(') && node.getText(ast).includes(watchText)
  }).map(node => node.getText(ast)).join('\n')
}

function logoutHarness() {
  let finish, flips = 0, cancelled = 0
  const rates = []
  const animation = {
    playbackRate: 1, finished: new Promise(resolve => { finish = resolve }),
    updatePlaybackRate(rate) { this.playbackRate = rate; rates.push(rate) },
    play() {}, cancel() { cancelled++ },
  }
  const holding = ref(false), suppressed = ref(false)
  const source = `let logoutProgressRun = 0, logoutProgressAnimation = null, logoutHoldTimer = null;\n` + pick(
    'src/widgets/app-header/AppHeaderActions.vue', [], ['resetLogoutProgress', 'cancelLogoutHold', 'activateLogoutProgress'],
  )
  const api = load(source, {
    logoutHolding: holding, suppressProfileClick: suppressed,
    logoutFlipping: ref(false), loggingOut: ref(false), nextTick,
    logoutProgressStrokeRef: ref({ animate: () => animation }), LOGOUT_PROGRESS_MS: 900,
    window: { setTimeout(fn) { fn(); return 1 }, clearTimeout() {}, matchMedia: () => ({ matches: false }) },
    playLogoutSequence() { flips++ },
  }, {}, '\nmodule.exports = { resetLogoutProgress, cancelLogoutHold, activateLogoutProgress };')
  return { api, animation, rates, holding, finish: () => finish(), flips: () => flips, cancelled: () => cancelled }
}

test('pointerup followed by pointerleave keeps the logout ring rewinding, never logs out', async () => {
  const h = logoutHarness()
  await h.api.activateLogoutProgress()
  h.api.cancelLogoutHold()
  h.api.cancelLogoutHold()
  assert.deepEqual(h.rates, [-1, -1])
  h.finish()
  await nextTick()
  assert.equal(h.flips(), 0)
  assert.equal(h.holding.value, false)
  assert.equal(h.cancelled(), 1)
})

test('leaving during activation cancels before the animation is created', async () => {
  const h = logoutHarness()
  const pending = h.api.activateLogoutProgress()
  h.api.cancelLogoutHold()
  await pending
  assert.equal(h.holding.value, false)
  assert.equal(h.flips(), 0)
  assert.equal(h.rates.length, 0)
})

test('completed uninterrupted hold still starts the logout sequence', async () => {
  const h = logoutHarness()
  await h.api.activateLogoutProgress()
  h.finish()
  await nextTick()
  assert.equal(h.flips(), 1)
  const source = read('src/widgets/app-header/AppHeaderActions.vue')
  assert.ok(!source.includes('@keyframes logout-progress'))
  assert.ok(!source.includes('animation: logout-progress'))
})

test('profile identity stays on the background route and its title is restored after sheet close', async () => {
  const route = reactive({ name: ROUTE_NAME.PROFILE, fullPath: '/u/smoke_author', params: { username: 'smoke_author' }, query: {} })
  const props = reactive({ routeOverride: { ...route } })
  const titles = []
  const source = pick('src/pages/profile/ProfilePage.vue', ['props', 'route', 'currentRoute', 'username', 'defaultTab', 'activeTab', 'profilePages', 'profile'], [], 'setDocumentTitle')
  const h = load(source, {
    computed, watch, ROUTE_NAME, useRoute: () => route,
    defineProps: () => props, withDefaults: value => value,
    authStore: { user: { username: 'smoke_author' } },
    profileQuery: { data: ref({ pages: [{ displayName: 'smoke_author', username: 'smoke_author' }] }) },
    setDocumentTitle: title => titles.push(title),
  }, {}, '\nmodule.exports = { username, activeTab };')
  assert.equal(titles.at(-1), 'smoke_author')
  route.name = ROUTE_NAME.ARTICLE_READ
  route.fullPath = '/articles/1'
  route.params = { id: '1' }
  await nextTick()
  assert.equal(h.username.value, 'smoke_author')
  assert.equal(h.activeTab.value, 'all')
  assert.equal(titles.length, 1)
  titles.push('Article title')
  route.name = ROUTE_NAME.PROFILE
  route.fullPath = '/u/smoke_author'
  await nextTick()
  assert.equal(titles.at(-1), 'smoke_author')
})

for (const [file, name, titleName] of [
  ['src/pages/category/CategoryPage.vue', ROUTE_NAME.CATEGORY, 'category'],
  ['src/pages/search/SearchPage.vue', ROUTE_NAME.SEARCH, 'keyword'],
]) {
  test(name + ' restores its dynamic title only when its route is active', async () => {
    const route = reactive({ name, fullPath: '/' + name })
    const titles = [], title = ref(titleName)
    load(pick(file, [], [], 'setDocumentTitle'), {
      watch, route, ROUTE_NAME, currentRoute: ref({ fullPath: '/' + name }),
      sectionMeta: computed(() => ({ label: title.value })), documentTitle: title,
      setDocumentTitle: value => titles.push(value),
    })
    route.name = ROUTE_NAME.ARTICLE_READ
    route.fullPath = '/articles/1'
    await nextTick()
    title.value += ' updated'
    await nextTick()
    assert.equal(titles.length, 1)
    route.name = name
    route.fullPath = '/' + name
    await nextTick()
    assert.equal(titles.at(-1), title.value)
  })
}

test('late article data cannot overwrite a closed sheet background title', () => {
  const route = reactive({ name: ROUTE_NAME.ARTICLE_READ, params: { id: '1' } })
  const titles = []
  const h = load(pick('src/pages/article/ArticleReadPage.vue', [], ['onLoaded']), {
    route, ROUTE_NAME, articleId: computed(() => String(route.params.id ?? '')),
    tocSyncKey: ref(''), setDocumentTitle: value => titles.push(value),
  }, {}, '\nmodule.exports = { onLoaded };')
  h.onLoaded({ id: 1, title: 'Article' })
  route.name = ROUTE_NAME.PROFILE
  h.onLoaded({ id: 1, title: 'Late Article' })
  assert.deepEqual(titles, ['Article'])
})

test('result scroll mode follows the rendered route and distinguishes lists, infinite menus and authors', () => {
  const h = load(read('src/app/model/pageScrollMode.ts'), {}, { '@/shared/constants/routes': { ROUTE_NAME } })
  for (const name of [ROUTE_NAME.CATEGORY, ROUTE_NAME.SEARCH]) {
    assert.equal(h.resolvePageScrollMode({ name, query: {} }), 'infinite')
    assert.equal(h.resolvePageScrollMode({ name, query: { view: 'list' } }), 'list')
    assert.equal(h.resolvePageScrollMode({ name, query: { view: ['list'] } }), 'list')
    assert.equal(h.resolvePageScrollMode({ name, query: { view: 'gallery' } }), 'infinite')
  }
  assert.equal(h.resolvePageScrollMode({ name: ROUTE_NAME.SEARCH, query: { type: 'users' } }), 'page')
  assert.equal(h.resolvePageScrollMode({ name: ROUTE_NAME.PROFILE, query: {} }), 'page')
  const app = read('src/app/App.vue')
  assert.ok(app.includes('resolvePageScrollMode(baseRenderRoute.value)'))
  assert.match(app, /#app\.app-shell\s*\{[^}]*scrollbar-gutter: auto;[^}]*scrollbar-width: none;/)
  assert.match(app, /#app\.app-shell--infinite\s*\{[^}]*overflow: clip;[^}]*scrollbar-gutter: auto;/)
  assert.ok(app.includes('<PageScrollbar'))
  assert.ok(app.includes('basePageScrollMode !=='))
  assert.ok(app.includes('targetRoute.name === ROUTE_NAME.PROFILE'))
})

test('result toggles cannot escape the page stacking layer or cover the navigation panels', () => {
  const app = read('src/app/App.vue')
  assert.ok(app.includes('class="app-route-view relative z-0 min-h-0"'))
  for (const file of ['src/widgets/article-result-stream/ArticleResultStream.vue', 'src/pages/search/SearchPage.vue']) {
    assert.ok(!read(file).includes('z-index: 60;'))
    assert.ok(read(file).includes('z-index: 20;'))
  }
})

function searchHarness() {
  const close = load(read('src/widgets/app-header/model/searchCloseSequence.ts'))
  const uiStore = reactive({ searchQuery: 'keyword', setSearchQuery(value) { this.searchQuery = value }, clearSearchQuery() { this.searchQuery = '' } })
  const source = pick('src/widgets/app-header/AppHeader.vue', [
    'searchOpen', 'searchClosing', 'searchPanelLeaving', 'clearSearchOnCollapse', 'searchCloseSequence',
    'keyword', 'dropdownVisible', 'trimmedKeyword', 'showDropdown', 'searchButtonRef', 'searchInputRef',
  ], ['closeSearch', 'resumeSearch', 'onSuggestionsClosed', 'navigateToArticleSearch', 'navigateToAuthorSearch', 'submitSearch'], 'watch-unused')
  const trimmedWatch = pick('src/widgets/app-header/AppHeader.vue', [], [], 'if (searchClosing.value) resumeSearch()')
  return load(source + '\n' + trimmedWatch, {
    computed, ref, watch, nextTick, uiStore, ROUTE_NAME,
    createSearchCloseSequence: close.createSearchCloseSequence,
    normalizeSearchKeyword: value => value.trim(), router: { async push() {} },
  }, {}, '\nmodule.exports = { searchOpen, searchClosing, keyword, dropdownVisible, closeSearch, onSuggestionsClosed, resumeSearch, navigateToArticleSearch, navigateToAuthorSearch, submitSearch };')
}

for (const method of ['submitSearch', 'navigateToArticleSearch', 'navigateToAuthorSearch']) {
  test(method + ' keeps bar width and keyword until the suggestion return animation completes', async () => {
    const h = searchHarness()
    h.searchOpen.value = true
    h.dropdownVisible.value = true
    await h[method]()
    assert.equal(h.searchOpen.value, true)
    assert.equal(h.searchClosing.value, true)
    assert.equal(h.keyword.value, 'keyword')
    assert.equal(h.dropdownVisible.value, false)
    h.onSuggestionsClosed()
    await nextTick()
    assert.equal(h.searchOpen.value, false)
    assert.equal(h.searchClosing.value, false)
    assert.equal(h.keyword.value, '')
  })
}

test('reopening search during submission retraction cancels stale clearing and collapse', async () => {
  const h = searchHarness()
  h.searchOpen.value = true
  h.dropdownVisible.value = true
  await h.submitSearch()
  h.resumeSearch()
  h.onSuggestionsClosed()
  await nextTick()
  assert.equal(h.searchOpen.value, true)
  assert.equal(h.keyword.value, 'keyword')
  assert.equal(h.dropdownVisible.value, true)
})

test('new-draft editor cannot overwrite the profile title during leave or a late save', async () => {
  const route = reactive({ name: ROUTE_NAME.PROFILE, fullPath: '/u/smoke_author', params: { username: 'smoke_author' } })
  const titles = [], editorDocumentTitle = ref('未命名')
  const shared = { watch, route, ROUTE_NAME, setDocumentTitle: value => titles.push(value) }
  load(pick('src/pages/profile/ProfilePage.vue', [], [], 'setDocumentTitle'), {
    ...shared, profile: ref({ displayName: 'smoke_author' }), username: ref('smoke_author'),
  })
  load(pick('src/pages/article/ArticleEditorPage.vue', [], [], 'setDocumentTitle'), { ...shared, editorDocumentTitle })
  route.name = ROUTE_NAME.ARTICLE_EDITOR_NEW
  route.fullPath = '/article-editor-new'
  await nextTick()
  assert.equal(titles.at(-1), '未命名')
  editorDocumentTitle.value = 'New draft'
  route.name = ROUTE_NAME.ARTICLE_EDITOR
  route.fullPath = '/editor/7'
  await nextTick()
  assert.equal(titles.at(-1), 'New draft')
  route.name = ROUTE_NAME.PROFILE
  route.fullPath = '/u/smoke_author'
  titles.push('个人主页') // Router afterEach supplies the generic title before page watches.
  await nextTick()
  assert.equal(titles.at(-1), 'smoke_author')
  editorDocumentTitle.value = 'Late saved title'
  await nextTick()
  assert.equal(titles.at(-1), 'smoke_author')
})

test('result heading, spacing and scroll mode switch only after the old view leaves', async () => {
  for (const file of ['src/pages/category/CategoryPage.vue', 'src/pages/search/SearchPage.vue']) {
    const resultView = ref('infinite'), contentState = ref('content'), events = []
    const source = pick(file, ['layoutView'], [], 'layoutView.value = view') + '\n' + pick(file, [], [], "emit('result-layout'")
    const h = load(source, { ref, watch, resultView, contentState, isUserSearch: ref(false), emit: (...args) => events.push(args) }, {}, '\nmodule.exports = { layoutView };')
    resultView.value = 'list'
    await nextTick()
    assert.equal(h.layoutView.value, 'infinite')
    h.layoutView.value = 'list' // ArticleResultStream emits layout:view after leave.
    await nextTick()
    assert.equal(events.at(-1)[1], 'list')
    const page = read(file)
    assert.ok(page.includes('<ResultListHeading'))
    assert.ok(page.includes('@layout:view="layoutView = $event"'))
  }
  const mode = load(read('src/app/model/pageScrollMode.ts'), {}, { '@/shared/constants/routes': { ROUTE_NAME } })
  const background = reactive({ name: ROUTE_NAME.CATEGORY, path: '/category/SHORT', query: {} })
  const h = load(pick('src/app/App.vue', ['basePageScrollMode'], ['onResultLayout'], 'baseRenderRoute.value.path'), {
    ref, watch, baseRenderRoute: ref(background), resolvePageScrollMode: mode.resolvePageScrollMode,
  }, {}, '\nmodule.exports = { basePageScrollMode, onResultLayout };')
  background.query.view = 'list'
  await nextTick()
  assert.equal(h.basePageScrollMode.value, 'infinite')
  h.onResultLayout('list')
  assert.equal(h.basePageScrollMode.value, 'list')
  const stream = read('src/widgets/article-result-stream/ArticleResultStream.vue')
  assert.ok(stream.includes('@after-leave="emit(\'layout:view\', view)"'))
})

test('overlay scrollbar geometry maps viewport, drag and endpoints without reserving width', () => {
  const h = load(read('src/shared/utils/pageScrollbar.ts'))
  const geometry = h.getPageScrollbarGeometry(800, 2400, 700, 800)
  assert.equal(geometry.scrollRange, 1600)
  assert.ok(Math.abs(geometry.thumbSize - 700 / 3) < 0.001)
  assert.ok(Math.abs(geometry.thumbOffset - geometry.travel / 2) < 0.001)
  assert.equal(h.getPageScrollTopFromThumb(geometry.travel, geometry.travel, geometry.scrollRange), 1600)
  assert.equal(h.getPageScrollTopFromThumb(-100, geometry.travel, geometry.scrollRange), 0)
  assert.equal(h.getPageScrollTopFromThumb(0, 0, 0), 0)
  assert.equal(h.getPageScrollbarGeometry(800, 500, 700, 0).scrollRange, 0)
})

test('persistent scrollbar follows actual container scroll, supports drag and keyboard, and disconnects', async () => {
  const geometry = load(read('src/shared/utils/pageScrollbar.ts'))
  const events = new Map(), frames = new Map(), captures = new Set()
  let id = 0, unmount, mutation
  const container = { id: 'app', clientHeight: 800, scrollHeight: 2400, scrollTop: 0,
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name), querySelector: () => ({}),
  }
  const props = reactive({ container, active: true })
  const setup = parse(read('src/shared/components/base/PageScrollbar.vue')).descriptor.scriptSetup.content.replace(/^import .*$/gm, '')
  const h = load(setup, {
    ...geometry, computed, ref, watch, defineProps: () => props, onBeforeUnmount: fn => { unmount = fn },
    window: { addEventListener: (name, fn) => events.set('window:' + name, fn), removeEventListener: name => events.delete('window:' + name) },
    requestAnimationFrame: fn => { frames.set(++id, fn); return id }, cancelAnimationFrame: key => frames.delete(key),
    ResizeObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { constructor(fn) { mutation = fn } observe() {} disconnect() {} },
  }, {}, '\nmodule.exports = { trackRef, thumbRef, metrics, visible, onPointerDown, onPointerMove, onKeydown, releaseDrag };')
  h.trackRef.value = { clientHeight: 700, getBoundingClientRect: () => ({ top: 100 }),
    hasPointerCapture: key => captures.has(key), setPointerCapture: key => captures.add(key), releasePointerCapture: key => captures.delete(key),
  }
  h.thumbRef.value = {}
  await nextTick()
  const tick = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()) }
  tick()
  assert.equal(h.visible.value, true)
  h.onPointerDown({ button: 0, pointerId: 5, clientY: 100, target: h.thumbRef.value, preventDefault() {} })
  h.onPointerMove({ pointerId: 5, clientY: 100 + h.metrics.value.travel / 2 })
  assert.ok(Math.abs(container.scrollTop - 800) < 0.001)
  h.releaseDrag()
  assert.equal(captures.size, 0)
  h.onKeydown({ key: 'End', preventDefault() {} })
  assert.equal(container.scrollTop, 1600)
  tick()
  assert.equal(h.metrics.value.thumbOffset, h.metrics.value.travel)
  container.scrollHeight = 4000
  mutation()
  tick()
  assert.equal(h.metrics.value.scrollRange, 3200)
  props.active = false
  await nextTick()
  assert.equal(h.visible.value, false)
  assert.equal(events.size, 0)
  unmount()
  assert.equal(frames.size, 0)
  const source = read('src/shared/components/base/PageScrollbar.vue')
  assert.ok(source.includes('position: fixed;'))
  assert.ok(source.includes('.page-scrollbar--visible { opacity: 1; pointer-events: auto; }'))
})

test('opening login and changing auth identity clear any preview draft menu before header remount', async () => {
  const authStore = reactive({ isAuthenticated: false })
  const authDialogOpen = ref(false), profileAfterLogin = ref(false)
  const draftMenuOpen = ref(false), userMenuOpen = ref(false), previewUser = ref({ username: 'dev-preview' })
  const file = 'src/widgets/app-header/AppHeaderActions.vue'
  const source = pick(file, [], ['closeDraftMenu', 'closeUserMenu'], 'previewUser.value = null') + '\n' + pick(file, [], [], 'if (!open) profileAfterLogin.value = false')
  load(source, { watch, nextTick, authStore, authDialogOpen, profileAfterLogin, draftMenuOpen, userMenuOpen, previewUser })
  draftMenuOpen.value = true
  userMenuOpen.value = true
  authDialogOpen.value = true
  await nextTick()
  assert.equal(draftMenuOpen.value, false)
  assert.equal(userMenuOpen.value, false)
  authDialogOpen.value = false
  await nextTick()
  draftMenuOpen.value = true
  userMenuOpen.value = true
  authStore.isAuthenticated = true
  await nextTick()
  assert.equal(draftMenuOpen.value, false)
  assert.equal(userMenuOpen.value, false)
  assert.equal(previewUser.value, null)
})
