<script setup lang="ts">
import { computed, ref } from 'vue'
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
const open = ref(false)

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

function closeMenu() {
  open.value = false
}

onClickOutside(rootRef, closeMenu)
</script>

<template>
  <div ref="rootRef" class="relative w-auto">
    <button
        type="button"
        class="surface-2 flex h-9 items-center justify-between gap-2 rounded-[var(--radius-pill)] px-4 text-sm font-medium tracking-[-0.01em] text-[var(--color-text)] transition-all duration-300 hover:border-[var(--color-border-strong)]"
        :aria-expanded="open ? 'true' : 'false'"
        aria-haspopup="menu"
        @click="toggleMenu"
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
      <div
          v-if="open"
          class="category-menu-panel surface-1 absolute left-1/2 top-[calc(100%+0.75rem)] z-50 w-[18rem] -translate-x-1/2 rounded-[var(--radius-xl)] p-2"
          role="menu"
      >
        <RouterLink
            v-for="item in items"
            :key="item.value"
            :to="item.path"
            class="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] px-3 py-3 transition-all duration-200"
            :class="
              item.isActive
                ? 'bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface)_90%)] text-[var(--color-primary)]'
                : 'text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_72%,transparent)]'
            "
            role="menuitem"
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
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.category-menu-panel {
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  border-color: color-mix(in srgb, var(--color-border-strong) 88%, white 10%);
  -webkit-backdrop-filter: blur(26px) saturate(180%);
  backdrop-filter: blur(26px) saturate(180%);
}
</style>
