<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { Input } from '@/shared/components/base'
import AnimatedDisabledIcon from '@/shared/components/base/AnimatedDisabledIcon.vue'
import { InlineMessage } from '@/shared/components/feedback'
import { FieldError, FormField, FormLabel } from '@/shared/components/form'
import { useToast } from '@/shared/composables/useToast'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { useAuthStore } from '@/stores/auth'

import { authApi } from '@/features/auth/api'
import { mapAuthRespToSession, mapRegisterFormToDto } from '@/features/auth/model'
import type { AuthFieldErrors, RegisterFormValues } from '@/features/auth/model'
import AuthActionButton from './AuthActionButton.vue'
import TurnstileWidget from './TurnstileWidget.vue'

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()

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
  emailCode: '',
})

const touched = reactive<Record<keyof RegisterFormValues, boolean>>({
  email: false,
  username: false,
  password: false,
  confirmPassword: false,
  emailCode: false,
})

const errors = reactive<AuthFieldErrors<RegisterFormValues>>({})
const submitting = ref(false)
const sendingCode = ref(false)
const submitError = ref('')
const successMessage = ref('')
const codeSent = ref(false)
const resendSeconds = ref(0)

const turnstileEl = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const turnstileToken = ref('')
const turnstileError = ref(false)
let resendTimer: number | null = null

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

function validateEmailCode(value: string): string {
  if (!value.trim()) return '请输入邮箱验证码'
  return /^\d{6}$/.test(value.trim()) ? '' : '验证码为 6 位数字'
}

function validateField(field: keyof RegisterFormValues): string {
  let message = ''

  if (field === 'email') message = validateEmail(form.email)
  if (field === 'username') message = validateUsername(form.username)
  if (field === 'password') message = validatePassword(form.password)
  if (field === 'confirmPassword') message = validateConfirmPassword(form.confirmPassword)
  if (field === 'emailCode') message = validateEmailCode(form.emailCode)

  errors[field] = message
  return message
}

function onBlur(field: keyof RegisterFormValues) {
  touched[field] = true
  validateField(field)
}

const hasErrors = computed(() =>
  Boolean(errors.email || errors.username || errors.password || errors.confirmPassword || errors.emailCode),
)
const turnstileEnabled = computed(() => Boolean(TURNSTILE_SITE_KEY))
const resendButtonLabel = computed(() =>
  resendSeconds.value > 0 ? `重新发送（${resendSeconds.value}s）` : '重新发送验证码',
)

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

function validateAll(): boolean {
  touched.email = true
  touched.username = true
  touched.password = true
  touched.confirmPassword = true
  touched.emailCode = true

  const nextErrors = [
    validateField('email'),
    validateField('username'),
    validateField('password'),
    validateField('confirmPassword'),
    validateField('emailCode'),
  ]

  return nextErrors.every((item) => !item)
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function handleSubmit() {
  submitError.value = ''
  successMessage.value = ''

  if (!validateAll()) return
  if (!codeSent.value) {
    submitError.value = '请先获取邮箱验证码'
    return
  }

  if (turnstileEnabled.value && !turnstileToken.value) {
    turnstileError.value = true
    return
  }

  submitting.value = true

  try {
    const result = await authApi.register(mapRegisterFormToDto(form, turnstileToken.value))
    authStore.setAuth(mapAuthRespToSession(result))

    await delay(900)

    toast.success('注册成功，已自动登录')
    await router.push({ name: ROUTE_NAME.HOME })

    emit('success')
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '注册失败，请稍后重试'
    toast.error(submitError.value)
    // token 已消耗或验证失败，重置 widget
    turnstileToken.value = ''
    turnstileError.value = false
    turnstileEl.value?.reset()
    submitting.value = false
  }
}

async function sendCode() {
  submitError.value = ''
  successMessage.value = ''
  touched.email = true

  if (validateField('email')) return

  if (turnstileEnabled.value && !turnstileToken.value) {
    turnstileError.value = true
    return
  }

  sendingCode.value = true

  try {
    await authApi.sendRegisterCode({
      email: form.email.trim(),
      cfTurnstileToken: turnstileToken.value || undefined,
    })
    codeSent.value = true
    successMessage.value = '验证码已发送，请查看邮箱'
    toast.success('验证码已发送，请查看邮箱')
    startResendCountdown()
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试'
    toast.error(submitError.value)
    turnstileToken.value = ''
    turnstileError.value = false
    turnstileEl.value?.reset()
  } finally {
    sendingCode.value = false
  }
}

onBeforeUnmount(() => {
  stopResendCountdown()
})
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <FormField>
      <FormLabel for="register-email">邮箱</FormLabel>
      <div class="flex gap-2">
        <Input
          id="register-email"
          v-model="form.email"
          type="email"
          placeholder="请输入邮箱"
          :error="touched.email ? errors.email : ''"
          autocomplete="email"
          :disabled="submitting || sendingCode || codeSent"
          @blur="onBlur('email')"
        />
        <button
          type="button"
          class="shrink-0 rounded-[var(--radius-pill)] border border-[color-mix(in_srgb,var(--color-primary)_34%,transparent)] px-4 text-sm font-medium text-[var(--color-primary)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--color-primary)_9%,transparent)] disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:text-[var(--color-text-muted)]"
          :disabled="submitting || sendingCode || resendSeconds > 0"
          @click="sendCode"
        >
          {{ sendingCode ? '发送中' : resendButtonLabel }}
        </button>
      </div>
      <FieldError :message="touched.email ? errors.email : ''" />
    </FormField>

    <FormField>
      <FormLabel for="register-email-code">邮箱验证码</FormLabel>
      <Input
        id="register-email-code"
        v-model="form.emailCode"
        type="text"
        inputmode="numeric"
        placeholder="请输入 6 位数字验证码"
        :error="touched.emailCode ? errors.emailCode : ''"
        autocomplete="one-time-code"
        :disabled="submitting"
        @blur="onBlur('emailCode')"
      />
      <FieldError :message="touched.emailCode ? errors.emailCode : ''" />
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

    <div class="flex flex-col items-center gap-1.5">
      <TurnstileWidget
        v-if="turnstileEnabled"
        ref="turnstileEl"
        :site-key="TURNSTILE_SITE_KEY"
        @verified="token => { turnstileToken = token; turnstileError = false }"
        @expired="() => { turnstileToken = ''; turnstileError = false }"
        @error="() => { turnstileToken = ''; turnstileError = false }"
      />
      <p v-if="turnstileError" class="text-xs text-[var(--color-danger)]">
        请完成安全验证
      </p>
    </div>

    <InlineMessage
      v-if="submitError"
      tone="error"
      :message="submitError"
    />

    <InlineMessage
      v-if="successMessage"
      tone="success"
      :message="successMessage"
    />

    <div class="flex justify-center">
      <AuthActionButton
        type="submit"
        :loading="submitting"
        :disabled="submitting || sendingCode || hasErrors"
        icon-only
        aria-label="注册"
      >
        <AnimatedDisabledIcon size="1.5rem" title="注册" :decorative="false" />
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
