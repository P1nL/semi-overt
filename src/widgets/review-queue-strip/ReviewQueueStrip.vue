<script setup lang="ts">
import { EmptyState } from '@/shared/components/base'
import type { PendingReviewItemVm } from '@/entities/review/model/review.types'
import ReviewQueueItem from './ReviewQueueItem.vue'

withDefaults(
    defineProps<{
      items?: PendingReviewItemVm[]
      loading?: boolean
    }>(),
    {
      items: () => [],
      loading: false,
    },
)
</script>

<template>
  <section class="space-y-3">
    <div v-if="loading" class="overflow-x-auto pb-2">
      <div class="grid min-w-full grid-flow-col auto-cols-[15.5rem] gap-3 sm:auto-cols-[19rem] xl:auto-cols-[calc((100%-1.5rem)/3)]">
        <div
            v-for="i in 3"
            :key="i"
            class="surface-2 h-40 animate-pulse rounded-[var(--radius-xl)]"
        />
      </div>
    </div>

    <div v-else-if="items.length" class="overflow-x-auto pb-2">
      <div class="grid min-w-full grid-flow-col auto-cols-[15.5rem] gap-3 sm:auto-cols-[19rem] xl:auto-cols-[calc((100%-1.5rem)/3)]">
        <ReviewQueueItem
            v-for="item in items"
            :key="item.id"
            :item="item"
        />
      </div>
    </div>

    <EmptyState
        v-else
        title="No pending reviews"
        description=""
        emoji="🙂"
        size="sm"
    />
  </section>
</template>
