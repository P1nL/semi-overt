<script setup lang="ts">
import { ROUTE_NAME } from '@/shared/constants/routes'
</script>

<template>
  <RouterLink
      :to="{ name: ROUTE_NAME.HOME }"
      class="inline-flex items-center gap-3 rounded-[var(--radius-pill)] px-2.5 py-1.5 text-base font-semibold tracking-[-0.03em] text-[var(--color-text)] transition-all duration-300 hover:bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_72%,transparent)]"
  >
    <span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--color-primary),var(--color-primary-strong))] text-sm font-semibold text-white shadow-[var(--shadow-button)]">
      N
    </span>
    <span class="hidden sm:inline">Now</span>
  </RouterLink>
</template>
