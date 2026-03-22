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
      title?: string
      description?: string
      accept?: string
    }>(),
    {
      articleId: undefined,
      disabled: false,
      title: '拖拽图片到这里',
      description: '或点击按钮从本地选择',
      accept: ARTICLE_IMAGE_ACCEPTED_EXTENSIONS.join(','),
    },
)

const emit = defineEmits<{
  uploaded: [ImageUploadResult]
  error: [string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const dragActive = ref(false)
const uploading = ref(false)
const toast = useToast()

const disabledState = computed(() => props.disabled || uploading.value)

function triggerPicker() {
  if (disabledState.value) return
  inputRef.value?.click()
}

async function uploadFile(file: File) {
  if (disabledState.value) return

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
  }
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (disabledState.value) return
  dragActive.value = true
}

function onDragLeave(event: DragEvent) {
  event.preventDefault()
  dragActive.value = false
}

async function onDrop(event: DragEvent) {
  event.preventDefault()
  dragActive.value = false

  if (disabledState.value) return

  const file = event.dataTransfer?.files?.[0]
  if (!file) return

  await uploadFile(file)
}

async function onInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''

  if (!file) return
  await uploadFile(file)
}
</script>

<template>
  <div
      class="rounded-[var(--radius-md)] border-2 border-dashed p-6 text-center transition-colors"
      :class="[
      dragActive ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)]' : 'border-[var(--color-border)]',
      disabledState ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
    ]"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @click="triggerPicker"
  >
    <input
        ref="inputRef"
        type="file"
        class="hidden"
        :accept="accept"
        :disabled="disabledState"
        @change="onInputChange"
    />

    <p class="text-sm font-medium text-[var(--color-text)]">{{ title }}</p>
    <p class="mt-2 text-xs text-[var(--color-text-muted)]">{{ description }}</p>

    <div class="mt-4">
      <Button
          type="button"
          size="sm"
          :loading="uploading"
          :disabled="disabledState"
          @click.stop="triggerPicker"
      >
        选择图片
      </Button>
    </div>
  </div>
</template>

