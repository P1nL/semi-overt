<script setup lang="ts">
import { ArticleAuthorMeta, ArticleMetaLine, ArticleStatusBadge } from '@/entities/article/ui'
import type { ArticleDetailVm } from '@/entities/article'

withDefaults(
    defineProps<{
      article: ArticleDetailVm
      showStatus?: boolean
    }>(),
    {
      showStatus: true,
    },
)
</script>

<template>
  <header class="space-y-6">
    <div class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <h1 class="max-w-4xl text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
            {{ article.title }}
          </h1>
        </div>

        <div class="flex shrink-0 items-start gap-3">
          <slot name="actions" />
          <ArticleStatusBadge
              v-if="showStatus"
              :status="article.status"
              size="md"
          />
        </div>
      </div>

      <ArticleMetaLine :meta="article.meta" />
      <ArticleAuthorMeta :author="article.author" size="md" />
    </div>

    <div
        v-if="article.latestReviewReason"
        class="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--color-warning)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,var(--color-surface)_90%)] px-4 py-3.5 text-sm leading-6 text-[var(--color-text)]"
    >
      Latest review note: {{ article.latestReviewReason }}
    </div>
  </header>
</template>
