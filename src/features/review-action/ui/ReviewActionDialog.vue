<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import { Button, Dialog } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import { requiresReviewReason } from '@/shared/utils/review'
import { getErrorMessage } from '@/shared/utils/error'
import { useToast } from '@/shared/composables/useToast'
import { useReviewStore } from '@/stores/review'
import {
    canReviewArticle,
    createReviewActionFormValues,
    submitReviewActionByArticleId,
    validateReviewActionForm,
    type ReviewActionResult,
    type ReviewActionValue,
} from '@/features/review-action/model'
import ReviewCommentInput from './ReviewCommentInput.vue'

const props = defineProps<{
  modelValue: boolean
  articleId: number | string
  action: ReviewActionValue
  status?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  acted: [ReviewActionResult]
}>()

const reviewStore = useReviewStore()
const toast = useToast()

const form = ref(createReviewActionFormValues(props.action))
const errors = reactive<{ reason: string }>({
  reason: '',
})
const loading = ref(false)
const errorMessage = ref('')

const actionLabelMap: Record<ReviewActionValue, string> = {
  APPROVE: '通过',
  RETURN: '退回修改',
  REJECT: '拒绝',
}

function resetForm() {
  form.value = createReviewActionFormValues(props.action)
  errors.reason = ''
  errorMessage.value = ''
}

function closeDialog() {
  emit('update:modelValue', false)
}

async function handleSubmit() {
  if (!canReviewArticle(props.status)) return

  const validation = validateReviewActionForm(form.value)
  errors.reason = validation.errors.reason || ''
  if (!validation.valid) return

  loading.value = true
  reviewStore.acting = true
  errorMessage.value = ''

  try {
    const result = await submitReviewActionByArticleId(props.articleId, form.value)
    reviewStore.pendingList = reviewStore.pendingList.filter(
        (item) => String(item.id) !== String(props.articleId),
    )
    void reviewStore.refreshPendingListIfInitialized()

    emit('acted', result)
    toast.success(`审核${actionLabelMap[props.action]}成功`)
    closeDialog()
  } catch (error) {
    const message = getErrorMessage(error, '审核操作失败，请稍后重试')
    errorMessage.value = message
    toast.error(message)
  } finally {
    loading.value = false
    reviewStore.acting = false
  }
}

watch(
    () => [props.action, props.modelValue],
    () => {
      if (props.modelValue) {
        resetForm()
      }
    },
)
</script>

<template>
  <Dialog
      :model-value="modelValue"
      :title="`审核操作：${actionLabelMap[action]}`"
      description="请确认后提交审核动作。"
      @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-3">
      <InlineMessage
          v-if="!canReviewArticle(status)"
          tone="warning"
          message="当前文章不在审核中，无法执行审核动作。"
      />

      <ReviewCommentInput
          v-if="requiresReviewReason(action)"
          v-model="form.reason"
          :required="true"
          :disabled="loading"
          :error="errors.reason"
          :placeholder="action === 'RETURN' ? '请填写退回修改原因' : '请填写拒绝原因'"
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
          :variant="action === 'APPROVE' ? 'success' : action === 'RETURN' ? 'warning' : 'danger'"
          :loading="loading"
          :disabled="loading || !canReviewArticle(status)"
          @click="handleSubmit"
      >
        确认{{ actionLabelMap[action] }}
      </Button>
    </template>
  </Dialog>
</template>
