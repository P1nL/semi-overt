<script setup lang="ts">
import LiquidPanelTransition from '@/shared/components/base/LiquidPanelTransition.vue'
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { onClickOutside, useMediaQuery } from '@vueuse/core'

import { mapPendingReviewItemDtoToVm } from '@/entities/review'
import { mapUserProfilePageDtoToVm } from '@/entities/user/model/user.mapper'
import { ThemeSwitch } from '@/features/theme-switch'
import { authApi } from '@/shared/api/modules/auth'
import { beginLogout } from '@/shared/api/authRuntime'
import { reviewApi } from '@/shared/api/modules/review'
import { userApi } from '@/shared/api/modules/user'
import { queryKeys } from '@/shared/api/queryKeys'
import { Avatar } from '@/shared/components/base'
import AnimatedAttributionIcon from '@/shared/components/base/AnimatedAttributionIcon.vue'
import AnimatedDraftBoxIcon from '@/shared/components/base/AnimatedDraftBoxIcon.vue'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { UI_TIMING } from '@/shared/constants/ui'
import { preloadImages } from '@/shared/utils/preloadImage'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { AuthDialog } from '@/widgets/auth-dialog'

const AsyncDraftBoxDrawer = defineAsyncComponent(
  () => import('@/features/draft-box/ui/DraftBoxDrawer.vue'),
)

const emit = defineEmits<{ 'dock-blocked': [blocked: boolean] }>()

const authStore = useAuthStore()
const uiStore = useUiStore()
const router = useRouter()
const route = useRoute()
const queryClient = useQueryClient()

const authDialogOpen = ref(false)
const draftMenuOpen = ref(false)
const draftDrawerLoaded = ref(false)
const userMenuOpen = ref(false)
watch(
  () => authDialogOpen.value || draftMenuOpen.value || userMenuOpen.value,
  value => emit('dock-blocked', value),
  { immediate: true },
)
const draftTriggerRef = ref<HTMLButtonElement | null>(null)
const themeEntryRef = ref<HTMLElement | null>(null)
const draftEntryRef = ref<HTMLElement | null>(null)
const draftMenuRef = ref<HTMLElement | null>(null)
const userTriggerRef = ref<HTMLButtonElement | null>(null)
const authTriggerRef = ref<HTMLButtonElement | null>(null)
const logoutCoinRef = ref<HTMLElement | null>(null)
const authLoginIconFrameRef = ref<HTMLElement | null>(null)
const authLoginIconRef = ref<InstanceType<typeof AnimatedAttributionIcon> | null>(null)
const userMenuRef = ref<HTMLElement | null>(null)
const userMenuItemRefs = ref<HTMLButtonElement[]>([])
const loggingOut = ref(false)
const logoutHolding = ref(false)
const logoutFlipping = ref(false)
const suppressProfileClick = ref(false)
const postLogoutIconExpanded = ref(false)
const logoutProgressStrokeRef = ref<SVGCircleElement | null>(null)
const LOGOUT_ACTIVATION_MS = 280
const LOGOUT_PROGRESS_MS = 900
const LOGOUT_FLIP_MS = 560
let logoutHoldTimer: number | null = null
let logoutFlipTimer: number | null = null
let logoutProgressAnimation: Animation | null = null
let logoutProgressRun = 0
let removePostLogoutPointerMove: (() => void) | null = null
let postLogoutSizeFrame = 0
let heldLoginVisualSize = 40
let postLogoutHoverBounds: DOMRect | null = null
const showThemeMenuItem = useMediaQuery('(max-width: 767px)')

const draftMenuId = 'header-draft-box'
const userMenuId = 'header-user-menu'
const PROFILE_PREFETCH_PARAMS = {
  tab: 'all',
  page: 1,
  pageSize: 10,
} as const

let currentUserProfilePromise: Promise<void> | null = null
let warmUserSurfacesTimer: number | null = null
let warmUserSurfacesIdleHandle: number | null = null

function getVisibleUserMenuItems() {
  return userMenuItemRefs.value.filter((item) => Boolean(item) && item.offsetParent !== null)
}

function setUserMenuItemRef(element: Element | ComponentPublicInstance | null, index: number) {
  if (element instanceof HTMLButtonElement) {
    userMenuItemRefs.value[index] = element
  }
}

