import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { createEditorSidePanelPreview, EDITOR_SIDE_PREVIEW_MS } from '../src/features/article-editor/model/editorSidePanelPreview.ts'

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
function clock() {
  let time = 0, nextId = 0
  const pending = new Map(), all = []
  const driver = {
    schedule(callback, delay) { const id = ++nextId; all.push(callback); pending.set(id, { callback, due: time + delay }); return id },
    cancel(id) { pending.delete(id) },
  }
  function advance(delay) {
    const target = time + delay
    for (const [id, item] of [...pending]) if (item.due <= target) {
      time = item.due
      pending.delete(id)
      item.callback()
    }
    time = target
  }
  return { driver, advance, pending, all }
}

test('initial sidebar preview collapses exactly once after 5 seconds', () => {
  const h = clock(), calls = []
  const controller = createEditorSidePanelPreview(() => calls.push('collapse'), h.driver)
  controller.start()
  controller.start()
  assert.equal(EDITOR_SIDE_PREVIEW_MS, 5_000)
  assert.equal(h.pending.size, 1)
  h.advance(4_999)
  assert.deepEqual(calls, [])
  h.advance(1)
  assert.deepEqual(calls, ['collapse'])
  controller.start()
  h.advance(5_000)
  assert.deepEqual(calls, ['collapse'])
})

test('manual toggles cancel preview and a stale callback cannot collapse the user-opened sidebar', () => {
  const h = clock(), calls = []
  const controller = createEditorSidePanelPreview(() => calls.push('collapse'), h.driver)
  controller.start()
  controller.takeControl()
  assert.equal(h.pending.size, 0)
  h.all[0]()
  controller.start()
  h.advance(40_000)
  assert.deepEqual(calls, [])
})

test('unmount clears its timer; a new editor gets an independent preview', () => {
  const h = clock(), calls = []
  const first = createEditorSidePanelPreview(() => calls.push('old'), h.driver)
  first.start()
  first.dispose()
  h.all[0]()
  first.start()
  assert.equal(h.pending.size, 0)
  const second = createEditorSidePanelPreview(() => calls.push('new'), h.driver)
  second.start()
  h.advance(5_000)
  assert.deepEqual(calls, ['new'])
})

test('actual editor toggle reopens the collapsed sidebar without restarting its timeout', () => {
  const h = clock()
  const setup = parse(read('src/features/article-editor/ui/ArticleEditorForm.vue')).descriptor.scriptSetup.content
  const ast = ts.createSourceFile('editor.ts', setup, ts.ScriptTarget.Latest, true)
  const code = ast.statements.filter(node => {
    if (ts.isVariableStatement(node)) return node.declarationList.declarations.some(item => ['sidePanelOpen', 'sidePanelPreview'].includes(item.name.getText(ast)))
    return ts.isFunctionDeclaration(node) && node.name.text === 'toggleSidePanel'
  }).map(node => node.getText(ast)).join('\n')
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { ref: value => ({ value }), createEditorSidePanelPreview: callback => createEditorSidePanelPreview(callback, h.driver) }
  vm.createContext(context)
  vm.runInContext(js + '\nthis.api = { sidePanelOpen, sidePanelPreview, toggleSidePanel };', context)
  const ui = context.api
  assert.equal(ui.sidePanelOpen.value, true)
  ui.sidePanelPreview.start()
  h.advance(5_000)
  assert.equal(ui.sidePanelOpen.value, false)
  ui.toggleSidePanel()
  assert.equal(ui.sidePanelOpen.value, true)
  h.advance(40_000)
  assert.equal(ui.sidePanelOpen.value, true)
  assert.match(setup, /onMounted\(async \(\) => \{\s*sidePanelPreview.start\(\)/)
  assert.match(setup, /onBeforeUnmount\(\(\) => \{\s*sidePanelPreview.dispose\(\)/)
})

test('tight top inset is opt-in for both editor routes; reader drawers keep their original inset', () => {
  const creator = read('src/app/router/routes/creator.ts')
  assert.equal((creator.match(/sheetInset: 'editor'/g) ?? []).length, 2)
  assert.ok(!read('src/app/router/routes/public.ts').includes("sheetInset: 'editor'"))
  const sheet = read('src/widgets/page-sheet/PageSheet.vue')
  assert.match(sheet, /\.page-sheet--editor \{ --page-sheet-editor-top: 3\.5rem; \}/)
  assert.match(sheet, /\.page-sheet-close--editor \{ height: var\(--page-sheet-editor-top\); \}/)
  assert.match(sheet, /\.page-sheet-panel--editor \{ top: var\(--page-sheet-editor-top\); \}/)
  assert.ok(sheet.includes("props.inset === 'editor' ? 'page-sheet-close--editor' : 'h-20 md:h-24'"))
  assert.ok(sheet.includes("props.inset === 'article' ? 'top-20 md:top-24'"))
})

test('writing canvas is modestly wider and small screens retain a manual sidebar toggle', () => {
  const form = read('src/features/article-editor/ui/ArticleEditorForm.vue')
  assert.ok(form.includes('--editor-canvas-width: 48rem;'))
  assert.ok(form.includes('width: min(var(--editor-canvas-width), calc(100% - var(--editor-toolbar-width) - var(--editor-toolbar-gap)))'))
  const mobile = form.slice(form.indexOf('@media (max-width: 960px)'), form.indexOf('/* 大屏（>960px）'))
  assert.match(mobile, /\.editor-side-toggle-anchor \{[^}]*position: static;[^}]*display: flex;/)
  assert.match(mobile, /\.editor-side-toggle \{[^}]*width: 2\.5rem;[^}]*height: 2\.5rem;/)
})
