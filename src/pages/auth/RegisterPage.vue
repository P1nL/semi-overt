<script setup lang="ts">
import { useRouter } from 'vue-router'

import { RegisterForm } from '@/features/auth'
import { ROUTE_NAME } from '@/shared/constants/routes'

const router = useRouter()

async function handleSwitch(mode: 'login' | 'forgot-password') {
  if (mode === 'login') {
    await router.push({ name: ROUTE_NAME.LOGIN })
    return
  }

  await router.push({ name: ROUTE_NAME.FORGOT_PASSWORD })
}
</script>

<template>
  <RegisterForm @switch-mode="handleSwitch" />
</template>
