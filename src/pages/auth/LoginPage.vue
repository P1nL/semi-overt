<script setup lang="ts">
import { useRouter } from 'vue-router'

import { LoginForm } from '@/features/auth'
import { ROUTE_NAME } from '@/shared/constants/routes'

const router = useRouter()

async function handleSwitch(mode: 'register' | 'forgot-password') {
  if (mode === 'register') {
    await router.push({ name: ROUTE_NAME.REGISTER })
    return
  }

  await router.push({ name: ROUTE_NAME.FORGOT_PASSWORD })
}
</script>

<template>
  <LoginForm @switch-mode="handleSwitch" />
</template>
