<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { onClickOutside } from '@vueuse/core'

import { mapCategoryValueToVm } from '@/entities/category/model/category.mapper'
import { CATEGORY_ORDER } from '@/entities/category/model/category.constants'
import Icon from '@/shared/components/base/Icon.vue'

const props = withDefaults(
    defineProps<{
      activeCategory?: string | null
    }>(),
    {
      activeCategory: null,
    },
)

const route = useRoute()
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const itemRefs = ref<HTMLAnchorElement[]>([])
const panelId = 'header-category-menu'

const currentCategory = computed(() => {
  if (props.activeCategory) return props.activeCategory
  if (route.name === 'category') return String(route.params.tab || '')
  return null
})

const items = computed(() =>
    CATEGORY_ORDER.map((category) => mapCategoryValueToVm(category, currentCategory.value)),
)

function getTimerIconVariant(category: string | null | undefined): 'quick' | 'short' | 'deep' {
  switch (category?.toUpperCase()) {
    case 'QUICK':
      return 'quick'
    case 'DEEP':
      return 'deep'
    case 'SHORT':
    default:
      return 'short'
  }
}

function toggleMenu() {
  open.value = !open.value
}

function setItemRef(element: any, index: number) {
  // Extract the DOM element if element is a Vue component instance
  const el = element && '$el' in element ? element.$el : element;
  if (!(el instanceof HTMLAnchorElement)) return
  itemRefs.value[index] = el
}

function focusItem(index: number) {
  const items = itemRefs.value.filter(Boolean)
  if (!items.length) return

  const nextIndex = (index + items.length) % items.length
  items[nextIndex]?.focus()
}

async function openMenuWithKeyboard(index = 0) {
  if (!open.value) {
    open.value = true
  }

  await nextTick()
  focusItem(index)
}

function closeMenu(eventOrOptions?: PointerEvent | { restoreFocus?: boolean }) {
  open.value = false

  const restoreFocus = eventOrOptions && !(eventOrOptions instanceof Event) && eventOrOptions.restoreFocus;
  if (restoreFocus) {
    void nextTick(() => {
      triggerRef.value?.focus()
    })
  }
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    void openMenuWithKeyboard(0)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    void openMenuWithKeyboard(itemRefs.value.length - 1)
    return
  }

  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    closeMenu({ restoreFocus: true })
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  const items = itemRefs.value.filter(Boolean)
  const currentIndex = items.findIndex((item) => item === document.activeElement)

  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu({ restoreFocus: true })
    return
  }

  if (!items.length) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusItem(currentIndex < 0 ? 0 : currentIndex + 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    focusItem(currentIndex < 0 ? items.length - 1 : currentIndex - 1)
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    focusItem(0)
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    focusItem(items.length - 1)
  }
}

onClickOutside(rootRef, closeMenu)

watch(open, async (isOpen) => {
  if (!isOpen) {
    itemRefs.value = []
    return
  }

  await nextTick()
  itemRefs.value = itemRefs.value.filter(Boolean)
})
</script>

