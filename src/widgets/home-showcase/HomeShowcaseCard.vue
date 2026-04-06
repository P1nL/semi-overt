<script setup lang="ts">
import { computed } from 'vue'

import type { ArticleCardVm } from '@/entities/article/model/article.types'

const props = withDefaults(
  defineProps<{
    article: ArticleCardVm
    categoryLabel: string
    emphasis?: 'hero' | 'regular'
    cropped?: boolean
    revealed?: boolean
    delay?: number
  }>(),
  {
    emphasis: 'regular',
    cropped: false,
    revealed: false,
    delay: 0,
  },
)

const imageLoading = computed<'eager' | 'lazy'>(() => (props.emphasis === 'hero' ? 'eager' : 'lazy'))
const imageDecoding = computed<'sync' | 'async'>(() => (props.emphasis === 'hero' ? 'sync' : 'async'))
const imageFetchPriority = computed<'high' | 'auto'>(() => (props.emphasis === 'hero' ? 'high' : 'auto'))

const cardStyle = computed(() => ({
  '--card-accent': props.article.cover.color,
  '--card-delay': `${props.delay}ms`,
}))
</script>

<template>
  <RouterLink
    :to="article.articlePath"
    class="home-showcase-card"
    :class="{
      'home-showcase-card--cropped': cropped,
      'home-showcase-card--revealed': revealed,
    }"
    :style="cardStyle"
    :aria-label="`${categoryLabel}：${article.titleText}`"
  >
    <div class="home-showcase-card__media">
      <img
        v-if="article.cover.hasImage && article.cover.src"
        :src="article.cover.src"
        :alt="article.cover.alt || article.titleText"
        :loading="imageLoading"
        :decoding="imageDecoding"
        :fetchpriority="imageFetchPriority"
        class="home-showcase-card__image"
      />
    </div>

    <div class="home-showcase-card__shade" />

    <div class="home-showcase-card__content">
      <span class="home-showcase-card__label">
        {{ categoryLabel }}
      </span>

      <h3 class="home-showcase-card__title line-clamp-2">
        {{ article.titleText }}
      </h3>
    </div>
  </RouterLink>
</template>

<style scoped>
.home-showcase-card {
  --card-accent: rgb(148 163 184);
  --card-delay: 0ms;
  --card-radius: clamp(2rem, 5vw, 3.25rem);
  position: relative;
  display: block;
  aspect-ratio: 1;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid rgb(255 255 255 / 0.34);
  border-radius: var(--card-radius);
  background:
    radial-gradient(circle at 20% 18%, rgb(255 255 255 / 0.38), transparent 24%),
    linear-gradient(
      155deg,
      color-mix(in srgb, var(--card-accent) 76%, white 24%),
      color-mix(in srgb, var(--card-accent) 58%, rgb(15 23 42) 42%)
    );
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.34);
  color: rgb(248 250 252);
  opacity: 0;
  transform: translateY(28px) scale(0.96);
  transition:
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 320ms ease,
    border-color 240ms ease;
}

.home-showcase-card--revealed {
  animation: home-showcase-card-rise 680ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--card-delay, 0ms);
}

.home-showcase-card__media,
.home-showcase-card__shade {
  position: absolute;
  inset: 0;
}

.home-showcase-card__media {
  z-index: -3;
}

.home-showcase-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.home-showcase-card__shade {
  z-index: -2;
  background:
    linear-gradient(180deg, rgb(15 23 42 / 0.06), rgb(15 23 42 / 0.22) 42%, rgb(15 23 42 / 0.78)),
    radial-gradient(circle at 50% 18%, transparent 0 38%, rgb(15 23 42 / 0.22) 82%, rgb(15 23 42 / 0.52));
}

.home-showcase-card__content {
  position: absolute;
  inset: clamp(1.1rem, 4vw, 1.75rem);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
}

.home-showcase-card__label {
  display: inline-flex;
  width: fit-content;
  max-width: 70%;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(255 255 255 / 0.2);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.12);
  padding: 0.45rem 0.85rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  line-height: 1;
  text-transform: uppercase;
  backdrop-filter: blur(10px);
}

.home-showcase-card__title {
  margin: 0;
  max-width: 76%;
  font-size: clamp(1.35rem, 3.2vw, 2.4rem);
  font-weight: 650;
  line-height: 1.06;
  letter-spacing: -0.05em;
  text-wrap: balance;
  text-shadow: 0 12px 28px rgb(15 23 42 / 0.48);
}

.home-showcase-card--cropped .home-showcase-card__content {
  inset:
    clamp(1rem, 3vw, 1.45rem)
    clamp(1rem, 3vw, 1.45rem)
    auto;
  justify-content: flex-start;
  gap: 0.7rem;
}

.home-showcase-card--cropped .home-showcase-card__title {
  max-width: 64%;
  font-size: clamp(1rem, 2.15vw, 1.5rem);
  line-height: 1.02;
}

.home-showcase-card:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-primary) 78%, white 22%);
  outline-offset: 5px;
}

@media (hover: hover) and (pointer: fine) {
  .home-showcase-card:hover {
    border-color: rgb(255 255 255 / 0.4);
  }
}

@media (max-width: 767px) {
  .home-showcase-card__title {
    max-width: 82%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-showcase-card,
  .home-showcase-card--revealed {
    opacity: 1;
    transform: none;
    animation: none;
    transition: none;
  }
}

@keyframes home-showcase-card-rise {
  0% {
    opacity: 0;
    transform: translateY(28px) scale(0.96);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
