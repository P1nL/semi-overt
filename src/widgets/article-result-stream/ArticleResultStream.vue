<script setup lang="ts">
import type { ArticleCardVm } from '@/entities/article'
import { AnimatedArticleList } from '@/widgets/animated-article-list'
import { ArticleInfiniteMenu } from '@/widgets/article-infinite-menu'
import ResultViewToggle from './ResultViewToggle.vue'
import { RESULT_VIEW_MODE, type ResultViewMode } from './result-view'

const RESULT_VIEW_SWITCH_DURATION = {
  enter: 260,
  leave: 200,
}

withDefaults(
  defineProps<{
    items: ArticleCardVm[]
    view: ResultViewMode
    fullscreen?: boolean
    centerLabel?: string
    resultCount?: number
    showViewToggle?: boolean
  }>(),
  {
    fullscreen: false,
    centerLabel: '',
    resultCount: 0,
    showViewToggle: true,
  },
)

const emit = defineEmits<{
  'update:view': [value: ResultViewMode]
  'layout:view': [value: ResultViewMode]
}>()
</script>

<template>
  <section
    class="article-result-stream"
    :class="[`article-result-stream--${view}`, fullscreen && 'article-result-stream--fullscreen']"
    :style="{ '--result-view-slide-direction': view === RESULT_VIEW_MODE.LIST ? 1 : -1 }"
  >
    <div v-if="showViewToggle" class="article-result-stream__view-toggle">
      <ResultViewToggle :model-value="view" @update:model-value="emit('update:view', $event)" />
    </div>

    <Transition name="result-view-switch" mode="out-in" :duration="RESULT_VIEW_SWITCH_DURATION" @after-leave="emit('layout:view', view)">
      <div :key="view" class="article-result-stream__panel" :class="`article-result-stream__panel--${view}`">
        <ArticleInfiniteMenu
          v-if="view === RESULT_VIEW_MODE.INFINITE"
          :items="items"
          :fullscreen="fullscreen"
          :center-label="centerLabel"
          :result-count="resultCount"
        />

        <AnimatedArticleList v-else :items="items" />
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.article-result-stream {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-x: clip;
}

.article-result-stream__view-toggle {
  position: absolute;
  top: 1.25rem;
  right: 0;
  z-index: 20;
  display: flex;
  justify-content: flex-end;
}

.article-result-stream__panel {
  display: flex;
  min-width: 0;
  flex-direction: column;

}

.article-result-stream__panel--list {
  padding-top: 4.25rem;
}


.result-view-switch-enter-active,
.result-view-switch-leave-active {
  will-change: transform;
  pointer-events: none;
}

.result-view-switch-enter-active {
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.result-view-switch-leave-active {
  transition: transform 200ms cubic-bezier(0.4, 0, 1, 1);
}

.result-view-switch-enter-from {
  transform: translate3d(calc(var(--result-view-slide-direction) * 100%), 0, 0);
}

.result-view-switch-leave-to {
  transform: translate3d(calc(var(--result-view-slide-direction) * -100%), 0, 0);
}

.result-view-switch-enter-to,
.result-view-switch-leave-from {
  transform: translate3d(0, 0, 0);
}

@media (max-width: 640px) {
  .article-result-stream__view-toggle {
    top: 0.85rem;
    right: 0.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .result-view-switch-enter-active,
  .result-view-switch-leave-active {
    transition-duration: 1ms;
    transform: none;
  }
}
</style>
