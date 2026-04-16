<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-vue-next'
import { cn } from '@/shared/utils/cn'

type MessageTone = 'info' | 'success' | 'warning' | 'error'

interface Props {
  tone?: MessageTone
  title?: string
  message?: string
  subtle?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'info',
  title: '',
  message: '',
  subtle: false,
})

const toneStyle = computed(() => {
  switch (props.tone) {
    case 'success':
      return {
        icon: CheckCircle2,
        color: 'var(--color-success)',
        background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
      }
    case 'warning':
      return {
        icon: TriangleAlert,
        color: 'var(--color-warning)',
        background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
      }
    case 'error':
      return {
        icon: AlertCircle,
        color: 'var(--color-danger)',
        background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
      }
    default:
      return {
        icon: Info,
        color: 'var(--color-primary)',
        background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
      }
  }
})
</script>

<template>
  <div
      :class="
            cn(
                'flex items-start gap-3 rounded-[var(--radius-md)] text-sm',
                props.subtle ? 'px-0 py-0' : 'px-3.5 py-3',
                props.class,
            )
        "
      :style="props.subtle ? { color: toneStyle.color } : { background: toneStyle.background }"
      role="status"
      aria-live="polite"
  >
    <component :is="toneStyle.icon" class="mt-0.5 h-5 w-5 shrink-0 pt-0.5" :style="{ color: toneStyle.color }" />

    <div class="min-w-0 flex-1">
      <p v-if="props.title" class="font-medium tracking-[-0.01em]" :style="{ color: toneStyle.color }">
        {{ props.title }}
      </p>
      <p v-if="props.message" class="text-muted leading-6">
        {{ props.message }}
      </p>
      <slot />
    </div>
  </div>
</template>
