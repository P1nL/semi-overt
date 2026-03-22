<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { Input } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import { FieldError, FormField, FormLabel } from '@/shared/components/form'
import { useToast } from '@/shared/composables/useToast'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { useAuthStore } from '@/stores/auth'

import { authApi } from '@/features/auth/api'
import { mapAuthRespToSession, mapRegisterFormToDto } from '@/features/auth/model'
import type { AuthFieldErrors, RegisterFormValues } from '@/features/auth/model'
import AuthActionButton from './AuthActionButton.vue'

const emit = defineEmits<{
  success: []
  switchMode: ['login' | 'forgot-password']
}>()

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const form = reactive<RegisterFormValues>({
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
})

const touched = reactive<Record<keyof RegisterFormValues, boolean>>({
  email: false,
  username: false,
  password: false,
  confirmPassword: false,
})

const errors = reactive<AuthFieldErrors<RegisterFormValues>>({})
const submitting = ref(false)
const submitError = ref('')

function validateEmail(value: string): string {
  if (!value.trim()) return '请输入邮箱'
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  return ok ? '' : '请输入正确的邮箱格式'
}

function validateUsername(value: string): string {
  const next = value.trim()

  if (!next) return '请输入用户名'
  if (next.length < 4 || next.length > 20) return '用户名长度需在 4-20 位之间'
  if (!/^[a-zA-Z0-9_]+$/.test(next)) return '用户名仅支持字母、数字和下划线'
  if (/^\d+$/.test(next)) return '用户名不能为纯数字'

  return ''
}

function validatePassword(value: string): string {
  if (!value) return '请输入密码'
  if (value.length < 8) return '密码至少 8 位'
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '密码需同时包含字母和数字'
  return ''
}

function validateConfirmPassword(value: string): string {
  if (!value) return '请再次输入密码'
  if (value !== form.password) return '两次输入的密码不一致'
  return ''
}

function validateField(field: keyof RegisterFormValues): string {
  let message = ''

  if (field === 'email') message = validateEmail(form.email)
  if (field === 'username') message = validateUsername(form.username)
  if (field === 'password') message = validatePassword(form.password)
  if (field === 'confirmPassword') message = validateConfirmPassword(form.confirmPassword)

  errors[field] = message
  return message
}

function onBlur(field: keyof RegisterFormValues) {
  touched[field] = true
  validateField(field)
}

const hasErrors = computed(() =>
  Boolean(errors.email || errors.username || errors.password || errors.confirmPassword),
)

function validateAll(): boolean {
  touched.email = true
  touched.username = true
  touched.password = true
  touched.confirmPassword = true

  const nextErrors = [
    validateField('email'),
    validateField('username'),
    validateField('password'),
    validateField('confirmPassword'),
  ]

  return nextErrors.every((item) => !item)
}

async function handleSubmit() {
  submitError.value = ''

  if (!validateAll()) return

  submitting.value = true

  try {
    const result = await authApi.register(mapRegisterFormToDto(form))
    authStore.setAuth(mapAuthRespToSession(result))

    toast.success('注册成功，已自动登录')
    await router.push({ name: ROUTE_NAME.HOME })

    emit('success')
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '注册失败，请稍后重试'
    toast.error(submitError.value)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <FormField>
      <FormLabel for="register-email">邮箱</FormLabel>
      <Input
        id="register-email"
        v-model="form.email"
        type="email"
        placeholder="请输入邮箱"
        :error="touched.email ? errors.email : ''"
        autocomplete="email"
        @blur="onBlur('email')"
      />
      <FieldError :message="touched.email ? errors.email : ''" />
    </FormField>

    <FormField>
      <FormLabel for="register-username">用户名</FormLabel>
      <Input
        id="register-username"
        v-model="form.username"
        type="text"
        placeholder="4-20 位，支持字母数字下划线"
        :error="touched.username ? errors.username : ''"
        autocomplete="username"
        @blur="onBlur('username')"
      />
      <FieldError :message="touched.username ? errors.username : ''" />
    </FormField>

    <FormField>
      <FormLabel for="register-password">密码</FormLabel>
      <Input
        id="register-password"
        v-model="form.password"
        type="password"
        placeholder="至少 8 位，包含字母和数字"
        :error="touched.password ? errors.password : ''"
        autocomplete="new-password"
        @blur="onBlur('password')"
      />
      <FieldError :message="touched.password ? errors.password : ''" />
    </FormField>

    <FormField>
      <FormLabel for="register-confirm-password">确认密码</FormLabel>
      <Input
        id="register-confirm-password"
        v-model="form.confirmPassword"
        type="password"
        placeholder="请再次输入密码"
        :error="touched.confirmPassword ? errors.confirmPassword : ''"
        autocomplete="new-password"
        @blur="onBlur('confirmPassword')"
      />
      <FieldError :message="touched.confirmPassword ? errors.confirmPassword : ''" />
    </FormField>

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
        注册
      </AuthActionButton>
    </div>

    <div class="text-center text-sm text-[var(--color-text-muted)]">
      已有账号？
      <button
        type="button"
        class="font-medium text-[var(--color-primary)] transition-colors duration-200 hover:text-[var(--color-primary-strong)]"
        @click="emit('switchMode', 'login')"
      >
        去登录
      </button>
    </div>
  </form>
</template>
