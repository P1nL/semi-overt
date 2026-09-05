<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import { useRoute } from 'vue-router'
import { onClickOutside } from '@vueuse/core'

import { mapCategoryValueToVm } from '@/entities/category'
import { CATEGORY_ORDER } from '@/entities/category'
import AnimatedFolderIcon from '@/shared/components/base/AnimatedFolderIcon.vue'
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

function setItemRef(element: Element | ComponentPublicInstance | null, index: number) {
  // Extract the DOM element if element is a Vue component instance
  const el = element && '$el' in element ? element.$el : element
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

  const restoreFocus = eventOrOptions && !(eventOrOptions instanceof Event) && eventOrOptions.restoreFocus
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
  <div ref="rootRef" class="relative flex h-[2.85rem] w-auto items-center">
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
      <AnimatedFolderIcon
          class="category-menu-trigger__icon"
          size="1.05rem"
          title="栏目"
          :decorative="false"
      />
      <Icon
          name="chevron-down"
          :size="16"
          class="transition-transform duration-200 ease-out"
          :class="open ? 'rotate-180' : 'rotate-0'"
      />
    </button>

    <Transition name="category-panel">
      <nav
          v-if="open"
          :id="panelId"
          class="category-menu-panel surface-1 absolute left-1/2 top-[calc(100%+0.75rem)] z-50 w-[180px] -translate-x-1/2 rounded-[var(--radius-xl)] p-3 shadow-[var(--shadow-lg)] max-md:fixed max-md:left-3 max-md:top-20 max-md:translate-x-0"
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
                class="category-menu-item flex h-12 items-center justify-center rounded-lg px-3 transition-colors duration-200"
                :class="
                  item.isActive
                    ? 'bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface)_90%)] text-(--color-primary)'
                    : 'text-(--color-text) hover:bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_72%,transparent)]'
                "
                @click="closeMenu()"
            >
              <svg
                  class="category-menu-item__icon"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  focusable="false"
              >
                <circle cx="16" cy="16" r="12" opacity="0.25" />
                <path
                    v-if="getTimerIconVariant(item.value) === 'quick'"
                    d="M16 4 A12 12 0 0 1 28 16 M16 9 V16 H22"
                />
                <path
                    v-else-if="getTimerIconVariant(item.value) === 'short'"
                    d="M16 4 A12 12 0 0 1 16 28 M16 9 V22"
                />
                <path
                    v-else
                    d="M16 4 A12 12 0 1 1 4 16 M16 9 V16 H10"
                />
                <circle cx="16" cy="16" r="1.25" fill="currentColor" stroke="none" />
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
  background: var(--color-surface-panel);
  border-color: var(--color-border-panel);
  -webkit-backdrop-filter: blur(var(--backdrop-blur-panel)) saturate(180%);
  backdrop-filter: blur(var(--backdrop-blur-panel)) saturate(180%);
}

.category-panel-enter-active {
  transition: opacity 220ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.category-panel-leave-active {
  pointer-events: none;
  transition: opacity 180ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.category-panel-enter-from,
.category-panel-leave-to {
  opacity: 0;
  transform: translateY(0.25rem);
}

.category-menu-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.category-menu-item__icon {
  width: 1.75rem;
  height: 1.75rem;
  display: block;
  flex: 0 0 auto;
}
@media (prefers-reduced-motion: reduce) {
  .category-panel-enter-active,
  .category-panel-leave-active {
    transition-duration: 1ms;
  }

  .category-panel-enter-from,
  .category-panel-leave-to {
    transform: none;
  }
}
</style>

