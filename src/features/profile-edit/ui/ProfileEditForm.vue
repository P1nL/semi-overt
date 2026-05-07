<script setup lang="ts">
import { computed } from 'vue'

import { Input, Textarea } from '@/shared/components/base'
import { FormField } from '@/shared/components/form'
import { ImageUploadButton, ImageUploadPreview } from '@/shared/image-upload'
import type {
  ProfileEditFieldErrors,
  ProfileEditFormValues,
} from '@/features/profile-edit/model'
import AvatarCropUpload from './AvatarCropUpload.vue'

const props = withDefaults(
  defineProps<{
    modelValue: ProfileEditFormValues
    errors?: ProfileEditFieldErrors
    disabled?: boolean
  }>(),
  {
    errors: () => ({}),
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [ProfileEditFormValues]
  submit: [ProfileEditFormValues]
}>()

const signatureCount = computed(() => `${props.modelValue.signature.length}/50`)

function patch(next: Partial<ProfileEditFormValues>) {
  emit('update:modelValue', {
    ...props.modelValue,
    ...next,
  })
}

function onSubmit() {
  emit('submit', props.modelValue)
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <FormField label="头像">
      <AvatarCropUpload
        :avatar-url="modelValue.avatarUrl || null"
        :nickname="modelValue.nickname"
        :disabled="disabled"
        :old-url="modelValue.avatarUrl || undefined"
        @uploaded="patch({ avatarUrl: $event.url })"
      />
    </FormField>

    <FormField label="封面图">
      <div class="space-y-3">
        <ImageUploadPreview
          :url="modelValue.coverUrl || null"
          alt="封面预览"
          empty-text="未上传封面图"
          :removable="false"
        />
        <ImageUploadButton
          biz-type="COVER"
          :disabled="disabled"
          :old-url="modelValue.coverUrl || undefined"
          button-text="上传封面"
          @uploaded="patch({ coverUrl: $event.url })"
        />
      </div>
    </FormField>

    <FormField label="昵称" :error="errors.nickname">
      <Input
        :model-value="modelValue.nickname"
        :disabled="disabled"
        :invalid="Boolean(errors.nickname)"
        placeholder="请输入昵称"
        @update:model-value="patch({ nickname: $event })"
      />
    </FormField>

    <FormField label="个性签名" :error="errors.signature">
      <Textarea
        :model-value="modelValue.signature"
        :disabled="disabled"
        :invalid="Boolean(errors.signature)"
        :maxlength="50"
        resize="auto"
        placeholder="请输入个性签名"
        @update:model-value="patch({ signature: $event })"
      />
      <p class="text-xs text-[var(--color-text-muted)]">{{ signatureCount }}</p>
    </FormField>
  </form>
</template>
