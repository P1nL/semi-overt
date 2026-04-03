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

function toggleMenu() {
  open.value = !open.value
}

function setItemRef(element: Element | null, index: number) {
  if (!(element instanceof HTMLAnchorElement)) return
  itemRefs.value[index] = element
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

function closeMenu(options: { restoreFocus?: boolean } = {}) {
  open.value = false

  if (options.restoreFocus) {
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
        class="surface-2 flex h-11 items-center justify-between gap-2 rounded-[var(--radius-pill)] px-3 text-sm font-medium tracking-[-0.01em] text-[var(--color-text)] transition-all duration-300 hover:border-[var(--color-border-strong)] md:h-9 md:px-4"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="panelId"
        aria-haspopup="true"
        @click="toggleMenu"
        @keydown="onTriggerKeydown"
    >
      <span>栏目</span>
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
          class="category-menu-panel surface-1 absolute left-1/2 top-[calc(100%+0.75rem)] z-50 w-[18rem] -translate-x-1/2 rounded-[var(--radius-xl)] p-2 max-md:fixed max-md:left-3 max-md:right-3 max-md:top-[5.35rem] max-md:w-auto max-md:translate-x-0 max-md:overflow-y-auto max-md:p-3"
          aria-label="栏目导航"
          @keydown="onPanelKeydown"
      >
        <ul class="m-0 list-none p-0">
          <li v-for="(item, index) in items" :key="item.value">
            <RouterLink
                :ref="(element) => setItemRef(element, index)"
                :to="item.path"
                class="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] px-3 py-3 transition-all duration-200"
                :class="
                  item.isActive
                    ? 'bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface)_90%)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_72%,transparent)]'
                "
                @click="closeMenu"
            >
              <span class="min-w-0">
                <span class="block text-sm font-medium tracking-[-0.01em]">
                  {{ item.label }}
                </span>
                <span class="mt-1 block text-xs leading-5 text-[var(--color-text-muted)]">
                  {{ item.description }}
                </span>
              </span>
              <Icon
                  v-if="item.isActive"
                  name="check"
                  :size="16"
                  class="mt-0.5 shrink-0"
              />
            </RouterLink>
          </li>
        </ul>
      </nav>
    </Transition>
  </div>
</template>

<style scoped>
.category-menu-panel {
  background: var(--color-surface-panel);
  border-color: var(--color-border-panel);
  -webkit-backdrop-filter: blur(var(--backdrop-blur-panel)) saturate(180%);
  backdrop-filter: blur(var(--backdrop-blur-panel)) saturate(180%);
}
</style>
