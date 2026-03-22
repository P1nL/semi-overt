<!-- src/entities/review/ui/ReviewActionTag.vue -->
<script setup lang="ts">
import { Badge } from '@/shared/components'
import type { ReviewActionVm } from '../model/review.types'

withDefaults(
    defineProps<{
      action: ReviewActionVm
      size?: 'sm' | 'md'
      outlined?: boolean
    }>(),
    {
      size: 'sm',
      outlined: false,
    },
)
</script>

<template>
  <Badge :variant="action.variant" :size="size" :outlined="outlined">
    {{ action.label }}
  </Badge>
</template>