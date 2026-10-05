import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createHeaderPreviewDrafts } from '../src/widgets/app-header/model/headerAuthPreview.ts'

function setupDrawer(development = true) {
  // Setup logic only, with fake stores/APIs; no browser and no network requests.
  const source = readFileSync(new URL('../src/features/draft-box/ui/DraftBoxDrawer.vue', import.meta.url), 'utf8')
  const setup = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replaceAll('import.meta.env.DEV', String(development))
  const code = ts.transpileModule(setup, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const props = { modelValue: true, previewItems: createHeaderPreviewDrafts(true) }
  const writes = [], calls = []
  const baseStore = { items: [], initialized: false, loading: true }
  const draftStore = new Proxy(baseStore, { set(target, key, value) {
    writes.push(key)
    if (development) throw Error('Preview must not modify the real draft store')
    target[key] = value
    return true
  } })
  const forbid = name => () => { calls.push(name); throw Error('Preview invoked ' + name) }
  const vue = {
    computed: fn => ({ get value() { return fn() } }),
    ref: value => ({ value }), nextTick: async () => {}, useAttrs: () => ({}),
    watch: (getter, callback, options) => { if (options?.immediate) callback(getter()) },
  }
  const modules = {
    vue,
    'vue-router': { useRouter: () => ({ push: forbid('router.push') }) },
    '@tanstack/vue-query': { useQueryClient: () => ({ invalidateQueries: forbid('invalidateQueries') }) },
    '@/features/draft-box/model': {
      loadDraftBoxItems: forbid('loadDraftBoxItems'), deleteDraftById: forbid('deleteDraftById'), syncDraftStore: forbid('syncDraftStore'),
    },
    '@/shared/api/queryKeys': { queryKeys: {} },
    '@/shared/composables/useToast': { useToast: () => ({ error: forbid('toast.error') }) },
    '@/shared/constants/article': { ARTICLE_STATUS: { DRAFT: 'DRAFT', PENDING: 'PENDING' } },
    '@/shared/constants/routes': { ROUTE_NAME: {} },
    '@/shared/utils/error': { getErrorMessage: () => 'error' },
    '@/stores/auth': { useAuthStore: () => ({ user: null }) },
    '@/stores/draft': { useDraftStore: () => draftStore },
    '@/stores/editor': { useEditorStore: () => ({ getCachedArticleDetail: forbid('getCachedArticleDetail'), prefetchArticleDetail: forbid('prefetchArticleDetail') }) },
  }
  const requireMock = name => {
    if (!(name in modules)) throw Error('Unexpected runtime import: ' + name)
    return modules[name]
  }
  const result = new Function('require', 'exports', 'defineOptions', 'defineProps', 'defineEmits',
    code + '\nreturn { items, panelLoading, pendingWarning, loadDrafts, openEditor, goCreateArticle, removeDraft };')(
      requireMock, {}, () => {}, () => props, () => forbid('emit'),
    )
  return { ...result, writes, calls, draftStore }
}

test('preview immediately populates the drawer despite missing real authentication', () => {
  const h = setupDrawer()
  assert.equal(h.items.value.length, 3)
  assert.equal(h.panelLoading.value, false)
  assert.equal(h.writes.length, 0)
  assert.equal(h.calls.length, 0)
})
test('preview loading and editor/create actions do not access real APIs or routes', async () => {
  const h = setupDrawer()
  await h.loadDrafts()
  await h.openEditor(h.items.value[0])
  await h.goCreateArticle()
  assert.equal(h.calls.length, 0)
  assert.equal(h.writes.length, 0)
})
test('preview deletion affects only local rows and keeps pending drafts intact', async () => {
  const h = setupDrawer()
  const pending = h.items.value[1]
  await h.removeDraft(pending)
  assert.equal(h.items.value.length, 3)
  await h.removeDraft(h.items.value[0])
  assert.equal(h.items.value.length, 2)
  assert.equal(h.calls.length, 0)
  assert.equal(h.writes.length, 0)
})
test('production ignores preview data even when the prop is supplied', () => {
  const h = setupDrawer(false)
  assert.equal(h.items.value.length, 0)
})
