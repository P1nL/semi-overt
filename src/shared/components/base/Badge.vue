<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
type BadgeSize = 'sm' | 'md'

const props = withDefaults(
    defineProps<{
      variant?: BadgeVariant
      size?: BadgeSize
      dot?: boolean
      outlined?: boolean
    }>(),
    {
      variant: 'default',
      size: 'sm',
      dot: false,
      outlined: false,
    },
)

const variantClassMap: Record<BadgeVariant, string> = {
  default:
      'bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_88%,transparent)] text-[var(--color-text-muted)] border-[var(--color-border)]',
  primary:
      'bg-[color-mix(in_srgb,var(--color-primary)_11%,var(--color-surface)_89%)] text-[var(--color-primary)] border-[color-mix(in_srgb,var(--color-primary)_16%,transparent)]',
  success:
      'bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-surface)_90%)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_16%,transparent)]',
  warning:
      'bg-[color-mix(in_srgb,var(--color-warning)_10%,var(--color-surface)_90%)] text-[var(--color-warning)] border-[color-mix(in_srgb,var(--color-warning)_16%,transparent)]',
  danger:
      'bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface)_90%)] text-[var(--color-danger)] border-[color-mix(in_srgb,var(--color-danger)_16%,transparent)]',
  info:
      'bg-[color-mix(in_srgb,var(--color-primary)_11%,var(--color-surface)_89%)] text-[var(--color-primary)] border-[color-mix(in_srgb,var(--color-primary)_16%,transparent)]',
}

const sizeClassMap: Record<BadgeSize, string> = {
  sm: 'min-h-6 px-2.5 text-[11px]',
  md: 'min-h-7 px-3 text-xs',
}

const dotClass = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'bg-[var(--color-success)]'
    case 'warning':
      return 'bg-[var(--color-warning)]'
    case 'danger':
      return 'bg-[var(--color-danger)]'
    case 'primary':
    case 'info':
      return 'bg-[var(--color-primary)]'
    default:
      return 'bg-[var(--color-text-muted)]'
  }
})
</script>

<template>
  <span
      :class="
      cn(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border font-medium tracking-[0.01em] whitespace-nowrap shadow-[var(--shadow-xs)]',
        sizeClassMap[size],
        variantClassMap[variant],
        outlined && 'bg-transparent',
        dot && 'px-2',
      )
    "
  >
    <span :class="cn('size-1.5 rounded-full', dotClass)" />
    <slot />
  </span>
</template>
