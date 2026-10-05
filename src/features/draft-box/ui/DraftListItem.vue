<script setup lang="ts">
import { computed } from 'vue'

import { ARTICLE_STATUS } from '@/entities/article'
import { ArticleStatusBadge } from '@/entities/article/ui'
import type { DraftBoxItem } from '@/features/draft-box/model'
import { AnimatedTrashIcon, Icon, Spinner } from '@/shared/components/base'
import { useDraftSwipe } from '../model/useDraftSwipe'

const props = withDefaults(
  defineProps<{
    item: DraftBoxItem
    deleting?: boolean
    active?: boolean
    swipeOwner?: boolean
  }>(),
  {
    deleting: false,
    active: true,
    swipeOwner: false,
  },
)

const emit = defineEmits<{
  open: [DraftBoxItem]
  delete: [DraftBoxItem]
  claim: []
}>()

const hasReviewFeedback = computed(() => {
  const status = props.item.status.value
  return status === ARTICLE_STATUS.RETURNED
})
const canDelete = computed(() => props.item.canDelete)
const titleText = computed(() => props.item.title?.trim() || '未命名文章')
const { root, content, rail, dragging, revealed, hinting, coarse, deleteExposed, hint, leaveHint, prepareClick, start, cancelGesture, captureClick, keyboardFocus, keydown, focusout } = useDraftSwipe({
  enabled: canDelete,
  active: computed(() => props.active),
  owner: computed(() => props.swipeOwner),
  busy: computed(() => props.deleting),
  claim: () => emit('claim'),
})
</script>

<template>
  <article
    ref="root"
    data-draft-reveal
    class="draft-item group"
    :class="{
      'draft-item--returned': hasReviewFeedback,
      'draft-item--swipeable': canDelete,
      'draft-item--dragging': dragging,
      'draft-item--revealed': revealed,
      'draft-item--hinting': hinting,
      'draft-item--coarse': coarse && canDelete,
    }"
    @pointerenter="hint"
    @pointerleave="leaveHint"
    @pointerdown.capture="prepareClick"
    @click.capture="captureClick"
    @lostpointercapture="cancelGesture"
    @keydown="keydown"
    @focusout="focusout"
  >
    <div ref="content" class="draft-item-content" @pointerdown="start" @dragstart.prevent>
      <button
        type="button"
        class="draft-item-open min-w-0 w-full text-left"
        @click="emit('open', item)"
        @focus="keyboardFocus"
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
          v-if="hasReviewFeedback && item.latestReason"
          class="draft-feedback-callout mt-3 flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-warning)]"
        >
          <Icon name="warning" :size="16" />
          <p class="min-w-0 flex-1 truncate">
            {{ item.latestReason }}
          </p>
        </div>
      </button>
    </div>
    <div v-if="canDelete" ref="rail" class="draft-item-delete-track" :inert="!deleteExposed" :aria-hidden="!deleteExposed">
      <button
        type="button"
        class="draft-swipe-delete"
        aria-label="删除文章"
        :aria-busy="deleting"
        :disabled="deleting || !deleteExposed"
        :tabindex="deleteExposed ? 0 : -1"
        @click="emit('delete', item)"
      >
        <Spinner v-if="deleting" size="sm" label="正在删除草稿" />
        <AnimatedTrashIcon v-else size="1.15rem" class="draft-delete-icon" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.draft-item {
  --draft-row-background: var(--color-draft-panel-bg);
  position: relative;
  overflow: hidden;
  isolation: isolate;
  border-radius: var(--radius-md);
}
.draft-item-content {
  position: relative;
  z-index: 1;
  width: 100%;
  min-width: 0;
  padding: 14px 8px;
  background: var(--draft-row-background);
  color: var(--color-draft-panel-text);
  transform: translate3d(0, 0, 0);
  touch-action: pan-y;
  user-select: none;
  cursor: auto;
  transition: background-color 180ms ease;
}
.draft-item--swipeable .draft-item-content { cursor: grab; }
.draft-item--dragging .draft-item-content { cursor: grabbing; }
.draft-item--dragging .draft-item-open { cursor: grabbing; }
.draft-item--dragging .draft-item-content,
.draft-item--hinting .draft-item-content,
.draft-item--dragging .draft-item-delete-track,
.draft-item--hinting .draft-item-delete-track { will-change: transform; }
.draft-item-open:focus-visible { outline: 2px solid var(--color-draft-panel-accent); outline-offset: -2px; border-radius: var(--radius-sm); }
.draft-feedback-callout { background: color-mix(in srgb, var(--color-warning) 20%, transparent); }
.draft-item-delete-track {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--color-draft-delete-bg);
  transform: translate3d(64px, 0, 0);
}
.draft-item--coarse .draft-item-delete-track { transform: none !important; }
.draft-swipe-delete {
  position: absolute;
  right: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 64px;
  height: 100%;
  padding: 8px 0;
  border: 0;
  background: var(--color-draft-delete-bg);
  color: var(--color-draft-delete-fg);
  font-size: 12px;
  font-weight: 500;
}
.draft-swipe-delete:focus-visible { outline: 2px solid var(--color-draft-delete-fg); outline-offset: -4px; }
.draft-swipe-delete:disabled { cursor: default; }
.draft-item--coarse .draft-item-content { width: calc(100% - 64px); transform: none !important; cursor: auto; }
@media (prefers-reduced-motion: reduce) {
  .draft-item-content, .draft-swipe-delete { transition: none; }
}
</style>
