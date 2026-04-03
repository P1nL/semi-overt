<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type ImageLoading = 'eager' | 'lazy'
type ImageDecoding = 'sync' | 'async' | 'auto'
type ImageFetchPriority = 'high' | 'low' | 'auto'

const props = withDefaults(
    defineProps<{
      src?: string
      alt?: string
      name?: string
      size?: AvatarSize
      rounded?: boolean
      fallback?: string
      loading?: ImageLoading
      decoding?: ImageDecoding
      fetchpriority?: ImageFetchPriority
    }>(),
    {
      alt: 'avatar',
      name: '',
      size: 'md',
      rounded: true,
      fallback: '',
      loading: 'lazy',
      decoding: 'async',
      fetchpriority: 'auto',
    },
)

const sizeClassMap: Record<AvatarSize, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-lg',
}

const initials = computed(() => {
  if (props.fallback?.trim()) return props.fallback.trim().slice(0, 2).toUpperCase()
  if (!props.name?.trim()) return '?'

  return props.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((item) => item[0])
      .join('')
      .toUpperCase()
})

const shapeClass = computed(() => (props.rounded ? 'rounded-full' : 'rounded-[var(--radius-md)]'))
</script>

<template>
  <span
      :class="
      cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-elevated)] font-medium text-[var(--color-text-muted)] select-none',
        sizeClassMap[size],
        shapeClass,
      )
    "
  >
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      :loading="loading"
      :decoding="decoding"
      :fetchpriority="fetchpriority"
      class="avatar-image absolute inset-0"
    />
    <span v-else class="relative z-10">{{ initials }}</span>
  </span>
</template>

<style scoped>
.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
</style>
