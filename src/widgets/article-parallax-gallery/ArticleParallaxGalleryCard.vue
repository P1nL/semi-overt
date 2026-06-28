<script setup lang="ts">
import { computed } from 'vue'

import {
  ArticleAuthorMeta,
  ArticleMetaLine,
  type ArticleCardVm,
} from '@/entities/article'

const props = defineProps<{
  article: ArticleCardVm
}>()

const shouldShowHoverSummary = computed(() => Boolean(props.article.summary.text))
</script>

<template>
  <RouterLink
    :to="article.articlePath"
    class="article-parallax-card content-card-shell content-card-shell--regular content-card-shell--fill"
    :class="shouldShowHoverSummary && 'article-parallax-card--has-summary'"
  >
    <div
      class="article-parallax-card__cover"
      :style="{ backgroundColor: article.cover.color }"
    >
      <img
        v-if="article.cover.hasImage && article.cover.src"
        :src="article.cover.src"
        :alt="article.cover.alt || article.titleText"
        loading="lazy"
        decoding="async"
        class="article-parallax-card__cover-image"
      />
      <div v-else class="article-parallax-card__cover-placeholder" aria-hidden="true" />
    </div>

    <div class="article-parallax-card__body">
      <div class="article-parallax-card__default-content">
        <h3 class="article-parallax-card__title">
          {{ article.titleText }}
        </h3>

        <p
          v-if="article.summary.text"
          class="article-parallax-card__summary"
        >
          {{ article.summary.text }}
        </p>

        <ArticleMetaLine :meta="article.meta" />

        <div class="article-parallax-card__author">
          <ArticleAuthorMeta
            :author="article.author"
            size="sm"
            :clickable="false"
          />
        </div>
      </div>

      <div v-if="shouldShowHoverSummary" class="article-parallax-card__hover-summary" aria-hidden="true">
        <div class="article-parallax-card__hover-summary-viewport">
          <div class="article-parallax-card__hover-summary-track">
            <p class="article-parallax-card__hover-summary-text">{{ article.summary.text }}</p>
          </div>
        </div>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.article-parallax-card {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 100%;
  min-width: 0;
  text-decoration: none;
  box-shadow: none;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.article-parallax-card:hover {
  transform: translate3d(0, -4px, 0);
  box-shadow: none;
}

.article-parallax-card__cover {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  min-block-size: 10.9rem;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: calc(var(--radius-lg) + 2px);
  box-shadow: var(--shadow-xs);
}

.article-parallax-card__cover-image,
.article-parallax-card__cover-placeholder {
  display: block;
  min-width: 100%;
  min-height: 100%;
  width: 100%;
  height: 100%;
}

.article-parallax-card__cover-image {
  object-fit: cover;
  object-position: center;
}

.article-parallax-card__cover-placeholder {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.2));
}

.article-parallax-card__body {
  position: relative;
  overflow: hidden;
  display: flex;
  flex: 1;
  min-block-size: 0;
  min-width: 0;
  flex-direction: column;
  gap: 0.75rem;
}

.article-parallax-card__default-content {
  display: flex;
  flex: 1;
  min-block-size: 0;
  min-width: 0;
  flex-direction: column;
  gap: 0.75rem;
  transition:
    opacity 460ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.article-parallax-card__title {
  margin: 0;
  min-width: 0;
  font-size: 1.05rem;
  line-height: 1.5;
  font-weight: 600;
  letter-spacing: -0.025em;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.article-parallax-card__summary {
  min-width: 0;
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.65;
  color: color-mix(in srgb, var(--color-text-muted) 94%, var(--color-text) 6%);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.article-parallax-card__author {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.article-parallax-card__hover-summary {
  position: absolute;
  inset: 0;
  display: flex;
  min-width: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.article-parallax-card__hover-summary-viewport {
  width: 100%;
  overflow: hidden;
  container-type: size;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 22%, #000 62%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 22%, #000 62%, transparent 100%);
}

.article-parallax-card__hover-summary-track {
  transform: translate3d(0, 50cqh, 0);
  will-change: transform;
}

.article-parallax-card__hover-summary-text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.75;
  opacity: 0;
  color: color-mix(in srgb, var(--color-text-muted) 86%, var(--color-text) 14%);
  transition: opacity 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.article-parallax-card--has-summary:hover .article-parallax-card__default-content,
.article-parallax-card--has-summary:focus-visible .article-parallax-card__default-content,
.article-parallax-card--has-summary:focus-within .article-parallax-card__default-content {
  opacity: 0;
  transform: translate3d(0, -2px, 0);
}

.article-parallax-card--has-summary:hover .article-parallax-card__hover-summary,
.article-parallax-card--has-summary:focus-visible .article-parallax-card__hover-summary,
.article-parallax-card--has-summary:focus-within .article-parallax-card__hover-summary {
  opacity: 1;
  transition-delay: 80ms;
}

.article-parallax-card--has-summary:hover .article-parallax-card__hover-summary-text,
.article-parallax-card--has-summary:focus-visible .article-parallax-card__hover-summary-text,
.article-parallax-card--has-summary:focus-within .article-parallax-card__hover-summary-text {
  opacity: 1;
  transition-delay: 140ms;
}

.article-parallax-card--has-summary:hover .article-parallax-card__hover-summary-track,
.article-parallax-card--has-summary:focus-visible .article-parallax-card__hover-summary-track,
.article-parallax-card--has-summary:focus-within .article-parallax-card__hover-summary-track {
  animation: article-parallax-card-summary-scroll 18s linear infinite;
  animation-delay: 700ms;
}

@keyframes article-parallax-card-summary-scroll {
  0% {
    opacity: 1;
    transform: translate3d(0, 50cqh, 0);
  }

  92% {
    opacity: 1;
    transform: translate3d(0, calc(-100% - 18cqh), 0);
  }

  93% {
    opacity: 0;
    transform: translate3d(0, calc(-100% - 18cqh), 0);
  }

  94% {
    opacity: 0;
    transform: translate3d(0, 100cqh, 0);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 50cqh, 0);
  }
}

@media (min-width: 768px) {
  .article-parallax-card__cover {
    min-block-size: 11.6rem;
  }

  .article-parallax-card__title {
    font-size: 1.12rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-parallax-card__default-content,
  .article-parallax-card__hover-summary {
    transition-duration: 1ms;
    transition-delay: 0ms;
  }

  .article-parallax-card__hover-summary-text {
    transition-duration: 1ms;
    transition-delay: 0ms;
  }

  .article-parallax-card__hover-summary-track {
    animation: none;
    transform: translate3d(0, 50cqh, 0);
  }
}
</style>
