<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'

import {
  ARTICLE_STATUS_BADGE_VARIANT_MAP,
  ARTICLE_STATUS_LABEL_MAP,
} from '@/entities/article/model/article.constants'
import type { ArticleDetailVm } from '@/entities/article/model/article.types'
import { ReviewLogList } from '@/entities/review/ui'
import { AdminDeleteArticleButton } from '@/features/admin-article-delete'
import { ReviewActionBar, type ReviewActionResult } from '@/features/review-action'
import { useReviewLogsQuery } from '@/shared/api/queries'
import { queryKeys } from '@/shared/api/queryKeys'
import { EmptyState } from '@/shared/components/base'
import { SectionHeader } from '@/shared/components/layout'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/utils/error'
import { ArticleReader } from '@/widgets/article-reader'
import { ArticleToc } from '@/widgets/article-toc'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()

const articleId = computed(() => String(route.params.id || ''))
const readerKey = ref(0)
const article = ref<ArticleDetailVm | null>(null)
const tocSyncKey = ref(`${articleId.value}-0`)

const reviewLogsQuery = useReviewLogsQuery(articleId)
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

async function handleAdminDeleted() {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.reviewPendingRoot,
  })
  await router.push({ name: ROUTE_NAME.REVIEW_DASHBOARD })
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <main class="flex-1 overflow-y-auto px-4 pb-40 pt-6 md:px-6 md:pb-44 xl:px-8">
      <div class="mx-auto w-full max-w-[1200px] space-y-6">
        <section class="surface-1 rounded-[var(--radius-xl)] p-6 md:p-8">
          <SectionHeader
            title="审核文章"
            description="先阅读完整内容，再在底部固定操作区执行通过、退回修改或拒绝。"
          />
        </section>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:gap-8">
          <section class="space-y-6">
            <section class="surface-1 rounded-[var(--radius-xl)] p-6 md:p-8">
              <ArticleReader
                :key="`${articleId}-${readerKey}`"
                :article-id="articleId"
                @loaded="onLoaded"
              />
            </section>

            <section class="surface-1 rounded-[var(--radius-xl)] p-6 md:p-8">
              <SectionHeader title="审核记录" compact />
              <ReviewLogList :logs="reviewLogsQuery.data ?? []" />
              <EmptyState
                v-if="!reviewLogsQuery.isFetching.value && !(reviewLogsQuery.data?.length ?? 0) && pageError"
                title="审核记录加载失败"
                :description="pageError"
                emoji="!"
                size="sm"
              />
            </section>
          </section>

          <div class="flex justify-end lg:sticky lg:top-6 lg:h-fit">
            <ArticleToc :sync-key="tocSyncKey" />
          </div>
        </div>
      </div>
    </main>

    <div class="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_94%,transparent)] backdrop-blur-xl">
      <div class="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 xl:px-8">
        <div class="min-w-0">
          <p class="text-sm font-semibold tracking-[-0.02em] text-[var(--color-text)]">
            审核操作区
          </p>
          <p class="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            通过和删除都需要二次确认；退回修改和拒绝需要填写原因。
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-3">
          <AdminDeleteArticleButton
            :article-id="articleId"
            text="删除文章"
            confirm-text="确认删除"
            @deleted="handleAdminDeleted"
          />

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
