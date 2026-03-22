<script setup lang="ts">
import { computed, ref } from 'vue'

import { Button } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import { ARTICLE_IMAGE_ACCEPTED_EXTENSIONS } from '@/shared/constants/article'
import {
    uploadImageFile,
    type ImageUploadResult,
} from '@/features/image-upload/model'
import type { UploadBizType } from '@/shared/types/api'

const props = withDefaults(
    defineProps<{
      bizType: UploadBizType
      articleId?: number | string
      disabled?: boolean
      buttonText?: string
      accept?: string
      variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
    }>(),
    {
      articleId: undefined,
      disabled: false,
      buttonText: '上传图片',
      accept: ARTICLE_IMAGE_ACCEPTED_EXTENSIONS.join(','),
      variant: 'secondary',
    },
)

const emit = defineEmits<{
  uploaded: [ImageUploadResult]
  error: [string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const toast = useToast()

const buttonDisabled = computed(() => props.disabled || uploading.value)

function triggerPick() {
  if (buttonDisabled.value) return
  inputRef.value?.click()
}

async function handleInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  uploading.value = true

  try {
    const uploaded = await uploadImageFile({
      file,
      bizType: props.bizType,
      articleId: props.articleId,
    })

    emit('uploaded', uploaded)
    toast.success('图片上传成功')
  } catch (error) {
    const message = error instanceof Error ? error.message : '图片上传失败'
    emit('error', message)
    toast.error(message)
  } finally {
    uploading.value = false
    target.value = ''
  }
}
</script>

<template>
  <div class="inline-flex items-center">
    <input
        ref="inputRef"
        type="file"
        class="hidden"
        :accept="accept"
        :disabled="buttonDisabled"
        @change="handleInputChange"
    />

    <Button
        type="button"
        :variant="variant"
        :loading="uploading"
        :disabled="buttonDisabled"
        @click="triggerPick"
    >
      {{ buttonText }}
    </Button>
  </div>
</template>