function focusUserMenuItem(index: number) {
  const items = getVisibleUserMenuItems()
  if (!items.length) return

  const nextIndex = (index + items.length) % items.length
  items[nextIndex]?.focus()
}

function closeDraftMenu(options: { restoreFocus?: boolean } = {}) {
  draftMenuOpen.value = false

  if (options.restoreFocus) {
    void nextTick(() => {
      draftTriggerRef.value?.focus()
    })
  }
}

function closeUserMenu(options: { restoreFocus?: boolean } = {}) {
  userMenuOpen.value = false

  if (options.restoreFocus) {
    void nextTick(() => {
      userTriggerRef.value?.focus()
    })
  }
}

const showAuthenticatedActions = computed(() => authStore.isAuthenticated && !authDialogOpen.value)
const userLabel = computed(() => authStore.displayName || (authStore.isAdmin ? '管理员' : '个人中心'))
const avatarFallback = computed(() => userLabel.value.slice(0, 1) || '我')
const themeMenuLabel = computed(() => (uiStore.darkMode ? '切换到浅色模式' : '切换到深色模式'))
const appreciationEnabled = computed(() => route.name === ROUTE_NAME.HOME)

type SurvivorMoveOffset = { x: number; y: number }

let themeMoveOutOffset: SurvivorMoveOffset | null = null
let draftMoveOutOffset: SurvivorMoveOffset | null = null

