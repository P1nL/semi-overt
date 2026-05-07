<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

import { Input } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import { FieldError, FormField, FormLabel } from '@/shared/components/form'
import { useToast } from '@/shared/composables/useToast'

import { authApi } from '@/features/auth/api'
import { mapForgotPasswordFormToDto, mapResetPasswordFormToDto } from '@/features/auth/model'
import type { AuthFieldErrors, ForgotPasswordFormValues } from '@/features/auth/model'
import AuthActionButton from './AuthActionButton.vue'

const emit = defineEmits<{
  success: []
  switchMode: ['login']
}>()

const toast = useToast()

const form = reactive<ForgotPasswordFormValues>({
  email: '',
  code: '',
  newPassword: '',
  confirmPassword: '',
})

const touched = reactive<Record<keyof ForgotPasswordFormValues, boolean>>({
  email: false,
  code: false,
  newPassword: false,
  confirmPassword: false,
})

const errors = reactive<AuthFieldErrors<ForgotPasswordFormValues>>({})
const submitting = ref(false)
const sendingCode = ref(false)
const submitError = ref('')
const successMessage = ref('')
const codeSent = ref(false)
const resendSeconds = ref(0)

let resendTimer: number | null = null

function stopResendCountdown() {
  if (!resendTimer) return
  window.clearInterval(resendTimer)
  resendTimer = null
}

function startResendCountdown() {
  stopResendCountdown()
  resendSeconds.value = 60
  resendTimer = window.setInterval(() => {
    resendSeconds.value -= 1

    if (resendSeconds.value <= 0) {
      resendSeconds.value = 0
      stopResendCountdown()
    }
  }, 1000)
}

function validateEmail(value: string): string {
  if (!value.trim()) return '请输入邮箱'
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  return ok ? '' : '请输入正确的邮箱格式'
}

function validateCode(value: string): string {
  if (!value.trim()) return '请输入验证码'
  return /^\d{6}$/.test(value.trim()) ? '' : '验证码为 6 位数字'
}

function validatePassword(value: string): string {
  if (!value) return '请输入新密码'
  if (value.length < 8) return '密码至少 8 位'
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '密码需同时包含字母和数字'
  return ''
}

function validateConfirmPassword(value: string): string {
  if (!value) return '请再次输入新密码'
  if (value !== form.newPassword) return '两次输入的密码不一致'
  return ''
}

function validateField(field: keyof ForgotPasswordFormValues): string {
  let message = ''

  if (field === 'email') message = validateEmail(form.email)
  if (field === 'code') message = validateCode(form.code)
  if (field === 'newPassword') message = validatePassword(form.newPassword)
  if (field === 'confirmPassword') message = validateConfirmPassword(form.confirmPassword)

  errors[field] = message
  return message
}

function onBlur(field: keyof ForgotPasswordFormValues) {
  touched[field] = true
  validateField(field)
}

function validateEmailStep(): boolean {
  touched.email = true
  errors.email = validateEmail(form.email)
  return !errors.email
}

function validateResetStep(): boolean {
  touched.email = true
  touched.code = true
  touched.newPassword = true
  touched.confirmPassword = true

  const nextErrors = [
    validateField('email'),
    validateField('code'),
    validateField('newPassword'),
    validateField('confirmPassword'),
  ]

  return nextErrors.every((item) => !item)
}

const resendButtonLabel = computed(() =>
  resendSeconds.value > 0 ? `重新发送（${resendSeconds.value}s）` : '重新发送',
)

function resetEmailStep() {
  stopResendCountdown()
  codeSent.value = false
  sendingCode.value = false
  submitting.value = false
  resendSeconds.value = 0
  submitError.value = ''
  successMessage.value = ''

  form.code = ''
  form.newPassword = ''
  form.confirmPassword = ''

  touched.code = false
  touched.newPassword = false
  touched.confirmPassword = false

  errors.code = ''
  errors.newPassword = ''
  errors.confirmPassword = ''
}

async function sendCode() {
  submitError.value = ''
  successMessage.value = ''

  if (!validateEmailStep()) return

  sendingCode.value = true

  try {
    await authApi.forgotPassword(mapForgotPasswordFormToDto(form))
    codeSent.value = true
    successMessage.value = '验证码已发送，请查看邮箱'
    toast.success('验证码已发送，请查看邮箱')
    startResendCountdown()
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '发送失败，请稍后重试'
    toast.error(submitError.value)
  } finally {
    sendingCode.value = false
  }
}

async function handleSubmit() {
  submitError.value = ''

  if (!codeSent.value) {
    await sendCode()
    return
  }

  if (!validateResetStep()) return

  submitting.value = true

  try {
    await authApi.resetPassword(mapResetPasswordFormToDto(form))
    successMessage.value = '密码已重置，请使用新密码登录'
    toast.success('密码已重置，请使用新密码登录')
    emit('success')
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '重置失败，请稍后重试'
    toast.error(submitError.value)
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  stopResendCountdown()
})
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
        :disabled="codeSent || sendingCode || submitting"
        @blur="onBlur('email')"
      />
      <FieldError :message="touched.email ? errors.email : ''" />
    </FormField>

    <div v-if="codeSent" class="space-y-5">
      <FormField>
        <FormLabel for="forgot-code">邮箱验证码</FormLabel>
        <Input
          id="forgot-code"
          v-model="form.code"
          type="text"
          inputmode="numeric"
          placeholder="请输入 6 位数字验证码"
          :error="touched.code ? errors.code : ''"
          autocomplete="one-time-code"
          @blur="onBlur('code')"
        />
        <FieldError :message="touched.code ? errors.code : ''" />
      </FormField>

      <FormField>
        <FormLabel for="forgot-new-password">新密码</FormLabel>
        <Input
          id="forgot-new-password"
          v-model="form.newPassword"
          type="password"
          placeholder="至少 8 位，包含字母和数字"
          :error="touched.newPassword ? errors.newPassword : ''"
          autocomplete="new-password"
          @blur="onBlur('newPassword')"
        />
        <FieldError :message="touched.newPassword ? errors.newPassword : ''" />
      </FormField>

      <FormField>
        <FormLabel for="forgot-confirm-password">确认新密码</FormLabel>
        <Input
          id="forgot-confirm-password"
          v-model="form.confirmPassword"
          type="password"
          placeholder="请再次输入新密码"
          :error="touched.confirmPassword ? errors.confirmPassword : ''"
          autocomplete="new-password"
          @blur="onBlur('confirmPassword')"
        />
        <FieldError :message="touched.confirmPassword ? errors.confirmPassword : ''" />
      </FormField>
    </div>

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
        :loading="submitting || sendingCode"
        :disabled="submitting || sendingCode"
      >
        {{ codeSent ? '重置密码' : '发送验证码' }}
      </AuthActionButton>
    </div>

    <div v-if="codeSent" class="flex justify-center">
      <button
        type="button"
        class="text-sm font-medium text-[var(--color-primary)] transition-colors duration-200 hover:text-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
        :disabled="sendingCode || submitting || resendSeconds > 0"
        @click="sendCode"
      >
        {{ resendButtonLabel }}
      </button>
    </div>

    <div v-if="codeSent" class="flex justify-center">
      <button
        type="button"
        class="text-sm font-medium text-[var(--color-text-muted)] transition-colors duration-200 hover:text-[var(--color-primary)]"
        @click="resetEmailStep"
      >
        修改邮箱 / 重新开始
      </button>
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
