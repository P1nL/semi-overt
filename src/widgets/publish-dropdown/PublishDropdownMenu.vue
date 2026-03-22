<script setup lang="ts">
import {
    CancelReviewButton,
    type ArticleCancelReviewResult,
} from '@/features/article-cancel-review'
import {
    DeleteArticleButton,
    type ArticleDeleteResult,
} from '@/features/article-delete'
import {
    SubmitArticleButton,
    type ArticleSubmitResult,
} from '@/features/article-submit'

defineProps<{
  articleId: number | string
  status?: string | null
}>()

defineEmits<{
  submitted: [ArticleSubmitResult]
  deleted: [ArticleDeleteResult]
  canceled: [ArticleCancelReviewResult]
}>()
</script>

<template>
  <div class="surface-1 space-y-2 rounded-[var(--radius-xl)] p-3 shadow-[var(--shadow-lg)]">
    <SubmitArticleButton
        :article-id="articleId"
        :status="status"
        text="提交审核"
        @submitted="$emit('submitted', $event)"
    />

    <CancelReviewButton
        :article-id="articleId"
        :status="status"
        text="取消审核"
        @canceled="$emit('canceled', $event)"
    />

    <DeleteArticleButton
        :article-id="articleId"
        :status="status"
        text="删除文章"
        @deleted="$emit('deleted', $event)"
    />
  </div>
</template>
