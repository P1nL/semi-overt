<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'

interface Props {
  as?: keyof HTMLElementTagNameMap
  top?: number | string
  bordered?: boolean
  blurred?: boolean
  fullWidth?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'div',
  top: 0,
  bordered: true,
  blurred: true,
  fullWidth: false,
  class: '',
})

const styleValue = computed(() => ({
  top: typeof props.top === 'number' ? `${props.top}px` : props.top,
}))
</script>

<template>
  <component
      :is="props.as"
      :style="styleValue"
      :class="
            cn(
                'sticky z-20',
                props.fullWidth ? 'w-full' : '',
                props.class,
            )
        "
  >
    <div
        :class="
                cn(
                    'rounded-[var(--radius-lg)] px-3 py-3 shadow-[var(--shadow-xs)] md:px-4',
                    props.bordered && 'border',
                    props.blurred && 'backdrop-blur-xl',
                )
            "
        :style="{
                borderColor: props.bordered ? 'var(--color-border)' : undefined,
                background: 'color-mix(in srgb, var(--color-surface-glass-strong) 88%, transparent)',
                boxShadow: 'var(--shadow-sm), var(--shadow-inset)',
            }"
    >
      <slot />
    </div>
  </component>
</template>
