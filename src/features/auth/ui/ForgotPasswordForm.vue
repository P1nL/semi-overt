<script setup lang="ts">
import { reactive, ref } from 'vue'

import { Input } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import { FieldError, FormField, FormLabel } from '@/shared/components/form'
import { useToast } from '@/shared/composables/useToast'

import { authApi } from '@/features/auth/api'
import { mapForgotPasswordFormToDto } from '@/features/auth/model'
import type { AuthFieldErrors, ForgotPasswordFormValues } from '@/features/auth/model'
import AuthActionButton from './AuthActionButton.vue'

const emit = defineEmits<{
  success: []
  switchMode: ['login']
}>()

const toast = useToast()

const form = reactive<ForgotPasswordFormValues>({
  email: '',
})

const touched = reactive<Record<keyof ForgotPasswordFormValues, boolean>>({
  email: false,
})

const errors = reactive<AuthFieldErrors<ForgotPasswordFormValues>>({})
const submitting = ref(false)
const submitError = ref('')
const successMessage = ref('')

function validateEmail(value: string): string {
  if (!value.trim()) return '请输入邮箱'
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  return ok ? '' : '请输入正确的邮箱格式'
}

function onBlur() {
  touched.email = true
  errors.email = validateEmail(form.email)
}

function validateAll(): boolean {
  touched.email = true
  errors.email = validateEmail(form.email)
  return !errors.email
}

async function handleSubmit() {
  submitError.value = ''
  successMessage.value = ''

  if (!validateAll()) return

  submitting.value = true

  try {
    await authApi.forgotPassword(mapForgotPasswordFormToDto(form))
    successMessage.value = '如果该邮箱已注册，系统会向其发送重置密码邮件。'
    toast.success('重置邮件已发送，请检查邮箱')
    emit('success')
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '发送失败，请稍后重试'
    toast.error(submitError.value)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <FormField>
      <FormLabel for="forgot-email">注册邮箱</FormLabel>
      <Input
        id="forgot-email"
        v-model="form.email"
        type="email"
        placeholder="请输入注册邮箱"
        :error="touched.email ? errors.email : ''"
        autocomplete="email"
        @blur="onBlur"
      />
      <FieldError :message="touched.email ? errors.email : ''" />
    </FormField>

    <InlineMessage
      v-if="successMessage"
      tone="success"
      :message="successMessage"
    />

    <InlineMessage
      v-if="submitError"
      tone="error"
      :message="submitError"
    />

    <div class="flex justify-center">
      <AuthActionButton
        type="submit"
        :loading="submitting"
        :disabled="submitting"
      >
        发送重置邮件
      </AuthActionButton>
    </div>

    <div class="flex justify-center">
      <button
        type="button"
        class="text-sm font-medium text-[var(--color-primary)] transition-colors duration-200 hover:text-[var(--color-primary-strong)]"
        @click="emit('switchMode', 'login')"
      >
        返回登录
      </button>
    </div>
  </form>
</template>
