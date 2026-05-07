<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'

import { ROUTE_NAME, ROUTE_PATH } from '@/shared/constants/routes'
import { UI_TIMING } from '@/shared/constants/ui'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { AppBackground } from '@/widgets/app-background'
import { AppHeader } from '@/widgets/app-header'
import { PageSheet } from '@/widgets/page-sheet'
import { ToastStack } from '@/widgets/toast-stack'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const uiStore = useUiStore()

const PAGE_SHEET_LEAVE = 240
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

const backgroundRoute = ref<RouteLocationNormalizedLoaded | null>(null)
const displayedSheetRoute = ref<RouteLocationNormalizedLoaded | null>(null)
const sheetVisible = ref(false)

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

async function closeSheet() {
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

function syncSheetRouteState(
  nextRoute: RouteLocationNormalizedLoaded,
  previousRoute: RouteLocationNormalizedLoaded | null,
) {
  const nextSnapshot = snapshotRoute(nextRoute)
  const previousSnapshot = snapshotRoute(previousRoute)
  const nextIsSheet = isSheetRoute(nextRoute)
  const previousIsSheet = isSheetRoute(previousRoute)

  clearSheetLeaveTimer()

  if (nextIsSheet) {
    if (!previousIsSheet && isAuthRoute(previousRoute)) {
      backgroundRoute.value = consumeSavedSheetBackgroundRoute()
    } else if (!previousIsSheet && previousSnapshot) {
      backgroundRoute.value = previousSnapshot
    }

    if (!backgroundRoute.value) {
      backgroundRoute.value = getFallbackBackgroundRoute()
    }

    displayedSheetRoute.value = nextSnapshot
    sheetVisible.value = true
    return
  }

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
    syncSheetRouteState(to, from ?? null)
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
  ] as const,
  () => {
    if (!isSheetRoute(liveRoute.value)) return

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

onBeforeUnmount(() => {
  if (drawerNavigationTimer !== null) {
    window.clearTimeout(drawerNavigationTimer)
  }

  clearSheetLeaveTimer()
})
</script>

<template>
  <div id="app" class="relative min-h-screen overflow-x-hidden text-[var(--color-text)]">
    <AppBackground />

    <div class="relative z-10">
      <AppHeader
        v-if="shouldShowAppHeader"
        :active-category="activeHeaderCategory"
      />

      <RouterView v-if="shouldRenderBaseRoute" v-slot="{ Component, route: currentRoute }" :route="baseRenderRoute">
        <Transition v-if="shouldAnimateBaseRoute" name="page-fade" mode="out-in">
          <component :is="Component" :key="getRouteViewKey(currentRoute)" v-bind="getRouteViewProps(currentRoute)" />
        </Transition>
        <component
          v-else
          :is="Component"
          :key="getRouteViewKey(currentRoute)"
          v-bind="getRouteViewProps(currentRoute)"
        />
      </RouterView>
    </div>

    <PageSheet
      v-if="displayedSheetRoute"
      :open="sheetVisible"
      :inset="activeSheetInset"
      :variant="activeSheetVariant"
      :scroll-mode="activeSheetScroll"
      @close="closeSheet"
    >
      <RouterView
        v-slot="{ Component, route: currentRoute }"
        :route="displayedSheetRoute"
      >
        <component :is="Component" :key="getRouteViewKey(currentRoute)" v-bind="getRouteViewProps(currentRoute)" />
      </RouterView>
    </PageSheet>

    <ToastStack />
  </div>
</template>
