<script setup lang="ts">
import { computed } from 'vue'

import { ARTICLE_STATUS } from '../model/article.constants'
import type { ArticleCardVm } from '../model/article.types'
import ArticleAuthorMeta from './ArticleAuthorMeta.vue'
import ArticleCover from './ArticleCover.vue'
import ArticleMetaLine from './ArticleMetaLine.vue'
import ArticleStatusBadge from './ArticleStatusBadge.vue'
import ArticleSummary from './ArticleSummary.vue'

const props = withDefaults(
    defineProps<{
      article: ArticleCardVm
      clickable?: boolean
      showAuthor?: boolean
      showStatus?: boolean
      showReason?: boolean
      compact?: boolean
      fillHeight?: boolean
      coverEager?: boolean
    }>(),
    {
      clickable: true,
      showAuthor: true,
      showStatus: true,
      showReason: true,
      compact: false,
      fillHeight: false,
      coverEager: false,
    },
)

const wrapperClass = computed(() =>
    props.compact
        ? 'article-card article-card--compact content-card-shell content-card-shell--compact flex items-start'
        : [
          'article-card',
          'content-card-shell content-card-shell--regular flex flex-col',
          props.fillHeight && 'content-card-shell--fill',
        ],
)

const summaryLines = computed(() => (props.compact ? 1 : 4))
const shouldShowHoverSummary = computed(() => props.compact && Boolean(props.article.summary.text))

const shouldShowStatusBadge = computed(() => {
    const statusValue = props.article.status?.value
    return Boolean(props.showStatus && statusValue && statusValue !== ARTICLE_STATUS.APPROVED)
})

const latestReasonLabel = computed(() =>
    props.article.status?.value === ARTICLE_STATUS.REJECTED ? '最近拒绝原因' : '最近退回原因',
)
</script>

<template>
  <component
      :is="clickable ? 'RouterLink' : 'article'"
      :to="clickable ? article.articlePath : undefined"
      :class="wrapperClass"
  >
    <ArticleCover
        :cover="article.cover"
        :title="article.titleText"
        :compact="compact"
        :fill-height="fillHeight"
        :eager="coverEager"
    />

    <div
        class="article-card__body flex min-w-0 flex-1 flex-col gap-3"
        :class="shouldShowHoverSummary && 'article-card__body--hover-summary'"
    >
      <div class="article-card__default-content flex min-w-0 flex-1 flex-col gap-3">
        <div class="flex items-start justify-between gap-3">
          <h3
              class="line-clamp-2 font-semibold tracking-[-0.025em] text-[var(--color-text)]"
              :class="compact ? 'text-[0.95rem] leading-6' : 'text-[1.05rem] leading-[1.65] md:text-[1.12rem]'"
          >
            {{ article.titleText }}
          </h3>
          <ArticleStatusBadge v-if="shouldShowStatusBadge && article.status" :status="article.status" />
        </div>

        <ArticleSummary v-if="article.summary.text" :summary="article.summary" :lines="summaryLines" />

        <ArticleMetaLine :meta="article.meta" />

        <div v-if="showAuthor || (showReason && article.latestReason)" class="flex flex-col gap-2">
          <ArticleAuthorMeta
              v-if="showAuthor"
              :author="article.author"
              size="sm"
              :clickable="!clickable"
          />
          <p v-if="showReason && article.latestReason" class="text-xs text-[var(--color-danger)]">
            {{ latestReasonLabel }}：{{ article.latestReason }}
          </p>
        </div>
      </div>

      <div v-if="shouldShowHoverSummary" class="article-card__hover-summary" aria-hidden="true">
        <div class="article-card__hover-summary-viewport">
          <div class="article-card__hover-summary-track">
            <p class="article-card__hover-summary-text">{{ article.summary.text }}</p>
          </div>
        </div>
      </div>
    </div>
  </component>
</template>

<style scoped>
.article-card__body {
  position: relative;
  overflow: hidden;
}

.article-card__default-content {
  min-width: 0;
  transition:
    opacity 460ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.article-card__hover-summary {
  position: absolute;
  inset: 0;
  display: flex;
  min-width: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.article-card__hover-summary-viewport {
  width: 100%;
  overflow: hidden;
  container-type: size;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 22%, #000 62%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 22%, #000 62%, transparent 100%);
}

.article-card__hover-summary-track {
  transform: translate3d(0, 50cqh, 0);
  will-change: transform;
}

.article-card__hover-summary-text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.75;
  opacity: 0;
  color: color-mix(in srgb, var(--color-text-muted) 86%, var(--color-text) 14%);
  transition: opacity 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.article-card--compact:hover .article-card__body--hover-summary .article-card__default-content,
.article-card--compact:focus-visible .article-card__body--hover-summary .article-card__default-content,
.article-card--compact:focus-within .article-card__body--hover-summary .article-card__default-content {
  opacity: 0;
  transform: translate3d(0, -2px, 0);
}

.article-card--compact:hover .article-card__hover-summary,
.article-card--compact:focus-visible .article-card__hover-summary,
.article-card--compact:focus-within .article-card__hover-summary {
  opacity: 1;
  transition-delay: 80ms;
}

.article-card--compact:hover .article-card__hover-summary-text,
.article-card--compact:focus-visible .article-card__hover-summary-text,
.article-card--compact:focus-within .article-card__hover-summary-text {
  opacity: 1;
  transition-delay: 140ms;
}

.article-card--compact:hover .article-card__hover-summary-track,
.article-card--compact:focus-visible .article-card__hover-summary-track,
.article-card--compact:focus-within .article-card__hover-summary-track {
  animation: article-card-summary-scroll 18s linear infinite;
  animation-delay: 700ms;
}

@keyframes article-card-summary-scroll {
  0% {
    opacity: 1;
    transform: translate3d(0, 50cqh, 0);
  }

  92% {
    opacity: 1;
    transform: translate3d(0, calc(-100% - 18cqh), 0);
  }

  93% {
    opacity: 0;
    transform: translate3d(0, calc(-100% - 18cqh), 0);
  }

  94% {
    opacity: 0;
    transform: translate3d(0, 100cqh, 0);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 50cqh, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-card__default-content,
  .article-card__hover-summary {
    transition-duration: 1ms;
    transition-delay: 0ms;
  }

  .article-card__hover-summary-text {
    transition-duration: 1ms;
    transition-delay: 0ms;
  }

  .article-card__hover-summary-track {
    animation: none;
    transform: translate3d(0, 50cqh, 0);
  }
}
</style>
