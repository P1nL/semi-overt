import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
import { parse } from '@vue/compiler-sfc'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const cache = new Map()
const receiptStorage = new Map()
const testStorage = { get: (key, fallback) => receiptStorage.get(key) ?? fallback, set: (key, value) => receiptStorage.set(key, value) }
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const module = { exports: {} }
  cache.set(file, module.exports)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require(name) {
    if (name === 'vue') return vue
    if (name === 'pinia') return { defineStore: (_name, setup) => setup }
    if (name === '@/shared/api/modules/article') return { articleApi: {} }
    if (name === '@/shared/utils/storage') return { localStore: testStorage }
    const target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(file), name)
    if (name.endsWith('.vue')) return {}
    return load(fs.existsSync(target + '.ts') ? target + '.ts' : path.join(target, 'index.ts'))
  } })
  cache.set(file, module.exports)
  return module.exports
}
const article = load(path.join(root, 'src/shared/utils/article.ts'))
test('visible body statistics exclude markup, styles and image addresses and count Unicode points', () => {
  assert.equal(article.calcWordCount('<p style="text-align:center">中文 &amp; &#x1F600;</p><img src="https://example.com/x.png">'), 4)
  assert.equal(article.calcWordCount('# 标题\n**正文** [链接](https://example.com) ![图](https://example.com/img)'), 6)
  assert.equal(article.calcWordCount('```java\nabc\n```\n`中文`'), 5)
  assert.equal(article.calcWordCount('<!-- hidden --><style>hidden</style><script>hidden</script>正文'), 2)
  const mapper = load(path.join(root, 'src/features/article-editor/model/editor.mapper.ts'))
  assert.equal(mapper.buildEditorStats('<p>正文</p>', '标题不计入正文').wordCount, 2)
})
test('autosave clears persistence dirty state but not the manual save reminder', () => {
  const store = load(path.join(root, 'src/stores/editor.ts')).useEditorStore()
  store.markChanged()
  const revision = store.changeRevision.value
  store.dirty.value = false
  assert.equal(store.manualSavePending.value, true)
  assert.equal(store.acknowledgeManualSave(revision), true)
  assert.equal(store.manualSavePending.value, false)
})
test('edits during manual save and reset invalidate stale confirmation', () => {
  const store = load(path.join(root, 'src/stores/editor.ts')).useEditorStore()
  store.markChanged()
  const revision = store.changeRevision.value
  store.markChanged()
  store.dirty.value = false
  assert.equal(store.acknowledgeManualSave(revision), false)
  assert.equal(store.manualSavePending.value, true)
  store.resetEditorState()
  store.markChanged()
  store.dirty.value = false
  assert.equal(store.acknowledgeManualSave(revision), false)
})
test('reopening an autosaved draft restores its receipt instead of the previous session reminder', () => {
  const store = load(path.join(root, 'src/stores/editor.ts')).useEditorStore()
  store.setCurrentArticle({ id: 7 })
  store.markChanged()
  store.dirty.value = false
  store.recordDraftSave(7, 'auto', '2026-10-05T01:00:00Z')
  assert.equal(store.manualSavePending.value, true)
  store.resetEditorState()
  store.setCurrentArticle({ id: 7 })
  store.beginEditorSession()
  assert.equal(store.manualSavePending.value, false)
  assert.equal(store.getDraftSaveReceipt(7).kind, 'auto')
})

test('save receipts survive a new store and remain isolated per article', () => {
  const create = load(path.join(root, 'src/stores/editor.ts')).useEditorStore
  const store = create()
  store.recordDraftSave(101, 'auto', '2026-10-05T01:00:00Z')
  store.recordDraftSave(102, 'manual', '2026-10-05T01:10:00Z')
  const reopened = create()
  assert.equal(reopened.getDraftSaveReceipt(101).kind, 'auto')
  assert.equal(reopened.getDraftSaveReceipt(102).kind, 'manual')
  assert.equal(reopened.getDraftSaveReceipt(102).savedAt, '2026-10-05T01:10:00Z')
  assert.equal(reopened.getDraftSaveReceipt(103), null)
  reopened.cacheArticleDetail({ id: 102 }, '2026-10-05T02:00:00Z')
  assert.equal(reopened.getDraftSaveReceipt(102).kind, 'unknown')
  assert.equal(reopened.getDraftSaveReceipt(102).savedAt, '2026-10-05T02:00:00Z')
})

