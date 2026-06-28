<script setup lang="ts">
import { ArticleCard, type ArticleCardVm } from '@/entities/article'
import { ArticleParallaxGallery } from '@/widgets/article-parallax-gallery'
import { RESULT_VIEW_MODE, type ResultViewMode } from './result-view'

const RESULT_VIEW_SWITCH_DURATION = {
  enter: 760,
  leave: 320,
}

const props = withDefaults(
  defineProps<{
    items: ArticleCardVm[]
    view: ResultViewMode
  }>(),
  {},
)
</script>

<template>
  <section class="article-result-stream">
    <Transition name="result-view-switch" mode="out-in" :duration="RESULT_VIEW_SWITCH_DURATION">
      <div :key="view" class="article-result-stream__panel" :class="`article-result-stream__panel--${view}`">
        <ArticleParallaxGallery
          v-if="view === RESULT_VIEW_MODE.GALLERY"
          :items="items"
        />

        <div v-else-if="view === RESULT_VIEW_MODE.LIST" class="article-result-stream__list">
          <div
            v-for="article in items"
            :key="article.id"
          >
            <ArticleCard :article="article" compact />
          </div>
        </div>

        <div v-else class="article-result-stream__grid">
          <div
            v-for="article in items"
            :key="article.id"
          >
            <ArticleCard :article="article" fill-height />
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.article-result-stream {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.article-result-stream__panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.article-result-stream__list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.article-result-stream__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

.article-result-stream__list > *,
.article-result-stream__grid > * {
  min-width: 0;
  --result-item-enter-delay: 0ms;
}

.article-result-stream__list > * {
  transition-delay: var(--result-item-enter-delay);
}

.article-result-stream__grid > :nth-child(3n + 1) {
  --result-item-enter-delay: 0ms;
}

.article-result-stream__grid > :nth-child(3n + 2) {
  --result-item-enter-delay: 52ms;
}

.article-result-stream__grid > :nth-child(3n) {
  --result-item-enter-delay: 104ms;
}

.article-result-stream__list > :nth-child(1) { --result-item-enter-delay: 0ms; }
.article-result-stream__list > :nth-child(2) { --result-item-enter-delay: 32ms; }
.article-result-stream__list > :nth-child(3) { --result-item-enter-delay: 64ms; }
.article-result-stream__list > :nth-child(4) { --result-item-enter-delay: 96ms; }
.article-result-stream__list > :nth-child(5) { --result-item-enter-delay: 128ms; }
.article-result-stream__list > :nth-child(6) { --result-item-enter-delay: 160ms; }
.article-result-stream__list > :nth-child(n + 7) { --result-item-enter-delay: 192ms; }

.result-view-switch-enter-active,
.result-view-switch-leave-active {
  transition: opacity 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.result-view-switch-enter-from,
.result-view-switch-leave-to {
  opacity: 0;
}

.article-result-stream__panel--gallery.result-view-switch-enter-active {
  transition:
    opacity 520ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
}

.article-result-stream__panel--gallery.result-view-switch-enter-from {
  opacity: 0;
  transform: translate3d(0, 8px, 0);
}

.article-result-stream__panel--gallery.result-view-switch-enter-to {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

.article-result-stream__panel--list.result-view-switch-enter-active,
.article-result-stream__panel--grid.result-view-switch-enter-active {
  transition: none;
}

.article-result-stream__panel--list.result-view-switch-enter-from,
.article-result-stream__panel--grid.result-view-switch-enter-from,
.article-result-stream__panel--list.result-view-switch-enter-to,
.article-result-stream__panel--grid.result-view-switch-enter-to {
  opacity: 1;
}

.article-result-stream__panel--list .article-result-stream__list > *,
.article-result-stream__panel--grid .article-result-stream__grid > * {
  animation: result-item-enter 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--result-item-enter-delay);
}

.article-result-stream__panel--list.result-view-switch-leave-active .article-result-stream__list > *,
.article-result-stream__panel--grid.result-view-switch-leave-active .article-result-stream__grid > * {
  transition:
    opacity 240ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.article-result-stream__panel--list.result-view-switch-leave-to .article-result-stream__list > *,
.article-result-stream__panel--grid.result-view-switch-leave-to .article-result-stream__grid > * {
  opacity: 0;
  transform: translate3d(0, -4px, 0);
}

@keyframes result-item-enter {
  from {
    opacity: 0;
    transform: translate3d(0, 10px, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@media (min-width: 700px) {
  .article-result-stream__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1180px) {
  .article-result-stream__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
