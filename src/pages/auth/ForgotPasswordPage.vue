<script setup lang="ts">
import { useRouter } from 'vue-router'

import { ForgotPasswordForm } from '@/features/auth'
import { ROUTE_NAME } from '@/shared/constants/routes'

const router = useRouter()

async function handleSwitch() {
  await router.push({ name: ROUTE_NAME.LOGIN })
}
</script>

<template>
  <ForgotPasswordForm @switch-mode="handleSwitch" />
</template>
