<!-- src/entities/review/ui/ReviewLogItem.vue -->
<script setup lang="ts">
import ReviewActionTag from './ReviewActionTag.vue'
import ArticleStatusBadge from '@/entities/article/ui/ArticleStatusBadge.vue'
import ArticleAuthorMeta from '@/entities/article/ui/ArticleAuthorMeta.vue'
import type { ReviewLogVm } from '../model/review.types'

defineProps<{
  log: ReviewLogVm
}>()
</script>

<template>
  <li class="surface-1 rounded-[var(--radius-xl)] p-4 md:p-5">
    <div class="flex flex-wrap items-center gap-2">
      <ReviewActionTag :action="log.action" />
      <ArticleStatusBadge :status="log.fromStatus" outlined />
      <span class="text-xs text-[var(--color-text-faint)]">→</span>
      <ArticleStatusBadge :status="log.toStatus" />
    </div>

    <p class="mt-3 text-sm leading-6 text-[var(--color-text)]">{{ log.description }}</p>

    <p v-if="log.reason" class="mt-3 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,var(--color-surface)_90%)] px-3 py-2.5 text-sm text-[var(--color-text)]">
      原因：{{ log.reason }}
    </p>

    <div class="mt-4 flex flex-wrap items-center gap-3 text-xs tracking-[0.01em] text-[var(--color-text-muted)]">
      <ArticleAuthorMeta :author="log.operator" size="xs" :clickable="false" />
      <span>{{ log.createdAt }}</span>
    </div>
  </li>
</template>
