<script setup lang="ts">
import type { PendingReviewItemVm } from '@/entities/review'

defineProps<{
  item: PendingReviewItemVm
}>()
</script>

<template>
  <RouterLink
    :to="item.reviewPath"
    class="surface-1 block min-w-0 rounded-[var(--radius-xl)] p-4 transition-all duration-300]"
  >
    <div class="flex items-start justify-between gap-3">
      <h4 class="line-clamp-2 flex-1 text-base font-semibold tracking-[-0.02em] text-[var(--color-text)]">
        {{ item.title }}
      </h4>
      <span class="shrink-0 rounded-full border border-[color-mix(in_srgb,var(--color-border)_86%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
        {{ item.assignedAdminId ? '分配给你' : '未分配' }}
      </span>
    </div>

    <dl class="mt-4 grid gap-2 text-sm text-[var(--color-text-muted)]">
      <div class="flex items-center justify-between gap-3">
        <dt>作者</dt>
        <dd class="truncate text-[var(--color-text)]">
          {{ item.author?.displayName || item.author?.username || '-' }}
        </dd>
      </div>
      <div class="flex items-center justify-between gap-3">
        <dt>投稿时间</dt>
        <dd class="text-[var(--color-text)]">
          {{ item.submittedAt }}
        </dd>
      </div>
      <div class="flex items-center justify-between gap-3">
        <dt>字数</dt>
        <dd class="text-[var(--color-text)]">
          {{ item.wordCountText }}
        </dd>
      </div>
    </dl>
  </RouterLink>
</template>
