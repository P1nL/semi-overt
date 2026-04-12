<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { Checkbox, Input } from '@/shared/components/base'
import AnimatedDisabledIcon from '@/shared/components/base/AnimatedDisabledIcon.vue'
import { InlineMessage } from '@/shared/components/feedback'
import { FieldError, FormField, FormLabel } from '@/shared/components/form'
import { useToast } from '@/shared/composables/useToast'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { useAuthStore } from '@/stores/auth'

import { authApi } from '@/features/auth/api'
import { mapAuthRespToSession, mapLoginFormToDto } from '@/features/auth/model'
import type { AuthFieldErrors, LoginFormValues } from '@/features/auth/model'
import AuthActionButton from './AuthActionButton.vue'
import PasswordToggleButton from './PasswordToggleButton.vue'

const emit = defineEmits<{
  success: []
  switchMode: ['register' | 'forgot-password']
}>()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

const form = reactive<LoginFormValues>({
  account: '',
  password: '',
  rememberMe: true,
})

const touched = reactive<Record<keyof LoginFormValues, boolean>>({
  account: false,
  password: false,
  rememberMe: false,
})

const errors = reactive<AuthFieldErrors<LoginFormValues>>({})
const submitting = ref(false)
const submitError = ref('')
const passwordVisible = ref(false)

function validateAccount(value: string): string {
  if (!value.trim()) return '请输入邮箱或用户名'
  if (value.trim().length < 3) return '账号长度不能少于 3 位'
  return ''
}

function validatePassword(value: string): string {
  if (!value) return '请输入密码'
  if (value.length < 6) return '密码长度不能少于 6 位'
  return ''
}

function validateField(field: keyof LoginFormValues): string {
  let message = ''

  if (field === 'account') message = validateAccount(form.account)
  if (field === 'password') message = validatePassword(form.password)

  errors[field] = message
  return message
}

function onBlur(field: keyof LoginFormValues) {
  touched[field] = true
  validateField(field)
}

const hasErrors = computed(() => Boolean(errors.account || errors.password))

function validateAll(): boolean {
  touched.account = true
  touched.password = true

  const nextErrors = [validateField('account'), validateField('password')]
  return nextErrors.every((item) => !item)
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function handleSubmit() {
  submitError.value = ''

  if (!validateAll()) return

  submitting.value = true

  try {
    const result = await authApi.login(mapLoginFormToDto(form))
    authStore.setAuth(mapAuthRespToSession(result), {
      persistence: form.rememberMe ? 'local' : 'session',
    })

    // 让转圈动效多转一会儿再跳转
    await delay(900)

    toast.success('登录成功')

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (redirect) {
      await router.push(redirect)
    } else {
      await router.push({ name: ROUTE_NAME.HOME })
    }

    emit('success')
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
    toast.error(submitError.value)
    submitting.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <FormField>
      <FormLabel for="login-account">邮箱或用户名</FormLabel>
      <Input
        id="login-account"
        v-model="form.account"
        type="text"
        placeholder="请输入邮箱或用户名"
        :error="touched.account ? errors.account : ''"
        autocomplete="username"
        @blur="onBlur('account')"
      />
      <FieldError :message="touched.account ? errors.account : ''" />
    </FormField>

    <FormField>
      <FormLabel for="login-password">密码</FormLabel>
      <Input
        id="login-password"
        v-model="form.password"
        :type="passwordVisible ? 'text' : 'password'"
        placeholder="请输入密码"
        :error="touched.password ? errors.password : ''"
        autocomplete="current-password"
        @blur="onBlur('password')"
      >
        <template #trailing>
          <PasswordToggleButton
            :visible="passwordVisible"
            @toggle="passwordVisible = !passwordVisible"
          />
        </template>
      </Input>
      <FieldError :message="touched.password ? errors.password : ''" />
    </FormField>

    <div class="flex items-center justify-between gap-3">
      <label class="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <Checkbox v-model="form.rememberMe" />
        <span>记住我</span>
      </label>

      <button
        type="button"
        class="text-sm font-medium text-[var(--color-primary)] transition-colors duration-200 hover:text-[var(--color-primary-strong)]"
        @click="emit('switchMode', 'forgot-password')"
      >
        忘记密码？
      </button>
    </div>

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
        icon-only
        aria-label="登录"
      >
        <AnimatedDisabledIcon size="1.5rem" title="登录" :decorative="false" />
      </AuthActionButton>
    </div>

    <div class="text-center text-sm text-[var(--color-text-muted)]">
      还没有账号？
      <button
        type="button"
        class="font-medium text-[var(--color-primary)] transition-colors duration-200 hover:text-[var(--color-primary-strong)]"
        @click="emit('switchMode', 'register')"
      >
        立即注册
      </button>
    </div>
  </form>
</template>
