<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onClickOutside, useMediaQuery } from '@vueuse/core'

import { DraftBoxDrawer } from '@/features/draft-box'
import { ThemeSwitch } from '@/features/theme-switch'
import { authApi } from '@/shared/api/modules/auth'
import { Avatar, Button } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import { useReviewStore } from '@/stores/review'
import { useUiStore } from '@/stores/ui'
import { AuthDialog } from '@/widgets/auth-dialog'

const authStore = useAuthStore()
const reviewStore = useReviewStore()
const uiStore = useUiStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const authDialogOpen = ref(false)
const draftMenuOpen = ref(false)
const userMenuOpen = ref(false)
const draftTriggerRef = ref<HTMLButtonElement | null>(null)
const draftMenuRef = ref<HTMLElement | null>(null)
const userTriggerRef = ref<HTMLButtonElement | null>(null)
const userMenuRef = ref<HTMLElement | null>(null)
const userMenuItemRefs = ref<HTMLButtonElement[]>([])
const loggingOut = ref(false)
const showThemeMenuItem = useMediaQuery('(max-width: 767px)')

const draftMenuId = 'header-draft-box'
const userMenuId = 'header-user-menu'

function getVisibleUserMenuItems() {
  return userMenuItemRefs.value.filter((item) => Boolean(item) && item.offsetParent !== null)
}

