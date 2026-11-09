import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { computed, ref } from 'vue'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const source = read('src/features/home-pin/ui/HomePinButton.vue')
const setup = parse(source).descriptor.scriptSetup.content
const ast = ts.createSourceFile('HomePinButton.ts', setup, ts.ScriptTarget.Latest, true)
const code = ts.transpileModule(ast.statements
  .filter(statement => !ts.isImportDeclaration(statement))
  .map(statement => statement.getText(ast)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText

function harness() {
  const auth = { isAdmin: true }, props = { articleId: 47, pinned: false }
  const pending = ref(0), mutations = [], invalidations = [], errors = [], requests = []
  let options
  const exports = {}
  vm.runInNewContext(`${code}\nObject.assign(exports, { togglePin, label })`, {
    exports, computed, defineProps: () => props, useAuthStore: () => auth,
    useIsMutating: () => pending,
    useQueryClient: () => ({ invalidateQueries: async filters => invalidations.push(filters) }),
    useToast: () => ({ error: message => errors.push(message) }),
    getErrorMessage: (error, fallback) => error.message || fallback,
    homeApi: { setHomePin: async (id, pinned) => requests.push({ id, pinned }) },
    queryKeys: { home: ['home'] },
    useMutation: config => { options = config; return { mutate: value => mutations.push(value) } },
  })
  return { ...exports, auth, props, pending, mutations, invalidations, errors, requests, options }
}

test('only admins can toggle; pending submissions are ignored and the action follows server state', async () => {
  const h = harness()
  h.auth.isAdmin = false
  h.togglePin()
  assert.deepEqual(h.mutations, [])
  h.auth.isAdmin = true
  h.pending.value = 1
  h.togglePin()
  assert.deepEqual(h.mutations, [])
  h.pending.value = 0
  assert.equal(h.label.value, '置顶到首页')
  h.togglePin()
  assert.deepEqual(h.mutations, [true])
  h.props.pinned = true
  // Plain mocked props are not reactive, but togglePin reads their current value.
  h.togglePin()
  assert.deepEqual(h.mutations, [true, false])
  await h.options.mutationFn(false)
  assert.deepEqual(h.requests, [{ id: 47, pinned: false }])
})

test('success refreshes only home; failures show an error and leave the saved state untouched', async () => {
  const h = harness()
  await h.options.onSuccess()
  assert.deepEqual(JSON.parse(JSON.stringify(h.invalidations)), [{ queryKey: ['home'] }])
  h.options.onError(new Error('需要管理员权限'))
  assert.deepEqual(h.errors, ['需要管理员权限'])
  assert.equal(h.props.pinned, false)
})

test('home-only bowling action is a separate accessible button, not a nested link control', () => {
  const card = read('src/widgets/home-showcase/HomeShowcaseCard.vue')
  assert.match(card, /<\/component>\s*<HomePinButton v-if="article"/)
  assert.match(source, /v-if="auth.isAdmin && articleId > 0"/)
  for (const attribute of [':aria-pressed="pinned"', ':aria-busy="busy"', ':disabled="busy"', ':aria-label="label"', '@click.stop.prevent="togglePin"']) {
    assert.ok(source.includes(attribute))
  }
  assert.match(source, /inset-block-start:/)
  assert.match(source, /inset-inline-end:/)
  assert.match(source, /inline-size: 2.75rem/)
  assert.match(source, /:focus-visible/)
  assert.match(read('src/shared/components/base/AnimatedBowlingIcon.vue'), /reducedMotion \? undefined : 'hover'/)
  assert.doesNotMatch(read('src/entities/article/ui/ArticleCard.vue'), /HomePinButton|home-pin/)
  const bowling = JSON.parse(read('src/shared/assets/lottie/ball-bowling-hover-pinch.json'))
  assert.equal(bowling.nm, 'system-outline-3194-ball-bowling')
  assert.equal(bowling.assets[0].nm, 'hover-pinch')
})
