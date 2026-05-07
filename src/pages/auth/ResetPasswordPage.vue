<script setup lang="ts">
import { useRouter } from 'vue-router'

import { ResetPasswordForm } from '@/features/auth'
import { ROUTE_NAME } from '@/shared/constants/routes'

const router = useRouter()

async function handleSwitch(mode: 'login' | 'forgot-password') {
  if (mode === 'forgot-password') {
    await router.push({ name: ROUTE_NAME.FORGOT_PASSWORD })
    return
  }

  await router.push({ name: ROUTE_NAME.LOGIN })
}
</script>

<template>
  <ResetPasswordForm @switch-mode="handleSwitch" />
</template>
