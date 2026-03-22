<!-- src/entities/category/ui/CategoryChip.vue -->
<script setup lang="ts">
import type { CategoryVm } from '../model/category.types'

defineProps<{
  category: CategoryVm
}>()
</script>

<template>
  <RouterLink
      :to="category.path"
      class="inline-flex items-center rounded-[var(--radius-pill)] border px-3.5 py-2 text-sm font-medium tracking-[-0.01em] transition-all duration-300"
      :class="
            category.isActive
                ? 'border-transparent bg-[var(--color-text)] text-[var(--color-surface)] shadow-[var(--shadow-sm)]'
                : 'control-surface text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]'
        "
  >
    {{ category.label }}
  </RouterLink>
</template>
