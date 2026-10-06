<script setup lang="ts">
import { computed, ref } from 'vue'

import { Input, Textarea } from '@/shared/components/base'
import { FormField } from '@/shared/components/form'
import type {
  ProfileEditFieldErrors,
  ProfileEditFormValues,
} from '@/features/profile-edit/model'
import AvatarCropUpload from './AvatarCropUpload.vue'
import CoverCropUpload from './CoverCropUpload.vue'

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

const avatarCropRef = ref<InstanceType<typeof AvatarCropUpload> | null>(null)

async function prepareAvatar() {
  return await avatarCropRef.value?.uploadCroppedAvatar() ?? null
}

const coverCropRef = ref<InstanceType<typeof CoverCropUpload> | null>(null)

async function prepareCover() {
  return await coverCropRef.value?.prepareCover() ?? null
}

defineExpose({ prepareAvatar, prepareCover })

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
        ref="avatarCropRef"
        :avatar-url="modelValue.avatarUrl || null"
        :nickname="modelValue.nickname"
        :disabled="disabled"
        :old-url="modelValue.avatarUrl || undefined"
        @uploaded="patch({ avatarUrl: $event.url })"
      />
    </FormField>

    <FormField label="封面图">
      <CoverCropUpload
        ref="coverCropRef"
        :url="modelValue.coverUrl"
        :disabled="disabled"
        @update:url="patch({ coverUrl: $event })"
      />
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
