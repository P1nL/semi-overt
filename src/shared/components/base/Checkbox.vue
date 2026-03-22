<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cn } from '@/shared/utils/cn'
import Icon from './Icon.vue'

const props = withDefaults(
    defineProps<{
      modelValue?: boolean
      label?: string
      description?: string
      disabled?: boolean
      indeterminate?: boolean
      name?: string
      value?: string
    }>(),
    {
      modelValue: false,
      label: '',
      description: '',
      disabled: false,
      indeterminate: false,
      name: '',
      value: '',
    },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', value: boolean): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)

watch(
    () => props.indeterminate,
    (value) => {
      if (inputRef.value) {
        inputRef.value.indeterminate = value
      }
    },
    { immediate: true },
)

const checked = computed(() => props.modelValue)

function onChange(event: Event) {
  const nextValue = (event.target as HTMLInputElement).checked
  emit('update:modelValue', nextValue)
  emit('change', nextValue)
}
</script>

<template>
  <label
      :class="
      cn(
        'inline-flex items-start gap-3',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )
    "
  >
    <span class="relative mt-0.5 inline-flex">
      <input
          ref="inputRef"
          :checked="checked"
          :name="name || undefined"
          :value="value || undefined"
          :disabled="disabled"
          type="checkbox"
          class="peer sr-only"
          @change="onChange"
      />
      <span
          :class="
          cn(
            'inline-flex size-5 items-center justify-center rounded-[calc(var(--radius-sm)-2px)] border transition-colors',
            checked || indeterminate
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] text-transparent',
          )
        "
      >
        <Icon v-if="checked && !indeterminate" name="check" :size="14" />
        <Icon v-else-if="indeterminate" name="minus" :size="14" />
      </span>
    </span>

    <span v-if="label || description" class="min-w-0">
      <span class="block text-sm font-medium text-[var(--color-text)]">{{ label }}</span>
      <span v-if="description" class="mt-0.5 block text-xs text-[var(--color-text-muted)]">
        {{ description }}
      </span>
    </span>
  </label>
</template>