<script setup lang="ts">
import { useRouter } from 'vue-router'

import { ForgotPasswordForm } from '@/features/auth'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

async function handleSwitch() {
  await router.push({ name: ROUTE_NAME.LOGIN })
}

async function handleSuccess() {
  authStore.clearAuth()
  await router.push({ name: ROUTE_NAME.LOGIN })
}
</script>

<template>
  <ForgotPasswordForm @success="handleSuccess" @switch-mode="handleSwitch" />
</template>
