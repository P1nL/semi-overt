<script setup lang="ts">
import { computed, reactive, watch, ref } from 'vue'
import { useRoute } from 'vue-router'

import { Input } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import { FieldError, FormField, FormHint, FormLabel } from '@/shared/components/form'
import { useToast } from '@/shared/composables/useToast'

import { authApi } from '@/features/auth/api'
import { mapResetPasswordFormToDto } from '@/features/auth/model'
import type { AuthFieldErrors, ResetPasswordFormValues } from '@/features/auth/model'
import AuthActionButton from './AuthActionButton.vue'

const emit = defineEmits<{
  success: []
  switchMode: ['login']
}>()

const route = useRoute()
const toast = useToast()

const form = reactive<ResetPasswordFormValues>({
  token: typeof route.query.token === 'string' ? route.query.token : '',
  newPassword: '',
  confirmPassword: '',
})

watch(
  () => route.query.token,
  (value) => {
    form.token = typeof value === 'string' ? value : ''
  },
)

const touched = reactive<Record<keyof ResetPasswordFormValues, boolean>>({
  token: false,
  newPassword: false,
  confirmPassword: false,
})

const errors = reactive<AuthFieldErrors<ResetPasswordFormValues>>({})
const submitting = ref(false)
const submitError = ref('')
const successMessage = ref('')

function validateToken(value: string): string {
  if (!value.trim()) return '缺少重置令牌，请从邮件链接进入'
  return ''
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

function validateField(field: keyof ResetPasswordFormValues): string {
  let message = ''

  if (field === 'token') message = validateToken(form.token)
  if (field === 'newPassword') message = validatePassword(form.newPassword)
  if (field === 'confirmPassword') message = validateConfirmPassword(form.confirmPassword)

  errors[field] = message
  return message
}

function onBlur(field: keyof ResetPasswordFormValues) {
  touched[field] = true
  validateField(field)
}

const hasErrors = computed(() =>
  Boolean(errors.token || errors.newPassword || errors.confirmPassword),
)

function validateAll(): boolean {
  touched.token = true
  touched.newPassword = true
  touched.confirmPassword = true

  const nextErrors = [
    validateField('token'),
    validateField('newPassword'),
    validateField('confirmPassword'),
  ]

  return nextErrors.every((item) => !item)
}

async function handleSubmit() {
  submitError.value = ''
  successMessage.value = ''

  if (!validateAll()) return

  submitting.value = true

  try {
    await authApi.resetPassword(mapResetPasswordFormToDto(form))
    successMessage.value = '密码已重置，请使用新密码登录。'
    toast.success('密码重置成功')
    emit('success')
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '重置失败，请稍后重试'
    toast.error(submitError.value)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <FormField>
      <FormLabel for="reset-token">重置令牌</FormLabel>
      <Input
        id="reset-token"
        v-model="form.token"
        type="text"
        placeholder="从邮件链接带入，或手动粘贴"
        :error="touched.token ? errors.token : ''"
        @blur="onBlur('token')"
      />
      <FieldError :message="touched.token ? errors.token : ''" />
    </FormField>

    <FormField>
      <FormLabel for="reset-new-password">新密码</FormLabel>
      <Input
        id="reset-new-password"
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
      <FormLabel for="reset-confirm-password">确认新密码</FormLabel>
      <Input
        id="reset-confirm-password"
        v-model="form.confirmPassword"
        type="password"
        placeholder="请再次输入新密码"
        :error="touched.confirmPassword ? errors.confirmPassword : ''"
        autocomplete="new-password"
        @blur="onBlur('confirmPassword')"
      />
      <FieldError :message="touched.confirmPassword ? errors.confirmPassword : ''" />
    </FormField>

    <FormHint>重置成功后，原密码将失效。</FormHint>

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
        :disabled="submitting || hasErrors"
      >
        重置密码
      </AuthActionButton>
    </div>

    <div class="text-center">
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
