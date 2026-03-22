<script setup lang="ts">
import { cn } from '@/shared/utils/cn'

interface Props {
  for?: string
  required?: boolean
  optional?: boolean
  muted?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  for: '',
  required: false,
  optional: false,
  muted: false,
})
</script>

<template>
  <label
      :for="props.for || undefined"
      :class="
            cn(
                'inline-flex items-center gap-1.5 text-sm font-medium',
                props.muted && 'text-muted',
                props.class,
            )
        "
  >
    <slot />

    <span v-if="props.required" aria-hidden="true" style="color: var(--color-danger)">
            *
        </span>

    <span v-else-if="props.optional" class="text-xs font-normal text-muted">
            可选
        </span>
  </label>
</template>