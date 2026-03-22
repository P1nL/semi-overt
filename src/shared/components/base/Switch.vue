<script setup lang="ts">
import { cn } from '@/shared/utils/cn'

const props = withDefaults(
    defineProps<{
      modelValue?: boolean
      disabled?: boolean
      label?: string
      description?: string
    }>(),
    {
      modelValue: false,
      disabled: false,
      label: '',
      description: '',
    },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', value: boolean): void
}>()

function onToggle() {
  if (props.disabled) return
  const next = !props.modelValue
  emit('update:modelValue', next)
  emit('change', next)
}
</script>

<template>
  <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      :class="
      cn(
        'inline-flex items-center gap-3 text-left',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )
    "
      @click="onToggle"
  >
    <span
        :class="
        cn(
          'relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-all duration-300',
          modelValue
            ? 'border-[color-mix(in_srgb,var(--color-primary)_38%,transparent)] bg-[var(--color-primary)] shadow-[0_10px_24px_rgb(0_113_227_/_0.18)]'
            : 'border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_92%,transparent)] shadow-[var(--shadow-inset)]',
        )
      "
    >
      <span
          :class="
          cn(
            'absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow-[0_6px_14px_rgb(15_23_42_/_0.16)] transition-transform duration-300 dark:bg-[var(--color-surface)]',
            modelValue ? 'translate-x-5' : 'translate-x-0.5',
          )
        "
      />
    </span>

    <span v-if="label || description" class="min-w-0">
      <span class="block text-sm font-medium text-[var(--color-text)]">{{ label }}</span>
      <span v-if="description" class="mt-0.5 block text-xs text-[var(--color-text-muted)]">
        {{ description }}
      </span>
    </span>
  </button>
</template>
