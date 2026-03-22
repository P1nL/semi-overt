<script setup lang="ts">
import { ref } from 'vue'

import { Button, Dialog } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import { useToast } from '@/shared/composables/useToast'
import { getErrorMessage } from '@/shared/utils/error'
import { useEditorStore } from '@/stores/editor'
import {
    canDeleteArticleStatus,
    deleteArticleById,
    type ArticleDeleteResult,
} from '@/features/article-delete/model'

const props = defineProps<{
  modelValue: boolean
  articleId: number | string
  status?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  deleted: [ArticleDeleteResult]
}>()

const editorStore = useEditorStore()
const toast = useToast()
const loading = ref(false)
const errorMessage = ref('')

function closeDialog() {
  emit('update:modelValue', false)
}

async function handleDelete() {
  if (!canDeleteArticleStatus(props.status)) return

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await deleteArticleById(props.articleId)

    if (String(editorStore.currentArticle?.id) === String(props.articleId)) {
      editorStore.setCurrentArticle(null)
      editorStore.dirty = false
    }

    emit('deleted', result)
    toast.success('文章已删除')
    closeDialog()
  } catch (error) {
    const message = getErrorMessage(error, '删除失败，请稍后重试')
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
      title="删除文章"
      description="删除后不可恢复，请确认操作。"
      @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-3">
      <InlineMessage
          v-if="!canDeleteArticleStatus(status)"
          tone="warning"
          message="当前状态不可删除。仅草稿、退回、拒绝状态可删除。"
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
          variant="danger"
          :loading="loading"
          :disabled="loading || !canDeleteArticleStatus(status)"
          @click="handleDelete"
      >
        确认删除
      </Button>
    </template>
  </Dialog>
</template>

