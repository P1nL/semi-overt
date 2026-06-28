<!-- src/entities/article/ui/ArticleSummary.vue -->
<script setup lang="ts">
import { computed } from 'vue'

import type { ArticleSummaryVm } from '../model/article.types'

const props = withDefaults(
    defineProps<{
      summary: ArticleSummaryVm
      lines?: number
    }>(),
    {
      lines: 2,
    },
)

const summaryStyle = computed(() => ({
  WebkitLineClamp: props.lines,
  lineClamp: props.lines,
}))
</script>

<template>
  <p
      class="article-summary text-sm leading-[1.65] text-[color-mix(in_srgb,var(--color-text-muted)_94%,var(--color-text)_6%)]"
      :style="summaryStyle"
  >
    {{ summary.text }}
  </p>
</template>

<style scoped>
.article-summary {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
}
</style>
