<script setup lang="ts">
import { computed, ref } from 'vue'

import { Button } from '@/shared/components/base'
import {
    canSubmitArticleStatus,
    type ArticleSubmitResult,
} from '@/features/article-submit/model'
import SubmitArticleDialog from './SubmitArticleDialog.vue'

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
      text: '提交审核',
    },
)

const emit = defineEmits<{
  submitted: [ArticleSubmitResult]
}>()

const open = ref(false)

const buttonDisabled = computed(
    () => props.disabled || !canSubmitArticleStatus(props.status),
)
</script>

<template>
  <div class="inline-flex">
    <Button
        type="button"
        variant="success"
        :disabled="buttonDisabled"
        @click="open = true"
    >
      {{ text }}
    </Button>

    <SubmitArticleDialog
        v-model="open"
        :article-id="articleId"
        :status="status"
        @submitted="emit('submitted', $event)"
    />
  </div>
</template>

