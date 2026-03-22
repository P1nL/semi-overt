<!-- src/entities/article/ui/ArticleCardSkeleton.vue -->
<script setup lang="ts">
import { Skeleton } from '@/shared/components'

withDefaults(
    defineProps<{
      compact?: boolean
      fillHeight?: boolean
    }>(),
    {
      compact: false,
      fillHeight: false,
    },
)
</script>

<template>
  <div
      :class="
            compact
                ? 'content-card-shell content-card-shell--compact flex'
                : [
                  'content-card-shell content-card-shell--regular flex flex-col',
                  fillHeight && 'content-card-shell--fill',
                ]
        "
  >
    <Skeleton
      variant="image"
      width="100%"
      :height="compact ? '88px' : fillHeight ? '100%' : '180px'"
      rounded
      :class="!compact && fillHeight ? 'min-h-[18rem] flex-1' : ''"
    />
    <div class="space-y-3">
      <Skeleton variant="title" width="70%" />
      <Skeleton variant="text" :lines="2" />
      <Skeleton variant="text" width="45%" />
    </div>
  </div>
</template>
