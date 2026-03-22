<script setup lang="ts">
defineProps<{
  signature: string
}>()
</script>

<template>
  <div class="surface-2 rounded-[var(--radius-xl)] p-4 md:p-5">
    <div class="mb-2 text-sm font-medium tracking-[-0.01em] text-[var(--color-text)]">个人简介</div>
    <p class="text-sm leading-7 text-[var(--color-text-muted)]">{{ signature }}</p>
  </div>
</template>
