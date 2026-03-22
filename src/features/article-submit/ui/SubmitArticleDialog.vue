<script setup lang="ts">
import { ref } from 'vue'

import { mapArticleDetailDtoToVm } from '@/entities/article/model/article.mapper'
import { articleApi } from '@/shared/api/modules/article'
import { Button, Dialog } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import { useToast } from '@/shared/composables/useToast'
import { getErrorMessage } from '@/shared/utils/error'
import { useEditorStore } from '@/stores/editor'
import { useReviewStore } from '@/stores/review'
import {
    canSubmitArticleStatus,
    submitArticleById,
    type ArticleSubmitResult,
} from '@/features/article-submit/model'

const props = defineProps<{
  modelValue: boolean
  articleId: number | string
  status?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submitted: [ArticleSubmitResult]
}>()

const editorStore = useEditorStore()
const reviewStore = useReviewStore()
const toast = useToast()
const loading = ref(false)
const errorMessage = ref('')

function closeDialog() {
  emit('update:modelValue', false)
}

async function handleSubmit() {
  if (!canSubmitArticleStatus(props.status)) return

  loading.value = true
  errorMessage.value = ''
  editorStore.submitting = true

  try {
    const result = await submitArticleById(props.articleId)
    const detail = await articleApi.getArticleDetail(props.articleId)
    editorStore.setCurrentArticle(mapArticleDetailDtoToVm(detail))
    editorStore.dirty = false
    void reviewStore.refreshPendingListIfInitialized()

    emit('submitted', result)
    toast.success('文章已提交审核')
    closeDialog()
  } catch (error) {
    const message = getErrorMessage(error, '提交失败，请稍后重试')
    errorMessage.value = message
    toast.error(message)
  } finally {
    loading.value = false
    editorStore.submitting = false
  }
}
</script>

<template>
  <Dialog
      :model-value="modelValue"
      title="提交审核"
      description="提交后文章将进入审核中状态，暂不可编辑。"
      @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-3">
      <InlineMessage
          v-if="!canSubmitArticleStatus(status)"
          tone="warning"
          message="当前状态不可提交审核。仅草稿或退回状态可提交。"
      />

      <InlineMessage
          v-if="errorMessage"
          tone="error"
          :message="errorMessage"
      />
    </div>

    <template #footer>
      <Button type="button" variant="ghost" :disabled="loading" @click="closeDialog">
        取消
      </Button>
      <Button
          type="button"
          variant="success"
          :loading="loading"
          :disabled="loading || !canSubmitArticleStatus(status)"
          @click="handleSubmit"
      >
        确认提交
      </Button>
    </template>
  </Dialog>
</template>
