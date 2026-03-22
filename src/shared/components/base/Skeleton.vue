<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'

type SkeletonVariant = 'text' | 'title' | 'avatar' | 'image' | 'card' | 'rect'

const props = withDefaults(
    defineProps<{
      variant?: SkeletonVariant
      lines?: number
      animated?: boolean
      width?: string
      height?: string
      rounded?: boolean
    }>(),
    {
      variant: 'text',
      lines: 3,
      animated: true,
      width: '',
      height: '',
      rounded: true,
    },
)

const baseClass = computed(() =>
    cn(
        'bg-[color-mix(in_srgb,var(--color-text-muted)_10%,var(--color-surface)_90%)]',
        props.animated && 'skeleton-pulse',
    ),
)

const styleObject = computed(() => ({
  width: props.width || undefined,
  height: props.height || undefined,
}))
</script>

<template>
  <div v-if="variant === 'text'" class="space-y-2">
    <div
        v-for="index in lines"
        :key="index"
        :class="cn(baseClass, 'h-4 rounded', index === lines ? 'w-2/3' : 'w-full')"
    />
  </div>

  <div
      v-else-if="variant === 'title'"
      :class="cn(baseClass, 'h-6 w-1/2 rounded')"
      :style="styleObject"
  />

  <div
      v-else-if="variant === 'avatar'"
      :class="cn(baseClass, 'size-10 rounded-full')"
      :style="styleObject"
  />

  <div
      v-else-if="variant === 'image'"
      :class="cn(baseClass, 'aspect-[16/9] w-full rounded-[var(--radius-md)]')"
      :style="styleObject"
  />

  <div
      v-else-if="variant === 'card'"
      class="surface-2 space-y-3 rounded-[var(--radius-lg)] p-4"
  >
    <div :class="cn(baseClass, 'h-40 w-full rounded-[var(--radius-sm)]')" />
    <div :class="cn(baseClass, 'h-5 w-2/3 rounded')" />
    <div :class="cn(baseClass, 'h-4 w-full rounded')" />
    <div :class="cn(baseClass, 'h-4 w-5/6 rounded')" />
  </div>

  <div
      v-else
      :class="cn(baseClass, rounded ? 'rounded-[var(--radius-sm)]' : 'rounded-none')"
      :style="styleObject"
  />
</template>
