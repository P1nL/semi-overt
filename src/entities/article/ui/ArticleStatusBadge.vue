<!-- src/entities/article/ui/ArticleStatusBadge.vue -->
<script setup lang="ts">
import { Badge } from '@/shared/components'
import type { ArticleStatusVm } from '../model/article.types'

withDefaults(
    defineProps<{
      status: ArticleStatusVm
      size?: 'sm' | 'md'
      dot?: boolean
      outlined?: boolean
    }>(),
    {
      size: 'sm',
      dot: false,
      outlined: false,
    },
)
</script>

<template>
  <Badge :variant="status.variant" :size="size" :dot="dot" :outlined="outlined">
    {{ status.label }}
  </Badge>
</template>