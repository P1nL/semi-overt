<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

import type { DraftBoxItem } from '@/features/draft-box/model'
import { Button, Icon } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import DraftListItem from './DraftListItem.vue'

const AnimatedList = defineAsyncComponent(() => import('@/shared/components/AnimatedList.vue'))

withDefaults(
  defineProps<{
    items: DraftBoxItem[]
    loading?: boolean
    error?: string
    warning?: string
    deletingId?: number | string | null
    createLabel?: string
  }>(),
  {
    loading: false,
    error: '',
    warning: '',
    deletingId: null,
    createLabel: '新建文章',
  },
)

const emit = defineEmits<{
  open: [DraftBoxItem]
  delete: [DraftBoxItem]
  create: []
  retry: []
}>()

const DRAFT_LIST_VISIBLE_COUNT = 3

function getDraftItemKey(item: DraftBoxItem) {
  return item.id
}
</script>

<template>
  <section class="draft-list-shell space-y-3" :aria-busy="loading">
    <InlineMessage v-if="error" tone="error" :message="error" />
    <InlineMessage v-else-if="warning" tone="warning" :message="warning" />

    <div class="draft-list-content space-y-3">
      <AnimatedList
        v-if="items.length"
        :items="items"
        :active="!loading"
        :visible-count="DRAFT_LIST_VISIBLE_COUNT"
        :get-key="getDraftItemKey"
        class="draft-list"
      >
        <template #default="{ item }">
          <DraftListItem
            :item="item"
            :deleting="item.canDelete && String(deletingId) === String(item.id)"
            @open="emit('open', $event)"
            @delete="emit('delete', $event)"
          />
        </template>
      </AnimatedList>

      <Button
        type="button"
        variant="ghost"
        block
        class="draft-create-card min-h-[4rem] items-center gap-3 border-2 border-dashed px-5 py-3.5 text-left active:!scale-100"
        @click="emit('create')"
      >
        <span class="draft-create-card__icon inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)]">
          <Icon name="plus" :size="17" />
        </span>
        <span class="block text-base font-medium tracking-[-0.01em] text-[var(--color-text-muted)]">
          {{ createLabel }}
        </span>
      </Button>
    </div>
  </section>
</template>

<style scoped>
.draft-list-shell,
.draft-list-content {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.draft-list {
  display: flex;
  max-height: min(25.25rem, calc(100vh - var(--header-height, 4rem) - 10rem));
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 0.25rem;
  scrollbar-gutter: stable;
}

.draft-create-card,
.draft-create-card:hover,
.draft-create-card:active {
  justify-content: flex-start;
  border-radius: var(--radius-lg);
  border-color: color-mix(in srgb, var(--color-text-faint) 42%, transparent);
  background: color-mix(in srgb, var(--color-surface-glass-strong) 72%, transparent);
  transform: none !important;
  transition:
    border-color 220ms ease,
    background-color 220ms ease,
    color 220ms ease,
    transform 0s;
}

.draft-create-card__icon {
  background: color-mix(in srgb, var(--color-surface) 82%, transparent);
}
</style>
