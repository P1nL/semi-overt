<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { Button, EmptyState } from '@/shared/components/base'
import { SectionHeader } from '@/shared/components/layout'
import { getErrorMessage } from '@/shared/utils/error'
import { useReviewStore } from '@/stores/review'
import { AppHeader } from '@/widgets/app-header'
import { ReviewQueueStrip } from '@/widgets/review-queue-strip'

const reviewStore = useReviewStore()
const pageError = ref('')

async function loadPending() {
  pageError.value = ''

  try {
    await reviewStore.loadPendingList()
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Failed to load the review queue.')
  }
}

onMounted(() => {
  void loadPending()
})
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <section class="surface-1 rounded-[var(--radius-xl)] p-6 md:p-8">
        <SectionHeader title="Review queue" description="Process pending articles and keep the editorial flow moving.">
          <template #actions>
            <Button type="button" variant="secondary" pill :loading="reviewStore.loading" @click="loadPending">
              Refresh queue
            </Button>
          </template>
        </SectionHeader>
      </section>

      <ReviewQueueStrip :items="reviewStore.pendingList" :loading="reviewStore.loading" />

      <div v-if="!reviewStore.loading && !reviewStore.pendingList.length && pageError" class="surface-1 rounded-[var(--radius-xl)] p-8">
        <EmptyState
            title="Unable to load reviews"
            :description="pageError"
            emoji="!"
        />
      </div>
    </main>
  </div>
</template>
