<!-- src/entities/article/ui/ArticleMetaLine.vue -->
<script setup lang="ts">
import type { ArticleMetaVm } from '../model/article.types'

defineProps<{
  meta: ArticleMetaVm
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-[0.01em] text-[var(--color-text-muted)]">
    <span>{{ meta.durationLabel }}</span>
    <span>{{ meta.readMinutesText }}</span>
    <span v-if="meta.wordCountText">{{ meta.wordCountText }}</span>
    <span v-if="meta.displayTime">{{ meta.displayTime }}</span>
  </div>
</template>
