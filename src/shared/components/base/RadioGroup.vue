<script setup lang="ts">
import { cn } from '@/shared/utils/cn'

type RadioValue = string | number | boolean | null

interface RadioOption {
  label: string
  value: string | number | boolean
  description?: string
  disabled?: boolean
}

const props = withDefaults(
    defineProps<{
      modelValue?: RadioValue
      options: RadioOption[]
      name?: string
      disabled?: boolean
      direction?: 'row' | 'column'
    }>(),
    {
      modelValue: null,
      name: undefined,
      disabled: false,
      direction: 'column',
    },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: RadioValue): void
  (e: 'change', value: RadioValue): void
}>()

function onChange(value: RadioValue) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <div :class="cn('flex gap-3', direction === 'row' ? 'flex-wrap items-center' : 'flex-col')">
    <label
        v-for="option in options"
        :key="String(option.value)"
        :class="
        cn(
          'inline-flex items-start gap-3',
          disabled || option.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )
      "
    >
      <input
          :checked="modelValue === option.value"
          :disabled="disabled || option.disabled"
          :name="name"
          :value="String(option.value)"
          type="radio"
          class="peer sr-only"
          @change="onChange(option.value)"
      />

      <span
          class="mt-0.5 inline-flex size-5 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <span
            :class="
            cn(
              'size-2.5 rounded-full transition-colors',
              modelValue === option.value ? 'bg-[var(--color-primary)]' : 'bg-transparent',
            )
          "
        />
      </span>

      <span class="min-w-0">
        <span class="block text-sm font-medium text-[var(--color-text)]">{{ option.label }}</span>
        <span
            v-if="option.description"
            class="mt-0.5 block text-xs text-[var(--color-text-muted)]"
        >
          {{ option.description }}
        </span>
      </span>
    </label>
  </div>
</template>