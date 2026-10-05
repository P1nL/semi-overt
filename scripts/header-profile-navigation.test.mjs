import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('../src/widgets/app-header/AppHeaderActions.vue', import.meta.url), 'utf8')
const handlers = source.slice(source.indexOf('async function gotoProfile()'), source.indexOf('function resetLogoutProgress()'))
function setup(authenticated = false) {
  const state = {
    authStore: { isAuthenticated: authenticated },
    suppressProfileClick: { value: false }, logoutHolding: { value: false },
    logoutFlipping: { value: false }, loggingOut: { value: false },
    profileAfterLogin: { value: false }, authDialogOpen: { value: false },
    profileRoute: { value: { name: 'profile', params: { username: 'real-user' } } },
    navigations: [], refreshes: 0,
  }
  const dependencies = { ...state, closeUserMenu() {},
    router: { async push(route) { state.navigations.push(route) } },
    async refreshCurrentUserProfile() { state.refreshes++ },
  }
  const actions = new Function(...Object.keys(dependencies), handlers + '; return { gotoProfile, onAuthSuccess }')(...Object.values(dependencies))
  return { state, ...actions }
}
test('preview avatar opens login without navigating to a fake account', async () => {
  const { state, gotoProfile } = setup()
  await gotoProfile()
  assert.equal(state.authDialogOpen.value, true)
  assert.equal(state.profileAfterLogin.value, true)
  assert.deepEqual(state.navigations, [])
})
test('real user avatar navigates directly to their profile', async () => {
  const { state, gotoProfile } = setup(true)
  await gotoProfile()
  assert.deepEqual(state.navigations, [state.profileRoute.value])
  assert.equal(state.authDialogOpen.value, false)
})
test('successful login from avatar refreshes and opens the real profile once', async () => {
  const { state, gotoProfile, onAuthSuccess } = setup()
  await gotoProfile()
  state.authStore.isAuthenticated = true
  await onAuthSuccess()
  await onAuthSuccess()
  assert.equal(state.refreshes, 1)
  assert.deepEqual(state.navigations, [state.profileRoute.value])
})
test('ordinary login does not force navigation to the profile', async () => {
  const { state, onAuthSuccess } = setup(true)
  await onAuthSuccess()
  assert.deepEqual(state.navigations, [])
})
test('long-press suppression still prevents click navigation or login', async () => {
  const { state, gotoProfile } = setup()
  state.suppressProfileClick.value = true
  await gotoProfile()
  assert.equal(state.authDialogOpen.value, false)
  assert.deepEqual(state.navigations, [])
})
test('closing the dialog clears pending profile navigation and success is wired', () => {
  assert.ok(source.includes('watch(authDialogOpen, (open) => {'))
  assert.ok(source.includes('if (!open) profileAfterLogin.value = false'))
  assert.match(source, /<AuthDialog[^>]*@success="onAuthSuccess"/)
})
