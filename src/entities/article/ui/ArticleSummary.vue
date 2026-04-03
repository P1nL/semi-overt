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
      class="text-sm leading-[1.65] text-[color-mix(in_srgb,var(--color-text-muted)_94%,var(--color-text)_6%)]"
      :class="lines === 1 ? 'line-clamp-1' : lines === 2 ? 'line-clamp-2' : 'line-clamp-3'"
  >
    {{ summary.text }}
  </p>
</template>
