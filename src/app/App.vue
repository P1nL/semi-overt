<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type Component,
} from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { RouterView, useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'

import { fetchArticleDetailVm } from '@/entities/queries'
import { queryKeys } from '@/shared/api/queryKeys'
import { useToast } from '@/shared/composables/useToast'
import { ROUTE_NAME, ROUTE_PATH } from '@/shared/constants/routes'
import { UI_TIMING } from '@/shared/constants/ui'
import { ApiBusinessError } from '@/shared/types/api'
import { getErrorMessage } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { AppHeader } from '@/widgets/app-header'
import { AuthDialog } from '@/widgets/auth-dialog'
import { PageSheet } from '@/widgets/page-sheet'
import { ToastStack } from '@/widgets/toast-stack'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const toast = useToast()
const authStore = useAuthStore()
const sessionStore = useSessionStore()
const uiStore = useUiStore()
const ClothBackground = defineAsyncComponent(() => import('@/shared/components/backgrounds/Cloth.vue'))

const PAGE_SHEET_LEAVE = 360
const SHEET_OPENING_MIN_VISIBLE_MS = 260
const DEFAULT_CATEGORY = 'SHORT'
const CATEGORY_VALUES = new Set(['QUICK', 'SHORT', 'DEEP'])
const AUTH_ROUTE_PATHS = new Set<string>([
  ROUTE_PATH.LOGIN,
  ROUTE_PATH.REGISTER,
  ROUTE_PATH.FORGOT_PASSWORD,
  ROUTE_PATH.RESET_PASSWORD,
])

let drawerNavigationTimer: number | null = null
let sheetLeaveTimer: number | null = null
let sheetOpenRequestId = 0
type AsyncRouteLoader = () => Promise<Component | { default: Component }>
const asyncRouteComponentCache = new WeakMap<AsyncRouteLoader, Component>()

const backgroundRoute = shallowRef<RouteLocationNormalizedLoaded | null>(null)
const displayedSheetRoute = shallowRef<RouteLocationNormalizedLoaded | null>(null)
const sheetVisible = ref(false)
const sheetOpening = ref(false)
const sheetBackgroundScrollX = ref(0)
const sheetBackgroundScrollY = ref(0)
const authDialogOpen = ref(false)

const liveRoute = computed(() => router.currentRoute.value)

const baseRenderRoute = computed<RouteLocationNormalizedLoaded>(() =>
  displayedSheetRoute.value
    ? backgroundRoute.value ?? liveRoute.value
    : liveRoute.value,
)

const shouldRenderBaseRoute = computed(
  () => !displayedSheetRoute.value || !!backgroundRoute.value,
)

const shouldAnimateBaseRoute = computed(
  () => !displayedSheetRoute.value && !uiStore.suppressNextPageTransition,
)

const shouldShowAppHeader = computed(() =>
  !baseRenderRoute.value.matched.some((record) => record.meta.publicOnly),
)

const activeHeaderCategory = computed(() => {
  if (baseRenderRoute.value.name !== ROUTE_NAME.CATEGORY) return null

  const value = String(baseRenderRoute.value.params.tab || DEFAULT_CATEGORY).toUpperCase()
  return CATEGORY_VALUES.has(value) ? value : DEFAULT_CATEGORY
})

const activeSheetVariant = computed<'default' | 'full'>(() =>
  displayedSheetRoute.value?.meta.sheetVariant === 'full' ? 'full' : 'default',
)

const activeSheetInset = computed<'default' | 'article'>(() =>
  displayedSheetRoute.value?.meta.sheetInset === 'article' ? 'article' : 'default',
)

const activeSheetScroll = computed<'sheet' | 'content'>(() =>
  displayedSheetRoute.value?.meta.sheetScroll === 'content' ? 'content' : 'sheet',
)

function snapshotRoute(
  targetRoute: RouteLocationNormalizedLoaded | null | undefined,
): RouteLocationNormalizedLoaded | null {
  if (!targetRoute) return null
  return router.resolve(targetRoute.fullPath) as RouteLocationNormalizedLoaded
}

function getRouteViewKey(targetRoute: RouteLocationNormalizedLoaded): string {
  const name = targetRoute.name

  if (
    name === ROUTE_NAME.ARTICLE_EDITOR_NEW ||
    name === ROUTE_NAME.ARTICLE_EDITOR
  ) {
    return targetRoute.fullPath
  }

  return targetRoute.path
}

function getRouteViewProps(targetRoute: RouteLocationNormalizedLoaded) {
  if (
    targetRoute.name === ROUTE_NAME.CATEGORY ||
    targetRoute.name === ROUTE_NAME.SEARCH
  ) {
    return {
      routeOverride: targetRoute,
    }
  }

  return {}
}

function isAsyncRouteLoader(component: unknown): component is AsyncRouteLoader {
  if (typeof component !== 'function') return false

  const componentRecord = component as unknown as Record<string, unknown>
  return !componentRecord.render && !componentRecord.__vccOpts && !componentRecord.__asyncLoader
}

function resolveRouteViewComponent(component: Component | undefined): Component | undefined {
  if (!isAsyncRouteLoader(component)) return component

  const cachedComponent = asyncRouteComponentCache.get(component)
  if (cachedComponent) return cachedComponent

  const asyncComponent = defineAsyncComponent(component)
  asyncRouteComponentCache.set(component, asyncComponent)
  return asyncComponent
}

function isSheetRoute(
  targetRoute: RouteLocationNormalizedLoaded | null | undefined,
) {
  return targetRoute?.meta.presentation === 'sheet'
}

function normalizePathname(rawPath: string | null | undefined): string {
  if (!rawPath) return ''

  try {
    return new URL(rawPath, window.location.origin).pathname
  } catch {
    return rawPath.split(/[?#]/)[0] || ''
  }
}

function isAuthRoutePath(rawPath: string | null | undefined): boolean {
  return AUTH_ROUTE_PATHS.has(normalizePathname(rawPath))
}

function isAuthRoute(
  targetRoute: RouteLocationNormalizedLoaded | null | undefined,
): boolean {
  return Boolean(targetRoute && isAuthRoutePath(targetRoute.fullPath))
}

function routeRequiresAuth(
  targetRoute: RouteLocationNormalizedLoaded | null | undefined,
): boolean {
  return Boolean(
    targetRoute?.matched.some((record) =>
      Boolean(record.meta.requiresAuth || record.meta.roles?.length),
    ),
  )
}

function getFallbackBackgroundRoute(): RouteLocationNormalizedLoaded {
  return router.resolve({ name: ROUTE_NAME.HOME }) as RouteLocationNormalizedLoaded
}

function consumeSavedSheetBackgroundRoute(): RouteLocationNormalizedLoaded {
  const backgroundPath = sessionStore.consumeAuthSheetBackground(ROUTE_PATH.HOME)
  return router.resolve(backgroundPath || { name: ROUTE_NAME.HOME }) as RouteLocationNormalizedLoaded
}

function ensureActiveSheetRouteVisible() {
  if (!isSheetRoute(liveRoute.value)) return

  const activeSheetRoute = snapshotRoute(liveRoute.value)
  if (!activeSheetRoute) return

  if (!backgroundRoute.value) {
    backgroundRoute.value = getFallbackBackgroundRoute()
  }

  displayedSheetRoute.value = activeSheetRoute
  sheetVisible.value = true
}

function clearSheetLeaveTimer() {
  if (sheetLeaveTimer === null) return

  window.clearTimeout(sheetLeaveTimer)
  sheetLeaveTimer = null
}

function cancelPendingSheetOpen() {
  sheetOpenRequestId += 1
  sheetOpening.value = false
}

function getArticleReadRouteId(
  targetRoute: RouteLocationNormalizedLoaded | null | undefined,
): string | null {
  if (targetRoute?.name !== ROUTE_NAME.ARTICLE_READ) return null

  const rawId = targetRoute.params.id
  const articleId = Array.isArray(rawId) ? rawId[0] : rawId

  return articleId === undefined || articleId === null || articleId === ''
    ? null
    : String(articleId)
}

function isCurrentSheetOpenRequest(
  requestId: number,
  targetRoute: RouteLocationNormalizedLoaded,
): boolean {
  return sheetOpenRequestId === requestId && liveRoute.value.fullPath === targetRoute.fullPath
}

function getSheetOpenErrorMessage(error: unknown): string {
  if (error instanceof ApiBusinessError && (error.code === 401 || error.status === 401)) {
    return '文章暂时无法查看。'
  }

  return getErrorMessage(error, '文章加载失败，请稍后重试。')
}

function wait(ms: number): Promise<void> {
  if (typeof window === 'undefined' || ms <= 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function waitForSheetRouteData(
  targetRoute: RouteLocationNormalizedLoaded,
  requestId: number,
): Promise<boolean> {
  const articleId = getArticleReadRouteId(targetRoute)
  if (!articleId) return true

  const queryKey = queryKeys.articleDetail(articleId)
  const shouldShowLoading = queryClient.getQueryData(queryKey) === undefined
  const loadingStartedAt = Date.now()

  if (shouldShowLoading) {
    sheetOpening.value = true
  }

  try {
    await queryClient.ensureQueryData({
      queryKey,
      queryFn: () => fetchArticleDetailVm(articleId),
    })

    if (shouldShowLoading) {
      await wait(SHEET_OPENING_MIN_VISIBLE_MS - (Date.now() - loadingStartedAt))
    }

    return isCurrentSheetOpenRequest(requestId, targetRoute)
  } catch (error) {
    if (isCurrentSheetOpenRequest(requestId, targetRoute)) {
      toast.error(getSheetOpenErrorMessage(error))

      const fallbackPath = backgroundRoute.value?.fullPath || ROUTE_PATH.HOME

      displayedSheetRoute.value = null
      sheetVisible.value = false
      backgroundRoute.value = null

      await router.replace(fallbackPath).catch(() => undefined)
    }

    return false
  } finally {
    if (sheetOpenRequestId === requestId) {
      sheetOpening.value = false
    }
  }
}

async function closeSheet() {
  // ZEN can survive opening an editor sheet. Closing it should always return
  // to the ZEN home surface instead of following a stale history entry (e.g. /404).
  if (uiStore.appreciationMode) {
    await router.replace({ name: ROUTE_NAME.HOME })
    return
  }

  const historyState = typeof window !== 'undefined'
    ? (window.history.state as { back?: string | null } | null)
    : null
  const backPath = historyState?.back ?? ''
  const normalizedBackPath = normalizePathname(backPath)

  if (
    backPath &&
    normalizedBackPath &&
    normalizedBackPath !== liveRoute.value.path &&
    !isAuthRoutePath(backPath)
  ) {
    await router.back()
    return
  }

  await router.replace({ name: ROUTE_NAME.HOME })
}

watch(
  () => route.fullPath,
  async () => {
    if (!uiStore.suppressNextPageTransition) return
    await nextTick()
    uiStore.clearNextPageTransitionSuppression()
  },
  { flush: 'post' },
)

async function syncSheetRouteState(
  nextRoute: RouteLocationNormalizedLoaded,
  previousRoute: RouteLocationNormalizedLoaded | null,
) {
  const nextSnapshot = snapshotRoute(nextRoute)
  const previousSnapshot = snapshotRoute(previousRoute)
  const nextIsSheet = isSheetRoute(nextRoute)
  const previousIsSheet = isSheetRoute(previousRoute)

  clearSheetLeaveTimer()

  if (nextIsSheet) {
    const requestId = ++sheetOpenRequestId

    if (!previousIsSheet && typeof window !== 'undefined') {
      // 路由的滚动处理和 Sheet 内部组件挂载都可能改变 window.scrollY。
      // 在同步路由 watcher 中先保存背景页位置，再交给 PageSheet 锁定和恢复。
      sheetBackgroundScrollX.value = window.scrollX
      sheetBackgroundScrollY.value = window.scrollY
    }

    if (!previousIsSheet && isAuthRoute(previousRoute)) {
      backgroundRoute.value = consumeSavedSheetBackgroundRoute()
    } else if (!previousIsSheet && previousSnapshot) {
      backgroundRoute.value = previousSnapshot
    }

    if (!backgroundRoute.value) {
      backgroundRoute.value = getFallbackBackgroundRoute()
    }

    displayedSheetRoute.value = nextSnapshot
    sheetVisible.value = false

    if (!await waitForSheetRouteData(nextRoute, requestId)) {
      return
    }

    if (!isCurrentSheetOpenRequest(requestId, nextRoute)) {
      return
    }

    sheetVisible.value = true
    return
  }

  cancelPendingSheetOpen()

  if (previousIsSheet && displayedSheetRoute.value) {
    sheetVisible.value = false
    sheetLeaveTimer = window.setTimeout(() => {
      sheetLeaveTimer = null

      if (isSheetRoute(liveRoute.value)) {
        ensureActiveSheetRouteVisible()
        return
      }

      displayedSheetRoute.value = null
      backgroundRoute.value = null
    }, PAGE_SHEET_LEAVE)

    return
  }

  displayedSheetRoute.value = null
  backgroundRoute.value = null
  sheetVisible.value = false
}

watch(
  () => router.currentRoute.value,
  (to, from) => {
    void syncSheetRouteState(to, from ?? null)
  },
  {
    immediate: true,
    flush: 'sync',
  },
)

watch(
  () => [
    liveRoute.value.fullPath,
    displayedSheetRoute.value?.fullPath,
    sheetVisible.value,
    sheetOpening.value,
  ] as const,
  () => {
    if (!isSheetRoute(liveRoute.value)) return
    if (sheetOpening.value) return

    if (
      displayedSheetRoute.value?.fullPath !== liveRoute.value.fullPath ||
      !sheetVisible.value ||
      !backgroundRoute.value
    ) {
      ensureActiveSheetRouteVisible()
    }
  },
  { flush: 'post' },
)

watch(
  () => route.query.auth,
  async (value) => {
    if (value !== 'login') return

    if (!authStore.isAuthenticated) {
      authDialogOpen.value = true
    }

    const nextQuery = { ...route.query }
    delete nextQuery.auth

    await router.replace({
      query: nextQuery,
      hash: route.hash,
    })
  },
  { immediate: true },
)

watch(
  () => sessionStore.lastAuthCode,
  (code) => {
    if (
      code === 401 &&
      !authStore.isAuthenticated &&
      !isAuthRoute(liveRoute.value) &&
      routeRequiresAuth(liveRoute.value)
    ) {
      authDialogOpen.value = true
    }
  },
)

watch(authDialogOpen, (open) => {
  if (!open && sessionStore.lastAuthCode === 401) {
    sessionStore.setAuthCode(null)
  }
})

watch(
  () => [uiStore.drawerOpen, uiStore.isDrawerClosing, uiStore.pendingRoute] as const,
  ([drawerOpen, isDrawerClosing, _pendingRoute]) => {
    if (drawerNavigationTimer !== null) {
      window.clearTimeout(drawerNavigationTimer)
      drawerNavigationTimer = null
    }

    if (!isDrawerClosing || drawerOpen) return

    drawerNavigationTimer = window.setTimeout(async () => {
      const targetRoute = uiStore.pendingRoute

      uiStore.finishDrawerClosing()

      if (targetRoute) {
        uiStore.clearPendingRoute()
        await router.push(targetRoute)
      }

      drawerNavigationTimer = null
    }, UI_TIMING.DRAWER_LEAVE)
  },
  { deep: true },
)

function handleAppreciationKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && uiStore.appreciationMode) uiStore.exitAppreciationMode()
}


onMounted(() => {
  window.addEventListener('keydown', handleAppreciationKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleAppreciationKeydown)
  if (drawerNavigationTimer !== null) {
    window.clearTimeout(drawerNavigationTimer)
  }

  clearSheetLeaveTimer()
})
</script>

<template>
  <div id="app" class="relative min-h-screen overflow-x-hidden text-[var(--color-text)]">
    <div
      aria-hidden="true"
      class="app-theme-background app-light-background"
      :class="uiStore.darkMode ? 'app-theme-background--hidden' : 'app-theme-background--visible'"
    >
    </div>

    <div
      aria-hidden="true"
      class="app-theme-background app-silk-background"
      :class="uiStore.darkMode ? 'app-theme-background--visible' : 'app-theme-background--hidden'"
    >
      <ClothBackground class="app-silk-background__canvas" />
      <div class="app-silk-background__overlay" />
    </div>

    <div
      class="app-interface relative z-10"
      :class="uiStore.appreciationMode && baseRenderRoute.name === ROUTE_NAME.HOME ? 'app-interface--appreciation' : ''"
    >
      <AppHeader
        v-if="shouldShowAppHeader"
        :active-category="activeHeaderCategory"
      />

      <RouterView v-if="shouldRenderBaseRoute" v-slot="{ Component, route: currentRoute }" :route="baseRenderRoute">
        <Transition
          name="page-fade"
          mode="out-in"
          :css="shouldAnimateBaseRoute"
        >
          <div :key="getRouteViewKey(currentRoute)" class="min-h-0">
            <component
              :is="resolveRouteViewComponent(Component)"
              v-bind="getRouteViewProps(currentRoute)"
            />
          </div>
        </Transition>
      </RouterView>
    </div>

    <Transition
      enter-active-class="transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      enter-from-class="translate-y-20"
      enter-to-class="translate-y-0"
      leave-active-class="transition-transform duration-[240ms] ease-[cubic-bezier(0.4,0,1,1)]"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-20"
    >
      <div
        v-if="sheetOpening"
        class="pointer-events-none fixed inset-x-0 bottom-6 z-[65] flex justify-center px-4 md:bottom-8"
        role="status"
        aria-live="polite"
        aria-label="正在加载文章详情"
      >
        <div class="surface-1 flex size-14 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-border)_80%,transparent)] text-[var(--color-text-muted)] shadow-[var(--shadow-md)]">
          <span
            class="inline-block size-5 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-current border-r-transparent"
            aria-hidden="true"
          />
        </div>
      </div>
    </Transition>

    <PageSheet
      v-if="displayedSheetRoute"
      :open="sheetVisible"
      :inset="activeSheetInset"
      :variant="activeSheetVariant"
      :scroll-mode="activeSheetScroll"
      :background-scroll-x="sheetBackgroundScrollX"
      :background-scroll-y="sheetBackgroundScrollY"
      @close="closeSheet"
    >
      <RouterView
        v-slot="{ Component, route: currentRoute }"
        :route="displayedSheetRoute"
      >
        <component
          :is="resolveRouteViewComponent(Component)"
          :key="getRouteViewKey(currentRoute)"
          v-bind="getRouteViewProps(currentRoute)"
        />
      </RouterView>
    </PageSheet>

    <AuthDialog v-model="authDialogOpen" initial-mode="login" />
    <ToastStack />
  </div>
</template>

<style scoped>
.app-interface > :not(:first-child) {
  transition: opacity 320ms ease, transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.app-interface--appreciation > :not(:first-child) {
  pointer-events: none;
  opacity: 0;
  transform: translate3d(0, 0.75rem, 0) scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
  .app-interface > :not(:first-child) { transition-duration: 0.01ms; }
}

.app-theme-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  transition: opacity 900ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity;
}

.app-theme-background--visible { opacity: 1; }
.app-theme-background--hidden { opacity: 0; }
.app-light-background { background: #fff; }
.app-silk-background { background: #0b0b0f; }

.app-silk-background__canvas,
.app-silk-background__overlay {
  position: absolute;
  inset: 0;
}

.app-silk-background__overlay {
  z-index: 2;
  background:
    radial-gradient(circle at 50% 42%, transparent 22%, rgb(5 6 10 / 0.18) 72%, rgb(3 4 8 / 0.46) 100%),
    linear-gradient(180deg, rgb(8 10 15 / 0.08), rgb(8 10 15 / 0.24));
}

@media (prefers-reduced-motion: reduce) {
  .app-theme-background { transition-duration: 0.01ms; }
}
</style>
