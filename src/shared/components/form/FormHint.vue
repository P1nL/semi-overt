<script setup lang="ts">
import { cn } from '@/shared/utils/cn'

interface Props {
  id?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
})
</script>

<template>
  <p
      :id="props.id || undefined"
      :class="cn('text-xs leading-5 text-muted', props.class)"
  >
    <slot />
  </p>
</template>