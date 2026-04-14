<script setup lang="ts">
import { computed } from 'vue'

import { Avatar, Input, Textarea } from '@/shared/components/base'
import { FormField } from '@/shared/components/form'
import { ImageUploadButton, ImageUploadPreview } from '@/shared/image-upload'
import type {
  ProfileEditFieldErrors,
  ProfileEditFormValues,
} from '@/features/profile-edit/model'

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
const avatarFallback = computed(() => props.modelValue.nickname.trim().slice(0, 1).toUpperCase() || '?')

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
      <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-start">
        <div class="space-y-3">
          <ImageUploadPreview
            :url="modelValue.avatarUrl || null"
            alt="头像预览"
            empty-text="未上传头像"
            :removable="false"
          />
          <ImageUploadButton
            biz-type="AVATAR"
            :disabled="disabled"
            :old-url="modelValue.avatarUrl || undefined"
            button-text="上传头像"
            @uploaded="patch({ avatarUrl: $event.url })"
          />
        </div>

        <div class="surface-2 flex flex-col items-center gap-3 rounded-[var(--radius-lg)] p-4 text-center">
          <p class="text-xs font-medium tracking-[0.08em] text-[var(--color-text-faint)]">
            头像取景预览
          </p>
          <Avatar
            :src="modelValue.avatarUrl || undefined"
            :alt="modelValue.nickname || 'avatar preview'"
            :name="modelValue.nickname"
            :fallback="avatarFallback"
            size="xl"
            rounded
            class="size-28 border-white/70 bg-[color-mix(in_srgb,var(--color-surface-elevated)_88%,transparent)] text-3xl text-[var(--color-text)] shadow-[0_18px_36px_rgb(15_23_42_/_0.12)] ring-4 ring-white/60"
          />
          <p class="text-xs leading-5 text-[var(--color-text-muted)]">
            将按圆形头像居中裁切显示
          </p>
        </div>
      </div>
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
