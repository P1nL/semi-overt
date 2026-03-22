<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'
import Icon from './Icon.vue'

interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

const props = withDefaults(
    defineProps<{
      modelValue?: string | number | null
      options: SelectOption[]
      placeholder?: string
      disabled?: boolean
      invalid?: boolean
      name?: string
    }>(),
    {
      modelValue: null,
      placeholder: '请选择',
      disabled: false,
      invalid: false,
      name: undefined,
    },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | null): void
  (e: 'change', value: string | number | null): void
}>()

const currentValue = computed(() =>
    props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue),
)

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const next = value === '' ? null : value
  emit('update:modelValue', next)
  emit('change', next)
}
</script>

<template>
  <div class="relative">
    <select
        :name="name"
        :disabled="disabled"
        :value="currentValue"
        :aria-invalid="invalid || undefined"
        :class="
        cn(
          'control-surface w-full appearance-none rounded-[var(--radius-md)] px-4 py-3 pr-11 text-sm text-[var(--color-text)] outline-none shadow-none transition-[border-color,box-shadow,background-color] duration-300',
          invalid
            ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-0 focus:shadow-none'
            : 'focus:border-[color-mix(in_srgb,var(--color-border-strong)_72%,white)] focus:ring-0 focus:shadow-none',
          disabled && 'cursor-not-allowed opacity-55',
        )
      "
        @change="onChange"
    >
      <option value="">{{ placeholder }}</option>
      <option
          v-for="option in options"
          :key="String(option.value)"
          :value="String(option.value)"
          :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>

    <span
        class="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center text-[var(--color-text-muted)]"
    >
      <Icon name="chevron-down" :size="16" />
    </span>
  </div>
</template>
