<!-- src/entities/category/ui/CategoryBadge.vue -->
<script setup lang="ts">
import { Badge } from '@/shared/components'
import type { CategoryVm } from '../model/category.types'

withDefaults(
    defineProps<{
      category: CategoryVm
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
  <Badge :variant="category.isActive ? 'primary' : 'info'" :size="size" :outlined="outlined">
    {{ category.label }}
  </Badge>
</template>