<script setup lang="ts">
import { cn } from '@/shared/utils/cn'

type EmptyStateSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
    defineProps<{
      title?: string
      description?: string
      emoji?: string
      size?: EmptyStateSize
    }>(),
    {
      title: '暂无内容',
      description: '',
      emoji: '😔',
      size: 'md',
    },
)

const sizeClassMap: Record<EmptyStateSize, string> = {
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-16',
}
</script>

<template>
  <div :class="cn('flex flex-col items-center justify-center rounded-[var(--radius-xl)] text-center', sizeClassMap[size])">
    <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full  text-5xl" aria-hidden="true">{{ emoji }}</div>
    <h3 class="text-lg font-semibold tracking-[-0.02em] text-[var(--color-text)]">{{ title }}</h3>
    <p v-if="description" class="mt-3 max-w-md text-sm leading-6 text-[var(--color-text-muted)]">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
