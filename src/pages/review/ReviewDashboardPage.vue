<script setup lang="ts">
import { computed } from 'vue'

import { Button, EmptyState } from '@/shared/components/base'
import { usePendingReviewsQuery } from '@/shared/api/queries'
import { SectionHeader } from '@/shared/components/layout'
import { getErrorMessage } from '@/shared/utils/error'
import { AppHeader } from '@/widgets/app-header'
import { ReviewQueueStrip } from '@/widgets/review-queue-strip'

const pendingReviewsQuery = usePendingReviewsQuery(1, 10)
const pendingItems = computed(() => pendingReviewsQuery.data.value?.list ?? [])
const pageError = computed(() =>
  pendingReviewsQuery.error.value
    ? getErrorMessage(pendingReviewsQuery.error.value, 'Failed to load the review queue.')
    : '',
)

function refreshPending() {
  void pendingReviewsQuery.refetch()
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <section class="surface-1 rounded-[var(--radius-xl)] p-5 sm:p-6 md:p-8">
        <SectionHeader title="Review queue" description="Process pending articles and keep the editorial flow moving.">
          <template #actions>
            <Button type="button" variant="secondary" pill class="w-full sm:w-auto" :loading="pendingReviewsQuery.isFetching.value" @click="refreshPending">
              Refresh queue
            </Button>
          </template>
        </SectionHeader>
      </section>

      <ReviewQueueStrip
        :items="pendingItems"
        :loading="pendingReviewsQuery.isFetching.value"
      />

      <div
        v-if="!pendingReviewsQuery.isFetching.value && !pendingItems.length && pageError"
        class="surface-1 rounded-[var(--radius-xl)] p-8"
      >
        <EmptyState
          title="Unable to load reviews"
          :description="pageError"
          emoji="!"
        />
      </div>
    </main>
  </div>
</template>
