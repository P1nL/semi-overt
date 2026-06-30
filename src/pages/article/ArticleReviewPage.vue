<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  ARTICLE_STATUS_BADGE_VARIANT_MAP,
  ARTICLE_STATUS_LABEL_MAP,
} from '@/entities/article'
import type { ArticleDetailVm } from '@/entities/article'
import { ReviewLogList } from '@/entities/review/ui'
import { ReviewActionBar, type ReviewActionResult } from '@/features/review-action'
import { useReviewLogsQuery } from '@/entities/queries'
import { EmptyState } from '@/shared/components/base'
import { SectionHeader } from '@/shared/components/layout'
import { REVIEW_AUTO_REFRESH_INTERVAL_MS } from '@/shared/constants/review'
import { setDocumentTitle } from '@/shared/utils/documentTitle'
import { getErrorMessage } from '@/shared/utils/error'
import { ArticleReader } from '@/widgets/article-reader'
import { ArticleToc } from '@/widgets/article-toc'

const route = useRoute()

const articleId = computed(() => String(route.params.id || ''))
const article = ref<ArticleDetailVm | null>(null)
const tocSyncVersion = ref(0)
const tocSyncKey = computed(() => `${articleId.value}-${tocSyncVersion.value}`)

// articleId 变化时重置 article，避免切换文章时短暂显示上一篇的状态
watch(articleId, () => {
  article.value = null
})

const reviewLogsQuery = useReviewLogsQuery(articleId, true, {
  refetchIntervalMs: REVIEW_AUTO_REFRESH_INTERVAL_MS,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
})
const reviewLogs = computed(() => reviewLogsQuery.data.value ?? [])
const pageError = computed(() =>
  reviewLogsQuery.error.value
    ? getErrorMessage(reviewLogsQuery.error.value, '审核记录加载失败，请稍后重试。')
    : '',
)

async function onActed(result: ReviewActionResult) {
  if (article.value) {
    const nextStatus = result.status?.toUpperCase?.() || result.status
    article.value = {
      ...article.value,
      status: {
        value: nextStatus,
        label:
          ARTICLE_STATUS_LABEL_MAP[nextStatus as keyof typeof ARTICLE_STATUS_LABEL_MAP] ??
          nextStatus,
        variant:
          ARTICLE_STATUS_BADGE_VARIANT_MAP[
            nextStatus as keyof typeof ARTICLE_STATUS_BADGE_VARIANT_MAP
          ] ?? 'default',
      },
    }
  }

  await reviewLogsQuery.refetch()
}

function onLoaded(value: ArticleDetailVm) {
  const shouldSyncToc =
    article.value?.id !== value.id ||
    article.value?.content !== value.content

  article.value = value
  setDocumentTitle(value.title)

  if (shouldSyncToc) {
    tocSyncVersion.value += 1
  }
}

</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <main class="flex-1 overflow-y-auto px-3 pb-56 pt-4 sm:px-4 md:px-6 md:pb-44 md:pt-6 xl:px-8">
      <div class="mx-auto w-full max-w-[1200px] space-y-6">

        <section class="surface-1 rounded-[var(--radius-xl)] p-4 lg:hidden">
          <SectionHeader title="目录" compact />
          <ArticleToc :sync-key="tocSyncKey" />
        </section>

        <div class="grid gap-6 xl:gap-8">
          <section class="mx-auto w-full max-w-[900px] space-y-6">
            <section class="surface-1 rounded-[var(--radius-xl)] p-4 sm:p-5 md:p-8">
              <ArticleReader
                :key="articleId"
                :article-id="articleId"
                :review-refresh-interval-ms="REVIEW_AUTO_REFRESH_INTERVAL_MS"
                @loaded="onLoaded"
              />
            </section>

            <section class="surface-1 rounded-[var(--radius-xl)] p-4 sm:p-5 md:p-8">
              <SectionHeader title="审核记录" compact />
              <ReviewLogList :logs="reviewLogs" />
              <EmptyState
                v-if="!reviewLogsQuery.isFetching.value && !reviewLogs.length && pageError"
                title="审核记录加载失败"
                :description="pageError"
                emoji="!"
                size="sm"
              />
            </section>
          </section>
        </div>
      </div>
    </main>

    <div class="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_94%,transparent)] backdrop-blur-xl">
      <div class="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-3 py-3.5 sm:px-4 md:flex-row md:items-center md:justify-between md:px-6 xl:px-8">
        <div class="min-w-0">
          <p class="text-sm font-semibold tracking-[-0.02em] text-[var(--color-text)]">
            审核操作区
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <ReviewActionBar
            :article-id="articleId"
            :author-username="article?.author?.username"
            :assigned-admin-id="article?.assignedAdminId"
            :status="article?.status?.value"
            @acted="onActed"
          />
        </div>
      </div>
    </div>
  </div>
</template>
