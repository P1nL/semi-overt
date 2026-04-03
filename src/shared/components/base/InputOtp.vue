<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { cn } from '@/shared/utils/cn'

type InputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'

const props = withDefaults(
    defineProps<{
      modelValue?: string
      length?: number
      disabled?: boolean
      invalid?: boolean
      mask?: boolean
      inputmode?: InputMode
    }>(),
    {
      modelValue: '',
      length: 6,
      disabled: false,
      invalid: false,
      mask: false,
      inputmode: 'numeric',
    },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'complete', value: string): void
}>()

const inputs = ref<HTMLInputElement[]>([])

const chars = computed(() => {
  const base = new Array(props.length).fill('')
  props.modelValue
      .slice(0, props.length)
      .split('')
      .forEach((char, index) => {
        base[index] = char
      })
  return base
})

watch(
    () => props.modelValue,
    (value) => {
      if (value.length === props.length) {
        emit('complete', value)
      }
    },
)

function setRef(el: HTMLInputElement | null, index: number) {
  if (!el) return
  inputs.value[index] = el
}

function updateAt(index: number, nextChar: string) {
  const next = [...chars.value]
  next[index] = nextChar
  const joined = next.join('').slice(0, props.length)
  emit('update:modelValue', joined)

  if (joined.length === props.length && !joined.includes('')) {
    emit('complete', joined)
  }
}

async function onInput(index: number, event: Event) {
  const target = event.target as HTMLInputElement
  const raw = target.value.replace(/\s+/g, '')
  const char = raw.slice(-1)

  updateAt(index, char)

  await nextTick()
  if (char && index < props.length - 1) {
    inputs.value[index + 1]?.focus()
  }
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace') {
    if (chars.value[index]) {
      updateAt(index, '')
      return
    }

    if (index > 0) {
      inputs.value[index - 1]?.focus()
      updateAt(index - 1, '')
    }
  }

  if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    inputs.value[index - 1]?.focus()
  }

  if (event.key === 'ArrowRight' && index < props.length - 1) {
    event.preventDefault()
    inputs.value[index + 1]?.focus()
  }
}

async function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  const pasted = event.clipboardData?.getData('text')?.trim() ?? ''
  const next = pasted.slice(0, props.length)
  emit('update:modelValue', next)

  await nextTick()
  inputs.value[Math.min(next.length, props.length - 1)]?.focus()
}
</script>

<template>
  <div class="flex items-center gap-2">
    <input
        v-for="(_, index) in length"
        :key="index"
        :ref="(el) => setRef(el as HTMLInputElement | null, index)"
        :value="chars[index]"
        :disabled="disabled"
        :type="mask ? 'password' : 'text'"
        :inputmode="inputmode"
        maxlength="1"
        :aria-invalid="invalid || undefined"
        :class="
        cn(
          'size-11 rounded-[var(--radius-sm)] border bg-[var(--color-surface)] text-center text-lg font-semibold outline-none shadow-none transition-[border-color,box-shadow] duration-300',
          invalid
            ? 'border-[var(--color-danger)]'
            : 'border-[var(--color-border)] focus:ring-0 focus:shadow-none',
          disabled && 'cursor-not-allowed opacity-60',
        )
      "
        @input="onInput(index, $event)"
        @keydown="onKeydown(index, $event)"
        @paste="onPaste"
    />
  </div>
</template>
