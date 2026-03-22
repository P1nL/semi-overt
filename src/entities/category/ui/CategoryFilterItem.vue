<!-- src/entities/category/ui/CategoryFilterItem.vue -->
<script setup lang="ts">
import CategoryBadge from './CategoryBadge.vue'
import type { CategoryVm } from '../model/category.types'

defineProps<{
  category: CategoryVm
}>()
</script>

<template>
  <RouterLink
      :to="category.path"
      class="surface-1 flex items-start justify-between gap-3 rounded-[var(--radius-xl)] p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]"
  >
    <div class="space-y-1">
      <div class="text-sm font-medium tracking-[-0.01em] text-[var(--color-text)]">{{ category.label }}</div>
      <div class="text-xs leading-6 text-[var(--color-text-muted)]">{{ category.description }}</div>
    </div>
    <CategoryBadge :category="category" />
  </RouterLink>
</template>