<template>
  <div ref="rootRef" class="relative w-auto">
    <button
        ref="triggerRef"
        type="button"
        class="surface-2 flex h-11 items-center justify-between gap-2 rounded-(--radius-pill) px-3 text-sm font-medium tracking-[-0.01em] text-(--color-text) transition-all duration-300 hover:border-(--color-border-strong) md:h-9 md:px-4"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="panelId"
        aria-label="栏目"
        aria-haspopup="true"
        @click="toggleMenu"
        @keydown="onTriggerKeydown"
    >
      <svg
          class="category-menu-trigger__icon"
          viewBox="0 0 1024 1024"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
      >
        <path d="M0 0m36.571429 0l182.857142 0q36.571429 0 36.571429 36.571429l0 182.857142q0 36.571429-36.571429 36.571429l-182.857142 0q-36.571429 0-36.571429-36.571429l0-182.857142q0-36.571429 36.571429-36.571429Z" fill="#BFCBD9" />
        <path d="M0 438.857143m36.571429 0l182.857142 0q36.571429 0 36.571429 36.571428l0 512q0 36.571429-36.571429 36.571429l-182.857142 0q-36.571429 0-36.571429-36.571429l0-512q0-36.571429 36.571429-36.571428Z" fill="#BFCBD9" />
        <path d="M768 438.857143m36.571429 0l182.857142 0q36.571429 0 36.571429 36.571428l0 512q0 36.571429-36.571429 36.571429l-182.857142 0q-36.571429 0-36.571429-36.571429l0-512q0-36.571429 36.571429-36.571428Z" fill="#BFCBD9" />
        <path d="M384 438.857143m36.571429 0l182.857142 0q36.571429 0 36.571429 36.571428l0 512q0 36.571429-36.571429 36.571429l-182.857142 0q-36.571429 0-36.571429-36.571429l0-512q0-36.571429 36.571429-36.571428Z" fill="#BFCBD9" />
        <path d="M384 0m36.571429 0l566.857142 0q36.571429 0 36.571429 36.571429l0 182.857142q0 36.571429-36.571429 36.571429l-566.857142 0q-36.571429 0-36.571429-36.571429l0-182.857142q0-36.571429 36.571429-36.571429Z" fill="#BFCBD9" />
      </svg>
      <Icon
          name="chevron-down"
          :size="16"
          class="transition-transform duration-200 ease-out"
          :class="open ? 'rotate-180' : 'rotate-0'"
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
      <nav
          v-if="open"
          :id="panelId"
          class="category-menu-panel surface-1 absolute left-1/2 top-[calc(100%+0.75rem)] z-50 w-[5rem] -translate-x-1/2 rounded-xl p-2 max-md:fixed max-md:left-3 max-md:right-3 max-md:top-[5.35rem] max-md:w-auto max-md:translate-x-0 max-md:overflow-y-auto max-md:p-3"
          aria-label="栏目导航"
          @keydown="onPanelKeydown"
      >
        <ul class="m-0 list-none p-0">
          <li v-for="(item, index) in items" :key="item.value">
            <RouterLink
                :ref="(element) => setItemRef(element, index)"
                :to="item.path"
                :aria-label="item.label"
                :title="item.label"
                class="flex items-center justify-center rounded-lg px-3 py-1 transition-all duration-200"
                :class="
                  item.isActive
                    ? 'bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface)_90%)] text-(--color-primary)'
                    : 'text-(--color-text) hover:bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_72%,transparent)]'
                "
                @click="closeMenu()"
            >
              <svg
                  v-if="getTimerIconVariant(item.value) === 'quick'"
                  class="category-menu-item__icon"
                  viewBox="0 0 96 96"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  focusable="false"
              >
                <circle cx="48" cy="52" r="28" fill="#F8FAFD"/>
                <circle cx="48" cy="52" r="25" fill="#F4F7FB" stroke="#D7DEE8" stroke-width="3"/>
                <path d="M 48 52 L 48.000 27.000 A 25 25 0 0 1 65.678 34.322 Z" fill="#30B86A"/>
                <circle cx="48" cy="52" r="4" fill="#1C2430"/>
                <path d="M48 52L62 38" stroke="#1C2430" stroke-width="4" stroke-linecap="round"/>
              </svg>
              <svg
                  v-else-if="getTimerIconVariant(item.value) === 'short'"
                  class="category-menu-item__icon"
                  viewBox="0 0 96 96"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  focusable="false"
              >
                <circle cx="48" cy="52" r="28" fill="#F8FAFD"/>
                <circle cx="48" cy="52" r="25" fill="#F4F7FB" stroke="#D7DEE8" stroke-width="3"/>
                <path d="M 48 52 L 48.000 27.000 A 25 25 0 0 1 73.000 52.000 Z" fill="#F2A33A"/>
                <circle cx="48" cy="52" r="4" fill="#1C2430"/>
                <path d="M48 52L68 52" stroke="#1C2430" stroke-width="4" stroke-linecap="round"/>
              </svg>
              <svg
                  v-else
                  class="category-menu-item__icon"
                  viewBox="0 0 96 96"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  focusable="false"
              >
                <circle cx="48" cy="52" r="28" fill="#F8FAFD"/>
                <circle cx="48" cy="52" r="25" fill="#F4F7FB" stroke="#D7DEE8" stroke-width="3"/>
                <path d="M 48 52 L 48.000 27.000 A 25 25 0 0 1 65.678 69.678 Z" fill="#E45A5A"/>
                <circle cx="48" cy="52" r="4" fill="#1C2430"/>
                <path d="M48 52L62 66" stroke="#1C2430" stroke-width="4" stroke-linecap="round"/>
              </svg>
            </RouterLink>
          </li>
        </ul>
      </nav>
    </Transition>
  </div>
</template>

<style scoped>
.category-menu-trigger__icon {
  width: 1.05rem;
  height: 1.05rem;
  display: block;
  flex: 0 0 auto;
}

.category-menu-panel {
  background: var(--color-surface);
  border-color: var(--color-border-panel);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.category-menu-item__icon {
  width: 2.25rem;
  height: 2.25rem;
  display: block;
  flex: 0 0 auto;
}
</style>

