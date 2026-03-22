<script setup lang="ts">
import { useRouter } from 'vue-router'

import { ResetPasswordForm } from '@/features/auth'
import { ROUTE_NAME } from '@/shared/constants/routes'

const router = useRouter()

async function handleSwitch() {
  await router.push({
    name: ROUTE_NAME.HOME,
    query: { auth: 'login' },
  })
}
</script>

<template>
  <ResetPasswordForm @switch-mode="handleSwitch" />
</template>
