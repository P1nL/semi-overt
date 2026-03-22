<!-- src/entities/user/ui/UserStatItem.vue -->
<script setup lang="ts">
import type { UserStatItemVm } from '../model/user.types'

defineProps<{
  item: UserStatItemVm
}>()
</script>

<template>
  <div class="surface-2 rounded-[var(--radius-xl)] p-4 text-center">
    <div class="text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">{{ item.value }}</div>
    <div class="mt-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{{ item.label }}</div>
  </div>
</template>
