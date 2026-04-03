<script setup lang="ts">
import { ref, watch } from 'vue'

import { useTocSync } from '@/features/toc-sync'
import TocAnchorList from './TocAnchorList.vue'

const props = withDefaults(
    defineProps<{
      syncKey?: string | number
      selector?: string
      title?: string
      offset?: number
      scrollContainer?: HTMLElement | null
      transparent?: boolean
    }>(),
    {
      syncKey: '',
      selector: '.article-reader-body h2, .article-reader-body h3, .article-reader-body h4',
      title: '目录',
      offset: 88,
      scrollContainer: null,
      transparent: false,
    },
)

const {
  headings,
  activeId,
  resetHeadings,
  scrollToHeading,
  refreshHeadingsFromDom,
  syncObserver,
} = useTocSync({
  selector: props.selector,
  offset: props.offset,
  getScrollContainer: () => props.scrollContainer,
})

const expanded = ref(false)

function handleFocusOut(event: FocusEvent) {
  const currentTarget = event.currentTarget as HTMLElement | null
  const relatedTarget = event.relatedTarget as Node | null

  if (!currentTarget?.contains(relatedTarget)) {
    expanded.value = false
  }
}

watch(
    () => [props.syncKey, props.scrollContainer],
    () => {
      resetHeadings()

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          refreshHeadingsFromDom()
          void syncObserver()
        })
      })
    },
)
</script>

<template>
  <aside
      class="article-toc"
      :class="{
        'article-toc--expanded': expanded,
        'article-toc--transparent': transparent,
      }"
      @mouseenter="expanded = true"
      @mouseleave="expanded = false"
      @focusin="expanded = true"
      @focusout="handleFocusOut"
  >
    <TocAnchorList
        v-if="headings.length"
        :headings="headings"
        :active-id="activeId"
        :expanded="expanded"
        @select="scrollToHeading"
    />

    <div
        v-else
        class="article-toc__empty"
        :class="{ 'article-toc__empty--visible': expanded }"
    >
      {{ title }}
    </div>
  </aside>
</template>

<style scoped>
.article-toc {
  --article-toc-anchor-gap: 0.55rem;
  box-sizing: border-box;
  position: relative;
  isolation: isolate;
  display: flex;
  width: max-content;
  max-width: 2.6rem;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-end;
  margin-left: auto;
  padding: 0.25rem 0;
  background: transparent;
  transition:
    max-width 400ms ease,
    padding 400ms ease;
}

.article-toc--expanded {
  max-width: min(18rem, calc(100vw - 2rem));
  padding: 0.25rem 0 0.25rem 1.1rem;
}

.article-toc--expanded::before {
  content: '';
  position: absolute;
  inset: 0 calc(var(--article-toc-anchor-gap) * -1) 0 0;
  z-index: -1;
  border: 1px solid color-mix(in srgb, var(--color-border) 78%, white 18%);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface) 96%, transparent);
  box-shadow: 0 20px 52px rgb(15 23 42 / 0.12);
  backdrop-filter: blur(18px);
  pointer-events: none;
}

.article-toc--transparent.article-toc--expanded::before {
  background: transparent;
  backdrop-filter: none;
}

.article-toc__empty {
  overflow: hidden;
  max-width: 0;
  opacity: 0;
  text-align: right;
  white-space: nowrap;
  color: var(--color-text-faint);
  transition: max-width 300ms ease, opacity 300ms ease;
}

.article-toc__empty--visible {
  max-width: 100%;
  opacity: 1;
}

@media (max-width: 1023px) {
  .article-toc,
  .article-toc--expanded {
    width: 100%;
    max-width: none;
    align-items: stretch;
    padding: 0;
  }

  .article-toc::before,
  .article-toc--expanded::before {
    content: none;
  }

  .article-toc__empty,
  .article-toc__empty--visible {
    max-width: 100%;
    opacity: 1;
    text-align: left;
  }
}
</style>
