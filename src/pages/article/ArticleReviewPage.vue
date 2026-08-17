<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Maximize2, X } from 'lucide-vue-next'
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
const coverPreviewOpen = ref(false)
const coverPreviewSrc = computed(() =>
  article.value?.cover.hasImage ? article.value.cover.src ?? '' : '',
)
const coverPreviewAlt = computed(() => article.value?.cover.alt || '文章封面预览')
const reviewSummaryText = computed(() =>
  article.value?.summary.rawText?.trim() || article.value?.summary.text.trim() || '',
)
const reviewSummaryCountText = computed(() =>
  article.value ? `${Array.from(reviewSummaryText.value).length} 字` : '',
)
let previousBodyOverflow = ''

// articleId 变化时重置 article，避免切换文章时短暂显示上一篇的状态
watch(articleId, () => {
  article.value = null
  coverPreviewOpen.value = false
})

watch(coverPreviewOpen, (value) => {
  if (typeof document === 'undefined') return

  if (value) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleCoverPreviewKeydown, true)
    return
  }

  document.removeEventListener('keydown', handleCoverPreviewKeydown, true)
  document.body.style.overflow = previousBodyOverflow
  previousBodyOverflow = ''
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

function openCoverPreview() {
  if (!coverPreviewSrc.value) return
  coverPreviewOpen.value = true
}

function closeCoverPreview() {
  coverPreviewOpen.value = false
}

function handleCoverPreviewKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !coverPreviewOpen.value) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  closeCoverPreview()
}

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', handleCoverPreviewKeydown, true)
    document.body.style.overflow = previousBodyOverflow
  }
})

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

        <div class="grid gap-6 xl:grid-cols-[minmax(0,900px)_minmax(260px,1fr)] xl:items-start xl:gap-8">
          <section class="min-w-0 xl:col-start-1 xl:row-start-1">
            <section class="surface-1 rounded-[var(--radius-xl)] p-4 sm:p-5 md:p-8">
              <ArticleReader
                :key="articleId"
                :article-id="articleId"
                :review-refresh-interval-ms="REVIEW_AUTO_REFRESH_INTERVAL_MS"
                @loaded="onLoaded"
              />
            </section>
          </section>

          <aside class="min-w-0 xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <section class="surface-1 overflow-hidden rounded-[var(--radius-xl)]">
              <section class="p-4 sm:p-5">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <h2 class="text-sm font-semibold tracking-[-0.02em] text-[var(--color-text)]">
                    摘要审核
                  </h2>
                  <span class="text-xs text-[var(--color-text-muted)]">
                    {{ reviewSummaryCountText }}
                  </span>
                </div>

                <div
                  v-if="article && reviewSummaryText"
                  class="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-elevated)_68%,transparent)] px-4 py-3.5"
                >
                  <p class="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-text)]">
                    {{ reviewSummaryText }}
                  </p>
                </div>

                <div
                  v-else
                  class="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]"
                >
                  {{ article ? '作者未填写摘要' : '摘要加载中…' }}
                </div>
              </section>

              <section class="border-t border-[var(--color-border)] p-4 sm:p-5">
                <div class="mb-3">
                  <h2 class="text-sm font-semibold tracking-[-0.02em] text-[var(--color-text)]">
                    封面审核
                  </h2>
                  <p class="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                    点击封面可查看完整图片
                  </p>
                </div>

                <button
                  v-if="coverPreviewSrc"
                  type="button"
                  class="group relative block aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-left shadow-[var(--shadow-xs)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                  :aria-label="`查看${coverPreviewAlt}`"
                  @click="openCoverPreview"
                >
                  <img
                    :src="coverPreviewSrc"
                    :alt="coverPreviewAlt"
                    class="h-full w-full object-cover transition duration-200 ease-out group-hover:scale-[1.02]"
                  >
                  <span class="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1.5 bg-[color-mix(in_srgb,var(--color-overlay)_76%,transparent)] px-3 py-2 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Maximize2 :size="14" :stroke-width="1.8" />
                    查看完整封面
                  </span>
                </button>

                <div
                  v-else
                  class="flex aspect-[16/9] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-muted)]"
                  :style="article ? { backgroundColor: article.cover.color } : undefined"
                >
                  {{ article ? '作者未上传封面' : '封面加载中…' }}
                </div>
              </section>
            </section>
          </aside>

          <section class="surface-1 min-w-0 rounded-[var(--radius-xl)] p-4 sm:p-5 md:p-8 xl:col-start-1 xl:row-start-2">
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

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="coverPreviewOpen && coverPreviewSrc"
          class="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--color-overlay)_92%,black)] px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="封面完整图片预览"
          @click.self="closeCoverPreview"
        >
          <button
            type="button"
            class="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color-mix(in_srgb,white_24%,transparent)] bg-[color-mix(in_srgb,black_34%,transparent)] text-white backdrop-blur-md transition hover:bg-[color-mix(in_srgb,white_14%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6 sm:top-6"
            aria-label="关闭封面预览"
            @click="closeCoverPreview"
          >
            <X :size="20" :stroke-width="1.8" />
          </button>

          <figure class="flex max-h-full max-w-full flex-col items-center gap-3">
            <img
              :src="coverPreviewSrc"
              :alt="coverPreviewAlt"
              class="block max-h-[calc(100vh-7rem)] max-w-[min(94vw,1200px)] rounded-[var(--radius-xl)] object-contain shadow-[0_24px_60px_rgb(0_0_0/0.45)]"
            >
            <figcaption class="max-w-[min(90vw,48rem)] truncate text-center text-xs text-white/70">
              {{ coverPreviewAlt }}
            </figcaption>
          </figure>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
