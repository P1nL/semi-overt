<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'

import { ROUTE_NAME } from '@/shared/constants/routes'
import { UI_TIMING } from '@/shared/constants/ui'
import { useUiStore } from '@/stores/ui'
import { AppBackground } from '@/widgets/app-background'
import { PageSheet } from '@/widgets/page-sheet'
import { ToastStack } from '@/widgets/toast-stack'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()

const PAGE_SHEET_LEAVE = 240

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

const activeSheetVariant = computed<'default' | 'full'>(() =>
  displayedSheetRoute.value?.meta.sheetVariant === 'full' ? 'full' : 'default',
)

const activeSheetInset = computed<'default' | 'article'>(() =>
  displayedSheetRoute.value?.meta.sheetInset === 'article' ? 'article' : 'default',
)

const activeSheetScroll = computed<'sheet' | 'content'>(() =>
  displayedSheetRoute.value?.meta.sheetScroll === 'content' ? 'content' : 'sheet',
)

function getRouteViewKey(targetRoute: RouteLocationNormalizedLoaded): string {
  const name = targetRoute.name

  if (
    name === ROUTE_NAME.ARTICLE_EDITOR_NEW ||
    name === ROUTE_NAME.ARTICLE_EDITOR
  ) {
    return 'article-editor-sheet'
  }

  return targetRoute.path
}

function isSheetRoute(
  targetRoute: RouteLocationNormalizedLoaded | null | undefined,
) {
  return targetRoute?.meta.presentation === 'sheet'
}

async function closeSheet() {
  const historyState = typeof window !== 'undefined'
    ? (window.history.state as { back?: string | null } | null)
    : null

  if (historyState?.back) {
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
  const nextIsSheet = isSheetRoute(nextRoute)
  const previousIsSheet = isSheetRoute(previousRoute)

  if (sheetLeaveTimer !== null) {
    window.clearTimeout(sheetLeaveTimer)
    sheetLeaveTimer = null
  }

  if (nextIsSheet) {
    if (!previousIsSheet && previousRoute) {
      backgroundRoute.value = previousRoute
    }

    displayedSheetRoute.value = nextRoute
    sheetVisible.value = true
    return
  }

  if (previousIsSheet && displayedSheetRoute.value) {
    sheetVisible.value = false
    sheetLeaveTimer = window.setTimeout(() => {
      displayedSheetRoute.value = null
      backgroundRoute.value = null
      sheetLeaveTimer = null
    }, PAGE_SHEET_LEAVE)

    return
  }

  displayedSheetRoute.value = null
  backgroundRoute.value = null
  sheetVisible.value = false
}

const removeAfterEach = router.afterEach((to, from) => {
  syncSheetRouteState(to, from)
})

syncSheetRouteState(router.currentRoute.value, null)

watch(
  () => [uiStore.drawerOpen, uiStore.isDrawerClosing, uiStore.pendingRoute] as const,
  ([drawerOpen, isDrawerClosing, pendingRoute]) => {
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

  if (sheetLeaveTimer !== null) {
    window.clearTimeout(sheetLeaveTimer)
  }

  removeAfterEach()
})
</script>

<template>
  <div id="app" class="relative min-h-screen overflow-x-hidden text-[var(--color-text)]">
    <AppBackground />

    <div class="relative z-10">
      <RouterView v-if="shouldRenderBaseRoute" v-slot="{ Component, route: currentRoute }" :route="baseRenderRoute">
        <Transition name="page-fade" mode="out-in" :css="shouldAnimateBaseRoute">
          <component :is="Component" :key="getRouteViewKey(currentRoute)" />
        </Transition>
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
        <component :is="Component" :key="getRouteViewKey(currentRoute)" />
      </RouterView>
    </PageSheet>

    <ToastStack />
  </div>
</template>
