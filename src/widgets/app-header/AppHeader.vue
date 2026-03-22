<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { onClickOutside } from '@vueuse/core'

import Icon from '@/shared/components/base/Icon.vue'
import { Container } from '@/shared/components/layout'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { useUiStore } from '@/stores/ui'
import { CategoryMenu } from '@/widgets/category-menu'
import AppHeaderActions from './AppHeaderActions.vue'
import AppHeaderLogo from './AppHeaderLogo.vue'

const router = useRouter()
const uiStore = useUiStore()

const searchWrapRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchOpen = ref(false)
const keyword = ref(uiStore.searchQuery)

watch(
  () => uiStore.searchQuery,
  (value) => {
    keyword.value = value
  },
)

watch(searchOpen, async (value) => {
  if (!value) return
  await nextTick()
  searchInputRef.value?.focus()
})

onClickOutside(searchWrapRef, () => {
  searchOpen.value = false
})

function toggleSearch() {
  searchOpen.value = !searchOpen.value
}

async function submitSearch() {
  const normalized = keyword.value.trim()
  uiStore.setSearchQuery(normalized)

  if (!normalized) {
    searchOpen.value = false
    return
  }

  await router.push({
    name: ROUTE_NAME.SEARCH,
    query: { keyword: normalized },
  })

  searchOpen.value = false
}
</script>

<template>
  <div class="header-shell">
    <header class="fixed inset-x-0 top-0 z-40 px-3 pt-3 md:px-4">
      <Container>
        <div class="surface-1 flex min-h-13 items-center gap-3 rounded-[var(--radius-xl)] px-3.5 py-2 md:px-4">
          <div class="flex shrink-0 items-center gap-3">
            <AppHeaderLogo />
            <div class="h-5 w-px bg-[color-mix(in_srgb,var(--color-border)_60%,transparent)]" />
            <CategoryMenu />
          </div>

          <div class="relative flex min-w-0 flex-1 items-center justify-end">
            <div
              ref="searchWrapRef"
              class="absolute right-0 top-1/2 -translate-y-1/2 overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              :class="searchOpen ? 'w-[min(26rem,calc(100vw-20rem))]' : 'w-[2.85rem]'"
            >
              <form
                class="header-search-shell flex h-[2.85rem] items-center rounded-[var(--radius-pill)]"
                :class="searchOpen ? 'header-search-shell-open' : 'header-search-shell-closed'"
                @submit.prevent="submitSearch"
              >
                <button
                  type="button"
                  class="tool-icon-button flex h-[2.85rem] w-[2.85rem] shrink-0 items-center justify-center text-[var(--color-text-muted)]"
                  :class="searchOpen ? 'tool-icon-button-open' : ''"
                  :aria-label="searchOpen ? '搜索' : '打开搜索'"
                  @click="searchOpen ? submitSearch() : toggleSearch()"
                >
                  <Icon name="search" :size="18" />
                </button>

                <input
                  v-if="searchOpen"
                  ref="searchInputRef"
                  v-model="keyword"
                  type="search"
                  placeholder="搜索文章"
                  class="min-w-0 flex-1 border-0 bg-transparent pr-3 text-sm text-[var(--color-text)] outline-none ring-0 shadow-none [-webkit-appearance:none] appearance-none placeholder:text-[var(--color-text-faint)] focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none"
                  @keydown.esc="searchOpen = false"
                />
              </form>
            </div>
          </div>

          <AppHeaderActions />
        </div>
      </Container>
    </header>

    <div aria-hidden="true" class="h-[5.5rem] md:h-[5.75rem]" />
  </div>
</template>

<style scoped>
.header-search-shell {
  background: transparent;
  border: 0;
  box-shadow: none;
  backdrop-filter: none;
}

.header-search-shell-open {
  overflow: hidden;
  background: color-mix(in srgb, var(--color-surface-glass-strong) 94%, transparent);
  box-shadow:
    0 10px 28px rgb(15 23 42 / 0.028),
    inset 0 1px 0 rgb(255 255 255 / 0.34);
  backdrop-filter: blur(var(--backdrop-blur)) saturate(180%);
  clip-path: inset(0 round 999px);
}

.tool-icon-button {
  border-radius: 999px;
  transition:
    color 220ms ease,
    background-color 220ms ease;
}

.tool-icon-button-open {
  background: transparent;
  color: var(--color-text-muted);
  transform: none;
}

.tool-icon-button-open:hover {
  background: transparent;
  color: var(--color-text-muted);
  transform: none;
}

input[type="search"]::-webkit-search-decoration,
input[type="search"]::-webkit-search-cancel-button,
input[type="search"]::-webkit-search-results-button,
input[type="search"]::-webkit-search-results-decoration {
  -webkit-appearance: none;
}

input[type="search"],
input[type="search"]:focus,
input[type="search"]:focus-visible {
  border: 0;
  outline: none;
  box-shadow: none;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
}

input[type="search"]::selection {
  background: transparent;
}
</style>
