<script setup lang="ts">
import { computed, ref } from 'vue'

import AnimatedUploadFileIcon from '@/shared/components/base/AnimatedUploadFileIcon.vue'
import { Button } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import { ARTICLE_IMAGE_ACCEPTED_EXTENSIONS } from '@/shared/constants/article'
import {
    uploadImageFile,
    type ImageUploadResult,
} from '@/shared/image-upload/model'
import type { UploadBizType } from '@/shared/types/api'

const props = withDefaults(
    defineProps<{
      bizType: UploadBizType
      articleId?: number | string
      /** AVATAR/COVER 场景：当前已上传文件的 URL，新文件上传成功后后端自动删除旧文件 */
      oldUrl?: string
      disabled?: boolean
      buttonText?: string
      accept?: string
      variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
    }>(),
    {
      articleId: undefined,
      oldUrl: undefined,
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
      oldUrl: props.oldUrl,
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
        :aria-label="uploading ? `${buttonText}中` : buttonText"
        :class="[
          'image-upload-button',
          variant === 'secondary' && 'image-upload-button--secondary',
        ]"
        icon-only
        @click="triggerPick"
    >
      <AnimatedUploadFileIcon size="1.1rem" :decorative="true" />
    </Button>
  </div>
</template>

<style scoped>
.image-upload-button {
  width: 3.5rem;
  border-radius: var(--radius-lg);
}

.image-upload-button.image-upload-button--secondary {
  border-color: color-mix(in srgb, var(--color-border) 74%, transparent);
  background: color-mix(in srgb, var(--color-surface-elevated) 84%, transparent);
  color: var(--color-text-muted);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.image-upload-button.image-upload-button--secondary:hover {
  border-color: color-mix(in srgb, var(--color-border-strong) 82%, transparent);
  background: color-mix(in srgb, var(--color-surface-elevated) 92%, transparent);
  color: var(--color-text);
  box-shadow:
    0 8px 18px rgb(15 23 42 / 0.08),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

.image-upload-button.image-upload-button--secondary:active {
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
}
</style>

