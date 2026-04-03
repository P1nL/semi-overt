<!-- src/entities/article/ui/ArticleMetaLine.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { ArticleMetaVm } from '../model/article.types'

const props = defineProps<{
  meta: ArticleMetaVm
}>()

const metaItems = computed(() =>
  [
    props.meta.durationLabel,
    props.meta.readMinutesText,
    props.meta.wordCountText,
    props.meta.displayTime,
  ].filter((item): item is string => Boolean(item)),
)
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.72rem] tracking-[0.01em] text-[var(--color-text-muted)]">
    <template v-for="(item, index) in metaItems" :key="`${item}-${index}`">
      <span class="inline-flex items-center gap-2">
        <span
          v-if="index > 0"
          aria-hidden="true"
          class="inline-block h-1 w-1 rounded-full bg-[color-mix(in_srgb,var(--color-text-muted)_56%,transparent)]"
        />
        <span>{{ item }}</span>
      </span>
    </template>
  </div>
</template>
