<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

interface Props {
  tone?: StatusTone
  pulse?: boolean
  label?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'neutral',
  pulse: false,
  label: '',
  class: '',
})

const color = computed(() => {
  switch (props.tone) {
    case 'success':
      return 'var(--color-success)'
    case 'warning':
      return 'var(--color-warning)'
    case 'danger':
      return 'var(--color-danger)'
    case 'info':
      return 'var(--color-primary)'
    default:
      return 'var(--color-text-muted)'
  }
})
</script>

<template>
    <span class="inline-flex items-center gap-2" :class="props.class">
        <span class="relative flex h-2.5 w-2.5">
            <span
                v-if="props.pulse"
                class="absolute inset-0 rounded-full animate-ping"
                :style="{ background: color, opacity: 0.3 }"
            />
            <span class="relative h-2.5 w-2.5 rounded-full" :style="{ background: color }" />
        </span>

        <span v-if="props.label" class="text-sm text-muted">
            {{ props.label }}
        </span>
    </span>
</template>