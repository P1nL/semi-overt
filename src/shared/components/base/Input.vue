<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'
import IconButton from './IconButton.vue'
import Icon from './Icon.vue'

const props = withDefaults(
    defineProps<{
      modelValue?: string | number
      type?: string
      placeholder?: string
      disabled?: boolean
      readonly?: boolean
      invalid?: boolean
      clearable?: boolean
      maxlength?: number
      autocomplete?: string
      name?: string
    }>(),
    {
      modelValue: '',
      type: 'text',
      placeholder: '',
      disabled: false,
      readonly: false,
      invalid: false,
      clearable: false,
      maxlength: undefined,
      autocomplete: undefined,
      name: undefined,
    },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
  (e: 'input', value: string): void
  (e: 'enter', value: string): void
  (e: 'clear'): void
}>()

const model = computed(() => String(props.modelValue ?? ''))

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
  emit('input', value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    emit('enter', model.value)
  }
}

function onClear() {
  emit('update:modelValue', '')
  emit('input', '')
  emit('clear')
}
</script>

<template>
  <label class="block">
    <div class="relative">
      <span
          v-if="$slots.leading"
          class="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-[var(--color-text-muted)]"
      >
        <slot name="leading" />
      </span>

      <input
          :value="model"
          :type="type"
          :placeholder="placeholder"
          :disabled="disabled"
          :readonly="readonly"
          :maxlength="maxlength"
          :autocomplete="autocomplete"
          :name="name"
          :aria-invalid="invalid || undefined"
          :class="
          cn(
            'control-surface w-full rounded-[var(--radius-md)] px-4 py-3 text-sm text-[var(--color-text)] outline-none shadow-none transition-[border-color,box-shadow,background-color] duration-300',
            'placeholder:text-[var(--color-text-muted)]',
            invalid
              ? 'border-[var(--color-danger)] focus:ring-0 focus:shadow-none'
              : 'focus:ring-0 focus:shadow-none',
            disabled && 'cursor-not-allowed opacity-55',
            $slots.leading && 'pl-11',
            (clearable && model) || $slots.trailing ? 'pr-11' : '',
          )
        "
          @input="onInput"
          @focus="emit('focus', $event)"
          @blur="emit('blur', $event)"
          @keydown="onKeydown"
      />

      <template v-if="$slots.trailing && !(clearable && model)">
        <slot name="trailing" />
      </template>

      <IconButton
          v-if="clearable && model"
          ariaLabel="清空输入"
          variant="ghost"
          size="sm"
          class="absolute inset-y-0 right-1.5 my-auto"
          @click="onClear"
      >
        <Icon name="close" :size="14" />
      </IconButton>
    </div>
  </label>
</template>
