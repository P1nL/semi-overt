<!-- src/entities/review/ui/ReviewLogList.vue -->
<script setup lang="ts">
import ReviewLogItem from './ReviewLogItem.vue'
import type { ReviewLogVm } from '../model/review.types'

defineProps<{
  logs: ReviewLogVm[]
  emptyText?: string
}>()
</script>

<template>
  <div v-if="logs.length" class="space-y-3">
    <ReviewLogItem v-for="log in logs" :key="log.id" :log="log" />
  </div>

  <div v-else class="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-surface-glass)_70%,transparent)] px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
    {{ emptyText || '暂无审核日志' }}
  </div>
</template>
