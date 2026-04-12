<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  ARTICLE_STATUS_BADGE_VARIANT_MAP,
  ARTICLE_STATUS_LABEL_MAP,
} from '@/entities/article/model/article.constants'
import type { ArticleDetailVm } from '@/entities/article/model/article.types'
import { ReviewLogList } from '@/entities/review/ui'
import { ReviewActionBar, type ReviewActionResult } from '@/features/review-action'
import { useReviewLogsQuery } from '@/shared/api/queries'
import { EmptyState } from '@/shared/components/base'
import { SectionHeader } from '@/shared/components/layout'
import { getErrorMessage } from '@/shared/utils/error'
import { ArticleReader } from '@/widgets/article-reader'
import { ArticleToc } from '@/widgets/article-toc'

const route = useRoute()
const router = useRouter()

const articleId = computed(() => String(route.params.id || ''))
const readerKey = ref(0)
const article = ref<ArticleDetailVm | null>(null)
const tocSyncKey = ref(`${articleId.value}-0`)

const reviewLogsQuery = useReviewLogsQuery(articleId)
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
  article.value = value
  tocSyncKey.value = `${articleId.value}-${Date.now()}`
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
                :key="`${articleId}-${readerKey}`"
                :article-id="articleId"
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
            :status="article?.status?.value"
            @acted="onActed"
          />
        </div>
      </div>
    </div>
  </div>
</template>
