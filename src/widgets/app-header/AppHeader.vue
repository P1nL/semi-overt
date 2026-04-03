<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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
const searchButtonRef = ref<HTMLButtonElement | null>(null)
const searchOpen = ref(false)
const keyword = ref(uiStore.searchQuery)

const leftSectionClass = computed(() => (searchOpen.value ? 'max-md:hidden' : ''))
const actionSectionClass = computed(() => (searchOpen.value ? 'max-md:hidden' : ''))
const searchWrapClass = computed(() =>
  searchOpen.value
    ? 'left-0 right-0 w-auto max-md:z-20 md:left-auto md:w-[min(22rem,calc(100vw-18rem))] lg:w-[min(26rem,calc(100vw-20rem))]'
    : 'w-[2.85rem]',
)

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
  closeSearch()
})

function toggleSearch() {
  if (!searchOpen.value) {
    keyword.value = ''
    uiStore.clearSearchQuery()
  }

  searchOpen.value = !searchOpen.value
}

function closeSearch(options: { restoreFocus?: boolean } = {}) {
  searchOpen.value = false

  if (options.restoreFocus) {
    void nextTick(() => {
      searchButtonRef.value?.focus()
    })
  }
}

async function submitSearch() {
  const normalized = keyword.value.trim()
  uiStore.setSearchQuery(normalized)

  if (!normalized) {
    keyword.value = ''
    uiStore.clearSearchQuery()
    closeSearch()
    return
  }

  await router.push({
    name: ROUTE_NAME.SEARCH,
    query: { keyword: normalized },
  })

  keyword.value = ''
  uiStore.clearSearchQuery()
  closeSearch()
}
</script>

<template>
  <div class="header-shell">
    <header class="fixed inset-x-0 top-0 z-40 px-3 pt-3 md:px-4">
      <Container>
        <div class="surface-1 flex min-h-13 items-center gap-2 rounded-[var(--radius-xl)] px-3 py-2 md:gap-3 md:px-4">
          <div class="flex shrink-0 items-center gap-2 md:gap-3" :class="leftSectionClass">
            <AppHeaderLogo />
            <div class="hidden h-5 w-px bg-[color-mix(in_srgb,var(--color-border)_60%,transparent)] md:block" />
            <CategoryMenu />
          </div>

          <div class="relative flex min-w-0 flex-1 items-center justify-end">
            <div
              ref="searchWrapRef"
              class="absolute right-0 top-1/2 -translate-y-1/2 overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              :class="searchWrapClass"
            >
              <form
                class="header-search-shell flex h-[2.85rem] items-center rounded-[var(--radius-pill)]"
                :class="searchOpen ? 'header-search-shell-open' : 'header-search-shell-closed'"
                @submit.prevent="submitSearch"
              >
                <button
                  ref="searchButtonRef"
                  type="button"
                  class="tool-icon-button flex h-[2.85rem] w-[2.85rem] shrink-0 items-center justify-center text-[var(--color-text-muted)]"
                  :class="searchOpen ? 'tool-icon-button-open' : ''"
                  :aria-label="searchOpen ? '提交搜索' : '打开搜索'"
                  :aria-expanded="searchOpen"
                  aria-controls="header-search-input"
                  @click="searchOpen ? submitSearch() : toggleSearch()"
                >
                  <Icon name="search" :size="18" />
                </button>

                <input
                  v-if="searchOpen"
                  id="header-search-input"
                  ref="searchInputRef"
                  v-model="keyword"
                  type="search"
                  placeholder="搜索文章"
                  aria-label="搜索文章"
                  class="min-w-0 flex-1 border-0 bg-transparent pr-3 text-sm text-[var(--color-text)] outline-none ring-0 shadow-none [-webkit-appearance:none] appearance-none placeholder:text-[var(--color-text-faint)] focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none"
                  @keydown.esc.prevent="closeSearch({ restoreFocus: true })"
                />
              </form>
            </div>
          </div>

          <AppHeaderActions :class="actionSectionClass" />
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

.header-search-shell button:focus-visible,
.header-search-shell input:focus-visible {
  outline: none !important;
  outline-offset: 0;
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
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
}

input[type="search"]::selection {
  background: transparent;
}
</style>
