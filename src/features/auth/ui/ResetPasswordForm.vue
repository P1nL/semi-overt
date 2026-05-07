<script setup lang="ts">
import { InlineMessage } from '@/shared/components/feedback'

import AuthActionButton from './AuthActionButton.vue'

const emit = defineEmits<{
  switchMode: ['login' | 'forgot-password']
}>()
</script>

<template>
  <div class="space-y-5 text-center">
    <InlineMessage
      tone="warning"
      message="密码找回方式已更新。旧邮件链接中的重置令牌不再使用，请重新获取邮箱验证码后在找回密码页完成重置。"
    />

    <p class="text-sm leading-6 text-[var(--color-text-muted)]">
      邮箱现在只用于接收 6 位验证码，不需要再从邮件链接进入重置页面。
    </p>

    <div class="flex justify-center">
      <AuthActionButton type="button" @click="emit('switchMode', 'forgot-password')">
        前往找回密码
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
  </div>
</template>
