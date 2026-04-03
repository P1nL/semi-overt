<script setup lang="ts">
import { computed } from 'vue'

import { isPublishedArticle } from '@/shared/utils/article'
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
        ? 'content-card-shell content-card-shell--compact flex items-start'
        : [
          'content-card-shell content-card-shell--regular flex flex-col',
          props.fillHeight && 'content-card-shell--fill',
        ],
)

const shouldShowStatusBadge = computed(() => {
    const statusValue = props.article.status?.value
    return Boolean(props.showStatus && statusValue && !isPublishedArticle(statusValue))
})
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

    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <h3
          class="line-clamp-2 font-semibold tracking-[-0.025em] text-[var(--color-text)]"
          :class="compact ? 'text-[0.95rem] leading-6' : 'text-[1.05rem] leading-[1.65] md:text-[1.12rem]'"
        >
          {{ article.titleText }}
        </h3>
        <ArticleStatusBadge v-if="shouldShowStatusBadge && article.status" :status="article.status" />
      </div>

      <ArticleSummary v-if="article.summary.text" :summary="article.summary" :lines="compact ? 2 : 3" />

      <ArticleMetaLine :meta="article.meta" />

      <div v-if="showAuthor || (showReason && article.latestReason)" class="flex flex-col gap-2">
        <ArticleAuthorMeta
            v-if="showAuthor"
            :author="article.author"
            size="sm"
            :clickable="!clickable"
        />
        <p v-if="showReason && article.latestReason" class="text-xs text-[var(--color-danger)]">
          最近退回原因：{{ article.latestReason }}
        </p>
      </div>
    </div>
  </component>
</template>