test('a manual confirmation of an in-flight autosave records manual mode without another write', () => {
  const store = load(path.join(root, 'src/stores/editor.ts')).useEditorStore()
  store.setCurrentArticle({ id: 104 })
  store.markChanged()
  store.dirty.value = false
  store.recordDraftSave(104, 'auto', '2026-10-05T01:00:00Z')
  assert.equal(store.acknowledgeManualSave(store.changeRevision.value), true)
  assert.equal(store.getDraftSaveReceipt(104).kind, 'manual')
  store.markChanged()
  store.recordDraftSave(104, 'auto', '2026-10-05T01:30:00Z')
  assert.equal(store.getDraftSaveReceipt(104).kind, 'auto')
})

test('status wording restores automatic/manual times and still prioritizes current unsaved edits', () => {
  const setup = parse(fs.readFileSync(path.join(root, 'src/pages/article/ArticleEditorPage.vue'), 'utf8')).descriptor.scriptSetup.content
  const ast = ts.createSourceFile('page.ts', setup, ts.ScriptTarget.Latest, true)
  const statement = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(ast) === 'saveStatus')).getText(ast)
  const store = vue.reactive(load(path.join(root, 'src/stores/editor.ts')).useEditorStore())
  const context = { computed: vue.computed, editorStore: store, manualSaving: vue.ref(false), saveFeedback: vue.ref('idle'), isPending: vue.ref(false), isReadOnly: vue.ref(false), currentStatusLabel: vue.ref(''), articleId: vue.ref('105'), formatSavedTime: value => value ? value.slice(11, 16) : '' }
  vm.createContext(context)
  vm.runInContext(ts.transpileModule(statement, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nthis.status = saveStatus;', context)
  store.setCurrentArticle({ id: 105 })
  store.recordDraftSave(105, 'auto', '2026-10-05T01:00:00Z')
  store.beginEditorSession()
  assert.equal(context.status.value.text, '上次自动保存于 01:00')
  store.markChanged()
  store.dirty = false
  store.recordDraftSave(105, 'auto', '2026-10-05T01:05:00Z')
  assert.equal(context.status.value.text, '有未保存的更改')
  store.acknowledgeManualSave(store.changeRevision)
  assert.equal(context.status.value.text, '上次手动保存于 01:05')
  store.beginEditorSession()
  assert.equal(context.status.value.text, '上次手动保存于 01:05')
})
test('provided animation assets and pen geometry are wired without Svelte runtime', () => {
  const icon = fs.readFileSync(path.join(root, 'src/features/article-editor/ui/EditorSaveIcon.vue'), 'utf8')
  assert.ok(icon.includes('m18 5-2.414-2.414A2 2'))
  assert.ok(icon.includes('M21.378 12.626a1 1'))
  assert.ok(icon.includes("loop: state === 'saving'"))
  assert.ok(icon.includes("goToAndStop(state === 'saved' ? 44 : 0"))
  assert.ok(icon.includes('player?.destroy()'))
  const check = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/assets/lottie/editor-save/checkmark.json'), 'utf8'))
  assert.equal(check.op / check.fr, 1.5)
  const page = fs.readFileSync(path.join(root, 'src/pages/article/ArticleEditorPage.vue'), 'utf8')
  assert.ok(page.includes('acknowledgeManualSave(revision)'))
  assert.ok(page.includes("saved ? 0 : 1400"))
  assert.ok(page.includes('<EditorSaveIcon :state="saveVisualState"'))
})

