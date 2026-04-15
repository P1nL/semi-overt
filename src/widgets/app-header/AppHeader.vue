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

withDefaults(
  defineProps<{
    activeCategory?: string | null
  }>(),
  {
    activeCategory: null,
  },
)

const router = useRouter()
const uiStore = useUiStore()

const searchWrapRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchButtonRef = ref<HTMLButtonElement | null>(null)
const searchOpen = ref(false)
const keyword = ref(uiStore.searchQuery)
const dropdownVisible = ref(false)

const leftSectionClass = computed(() => (searchOpen.value ? 'max-md:hidden' : ''))
const actionSectionClass = computed(() => (searchOpen.value ? 'max-md:hidden' : ''))
const searchWrapClass = computed(() =>
  searchOpen.value
    ? 'left-0 right-0 w-auto max-md:z-20 md:left-auto md:w-[min(22rem,calc(100vw-18rem))] lg:w-[min(26rem,calc(100vw-20rem))]'
    : 'w-[2.85rem]',
)

const trimmedKeyword = computed(() => keyword.value.trim())
const showDropdown = computed(() => searchOpen.value && trimmedKeyword.value.length > 0 && dropdownVisible.value)

watch(
  () => uiStore.searchQuery,
  (value) => {
    keyword.value = value
  },
)

watch(searchOpen, async (value) => {
  if (!value) {
    dropdownVisible.value = false
    return
  }
  await nextTick()
  searchInputRef.value?.focus()
})

watch(trimmedKeyword, (value) => {
  dropdownVisible.value = value.length > 0
})

onClickOutside(searchWrapRef, () => {
  closeSearch()
})

function toggleSearch() {
  if (!searchOpen.value) {
    keyword.value = ''
    uiStore.clearSearchQuery()
    dropdownVisible.value = false
  }

  searchOpen.value = !searchOpen.value
}

function closeSearch(options: { restoreFocus?: boolean } = {}) {
  searchOpen.value = false
  dropdownVisible.value = false

  if (options.restoreFocus) {
    void nextTick(() => {
      searchButtonRef.value?.focus()
    })
  }
}

async function navigateToArticleSearch() {
  const normalized = trimmedKeyword.value
  if (!normalized) return

  uiStore.setSearchQuery(normalized)
  await router.push({
    name: ROUTE_NAME.SEARCH,
    query: { keyword: normalized },
  })

  keyword.value = ''
  uiStore.clearSearchQuery()
  closeSearch()
}

async function navigateToAuthorSearch() {
  const normalized = trimmedKeyword.value
  if (!normalized) return

  uiStore.setSearchQuery(normalized)
  await router.push({
    name: ROUTE_NAME.SEARCH,
    query: {
      keyword: normalized,
      type: 'users',
    },
  })

  keyword.value = ''
  uiStore.clearSearchQuery()
  closeSearch()
}

async function submitSearch() {
  await navigateToArticleSearch()
}
</script>

<template>
  <div class="header-shell">
    <header class="fixed inset-x-0 top-0 z-40 px-3 pt-3 md:px-4">
      <Container class="app-header-container">
        <div class="surface-1 flex min-h-13 items-center gap-2 rounded-[var(--radius-xl)] px-3 py-2 md:gap-3 md:px-4">
          <div class="flex shrink-0 items-center gap-2 md:gap-3" :class="leftSectionClass">
            <AppHeaderLogo />
            <div class="hidden h-5 w-px bg-[color-mix(in_srgb,var(--color-border)_60%,transparent)] md:block" />
            <CategoryMenu :active-category="activeCategory" />
          </div>

          <div class="relative flex min-w-0 flex-1 items-center justify-end">
            <div
              ref="searchWrapRef"
              class="absolute right-0 top-1/2 -translate-y-1/2 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              :class="[searchWrapClass, showDropdown ? 'overflow-visible' : 'overflow-hidden']"
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
                  <Icon name="search" size="1.15rem" />
                </button>

                <input
                  v-if="searchOpen"
                  id="header-search-input"
                  ref="searchInputRef"
                  v-model="keyword"
                  type="search"
                  placeholder="搜索文章或作者"
                  aria-label="搜索文章或作者"
                  class="header-search-input min-w-0 flex-1 border-0 bg-transparent pr-3 text-sm text-[var(--color-text)] outline-none ring-0 shadow-none [-webkit-appearance:none] appearance-none placeholder:text-[var(--color-text-faint)] focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none"
                  @keydown.esc.prevent="closeSearch({ restoreFocus: true })"
                />
              </form>

              <!-- 搜索建议下拉框 -->
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="opacity-0 translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 translate-y-1"
              >
                <div
                  v-if="showDropdown"
                  class="search-dropdown absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_97%,transparent)] py-1 shadow-[var(--shadow-lg)] backdrop-blur-xl"
                  role="listbox"
                  aria-label="搜索建议"
                >
                  <button
                    type="button"
                    class="search-dropdown-item flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)]"
                    role="option"
                    @click="navigateToArticleSearch"
                  >
                    <span class="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[var(--color-primary)]">
                      <Icon name="search" size="0.85rem" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-xs text-[var(--color-text-muted)]">文章</span>
                      <span class="block truncate text-sm font-medium text-[var(--color-text)]">具有「{{ trimmedKeyword }}」的文章</span>
                    </span>
                  </button>

                  <div class="mx-4 h-px bg-[var(--color-border)]" />

                  <button
                    type="button"
                    class="search-dropdown-item flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)]"
                    role="option"
                    @click="navigateToAuthorSearch"
                  >
                    <span class="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-text-muted)_10%,transparent)] text-[var(--color-text-muted)]">
                      <Icon name="user" size="0.85rem" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-xs text-[var(--color-text-muted)]">作者</span>
                      <span class="block truncate text-sm font-medium text-[var(--color-text)]">包含「{{ trimmedKeyword }}」的作者</span>
                    </span>
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <AppHeaderActions :class="actionSectionClass" />
        </div>
      </Container>
    </header>

    <div aria-hidden="true" class="h-[var(--header-height)] md:h-[var(--header-height-md)]" />
  </div>
</template>

<style scoped>
.header-shell :deep(.app-header-container) {
  width: min(100% - 1.5rem, 1216px);
}

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

.header-search-shell-open:has(.header-search-input:-webkit-autofill),
.header-search-shell-open:has(.header-search-input:autofill) {
  background: color-mix(in srgb, var(--color-surface-glass-strong) 94%, transparent);
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

.header-search-input:-webkit-autofill,
.header-search-input:-webkit-autofill:hover,
.header-search-input:-webkit-autofill:focus,
.header-search-input:-webkit-autofill:active {
  -webkit-text-fill-color: var(--color-text) !important;
  caret-color: var(--color-text);
  background-color: transparent !important;
  border: 0;
  -webkit-box-shadow: inset 0 0 0 1000px transparent !important;
  box-shadow: inset 0 0 0 1000px transparent !important;
  -webkit-background-clip: text;
  transition:
    background-color 99999s ease-out 0s,
    color 99999s ease-out 0s;
}

.header-search-input:-webkit-autofill::first-line {
  font: inherit;
}

input[type="search"]::selection {
  background: transparent;
}
</style>
