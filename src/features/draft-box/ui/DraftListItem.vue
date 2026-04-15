<script setup lang="ts">
import { computed } from 'vue'

import { ARTICLE_STATUS } from '@/entities/article'
import { ArticleStatusBadge } from '@/entities/article/ui'
import type { DraftBoxItem } from '@/features/draft-box/model'
import { AnimatedTrashIcon, Icon, IconButton } from '@/shared/components/base'

const props = withDefaults(
  defineProps<{
    item: DraftBoxItem
    deleting?: boolean
  }>(),
  {
    deleting: false,
  },
)

const emit = defineEmits<{
  open: [DraftBoxItem]
  delete: [DraftBoxItem]
}>()

const isReturned = computed(() => props.item.status.value === ARTICLE_STATUS.RETURNED)
const canDelete = computed(() => props.item.canDelete)
const titleText = computed(() => props.item.title?.trim() || '未命名文章')
</script>

<template>
  <article
    class="draft-item group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_82%,transparent)] p-4 transition-colors duration-200"
    :class="isReturned ? 'draft-item--returned border-[color-mix(in_srgb,var(--color-warning)_72%,var(--color-border))]' : ''"
  >
    <div class="flex items-start gap-3">
      <button
        type="button"
        class="min-w-0 flex-1 text-left"
        @click="emit('open', item)"
      >
        <h4 class="truncate text-lg font-semibold tracking-[-0.02em] text-[var(--color-text)]">
          {{ titleText }}
        </h4>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <ArticleStatusBadge :status="item.status" />
          <span class="text-sm text-[var(--color-text-faint)]">
            {{ item.updatedAt }} · {{ item.wordCountText }}
          </span>
        </div>

        <div
          v-if="isReturned && item.latestReason"
          class="draft-feedback-callout mt-3 flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-warning)]"
        >
          <Icon name="warning" :size="16" />
          <p class="min-w-0 flex-1 truncate">
            {{ item.latestReason }}
          </p>
        </div>
      </button>

      <div class="draft-item-actions shrink-0">
        <IconButton
          type="button"
          size="sm"
          pill
          variant="ghost"
          ariaLabel="打开文章"
          class="draft-action-button"
          @click="emit('open', item)"
        >
          <Icon name="edit" :size="16" />
        </IconButton>

        <IconButton
          v-if="canDelete"
          type="button"
          size="sm"
          pill
          variant="ghost"
          ariaLabel="删除文章"
          class="draft-action-button draft-delete-button"
          :loading="deleting"
          :disabled="deleting"
          @click="emit('delete', item)"
        >
          <AnimatedTrashIcon size="1rem" class="draft-delete-icon" />
        </IconButton>
      </div>
    </div>
  </article>
</template>

<style scoped>
.draft-item {
  transition:
    border-color 220ms ease,
    background-color 220ms ease,
    transform 220ms ease;
}

.draft-item:hover {
  border-color: color-mix(in srgb, var(--color-border-strong) 86%, white 10%);
}

.draft-item--returned {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-warning) 12%, var(--color-surface-glass-strong)),
    color-mix(in srgb, var(--color-surface-glass-strong) 82%, transparent)
  );
}

.draft-feedback-callout {
  background: color-mix(in srgb, var(--color-warning) 20%, transparent);
}

.draft-item-actions {
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transform: translateX(8px);
  pointer-events: none;
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.group:hover .draft-item-actions,
.group:focus-within .draft-item-actions {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.draft-action-button {
  color: var(--color-text-faint);
  background: color-mix(in srgb, var(--color-surface) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border) 88%, transparent);
  transition:
    color 180ms ease,
    background-color 180ms ease,
    border-color 180ms ease,
    transform 180ms ease;
}

.draft-action-button:hover {
  color: var(--color-text);
  border-color: color-mix(in srgb, var(--color-border-strong) 88%, transparent);
  transform: translateY(-1px);
}

.draft-delete-button {
  transition:
    color 180ms ease,
    background-color 180ms ease,
    border-color 180ms ease,
    transform 180ms ease;
}

.draft-delete-button:hover {
  color: color-mix(in srgb, var(--color-danger) 82%, var(--color-text));
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  border-color: color-mix(in srgb, var(--color-danger) 32%, var(--color-border));
}

.draft-delete-icon {
  transition: color 180ms ease;
}

.draft-delete-button:hover :deep(.draft-delete-icon) {
  color: inherit;
}
</style>
