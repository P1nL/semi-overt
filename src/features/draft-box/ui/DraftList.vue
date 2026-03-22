<script setup lang="ts">
import type { DraftBoxItem } from '@/features/draft-box/model'
import { Button, Icon } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import DraftListItem from './DraftListItem.vue'

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
</script>

<template>
  <section class="space-y-3">
    <InlineMessage v-if="error" tone="error" :message="error" />
    <InlineMessage v-else-if="warning" tone="warning" :message="warning" />

    <div v-if="loading" class="space-y-2">
      <div
        v-for="index in 3"
        :key="index"
        class="surface-2 h-24 animate-pulse rounded-[var(--radius-lg)]"
      />
    </div>

    <div v-else class="space-y-3">
      <TransitionGroup
        v-if="items.length"
        name="draft-list"
        tag="div"
        class="draft-list"
      >
        <div
          v-for="item in items"
          :key="item.id"
          class="draft-list__item"
        >
          <DraftListItem
            :item="item"
            :deleting="item.canDelete && String(deletingId) === String(item.id)"
            @open="emit('open', $event)"
            @delete="emit('delete', $event)"
          />
        </div>
      </TransitionGroup>

      <Button
        type="button"
        variant="ghost"
        block
        class="draft-create-card h-18 items-center gap-3 border-2 border-dashed px-5 text-left active:!scale-100"
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
.draft-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.draft-list__item {
  position: relative;
}

.draft-list-enter-active,
.draft-list-leave-active {
  overflow: hidden;
  transition:
    opacity 220ms ease,
    transform 260ms ease,
    max-height 260ms ease,
    filter 220ms ease;
}

.draft-list-enter-from,
.draft-list-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.985);
  max-height: 0;
  filter: blur(4px);
}

.draft-list-enter-to,
.draft-list-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-height: 12rem;
  filter: blur(0);
}

.draft-list-move {
  transition: transform 260ms ease;
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