function saveHarness(saveDraft) {
  const setup = parse(fs.readFileSync(path.join(root, 'src/pages/article/ArticleEditorPage.vue'), 'utf8')).descriptor.scriptSetup.content
  const ast = ts.createSourceFile('page.ts', setup, ts.ScriptTarget.Latest, true)
  const statements = ast.statements.filter(node => {
    if (ts.isVariableStatement(node)) return node.declarationList.declarations.some(item => ['finishLoadingCycle', 'saveAnimationDisposed'].includes(item.name.getText(ast)))
    if (ts.isFunctionDeclaration(node)) return ['handleSaveDraft', 'onSaveLoadingCycleComplete', 'onSaveCheckmarkComplete', 'onSaveFlipEnd'].includes(node.name?.text)
    return node.getText(ast).startsWith('onBeforeUnmount(')
  }).map(node => node.getText(ast)).join('\n')
  const events = [], acknowledgements = []
  const context = {
    showSaveAction: { value: true }, manualSaving: { value: false }, isReadOnly: { value: false },
    saveLoadingFinishRequested: { value: false }, lastManualSavedAt: { value: '' },
    saveFeedback: { value: 'idle' }, saveFlipPhase: { value: null },
    window: { matchMedia: () => ({ matches: false }) },
    editorFormRef: { value: { saveDraft } },
    editorStore: { changeRevision: 1, lastSavedAt: 'saved', acknowledgeManualSave(revision) { acknowledgements.push(revision); return true } },
    setSaveFeedback: (...args) => { events.push(args); context.saveFeedback.value = args[0]; context.saveFlipPhase.value = null }, onBeforeUnmount: fn => { context.dispose = fn },
    clearPublishConfirmTimer() {}, clearCancelConfirmTimer() {}, clearPublishCooldownRevealTimer() {},
    clearPublishCooldownTimer() {}, clearSaveFeedbackTimer() {}, clearMainActionWidthFrame() {}, syncPublishConfirmListeners() {},
  }
  vm.createContext(context)
  const js = ts.transpileModule(statements, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInContext(js + '\nthis.api = { handleSaveDraft, onSaveLoadingCycleComplete, onSaveCheckmarkComplete, onSaveFlipEnd };', context)
  return { ...context.api, context, events, acknowledgements }
}

test('checkmark completion triggers a two-stage flip with the icon swapped only edge-on', () => {
  const page = fs.readFileSync(path.join(root, 'src/pages/article/ArticleEditorPage.vue'), 'utf8')
  // A keyed out-in Transition with CSS disabled can synchronously remove its
  // parent during the midpoint update. Keep the icon instance mounted instead.
  assert.ok(!page.includes('<Transition name="editor-save-icon"'))
  assert.ok(!page.includes(':key="saveVisualState"'))
  const h = saveHarness(async () => true)
  h.context.saveFeedback.value = 'saved'
  h.onSaveCheckmarkComplete()
  assert.equal(h.context.saveFlipPhase.value, 'out')
  assert.equal(h.context.saveFeedback.value, 'saved')
  const button = {}
  h.onSaveFlipEnd({ target: {}, currentTarget: button, animationName: 'editor-save-flip-out' })
  assert.equal(h.context.saveFlipPhase.value, 'out')
  h.onSaveFlipEnd({ target: button, currentTarget: button, animationName: 'editor-save-flip-out-data-v-test' })
  assert.equal(h.context.saveFlipPhase.value, 'in')
  assert.equal(h.context.saveFeedback.value, 'idle')
  h.onSaveFlipEnd({ target: button, currentTarget: button, animationName: 'editor-save-flip-in-data-v-test' })
  assert.equal(h.context.saveFlipPhase.value, null)
})

test('reduced motion skips flipping and stale completions do nothing', () => {
  const h = saveHarness(async () => true)
  h.context.window.matchMedia = () => ({ matches: true })
  h.context.saveFeedback.value = 'saved'
  h.onSaveCheckmarkComplete()
  assert.equal(h.context.saveFeedback.value, 'idle')
  assert.equal(h.context.saveFlipPhase.value, null)
  h.context.saveFeedback.value = 'error'
  h.onSaveCheckmarkComplete()
  assert.equal(h.context.saveFeedback.value, 'error')
  h.context.dispose()
  h.context.saveFeedback.value = 'saved'
  h.onSaveCheckmarkComplete()
  assert.equal(h.context.saveFlipPhase.value, null)
})

test('save cannot restart during the checkmark or either flip half', async () => {
  const h = saveHarness(async () => { throw new Error('must not save during feedback') })
  h.context.saveFeedback.value = 'saved'
  await h.handleSaveDraft()
  h.context.saveFeedback.value = 'idle'
  for (const phase of ['out', 'in']) {
    h.context.saveFlipPhase.value = phase
    await h.handleSaveDraft()
  }
  const icon = fs.readFileSync(path.join(root, 'src/features/article-editor/ui/EditorSaveIcon.vue'), 'utf8')
  assert.ok(icon.includes("player.addEventListener('complete'"))
  assert.ok(icon.includes("if (run === version && state === 'saved') emit('saved-complete')"))
})

test('closing the editor preserves its article, saved timestamp and form until unmount', async () => {
  const setup = parse(fs.readFileSync(path.join(root, 'src/pages/article/ArticleEditorPage.vue'), 'utf8')).descriptor.scriptSetup.content
  const ast = ts.createSourceFile('page.ts', setup, ts.ScriptTarget.Latest, true)
  const statements = ast.statements.filter(node => {
    if (ts.isVariableStatement(node)) return node.declarationList.declarations.some(item => ['articleId', 'hasRouteArticleId'].includes(item.name.getText(ast)))
    const text = node.getText(ast)
    return text.startsWith('watch(') && (text.includes('[route.name, route.params.id]') || /^watch\(\s*hasRouteArticleId,/.test(text) || text.startsWith('watch(articleId,'))
  }).map(node => node.getText(ast)).join('\n')
  const route = vue.reactive({ name: 'editor', params: { id: '42' } })
  const values = { title: '已保存标题', content: '已保存正文' }
  let resets = 0
  const context = {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, route,
    ROUTE_NAME: { ARTICLE_EDITOR: 'editor', ARTICLE_EDITOR_NEW: 'new' },
    editorStore: { resetEditorState() { resets++ } },
    formValues: vue.ref(values), lastManualSavedAt: vue.ref(''),
    nowTimestamp: vue.ref(0), publishCooldownUntil: vue.ref(0),
    readPersistedPublishCooldownUntil: () => 0,
    createEmptyEditorFormValues: () => ({ title: '', content: '' }),
  }
  const scope = vue.effectScope()
  vm.createContext(context)
  scope.run(() => vm.runInContext(ts.transpileModule(statements, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nthis.articleId = articleId;', context))
  try {
    context.lastManualSavedAt.value = 'saved-time'
    route.name = 'profile'
    route.params = {}
    await vue.nextTick()
    assert.equal(context.articleId.value, '42')
    assert.equal(context.lastManualSavedAt.value, 'saved-time')
    assert.equal(context.formValues.value.content, values.content)
    assert.equal(resets, 0)
    // Background articles also have an id, which must not replace the editor's id.
    route.name = 'article-read'
    route.params = { id: '99' }
    await vue.nextTick()
    assert.equal(context.articleId.value, '42')
    // A real navigation to another editor still updates its identity.
    route.name = 'editor'
    route.params = { id: '43' }
    await vue.nextTick()
    assert.equal(context.articleId.value, '43')
    route.name = 'new'
    route.params = {}
    await vue.nextTick()
    assert.equal(context.articleId.value, '')
    assert.equal(resets, 1)
    assert.equal(context.formValues.value.content, '')
  } finally { scope.stop() }
})

test('status messages have a stable live region and overlapping reduced-motion-aware transitions', () => {
  const page = fs.readFileSync(path.join(root, 'src/pages/article/ArticleEditorPage.vue'), 'utf8')
  assert.ok(page.includes('class="editor-save-status" role="status" aria-live="polite"'))
  assert.ok(page.includes('<Transition name="editor-save-status">'))
  assert.ok(page.includes(':key="saveStatus.text"'))
  assert.match(page, /\.editor-save-status > \.editor-save-pill \{\s*grid-area: 1 \/ 1;/)
  assert.match(page, /@media \(prefers-reduced-motion: reduce\) \{\s*\.editor-save-status > \.editor-save-status-enter-active,[\s\S]*?transition: none;/)
})

test('fast save waits for the actual Loading cycle boundary before success', async () => {
  const h = saveHarness(async () => true)
  const request = h.handleSaveDraft()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.context.saveLoadingFinishRequested.value, true)
  assert.equal(h.context.manualSaving.value, true)
  assert.equal(h.events.length, 0)
  h.onSaveLoadingCycleComplete()
  await request
  assert.equal(h.events[0][0], 'saved')
  assert.equal(h.context.manualSaving.value, false)
})

test('a cycle before a slow request completes cannot cut off the later cycle', async () => {
  let finish
  const h = saveHarness(() => new Promise(resolve => { finish = resolve }))
  const request = h.handleSaveDraft()
  h.onSaveLoadingCycleComplete()
  finish(true)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.events.length, 0)
  assert.equal(h.context.manualSaving.value, true)
  h.onSaveLoadingCycleComplete()
  await request
  assert.equal(h.events[0][0], 'saved')
})

test('closing after persistence retains manual confirmation while canceling the animation wait', async () => {
  const h = saveHarness(async () => true)
  const request = h.handleSaveDraft()
  await new Promise(resolve => setImmediate(resolve))
  h.context.dispose()
  await request
  assert.equal(h.events.length, 0)
  assert.equal(h.acknowledgements.length, 1)
})

test('failure does not wait for success animation; only checkmark is green and glyph is bounded', async () => {
  const h = saveHarness(async () => false)
  await h.handleSaveDraft()
  assert.equal(h.events[0][0], 'error')
  const icon = fs.readFileSync(path.join(root, 'src/features/article-editor/ui/EditorSaveIcon.vue'), 'utf8')
  const page = fs.readFileSync(path.join(root, 'src/pages/article/ArticleEditorPage.vue'), 'utf8')
  assert.ok(icon.includes("addEventListener('loopComplete'"))
  assert.ok(icon.includes('.editor-save-icon__animation--saved { color: var(--color-success); }'))
  assert.ok(!icon.includes('translateY(2px)'))
  assert.ok(!page.includes('.editor-icon-btn.is-saved {'))
  assert.match(page, /\.editor-icon-btn__glyph \{\s*width: 18px;\s*height: 18px;/)
  assert.match(page, /\.editor-icon-btn \{[^}]*width: 2\.125rem;[^}]*height: 2\.125rem;/)
})

test('only loading fills the button, while the idle and saved glyphs retain their size', () => {
  const page = fs.readFileSync(path.join(root, 'src/pages/article/ArticleEditorPage.vue'), 'utf8')
  assert.ok(page.includes("'editor-icon-btn__glyph--loading': saveVisualState === 'saving'"))
  assert.match(page, /\.editor-icon-btn \{\s*position: relative;/)
  assert.match(page, /\.editor-icon-btn__glyph--loading \{\s*position: absolute;\s*inset: 0;\s*width: auto;\s*height: auto;/)
})

test('loading crops the asset padding so visible tiles fill the button, not just its SVG canvas', () => {
  const icon = fs.readFileSync(path.join(root, 'src/features/article-editor/ui/EditorSaveIcon.vue'), 'utf8')
  assert.ok(icon.includes("viewBoxSize: state === 'saving' ? '4 4 24 24' : undefined"))
  const data = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/assets/lottie/editor-save/loading.json'), 'utf8'))
  const vertices = []
  function collect(items, offset) {
    const transform = items.find(item => item.ty === 'tr')
    const shift = offset.map((value, axis) => value + (transform?.p.k[axis] ?? 0) - (transform?.a.k[axis] ?? 0))
    for (const item of items) {
      if (item.ty === 'gr') collect(item.it, shift)
      if (item.ty === 'sh') vertices.push(...item.ks.k.v.map(point => point.map((value, axis) => value + shift[axis])))
    }
  }
  for (const layer of data.layers) collect(layer.shapes, layer.ks.p.k.slice(0, 2).map((value, axis) => value - layer.ks.a.k[axis]))
  for (const axis of [0, 1]) {
    assert.equal(Math.min(...vertices.map(point => point[axis])), 4)
    assert.equal(Math.max(...vertices.map(point => point[axis])), 28)
  }
  const page = fs.readFileSync(path.join(root, 'src/pages/article/ArticleEditorPage.vue'), 'utf8')
  assert.match(page, /\.editor-icon-btn__glyph--loading \{[^}]*overflow: hidden;\s*border-radius: inherit;/)
})

test('final checkmark path is centered in the 32px canvas, without an extra CSS offset', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/assets/lottie/editor-save/checkmark.json'), 'utf8'))
  const layer = data.layers[0], shapes = layer.shapes[0].it
  const vertices = shapes.find(shape => shape.ty === 'sh').ks.k.v
  const transform = shapes.find(shape => shape.ty === 'tr')
  const center = axis => layer.ks.p.k[axis] - layer.ks.a.k[axis] + transform.p.k[axis]
    + (Math.min(...vertices.map(point => point[axis])) + Math.max(...vertices.map(point => point[axis]))) / 2
  assert.equal(center(0), data.w / 2)
  assert.equal(center(1), data.h / 2)
})
