import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8')
}

test('legacy bearer storage is cleanup-only and never writes a token', async () => {
  const storage = await source('src/shared/utils/authStorage.ts')

  assert.match(storage, /clearLegacyAuthStorage/)
  assert.match(storage, /window\.localStorage/)
  assert.match(storage, /window\.sessionStorage/)
  assert.doesNotMatch(storage, /setItem\(/)
  assert.doesNotMatch(storage, /writeStoredToken/)
  assert.doesNotMatch(storage, /writeStoredUser/)
})

test('Axios uses cookie credentials and has bounded refresh retry exclusions', async () => {
  const http = await source('src/shared/api/http.ts')

  assert.match(http, /withCredentials:\s*true/)
  assert.match(http, /await refreshAccessToken\(\)/)
  assert.match(http, /AUTH_RETRY_CONFIG_KEY/)

  for (const path of [
    '/auth/login',
    '/auth/register',
    '/auth/logout',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
  ]) {
    assert.match(http, new RegExp(path.replaceAll('/', '\\/')))
  }

  assert.doesNotMatch(http, /readStoredToken|writeStoredToken/)
})

test('refresh coordination and logout cancellation stay memory/cookie based', async () => {
  const runtime = await source('src/shared/api/authRuntime.ts')

  assert.match(runtime, /navigator as Navigator/)
  assert.match(runtime, /\.locks/)

  assert.doesNotMatch(runtime, /withStorageLease|REFRESH_LEASE_KEY/)
  assert.match(runtime, /Fail closed/)
  assert.match(runtime, /BroadcastChannel/)
  assert.match(runtime, /beginLogout/)
  assert.match(runtime, /logoutEpoch/)
  assert.match(runtime, /withCredentials:\s*true/)
  assert.match(runtime, /auth\/refresh/)
  assert.match(runtime, /登录会话已结束/)
})

test('offline restore remains unavailable instead of becoming unauthorized', async () => {
  const store = await source('src/stores/auth.ts')
  const guards = await source('src/app/router/guards.ts')
  const app = await source('src/app/App.vue')

  assert.match(store, /sessionRestoreState\.value = 'unavailable'/)
  assert.match(store, /Later protected requests may retry refresh/)
  assert.match(guards, /sessionRestoreState === 'unavailable'/)
  assert.match(guards, /return true/)
  assert.match(app, /暂时无法恢复本设备登录状态/)
  assert.match(app, /retryAuthRestore/)
  assert.match(app, /actionLabel: '重试'/)
  assert.doesNotMatch(app, /fixed inset-x-0 top-3/)
})

test('refresh updates auth state without clearing query/editor state', async () => {
  const store = await source('src/stores/auth.ts')

  assert.match(store, /applyAuthResponse\(event\.session, \{ preserveProfileState: true \}\)/)
  assert.match(store, /if \(options\.clearQueries\)/)
  assert.match(store, /clearAllQueries\(\)/)
  assert.match(store, /function setAuth\(/)
  assert.match(store, /function clearAuth\(/)
})

test('login UI no longer implies local bearer persistence', async () => {
  const login = await source('src/features/auth/ui/LoginForm.vue')
  const mapper = await source('src/features/auth/model/auth.mapper.ts')

  assert.doesNotMatch(login, /rememberMe|Checkbox/)
  assert.match(login, /空闲 30 天失效，绝对上限 90 天/)
  assert.doesNotMatch(mapper, /rememberMe/)
})

test('public profile projection strips email while private profile remains explicit', async () => {
  const adapters = await source('src/shared/api/adapters.ts')
  const controller = await source('../semi-overt-springboot/src/main/java/com/platform/semiovert/auth/api/user/UserProfileController.java')
  const publicResponse = await source('../semi-overt-springboot/src/main/java/com/platform/semiovert/auth/api/user/PublicUserProfileResponse.java')

  assert.match(adapters, /includeEmail: false/)
  assert.match(controller, /toPublicResponse\(user\)/)
  assert.match(publicResponse, /PublicUserProfileDto/)
  assert.doesNotMatch(publicResponse, /String email/)
})

test('logout failure reuses the global bottom-right toast with a retry action', async () => {
  const app = await source('src/app/App.vue')
  const header = await source('src/widgets/app-header/AppHeaderActions.vue')
  const stack = await source('src/widgets/toast-stack/ToastStack.vue')
  const store = await source('src/stores/auth.ts')

  assert.match(app, /toast.error/)
  assert.match(app, /duration: 0/)
  assert.match(app, /actionLabel: '重试'/)
  assert.match(stack, /position="bottom-right"/)
  assert.match(stack, /@action="handleAction"/)
  assert.ok(!header.includes('toast.error'))
  assert.ok(!app.includes('服务器尚未确认退出'))
  assert.match(store, /event.type === 'logout-pending'/)
  assert.match(store, /sessionRestoreMessage.value = event.message/)
})
