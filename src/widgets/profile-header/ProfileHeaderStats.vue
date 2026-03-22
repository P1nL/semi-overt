<script setup lang="ts">
import type { UserStatItemVm } from '@/entities/user/model/user.types'

withDefaults(
    defineProps<{
      stats?: UserStatItemVm[]
    }>(),
    {
      stats: () => [],
    },
)
</script>

<template>
  <div
    class="inline-flex max-w-full flex-wrap items-center justify-center gap-x-5 gap-y-3 px-1 py-1"
  >
    <div
      v-for="(item, index) in stats"
      :key="item.key"
      class="flex items-baseline gap-2 text-center"
    >
      <span
        v-if="index > 0"
        aria-hidden="true"
        class="mr-3 hidden h-4 w-px bg-[color-mix(in_srgb,var(--color-text-muted)_38%,transparent)] sm:block"
      />
      <span class="text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)] md:text-[2rem]">
        {{ item.value }}
      </span>
      <span class="text-base text-[color-mix(in_srgb,var(--color-text-muted)_88%,white_12%)]">
        {{ item.label }}
      </span>
    </div>
  </div>
</template>
