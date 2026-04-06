<script setup lang="ts">
import type { ArticleCardVm } from '@/entities/article/model/article.types'
import { ArticleAuthorMeta, ArticleMetaLine } from '@/entities/article/ui'

defineProps<{
  article: ArticleCardVm
}>()
</script>

<template>
  <RouterLink
    :to="article.articlePath"
    class="article-parallax-card content-card-shell content-card-shell--regular content-card-shell--fill"
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
  transform: translate3d(0, -8px, 0);
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
  width: 100%;
  height: 100%;
}

.article-parallax-card__cover-image {
  object-fit: cover;
}

.article-parallax-card__cover-placeholder {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.2));
}

.article-parallax-card__body {
  display: flex;
  flex: 1;
  min-block-size: 0;
  min-width: 0;
  flex-direction: column;
  gap: 0.75rem;
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

@media (min-width: 768px) {
  .article-parallax-card__cover {
    min-block-size: 11.6rem;
  }

  .article-parallax-card__title {
    font-size: 1.12rem;
  }
}
</style>
