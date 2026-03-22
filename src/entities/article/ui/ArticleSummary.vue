<!-- src/entities/article/ui/ArticleSummary.vue -->
<script setup lang="ts">
import type { ArticleSummaryVm } from '../model/article.types'

withDefaults(
    defineProps<{
      summary: ArticleSummaryVm
      lines?: number
    }>(),
    {
      lines: 2,
    },
)
</script>

<template>
  <p
      class="text-sm leading-7 text-[var(--color-text-muted)]"
      :class="lines === 1 ? 'line-clamp-1' : lines === 2 ? 'line-clamp-2' : 'line-clamp-3'"
  >
    {{ summary.text }}
  </p>
</template>
