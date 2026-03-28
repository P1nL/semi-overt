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
  primary: 'button--primary',
  secondary: 'button--secondary',
  ghost: 'button--ghost',
  danger: 'button--danger',
  success: 'button--success',
  warning: 'button--warning',
}

const sizeClassMap: Record<ButtonSize, string> = {
  sm: 'button--sm',
  md: 'button--md',
  lg: 'button--lg',
}

const iconOnlySizeClassMap: Record<ButtonSize, string> = {
  sm: 'button--icon-sm',
  md: 'button--icon-md',
  lg: 'button--icon-lg',
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

<style scoped>
.button--primary {
  border: 1px solid transparent;
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-button);
}

.button--primary:hover {
  background: var(--color-primary-strong);
}

.button--secondary {
  background: color-mix(in srgb, var(--color-surface-glass-strong) 96%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border) 16%, transparent);
  color: var(--color-text);
  box-shadow:
    0 4px 14px rgb(15 23 42 / 0.018),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
  backdrop-filter: blur(calc(var(--backdrop-blur) * 0.7)) saturate(160%);
}

.button--secondary:hover {
  border-color: var(--color-border-strong);
  background: color-mix(in srgb, var(--color-surface) 90%, transparent);
}

.button--ghost {
  color: var(--color-text-muted);
}

.button--ghost:hover {
  background: color-mix(in srgb, var(--color-surface-glass-strong) 72%, transparent);
  color: var(--color-text);
}

.button--danger,
.button--success,
.button--warning {
  border: 1px solid transparent;
  color: white;
  box-shadow: var(--shadow-xs);
}

.button--danger {
  background: var(--color-danger);
}

.button--success {
  background: var(--color-success);
}

.button--warning {
  background: var(--color-warning);
}

.button--danger:hover,
.button--success:hover,
.button--warning:hover {
  filter: brightness(1.03);
}

.button--sm {
  height: 2.25rem;
  gap: 0.5rem;
  padding-inline: 0.875rem;
  font-size: 0.875rem;
}

.button--md {
  height: 2.75rem;
  gap: 0.5rem;
  padding-inline: 1.25rem;
  font-size: 0.875rem;
}

.button--lg {
  height: 3rem;
  gap: 0.625rem;
  padding-inline: 1.5rem;
  font-size: 1rem;
}

.button--icon-sm {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
}

.button--icon-md {
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
}

.button--icon-lg {
  width: 3rem;
  height: 3rem;
  padding: 0;
}
</style>
