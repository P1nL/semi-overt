<script setup lang="ts">
import { computed, ref } from 'vue'

import { Button } from '@/shared/components/base'
import {
    canCancelReviewStatus,
    type ArticleCancelReviewResult,
} from '@/features/article-cancel-review/model'
import CancelReviewDialog from './CancelReviewDialog.vue'

const props = withDefaults(
    defineProps<{
      articleId: number | string
      status?: string | null
      disabled?: boolean
      text?: string
    }>(),
    {
      status: null,
      disabled: false,
      text: '取消审核',
    },
)

const emit = defineEmits<{
  canceled: [ArticleCancelReviewResult]
}>()

const open = ref(false)

const buttonDisabled = computed(
    () => props.disabled || !canCancelReviewStatus(props.status),
)
</script>

<template>
  <div class="inline-flex">
    <Button
        type="button"
        variant="warning"
        :disabled="buttonDisabled"
        @click="open = true"
    >
      {{ text }}
    </Button>

    <CancelReviewDialog
        v-model="open"
        :article-id="articleId"
        :status="status"
        @canceled="emit('canceled', $event)"
    />
  </div>
</template>

