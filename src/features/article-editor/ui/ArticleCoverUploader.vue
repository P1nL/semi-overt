<script setup lang="ts">
import { computed } from 'vue'

import { FormField } from '@/shared/components/form'
import { ImageUploadButton, ImageUploadPreview } from '@/features/image-upload'
import type { ImageUploadResult } from '@/features/image-upload/model'

const props = withDefaults(
    defineProps<{
      modelValue?: string
      color?: string
      articleId?: number | string
      disabled?: boolean
    }>(),
    {
      modelValue: '',
      color: '',
      articleId: undefined,
      disabled: false,
    },
)

const emit = defineEmits<{
  'update:modelValue': [string]
  'update:color': [string]
  uploaded: [ImageUploadResult]
  remove: []
  error: [string]
}>()

const previewColor = computed(() => props.color || '')

function onUploaded(payload: ImageUploadResult) {
  emit('update:modelValue', payload.url)
  emit('update:color', payload.dominantColor ?? '')
  emit('uploaded', payload)
}

function onRemove() {
  emit('update:modelValue', '')
  emit('update:color', '')
  emit('remove')
}
</script>

<template>
  <FormField label="封面图">
    <div class="space-y-3">
      <ImageUploadPreview
          :url="modelValue || null"
          :color="previewColor || null"
          :removable="Boolean(modelValue) && !disabled"
          empty-text="未上传封面图"
          @remove="onRemove"
      />

      <ImageUploadButton
          biz-type="COVER"
          :article-id="articleId"
          :disabled="disabled"
          button-text="上传封面"
          @uploaded="onUploaded"
          @error="emit('error', $event)"
      />
    </div>
  </FormField>
</template>

