<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'

interface TabItem {
  label: string
  value: string | number
  disabled?: boolean
  badge?: string | number
}

type TabVariant = 'line' | 'pill'
type TabSize = 'sm' | 'md'

const props = withDefaults(
    defineProps<{
      modelValue?: string | number
      items: TabItem[]
      variant?: TabVariant
      size?: TabSize
      stretch?: boolean
      transparentTrack?: boolean
    }>(),
    {
      modelValue: undefined,
      variant: 'line',
      size: 'md',
      stretch: false,
      transparentTrack: false,
    },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'change', value: string | number): void
}>()

const currentValue = computed(() => props.modelValue ?? props.items[0]?.value)

function selectTab(value: string | number, disabled?: boolean) {
  if (disabled) return
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <div class="w-full">
    <div
        :class="
        cn(
          'flex items-center gap-1.5 overflow-x-auto',
          variant === 'line'
            ? 'border-b border-[var(--color-border)]'
            : props.transparentTrack
              ? 'rounded-[var(--radius-lg)] p-1.5'
              : 'surface-2 rounded-[var(--radius-lg)] p-1.5',
        )
      "
        role="tablist"
    >
      <button
          v-for="item in items"
          :key="String(item.value)"
          type="button"
          role="tab"
          :aria-selected="currentValue === item.value"
          :disabled="item.disabled"
          :class="
          cn(
            'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-medium tracking-[-0.01em] transition-all duration-300',
            size === 'sm' ? 'h-9 px-3.5 text-sm' : 'h-11 px-4.5 text-sm',
            stretch && 'flex-1',
            variant === 'line'
              ? currentValue === item.value
                ? 'bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_82%,transparent)] text-[var(--color-text)] shadow-[var(--shadow-xs)] after:absolute after:inset-x-4 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] hover:bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_58%,transparent)] hover:text-[var(--color-text)]'
              : currentValue === item.value
                ? 'bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_94%,transparent)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-muted)] hover:bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_62%,transparent)] hover:text-[var(--color-text)]',
            item.disabled && 'cursor-not-allowed opacity-50',
          )
        "
          @click="selectTab(item.value, item.disabled)"
      >
        <span>{{ item.label }}</span>
        <span
            v-if="item.badge !== undefined"
            class="rounded-full bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_84%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
        >
          {{ item.badge }}
        </span>
      </button>
    </div>

    <div class="pt-4">
      <slot :value="currentValue" />
      <template v-for="item in items" :key="`panel-${String(item.value)}`">
        <div v-show="currentValue === item.value" role="tabpanel">
          <slot :name="String(item.value)" />
        </div>
      </template>
    </div>
  </div>
</template>
