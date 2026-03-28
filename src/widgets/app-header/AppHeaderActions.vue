<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onClickOutside } from '@vueuse/core'

import { DraftBoxDrawer } from '@/features/draft-box'
import { ThemeSwitch } from '@/features/theme-switch'
import { authApi } from '@/shared/api/modules/auth'
import { Avatar, Button } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import { useReviewStore } from '@/stores/review'
import { AuthDialog } from '@/widgets/auth-dialog'

const authStore = useAuthStore()
const reviewStore = useReviewStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const authDialogOpen = ref(false)
const draftMenuOpen = ref(false)
const userMenuOpen = ref(false)
const draftMenuRef = ref<HTMLElement | null>(null)
const userMenuRef = ref<HTMLElement | null>(null)
const loggingOut = ref(false)

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

const profileRoute = computed(() => {
  if (!authStore.user?.username) return { name: ROUTE_NAME.HOME }
  return {
    name: ROUTE_NAME.PROFILE,
    params: { username: authStore.user.username },
  }
})

async function openDraftEditor(item: { id: number }) {
  draftMenuOpen.value = false
  await router.push({
    name: ROUTE_NAME.ARTICLE_EDITOR,
    params: { id: String(item.id) },
  })
}

async function gotoProfile() {
  userMenuOpen.value = false
  await router.push(profileRoute.value)
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

onClickOutside(draftMenuRef, () => {
  if (draftMenuOpen.value) {
    draftMenuOpen.value = false
  }
})

onClickOutside(userMenuRef, () => {
  if (userMenuOpen.value) {
    userMenuOpen.value = false
  }
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
        <ThemeSwitch :show-label="false" />

        <div ref="draftMenuRef" class="relative">
          <button
            type="button"
            class="tool-icon-button"
            :class="draftMenuOpen ? 'tool-icon-button-active' : ''"
            :aria-expanded="draftMenuOpen"
            aria-haspopup="dialog"
            aria-label="草稿箱"
            @click="toggleDraftMenu"
          >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 2.5 20 20"
                class="h-4 w-4"
                aria-hidden="true"
            >
              <path
                  d="M7 3h8a2 2 0 0 1 2 2v4H7a2 2 0 0 0-2 2V5a2 2 0 0 1 2-2z"
                  fill="#A9C2F7"
              />
              <path
                  d="M4 7a2 2 0 0 1 2-2h4.6a2 2 0 0 1 1.6.8l1.1 1.47A2 2 0 0 0 14.9 8H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"
                  fill="#2563EB"
              />
              <rect x="7.2" y="12" width="3.8" height="1.4" rx="0.7" fill="#FFFFFF" />
              <rect x="7.2" y="15.5" width="8.2" height="1.4" rx="0.7" fill="#FFFFFF" />
            </svg>

          </button>

          <DraftBoxDrawer v-model="draftMenuOpen" @open-editor="openDraftEditor" />
        </div>
      </div>

      <div class="h-5 w-px bg-[color-mix(in_srgb,var(--color-border)_55%,transparent)]" />

      <div ref="userMenuRef" class="relative">
        <button
          type="button"
          class="user-trigger"
          :aria-expanded="userMenuOpen"
          aria-haspopup="menu"
          aria-label="打开用户菜单"
          @click="toggleUserMenu"
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
            class="header-menu-panel surface-1 absolute right-0 top-[calc(100%+0.75rem)] z-50 min-w-[11rem] rounded-[var(--radius-lg)] p-2 shadow-[var(--shadow-lg)]"
            role="menu"
          >
            <button type="button" class="menu-item" role="menuitem" @click="gotoProfile">
              {{ userLabel }}
            </button>

            <button
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
      <Button type="button" size="sm" pill variant="secondary" @click="authDialogOpen = true">
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
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  border-color: color-mix(in srgb, var(--color-border-strong) 88%, white 10%);
  -webkit-backdrop-filter: blur(26px) saturate(180%);
  backdrop-filter: blur(26px) saturate(180%);
}
</style>
