<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'
import { cn } from '@/shared/utils/cn'

interface Props {
  id?: string
  message?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  message: '',
})
</script>

<template>
  <p
      v-if="props.message || $slots.default"
      :id="props.id || undefined"
      :class="cn('flex items-start gap-1.5 text-xs leading-5', props.class)"
      style="color: var(--color-danger)"
      role="alert"
      aria-live="polite"
  >
    <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
    <span>
            <slot>{{ props.message }}</slot>
        </span>
  </p>
</template>