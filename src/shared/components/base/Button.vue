<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { cn } from '@/shared/utils/cn'
import Spinner from './Spinner.vue'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
type ButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
    defineProps<{
      type?: 'button' | 'submit' | 'reset'
      variant?: ButtonVariant
      size?: ButtonSize
      loading?: boolean
      disabled?: boolean
      block?: boolean
      pill?: boolean
      iconOnly?: boolean
    }>(),
    {
      type: 'button',
      variant: 'primary',
      size: 'md',
      loading: false,
      disabled: false,
      block: false,
      pill: false,
      iconOnly: false,
    },
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const slots = useSlots()

const variantClassMap: Record<ButtonVariant, string> = {
  primary:
      'border border-transparent bg-[var(--color-primary)] text-white shadow-[var(--shadow-button)] hover:bg-[var(--color-primary-strong)] focus-visible:outline-none focus-visible:ring-0',
  secondary:
      'control-surface text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] focus-visible:outline-none focus-visible:ring-0',
  ghost:
      'text-[var(--color-text-muted)] hover:bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_72%,transparent)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-0',
  danger:
      'border border-transparent bg-[var(--color-danger)] text-white shadow-[var(--shadow-xs)] hover:brightness-[1.03] focus-visible:outline-none',
  success:
      'border border-transparent bg-[var(--color-success)] text-white shadow-[var(--shadow-xs)] hover:brightness-[1.03] focus-visible:outline-none',
  warning:
      'border border-transparent bg-[var(--color-warning)] text-white shadow-[var(--shadow-xs)] hover:brightness-[1.03] focus-visible:outline-none',
}

const sizeClassMap: Record<ButtonSize, string> = {
  sm: 'h-9 gap-2 px-3.5 text-sm',
  md: 'h-11 gap-2 px-5 text-sm',
  lg: 'h-12 gap-2.5 px-6 text-base',
}

const iconOnlySizeClassMap: Record<ButtonSize, string> = {
  sm: 'size-9 p-0',
  md: 'size-11 p-0',
  lg: 'size-12 p-0',
}

const isDisabled = computed(() => props.disabled || props.loading)

function onClick(event: MouseEvent) {
  if (isDisabled.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  emit('click', event)
}

const hasLeftIcon = computed(() => Boolean(slots.icon))
const hasRightIcon = computed(() => Boolean(slots.trailing))
</script>

<template>
  <button
      :type="type"
      :disabled="isDisabled"
      :aria-busy="loading || undefined"
      :class="
      cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] font-medium tracking-[-0.01em] transition-all duration-300 ease-out focus:outline-none focus-visible:outline-none focus-visible:ring-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55',
        variantClassMap[variant],
        iconOnly ? iconOnlySizeClassMap[size] : sizeClassMap[size],
        block && 'w-full',
        pill && 'rounded-[var(--radius-pill)]',
      )
    "
      @click="onClick"
  >
    <Spinner v-if="loading" :size="size === 'lg' ? 'md' : 'sm'" />
    <slot v-else-if="hasLeftIcon" name="icon" />
    <slot />
    <slot v-if="!loading && hasRightIcon" name="trailing" />
  </button>
</template>
