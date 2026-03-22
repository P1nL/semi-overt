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
    cancelReviewByArticleId,
    canCancelReviewStatus,
    type ArticleCancelReviewResult,
} from '@/features/article-cancel-review/model'

const props = defineProps<{
  modelValue: boolean
  articleId: number | string
  status?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  canceled: [ArticleCancelReviewResult]
}>()

const editorStore = useEditorStore()
const reviewStore = useReviewStore()
const toast = useToast()
const loading = ref(false)
const errorMessage = ref('')

function closeDialog() {
  emit('update:modelValue', false)
}

async function handleCancelReview() {
  if (!canCancelReviewStatus(props.status)) return

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await cancelReviewByArticleId(props.articleId)
    const detail = await articleApi.getArticleDetail(props.articleId)
    editorStore.setCurrentArticle(mapArticleDetailDtoToVm(detail))
    void reviewStore.refreshPendingListIfInitialized()

    emit('canceled', result)
    toast.success('已取消审核，文章恢复为草稿')
    closeDialog()
  } catch (error) {
    const message = getErrorMessage(error, '取消审核失败，请稍后重试')
    errorMessage.value = message
    toast.error(message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog
      :model-value="modelValue"
      title="取消审核"
      description="取消后文章将回到草稿状态，可继续编辑。"
      @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-3">
      <InlineMessage
          v-if="!canCancelReviewStatus(status)"
          tone="warning"
          message="当前状态不可取消审核，仅审核中状态可执行该操作。"
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
          variant="warning"
          :loading="loading"
          :disabled="loading || !canCancelReviewStatus(status)"
          @click="handleCancelReview"
      >
        确认取消审核
      </Button>
    </template>
  </Dialog>
</template>