function animateSurvivorMove(
  element: HTMLElement | null,
  previousRect: DOMRect | undefined,
  reusedOffset?: SurvivorMoveOffset | null,
) {
  if (!element || !previousRect || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  const nextRect = element.getBoundingClientRect()
  const measuredOffset = {
    x: previousRect.left - nextRect.left,
    y: previousRect.top - nextRect.top,
  }
  // Dock magnification or a viewport change can invalidate the saved entry offset.
  // Only reuse its exact reverse when it still starts at the current visual position.
  const canReuseOffset = reusedOffset
    && Math.abs(reusedOffset.x - measuredOffset.x) < 1
    && Math.abs(reusedOffset.y - measuredOffset.y) < 1
  const offset = canReuseOffset ? reusedOffset : measuredOffset

  if (Math.abs(offset.x) < 1 && Math.abs(offset.y) < 1) return measuredOffset

  element.getAnimations().forEach(animation => animation.cancel())
  element.animate(
    [
      { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` },
      { transform: 'translate3d(0, 0, 0)' },
    ],
    { duration: UI_TIMING.APPRECIATION_MOVE, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  )

  return measuredOffset
}

const stopAppreciationMoveSubscription = uiStore.$onAction(({ name, args, after }) => {
  if (!['enterAppreciationMode', 'exitAppreciationMode', 'setAppreciationMode'].includes(name)) return

  const targetEnabled = name === 'enterAppreciationMode'
    ? true
    : name === 'exitAppreciationMode'
      ? false
      : Boolean(args[0])

  if (targetEnabled === uiStore.appreciationMode) return

  // Capture before the store mutates layout. Entering records the real move-out
  // vector; exiting reuses its inverse so the icon follows exactly the same path home.
  const themeRect = themeEntryRef.value?.getBoundingClientRect()
  const draftRect = draftEntryRef.value?.getBoundingClientRect()
  draftMenuOpen.value = false
  userMenuOpen.value = false

  after(() => {
    void nextTick(() => {
      if (targetEnabled) {
        themeMoveOutOffset = animateSurvivorMove(themeEntryRef.value, themeRect)
        draftMoveOutOffset = animateSurvivorMove(draftEntryRef.value, draftRect)
        return
      }

      animateSurvivorMove(
        themeEntryRef.value,
        themeRect,
        themeMoveOutOffset && { x: -themeMoveOutOffset.x, y: -themeMoveOutOffset.y },
      )
      animateSurvivorMove(
        draftEntryRef.value,
        draftRect,
        draftMoveOutOffset && { x: -draftMoveOutOffset.x, y: -draftMoveOutOffset.y },
      )
      themeMoveOutOffset = null
      draftMoveOutOffset = null
    })
  })
})

const profileRoute = computed(() => {
  if (!authStore.user?.username) return { name: ROUTE_NAME.HOME }
  return {
    name: ROUTE_NAME.PROFILE,
    params: { username: authStore.user.username },
  }
})

async function refreshCurrentUserProfile() {
  if (!authStore.isAuthenticated || !authStore.user?.username || authStore.hasCurrentUserProfile) return

  if (!currentUserProfilePromise) {
    currentUserProfilePromise = authStore.fetchCurrentUser()
      .catch(() => undefined)
      .finally(() => {
        currentUserProfilePromise = null
      })
  }

  await currentUserProfilePromise
}

function prefetchOwnerProfile(username = authStore.user?.username) {
  if (!authStore.isAuthenticated || !username) return

  void queryClient.prefetchQuery({
    queryKey: queryKeys.userProfile(
      username,
      PROFILE_PREFETCH_PARAMS.tab,
      PROFILE_PREFETCH_PARAMS.page,
      PROFILE_PREFETCH_PARAMS.pageSize,
    ),
    queryFn: async () => {
      const profile = mapUserProfilePageDtoToVm(
        await userApi.getUserProfile(username, PROFILE_PREFETCH_PARAMS),
      )
      void preloadImages([profile.coverUrl, profile.avatarUrl], 'high')
      return profile
    },
    staleTime: 30_000,
  })
}

function prefetchAdminReviewQueue() {
  if (!authStore.isAuthenticated || !authStore.isAdmin) return

  void queryClient.prefetchQuery({
    queryKey: queryKeys.reviewPending(1, 10),
    queryFn: async () => {
      const response = await reviewApi.getPendingReviews({ page: 1, pageSize: 10 })
      return {
        ...response,
        list: response.list.map(mapPendingReviewItemDtoToVm),
      }
    },
    staleTime: 30_000,
  })
}

function warmUserSurfaces() {
  if (!authStore.isAuthenticated || !authStore.user?.username) return

  void refreshCurrentUserProfile()
  prefetchOwnerProfile()
  prefetchAdminReviewQueue()
}

function clearScheduledWarmUserSurfaces() {
  if (warmUserSurfacesTimer !== null) {
    window.clearTimeout(warmUserSurfacesTimer)
    warmUserSurfacesTimer = null
  }

  if (warmUserSurfacesIdleHandle !== null && window.cancelIdleCallback) {
    window.cancelIdleCallback(warmUserSurfacesIdleHandle)
    warmUserSurfacesIdleHandle = null
  }
}

function scheduleWarmUserSurfaces() {
  if (!authStore.isAuthenticated || !authStore.user?.username) {
    clearScheduledWarmUserSurfaces()
    return
  }

  if (warmUserSurfacesTimer !== null || warmUserSurfacesIdleHandle !== null) return

  warmUserSurfacesTimer = window.setTimeout(() => {
    warmUserSurfacesTimer = null

    if (window.requestIdleCallback) {
      warmUserSurfacesIdleHandle = window.requestIdleCallback(() => {
        warmUserSurfacesIdleHandle = null
        warmUserSurfaces()
      }, { timeout: 1800 })
      return
    }

    warmUserSurfaces()
  }, 900)
}

async function openDraftEditor(item: { id: number }) {
  await router.push({
    name: ROUTE_NAME.ARTICLE_EDITOR,
    params: { id: String(item.id) },
  })
}

async function gotoProfile() {
  if (suppressProfileClick.value || logoutHolding.value || logoutFlipping.value || loggingOut.value) return
  closeUserMenu()
  await router.push(profileRoute.value)
}

function resetLogoutProgress() {
  logoutProgressRun += 1
  logoutProgressAnimation?.cancel()
  logoutProgressAnimation = null
  logoutHolding.value = false
  window.setTimeout(() => { suppressProfileClick.value = false }, 0)
}

function clearLogoutTimers() {
  if (logoutHoldTimer !== null) { window.clearTimeout(logoutHoldTimer); logoutHoldTimer = null }
  if (logoutFlipTimer !== null) { window.clearTimeout(logoutFlipTimer); logoutFlipTimer = null }
  logoutProgressAnimation?.cancel()
  logoutProgressAnimation = null
}

function cancelLogoutHold() {
  if (logoutFlipping.value || loggingOut.value) return
  if (logoutHoldTimer !== null) {
    window.clearTimeout(logoutHoldTimer)
    logoutHoldTimer = null
  }
  if (!logoutProgressAnimation) return
  const animation = logoutProgressAnimation
  const run = ++logoutProgressRun
  animation.reverse()
  void animation.finished.then(() => {
    if (run !== logoutProgressRun || logoutProgressAnimation !== animation) return
    resetLogoutProgress()
  }).catch(() => undefined)
}

async function activateLogoutProgress() {
  logoutHoldTimer = null
  logoutHolding.value = true
  suppressProfileClick.value = true
  await nextTick()
  const stroke = logoutProgressStrokeRef.value
  if (!stroke) { resetLogoutProgress(); return }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const animation = stroke.animate(
    [{ strokeDashoffset: '135.1' }, { strokeDashoffset: '0' }],
    { duration: reducedMotion ? 1 : LOGOUT_PROGRESS_MS, easing: 'linear', fill: 'forwards' },
  )
  logoutProgressAnimation = animation
  const run = ++logoutProgressRun
  void animation.finished.then(() => {
    if (run !== logoutProgressRun || logoutProgressAnimation !== animation || animation.playbackRate < 0) return
    animation.cancel()
    logoutProgressAnimation = null
    logoutHolding.value = false
    void playLogoutSequence()
  }).catch(() => undefined)
}

function startLogoutHold(event: PointerEvent | KeyboardEvent) {
  if (loggingOut.value || logoutFlipping.value || logoutHoldTimer !== null || logoutProgressAnimation) return
  if (event instanceof PointerEvent && event.button !== 0) return
  if (event instanceof KeyboardEvent && (!['Enter', ' '].includes(event.key) || event.repeat)) return
  if (event instanceof KeyboardEvent) event.preventDefault()
  logoutHoldTimer = window.setTimeout(() => { void activateLogoutProgress() }, LOGOUT_ACTIVATION_MS)
}

function finishLogoutKeyHold(event: KeyboardEvent) {
  if (!['Enter', ' '].includes(event.key)) return
  if (logoutFlipping.value || loggingOut.value) { event.preventDefault(); return }
  cancelLogoutHold()
}

async function playLogoutSequence() {
  if (logoutFlipping.value || loggingOut.value) return
  // Capture the unrotated, magnified avatar before the flip or draft reflow.
  heldLoginVisualSize = logoutCoinRef.value?.getBoundingClientRect().width || 40
  postLogoutHoverBounds = userTriggerRef.value?.getBoundingClientRect() ?? null
  logoutFlipping.value = true
  postLogoutIconExpanded.value = true
  maintainPostLogoutIconVisualSize()
  userMenuOpen.value = false
  logoutFlipTimer = window.setTimeout(async () => {
    logoutFlipTimer = null
    // The pointer is stationary during the flip, so no native mouseenter is
    // guaranteed. Animate the existing player without replacing or resetting it.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      authLoginIconRef.value?.playHoverAnimation()
    }
    await handleLogout()
    logoutFlipping.value = false
    await nextTick()
    maintainPostLogoutIconVisualSize()
    armPostLogoutIconRelease()
    window.setTimeout(() => { suppressProfileClick.value = false }, 0)
  }, LOGOUT_FLIP_MS)
}


function stopMaintainingPostLogoutIconSize() {
  if (postLogoutSizeFrame) {
    window.cancelAnimationFrame(postLogoutSizeFrame)
    postLogoutSizeFrame = 0
  }
}

function maintainPostLogoutIconVisualSize() {
  stopMaintainingPostLogoutIconSize()
  const update = () => {
    const frame = authLoginIconFrameRef.value
    const dock = frame?.closest<HTMLElement>('[data-header-dock-button]')
    if (!frame || !dock || !postLogoutIconExpanded.value) return
    const transform = getComputedStyle(dock).transform
    const scale = transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a || 1
    const compensatedSize = heldLoginVisualSize / scale
    frame.style.width = compensatedSize + 'px'
    frame.style.height = compensatedSize + 'px'
    postLogoutSizeFrame = window.requestAnimationFrame(update)
  }
  update()
}

function releasePostLogoutIcon() {
  const frame = authLoginIconFrameRef.value
  stopMaintainingPostLogoutIconSize()
  postLogoutIconExpanded.value = false
  postLogoutHoverBounds = null
  removePostLogoutPointerMove?.()
  removePostLogoutPointerMove = null
  if (frame) {
    window.requestAnimationFrame(() => {
      frame.style.removeProperty('width')
      frame.style.removeProperty('height')
    })
  }
}

function armPostLogoutIconRelease() {
  removePostLogoutPointerMove?.()
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    // Removing drafts can move the target underneath a stationary pointer.
    // Keep the original hover footprint valid until the user leaves it too.
    const bounds = postLogoutHoverBounds
    if (bounds && event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom) return
    const trigger = authTriggerRef.value
    const hoveredElement = document.elementFromPoint(event.clientX, event.clientY)
    if (trigger && hoveredElement && trigger.contains(hoveredElement)) return
    releasePostLogoutIcon()
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  removePostLogoutPointerMove = () => window.removeEventListener('pointermove', onPointerMove)
}

function toggleThemeMode() {
  uiStore.setDarkMode(!uiStore.darkMode)
  closeUserMenu()
}

function toggleDraftMenu() {
  const nextOpen = !draftMenuOpen.value
  draftMenuOpen.value = nextOpen

  if (nextOpen) {
    draftDrawerLoaded.value = true
    userMenuOpen.value = false
  }
}

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
  if (userMenuOpen.value) {
    draftMenuOpen.value = false
  }
}

function onDraftTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && draftMenuOpen.value) {
    event.preventDefault()
    closeDraftMenu({ restoreFocus: true })
  }
}

function onDraftPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDraftMenu({ restoreFocus: true })
  }
}

async function openUserMenuWithKeyboard(index = 0) {
  if (!userMenuOpen.value) {
    userMenuOpen.value = true
  }

  await nextTick()
  focusUserMenuItem(index)
}

function onUserTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    void openUserMenuWithKeyboard(0)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    void openUserMenuWithKeyboard(userMenuItemRefs.value.length - 1)
    return
  }

  if (event.key === 'Escape' && userMenuOpen.value) {
    event.preventDefault()
    closeUserMenu({ restoreFocus: true })
  }
}

function onUserMenuKeydown(event: KeyboardEvent) {
  const items = getVisibleUserMenuItems()
  const currentIndex = items.findIndex((item) => item === document.activeElement)

  if (event.key === 'Escape') {
    event.preventDefault()
    closeUserMenu({ restoreFocus: true })
    return
  }

  if (!items.length) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusUserMenuItem(currentIndex < 0 ? 0 : currentIndex + 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    focusUserMenuItem(currentIndex < 0 ? items.length - 1 : currentIndex - 1)
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    focusUserMenuItem(0)
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    focusUserMenuItem(items.length - 1)
  }
}

onClickOutside(draftMenuRef, () => {
  if (draftMenuOpen.value) {
    closeDraftMenu()
  }
})

onClickOutside(userMenuRef, () => {
  if (userMenuOpen.value) {
    closeUserMenu()
  }
})

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) return

    draftMenuOpen.value = false
    userMenuOpen.value = false
  },
)

watch(userMenuOpen, async (open) => {
  if (!open) {
    userMenuItemRefs.value = []
    return
  }

  await nextTick()
  scheduleWarmUserSurfaces()
  userMenuItemRefs.value = userMenuItemRefs.value.filter(Boolean)
})

watch(
  () => [
    authStore.token,
    authStore.user?.username,
    authStore.hasCurrentUserProfile,
    authStore.isAdmin,
  ] as const,
  () => {
    scheduleWarmUserSurfaces()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopAppreciationMoveSubscription()
  clearScheduledWarmUserSurfaces()
  clearLogoutTimers()
  removePostLogoutPointerMove?.()
  stopMaintainingPostLogoutIconSize()
})

async function handleLogout() {
  if (loggingOut.value) return

  loggingOut.value = true

  try {
    beginLogout()
    await authApi.logout()
  } catch {
    // authStore receives the runtime failure event; App.vue reuses the global
    // bottom-right Toast stack so this action does not create a duplicate.
  } finally {
    authStore.clearAuth({ skipRuntime: true })
    userMenuOpen.value = false
    loggingOut.value = false
    await router.push({ name: ROUTE_NAME.HOME })
  }
}
</script>

<template>
  <div
    class="header-actions relative z-10 flex shrink-0 items-center gap-2"
    :class="uiStore.appreciationMode ? 'header-actions--appreciation' : ''"
  >
    <div ref="themeEntryRef" class="header-theme-entry" data-header-dock-item="theme" data-header-dock-max-scale="1.4">
      <ThemeSwitch
        data-header-dock-button
        :show-label="false"
        :appreciation-enabled="appreciationEnabled"
        class="header-theme-switch inline-flex"
      />
    </div>

    <Transition name="header-draft-state" :appear="authStore.isAuthenticated">
      <div
        v-if="showAuthenticatedActions"
        ref="draftEntryRef"
        data-header-dock-item="draft"
        class="header-draft-entry"
      >
        <div ref="draftMenuRef" class="relative">
          <button
            ref="draftTriggerRef"
            data-header-dock-button
            type="button"
            class="tool-icon-button"
            :class="draftMenuOpen ? 'tool-icon-button-active' : ''"
            :aria-expanded="draftMenuOpen"
            :aria-controls="draftMenuId"
            aria-haspopup="dialog"
            aria-label="草稿箱"
            @click="toggleDraftMenu"
            @keydown="onDraftTriggerKeydown"
          >
            <AnimatedDraftBoxIcon size="1.55rem" class="draft-box-icon" />

          </button>

          <AsyncDraftBoxDrawer
            v-if="draftDrawerLoaded"
            :id="draftMenuId"
            v-model="draftMenuOpen"
            @open-editor="openDraftEditor"
            @keydown="onDraftPanelKeydown"
          />
        </div>

        <div class="header-auth-divider h-5 w-px bg-[color-mix(in_srgb,var(--color-border)_55%,transparent)]" />
      </div>
    </Transition>

    <div class="header-auth-identity-slot" data-header-dock-item="identity" :aria-hidden="uiStore.appreciationMode ? 'true' : undefined">
      <div class="header-auth-identity-dock" data-header-dock-button>
        <div
          v-show="showAuthenticatedActions"
          ref="userMenuRef"
          class="relative flex items-center justify-center"
        >
        <button
          ref="userTriggerRef"

          type="button"
          class="user-trigger user-profile-trigger"
          :class="{
            'user-profile-trigger--holding': logoutHolding,
            'user-profile-trigger--flipping': logoutFlipping,
          }"
          aria-label="进入个人页；长按退出登录"
          title="点击进入个人页，长按退出登录"
          :disabled="loggingOut"
          @click="gotoProfile"
          @pointerdown="startLogoutHold"
          @pointerup="cancelLogoutHold"
          @pointercancel="cancelLogoutHold"
          @pointerleave="cancelLogoutHold"
          @contextmenu.prevent
          @keydown="startLogoutHold"
          @keyup="finishLogoutKeyHold"
          @blur="cancelLogoutHold"
        >
          <span ref="logoutCoinRef" class="logout-coin">
            <span class="logout-coin__face logout-coin__front">
              <Avatar
                :src="authStore.user?.avatar || undefined"
                :name="userLabel"
                :fallback="avatarFallback"
                size="md"
                loading="eager"
                fetchpriority="high"
                class="user-avatar"
              />
            </span>
          </span>
          <svg class="logout-progress" viewBox="0 0 48 48" aria-hidden="true">
            <circle ref="logoutProgressStrokeRef" class="logout-progress__stroke" cx="24" cy="24" r="21.5" />
          </svg>
        </button>
        </div>

        <button
          ref="authTriggerRef"
          type="button"
          class="tool-icon-button auth-trigger-button"
          :class="{
            'auth-trigger-button--avatar-sized': postLogoutIconExpanded,
            'auth-trigger-button--concealed': showAuthenticatedActions && !logoutFlipping,
            'auth-trigger-button--flipping': logoutFlipping,
          }"
          :aria-hidden="showAuthenticatedActions ? 'true' : undefined"
          :tabindex="showAuthenticatedActions ? -1 : undefined"
          :disabled="showAuthenticatedActions"
          aria-label="登录 / 注册"
          @click="authDialogOpen = true"
        >
          <span ref="authLoginIconFrameRef" class="auth-login-icon-frame">
            <AnimatedAttributionIcon ref="authLoginIconRef" size="100%" title="登录 / 注册" :decorative="false" trigger="hover" />
          </span>
        </button>

      </div>
    </div>

    <AuthDialog v-model="authDialogOpen" initial-mode="login" />
  </div>
</template>

<style scoped>
.header-actions {
  transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* Keep icon sizing explicit; the login player otherwise adds another 1.3x. */
.header-theme-switch :deep(.theme-switch-icon:not(.theme-switch-icon--appreciation)) {
  width: 26px;
  height: 26px;
}
.auth-trigger-button :deep(.animated-attribution-icon__player) {
  width: 100%;
  height: 100%;
}

.header-theme-entry,
.header-draft-entry > :first-child {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--header-dock-width, 2.85rem);
  height: 2.85rem;
  flex-shrink: 0;
}

@media (max-width: 767px) {
  .header-theme-entry { width: 0; }
  .header-actions--appreciation .header-theme-entry { width: 2.85rem; }
}

.header-actions--appreciation {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 80;
  flex-direction: column;
  gap: 0.45rem;
}

.header-actions--appreciation .header-theme-entry { order: 1; }
.header-actions--appreciation .header-theme-switch { display: inline-flex !important; }

.header-actions--appreciation .header-draft-entry {
  order: 2;
  width: 2.85rem;
}

.header-actions--appreciation .header-auth-divider {
  pointer-events: none;
  opacity: 0;
  transform: scaleY(0.45);
}

.header-actions--appreciation .header-auth-identity-slot {
  width: var(--header-dock-width, 2.85rem);
  height: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transform: translate3d(0.45rem, -0.35rem, 0) scale(0.9);
}

@media (max-width: 767px) {
  .header-actions--appreciation { top: 1rem; right: 1rem; }
}

@media (prefers-reduced-motion: reduce) {
  .header-actions { transition-duration: 0.01ms; }
}

.header-draft-entry {
  display: flex;
  flex: 0 0 auto;
  width: calc(var(--header-dock-width, 2.85rem) + 0.5rem + 1px);
  align-items: center;
  gap: 0.5rem;
  transform-origin: right center;
}

.header-auth-divider {
  flex: 0 0 auto;
  opacity: 1;
  transform: scaleY(1);
  transform-origin: center;
  transition:
    opacity 300ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 480ms cubic-bezier(0.22, 1, 0.36, 1);
}

.header-draft-state-enter-active {
  overflow: hidden;
  transition:
    width 260ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.header-draft-state-leave-active {
  overflow: hidden;
  transition:
    width 180ms cubic-bezier(0.4, 0, 1, 1),
    opacity 140ms cubic-bezier(0.4, 0, 1, 1),
    transform 180ms cubic-bezier(0.4, 0, 1, 1);
}

.header-draft-state-enter-from,
.header-draft-state-leave-to {
  width: 0;
  opacity: 0;
  transform: translateX(0.35rem) scale(0.94);
}

.header-auth-identity-dock {
  position: relative;
  perspective: 420px;
  display: flex;
  width: 2.85rem;
  height: 2.85rem;
  align-items: center;
  justify-content: center;
  transform-origin: center;
}

.header-auth-identity-slot {
  display: flex;
  width: var(--header-dock-width, 2.85rem);
  height: 2.85rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
  transition:
    opacity 340ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
}

.header-auth-identity-enter-active {
  transition:
    opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.header-auth-identity-leave-active {
  transition:
    opacity 140ms cubic-bezier(0.4, 0, 1, 1),
    transform 160ms cubic-bezier(0.4, 0, 1, 1);
}

.header-auth-identity-enter-from,
.header-auth-identity-leave-to {
  opacity: 0;
  transform: translateY(0.15rem) scale(0.94);
}

.tool-icon-button,
.user-trigger {
  display: inline-flex;
  height: 2.85rem;
  width: 2.85rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--color-text-muted);
  -webkit-tap-highlight-color: transparent;
  transition:
    color 220ms ease,
    background-color 220ms ease;
}

.tool-icon-button-active,
.user-trigger[aria-expanded='true'] {
  background: transparent;
  color: var(--color-text);
}

.tool-icon-button:hover,
.user-trigger:hover {
  background: color-mix(in srgb, var(--color-surface-glass-strong) 24%, transparent);
  color: var(--color-text);
}

.header-draft-entry .tool-icon-button:hover,
.user-trigger:hover {
  background: transparent;
}

.draft-box-icon {
  width: 1.55rem;
  height: auto;
  display: block;
}

.auth-trigger-button {
  position: absolute;
  inset: 0;
  min-height: 2.85rem;
  min-width: 2.85rem;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: rotateY(0deg);
}

/* One persistent player is both the flip's reverse face and the login action. */
.auth-trigger-button--concealed {
  visibility: hidden;
  pointer-events: none;
  transform: rotateY(-180deg);
}

.auth-trigger-button--flipping {
  pointer-events: none;
  transition: transform 560ms cubic-bezier(0.2, 0.86, 0.28, 1);
}

.auth-trigger-button--avatar-sized {
  color: var(--color-text);
}

@media (prefers-reduced-motion: reduce) {
  .auth-trigger-button--flipping { transition: none; }
}

.auth-trigger-button:hover {
  background: transparent;
}

.auth-login-icon-frame {
  display: block;
  width: 1.75rem;
  height: 1.75rem;
  flex: 0 0 auto;
  transition:
    width 360ms cubic-bezier(0.22, 1, 0.36, 1),
    height 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.auth-trigger-button--avatar-sized .auth-login-icon-frame {
  width: 2.5rem;
  height: 2.5rem;
  transition: none;
}

.tool-icon-button:active,
.user-trigger:active {
  background: transparent;
  color: var(--color-text);
}

.user-avatar:deep(*) {
  border: 0;
}

.user-profile-trigger {
  position: relative;
  perspective: 420px;
  touch-action: manipulation;
  user-select: none;
}

.logout-coin {
  position: relative;
  display: block;
  width: 2.5rem;
  height: 2.5rem;
  transform-style: preserve-3d;
  transition: transform 560ms cubic-bezier(0.2, 0.86, 0.28, 1);
}

.user-profile-trigger--flipping .logout-coin {
  transform: rotateY(180deg);
}

.logout-coin__face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.logout-progress {
  position: absolute;
  inset: -0.075rem;
  width: calc(100% + 0.15rem);
  height: calc(100% + 0.15rem);
  pointer-events: none;
  transform: rotate(-90deg);
}

.logout-progress circle {
  fill: none;
  stroke-width: 2;
}

.logout-progress__stroke {
  stroke: var(--color-danger);
  stroke-linecap: round;
  stroke-dasharray: 135.1;
  stroke-dashoffset: 135.1;
}

.user-profile-trigger--holding .logout-progress__stroke {
  animation: logout-progress 1100ms linear forwards;
}

.user-profile-trigger--flipping .logout-progress {
  opacity: 0;
  transition: opacity 120ms ease-out;
}

@keyframes logout-progress {
  to { stroke-dashoffset: 0; }
}

.menu-item {
  display: flex;
  width: 100%;
  min-height: 3rem;
  align-items: center;
  justify-content: flex-start;
  border-radius: var(--radius-lg);
  padding: 0.65rem 0.75rem;
  color: var(--color-text);
  font-size: 0.95rem;
  transition:
    background-color 180ms ease,
    color 180ms ease;
}

.menu-item:hover {
  background: color-mix(in srgb, var(--color-surface-glass-strong) 78%, transparent);
}

.menu-item-danger {
  color: color-mix(in srgb, var(--color-text-muted) 88%, transparent);
}

.menu-item-danger:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
}

.header-menu-panel {
  background: var(--color-surface-panel);
  border-color: var(--color-border-panel);
  -webkit-backdrop-filter: blur(var(--backdrop-blur-panel)) saturate(180%);
  backdrop-filter: blur(var(--backdrop-blur-panel)) saturate(180%);
}

.header-user-panel-enter-active {
  transition:
    opacity 220ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.header-user-panel-leave-active {
  pointer-events: none;
  transition:
    opacity 180ms ease,
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.header-user-panel-enter-from,
.header-user-panel-leave-to {
  opacity: 0;
  transform: translateY(0.25rem);
}

@media (prefers-reduced-motion: reduce) {
  .logout-coin { transition: none; }\n  .user-profile-trigger--holding .logout-progress__stroke { animation: none; stroke-dashoffset: 0; }\n\n  .header-draft-state-enter-active,
  .header-draft-state-leave-active,
  .header-auth-identity-enter-active,
  .header-auth-identity-leave-active,
  .header-user-panel-enter-active,
  .header-user-panel-leave-active {
    transition-duration: 1ms;
  }

  .header-draft-state-enter-from,
  .header-draft-state-leave-to,
  .header-auth-identity-enter-from,
  .header-auth-identity-leave-to,
  .header-user-panel-enter-from,
  .header-user-panel-leave-to {
    transform: none;
  }
}
</style>
