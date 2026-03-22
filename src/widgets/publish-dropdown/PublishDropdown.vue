<script setup lang="ts">
import { ref } from 'vue'

import type { ArticleCancelReviewResult } from '@/features/article-cancel-review'
import type { ArticleDeleteResult } from '@/features/article-delete'
import type { ArticleSubmitResult } from '@/features/article-submit'
import { Button } from '@/shared/components/base'
import PublishDropdownMenu from './PublishDropdownMenu.vue'

const props = withDefaults(
  defineProps<{
    articleId: number | string
    status?: string | null
    label?: string
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
    size?: 'sm' | 'md' | 'lg'
    pill?: boolean
  }>(),
  {
    label: '发布操作',
    variant: 'secondary',
    size: 'md',
    pill: true,
  },
)

const emit = defineEmits<{
  submitted: [ArticleSubmitResult]
  deleted: [ArticleDeleteResult]
  canceled: [ArticleCancelReviewResult]
}>()

const open = ref(false)

function handleSubmitted(payload: ArticleSubmitResult) {
  open.value = false
  emit('submitted', payload)
}

function handleDeleted(payload: ArticleDeleteResult) {
  open.value = false
  emit('deleted', payload)
}

function handleCanceled(payload: ArticleCancelReviewResult) {
  open.value = false
  emit('canceled', payload)
}
</script>

<template>
  <div class="relative inline-flex">
    <Button
      type="button"
      :variant="variant"
      :size="size"
      :pill="pill"
      @click="open = !open"
    >
      {{ label }}
    </Button>

    <div
      v-if="open"
      class="absolute right-0 top-[calc(100%+10px)] z-30 min-w-[220px]"
    >
      <PublishDropdownMenu
        :article-id="props.articleId"
        :status="props.status"
        @submitted="handleSubmitted"
        @deleted="handleDeleted"
        @canceled="handleCanceled"
      />
    </div>
  </div>
</template>
