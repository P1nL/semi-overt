<script setup lang="ts">
export type AuthDialogMode = 'login' | 'register' | 'forgot'

defineProps<{
  modelValue: AuthDialogMode
}>()

const emit = defineEmits<{
  'update:modelValue': [AuthDialogMode]
}>()

const items: Array<{ value: Exclude<AuthDialogMode, 'forgot'>; label: string }> = [
  { value: 'login', label: '登录' },
  { value: 'register', label: '注册' },
]
</script>

<template>
  <div class="grid grid-cols-2 gap-2 rounded-[var(--radius-lg)] bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_72%,transparent)] p-1">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="rounded-[calc(var(--radius-lg)-0.25rem)] px-3 py-2 text-sm font-medium tracking-[-0.01em] transition-all duration-200"
      :class="
        item.value === modelValue
          ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-xs)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
      "
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