function setUserMenuItemRef(element: Element | null | any, index: number) {
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

watch(
  () => route.query.auth,
  async (value) => {
    if (value !== 'login') return

    if (!authStore.isAuthenticated) {
      await nextTick()
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

const userLabel = computed(() => authStore.displayName || (authStore.isAdmin ? '管理员' : '个人中心'))
const avatarFallback = computed(() => userLabel.value.slice(0, 1) || '我')
const themeMenuLabel = computed(() => (uiStore.darkMode ? '切换到浅色模式' : '切换到深色模式'))

const profileRoute = computed(() => {
  if (!authStore.user?.username) return { name: ROUTE_NAME.HOME }
  return {
    name: ROUTE_NAME.PROFILE,
    params: { username: authStore.user.username },
  }
})

async function openDraftEditor(item: { id: number }) {
  closeDraftMenu()
  await router.push({
    name: ROUTE_NAME.ARTICLE_EDITOR,
    params: { id: String(item.id) },
  })
}

async function gotoProfile() {
  closeUserMenu()
  await router.push(profileRoute.value)
}

function toggleThemeMode() {
  uiStore.setDarkMode(!uiStore.darkMode)
  closeUserMenu()
}

function toggleDraftMenu() {
  draftMenuOpen.value = !draftMenuOpen.value
  if (draftMenuOpen.value) {
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

watch(userMenuOpen, async (open) => {
  if (!open) {
    userMenuItemRefs.value = []
    return
  }

  await nextTick()
  userMenuItemRefs.value = userMenuItemRefs.value.filter(Boolean)
})

async function handleLogout() {
  if (loggingOut.value) return

  loggingOut.value = true

  try {
    await authApi.logout()
  } catch (error) {
    toast.warning(getErrorMessage(error, '退出失败，但本地登录状态已清除。'))
  } finally {
    authStore.clearAuth()
    reviewStore.resetReviewState()
    userMenuOpen.value = false
    loggingOut.value = false
    toast.success('已退出登录')
    await router.push({ name: ROUTE_NAME.HOME })
  }
}
</script>

<template>
  <div class="relative z-10 flex shrink-0 items-center gap-2">
    <template v-if="authStore.isAuthenticated">
      <div class="flex items-center gap-1">
        <ThemeSwitch :show-label="false" class="hidden md:inline-flex" />

        <div ref="draftMenuRef" class="relative">
          <button
            ref="draftTriggerRef"
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 254 204"
              class="draft-box-icon"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="draftBodyGrad" x1="127" y1="34" x2="127" y2="187" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#5D4A71"/>
                  <stop offset="1" stop-color="#564967"/>
                </linearGradient>
                <linearGradient id="draftInnerGrad" x1="127" y1="35" x2="127" y2="116" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#58496A"/>
                  <stop offset="1" stop-color="#473B59"/>
                </linearGradient>
                <linearGradient id="draftYellowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#FFD95B"/>
                  <stop offset="1" stop-color="#F5C94A"/>
                </linearGradient>
                <linearGradient id="draftGreenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#57DD87"/>
                  <stop offset="1" stop-color="#39C970"/>
                </linearGradient>
                <linearGradient id="draftBlueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#5896EE"/>
                  <stop offset="1" stop-color="#4280DF"/>
                </linearGradient>
                <linearGradient id="draftRedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#FF5374"/>
                  <stop offset="1" stop-color="#FB4066"/>
                </linearGradient>
                <linearGradient id="draftHandleOuter" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#9168DE"/>
                  <stop offset="1" stop-color="#7B58C5"/>
                </linearGradient>
                <linearGradient id="draftHandleInner" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#C9B8F2"/>
                  <stop offset="1" stop-color="#B09CE6"/>
                </linearGradient>
              </defs>
              <rect x="34" y="36" width="174" height="151" rx="14" fill="url(#draftBodyGrad)"/>
              <rect x="44" y="36" width="154" height="80" rx="10" fill="url(#draftInnerGrad)"/>
              <rect x="48" y="41" width="146" height="70" rx="8" fill="#6A5B86"/>
              <rect x="34" y="103" width="174" height="84" rx="0 0 14 14" fill="#594C6A"/>
              <path d="M34 103H208V173C208 180.732 201.732 187 194 187H48C40.268 187 34 180.732 34 173V103Z" fill="#594C6A"/>
              <rect x="44" y="44" width="9" height="64" rx="4.5" fill="#4F4261"/>
              <rect x="189" y="44" width="9" height="64" rx="4.5" fill="#4F4261"/>
              <rect x="131" y="23" width="40" height="24" rx="7" fill="url(#draftGreenGrad)"/>
              <rect x="86" y="35" width="104" height="54" rx="14" fill="url(#draftYellowGrad)"/>
              <rect x="102" y="48" width="38" height="16" rx="5.5" fill="url(#draftBlueGrad)"/>
              <rect x="67" y="60" width="123" height="48" rx="14" fill="url(#draftYellowGrad)"/>
              <rect x="71" y="72" width="38" height="16" rx="5.5" fill="url(#draftRedGrad)"/>
              <rect x="53" y="83" width="137" height="29" rx="10" fill="url(#draftYellowGrad)"/>
              <rect x="95" y="134" width="51" height="38" rx="9" fill="url(#draftHandleOuter)"/>
              <rect x="101" y="140" width="39" height="26" rx="6" fill="url(#draftHandleInner)"/>
              <path d="M98 37H178" stroke="#FFE07D" stroke-width="2" stroke-linecap="round" opacity="0.28"/>
              <path d="M80 62H183" stroke="#FFE07D" stroke-width="2" stroke-linecap="round" opacity="0.22"/>
              <path d="M66 85H182" stroke="#FFE07D" stroke-width="2" stroke-linecap="round" opacity="0.18"/>
            </svg>

          </button>

          <DraftBoxDrawer
            :id="draftMenuId"
            v-model="draftMenuOpen"
            @open-editor="openDraftEditor"
            @keydown="onDraftPanelKeydown"
          />
        </div>
      </div>

      <div class="h-5 w-px bg-[color-mix(in_srgb,var(--color-border)_55%,transparent)]" />

      <div ref="userMenuRef" class="relative">
        <button
          ref="userTriggerRef"
          type="button"
          class="user-trigger"
          :aria-expanded="userMenuOpen"
          :aria-controls="userMenuId"
          aria-haspopup="menu"
          aria-label="打开用户菜单"
          @click="toggleUserMenu"
          @keydown="onUserTriggerKeydown"
        >
          <Avatar
            :src="authStore.user?.avatar || undefined"
            :name="userLabel"
            :fallback="avatarFallback"
            size="md"
            class="user-avatar"
          />
        </button>

        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="translate-y-1 opacity-0"
          enter-to-class="translate-y-0 opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="translate-y-0 opacity-100"
          leave-to-class="translate-y-1 opacity-0"
        >
          <div
            v-if="userMenuOpen"
            :id="userMenuId"
            class="header-menu-panel surface-1 absolute right-0 top-[calc(100%+0.75rem)] z-50 min-w-44 rounded-lg p-2 shadow-(--shadow-lg) max-md:w-[min(18rem,calc(100vw-1.5rem))]"
            role="menu"
            aria-label="用户菜单"
            @keydown="onUserMenuKeydown"
          >
            <button
              v-if="showThemeMenuItem"
              :ref="(element) => setUserMenuItemRef(element, 0)"
              type="button"
              class="menu-item"
              role="menuitem"
              @click="toggleThemeMode"
            >
              {{ themeMenuLabel }}
            </button>

            <button
              :ref="(element) => setUserMenuItemRef(element, 1)"
              type="button"
              class="menu-item"
              role="menuitem"
              @click="gotoProfile"
            >
              {{ userLabel }}
            </button>

            <button
              :ref="(element) => setUserMenuItemRef(element, 2)"
              type="button"
              class="menu-item menu-item-danger"
              role="menuitem"
              :disabled="loggingOut"
              @click="handleLogout"
            >
              {{ loggingOut ? '退出中...' : '退出' }}
            </button>
          </div>
        </Transition>
      </div>
    </template>

    <template v-else>
      <Button type="button" size="sm" pill variant="secondary" class="max-md:min-h-11" @click="authDialogOpen = true">
        登录 / 注册
      </Button>
    </template>

    <AuthDialog v-model="authDialogOpen" initial-mode="login" />
  </div>
</template>

<style scoped>
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

.draft-box-icon {
  width: 1.55rem;
  height: auto;
  display: block;
}

.tool-icon-button:active,
.user-trigger:active {
  background: transparent;
  color: var(--color-text);
}

.user-avatar:deep(*) {
  border: 0;
}

.menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: flex-start;
  border-radius: 999px;
  padding: 0.7rem 0.9rem;
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
</style>
