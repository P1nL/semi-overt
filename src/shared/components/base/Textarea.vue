<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { cn } from '@/shared/utils/cn'

const props = withDefaults(
    defineProps<{
      modelValue?: string
      placeholder?: string
      rows?: number
      disabled?: boolean
      readonly?: boolean
      invalid?: boolean
      maxlength?: number
      resize?: 'none' | 'vertical' | 'auto'
    }>(),
    {
      modelValue: '',
      placeholder: '',
      rows: 4,
      disabled: false,
      readonly: false,
      invalid: false,
      maxlength: undefined,
      resize: 'vertical',
    },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
  (e: 'input', value: string): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const model = computed(() => props.modelValue ?? '')

function onInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  emit('update:modelValue', value)
  emit('input', value)
  resizeIfNeeded()
}

async function resizeIfNeeded() {
  if (props.resize !== 'auto' || !textareaRef.value) return

  await nextTick()
  textareaRef.value.style.height = 'auto'
  textareaRef.value.style.height = `${textareaRef.value.scrollHeight}px`
}

watch(() => props.modelValue, resizeIfNeeded, { immediate: true })
</script>

<template>
  <textarea
      ref="textareaRef"
      :value="model"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      :aria-invalid="invalid || undefined"
      :class="
      cn(
        'control-surface w-full rounded-[var(--radius-lg)] px-4 py-3 text-sm text-[var(--color-text)] outline-none shadow-none transition-[border-color,box-shadow,background-color] duration-300 placeholder:text-[var(--color-text-muted)]',
        invalid
          ? 'border-[var(--color-danger)] focus:ring-0 focus:shadow-none'
          : 'focus:ring-0 focus:shadow-none',
        disabled && 'cursor-not-allowed opacity-55',
        resize === 'none' && 'resize-none',
        resize === 'vertical' && 'resize-y',
        resize === 'auto' && 'resize-none overflow-hidden',
      )
    "
      @input="onInput"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
  />
</template>
