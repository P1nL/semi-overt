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
    <div class="home-showcase-card__header">
<!--      <span class="home-showcase-card__label">-->
<!--        {{ categoryLabel }}-->
<!--      </span>-->
    </div>

    <div class="home-showcase-card__media-shell">
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
        <div v-else class="home-showcase-card__placeholder" />

        <div class="home-showcase-card__title-wrap">
          <h3 class="home-showcase-card__title line-clamp-3">
            {{ article.titleText }}
          </h3>
        </div>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.home-showcase-card {
  --card-accent: rgb(148 163 184);
  --card-delay: 0ms;
  --card-radius: clamp(2rem, 5vw, 3.25rem);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(0.9rem, 2vw, 1.2rem);
  aspect-ratio: 1;
  overflow: hidden;
  isolation: isolate;
  padding: clamp(1rem, 3vw, 1.35rem);
  border: 1px solid color-mix(in srgb, var(--card-accent) 56%, rgb(232 238 245) 44%);
  border-radius: var(--card-radius);
  background:
    linear-gradient(
      155deg,
      color-mix(in srgb, var(--card-accent) 84%, rgb(236 241 247) 16%),
      color-mix(in srgb, var(--card-accent) 56%, rgb(12 18 30) 44%)
    );
  box-shadow:
    0 24px 60px rgb(15 23 42 / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.18);
  color: rgb(248 250 252);
  opacity: 0;
  transform: translateY(28px) scale(0.96);
  transition:
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 320ms ease,
    border-color 240ms ease,
    background-color 240ms ease;
}

.home-showcase-card::before {
  content: '';
  position: absolute;
  inset: auto auto -18% -8%;
  width: 72%;
  aspect-ratio: 1;
  border-radius: 999px;
  background: color-mix(in srgb, rgb(255 255 255 / 16%) 22%, transparent);
  filter: blur(36px);
  opacity: 0.4;
  pointer-events: none;
}

.home-showcase-card--revealed {
  animation: home-showcase-card-rise 680ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--card-delay, 0ms);
}

.home-showcase-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.home-showcase-card__label,
.home-showcase-card__chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  line-height: 1;
}

.home-showcase-card__label {
  padding: 0.45rem 0.85rem;
  background: color-mix(in srgb, var(--card-accent) 28%, rgb(235 241 247) 72%);
  color: rgb(248 250 252);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.home-showcase-card__chip {
  padding: 0.38rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--card-accent) 24%, rgb(226 234 242) 76%);
  background: rgb(20 28 40);
  color: rgb(226 232 240);
  font-size: 0.72rem;
  font-weight: 600;
}

.home-showcase-card__media-shell {
  position: relative;
  inset: auto;
  flex: 1;
  min-height: 0;
}

.home-showcase-card__media {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: clamp(1.4rem, 4vw, 2.25rem);
  border: 1px solid rgb(255 255 255 / 0.12);
  background:
    linear-gradient(165deg, rgb(255 255 255 / 0.04), rgb(255 255 255 / 0)),
    color-mix(in srgb, var(--card-accent) 24%, rgb(8 12 20) 76%);
  box-shadow:
    0 18px 36px rgb(15 23 42 / 0.22),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

.home-showcase-card__media::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgb(15 23 42 / 0.02), rgb(15 23 42 / 0.18) 44%, rgb(15 23 42 / 0.62)),
    radial-gradient(circle at 18% 16%, rgb(255 255 255 / 0.18), transparent 28%);
  pointer-events: none;
}

.home-showcase-card__image,
.home-showcase-card__placeholder {
  width: 100%;
  height: 100%;
}

.home-showcase-card__image {
  object-fit: cover;
}

.home-showcase-card__placeholder {
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--card-accent) 64%, white 36%), color-mix(in srgb, var(--card-accent) 34%, rgb(15 23 42) 66%)),
    radial-gradient(circle at 24% 24%, rgb(255 255 255 / 0.3), transparent 30%);
}

.home-showcase-card__title-wrap {
  position: absolute;
  left: clamp(0.95rem, 3vw, 1.3rem);
  right: clamp(0.95rem, 3vw, 1.3rem);
  bottom: clamp(1rem, 3vw, 1.35rem);
  z-index: 1;
  min-block-size: clamp(5.8rem, 28%, 7.8rem);
}

.home-showcase-card__title {
  margin: 0;
  max-width: min(100%, 22ch);
  padding-bottom: 0.14em;
  color: rgb(248 250 252);
  font-size: clamp(1.3rem, 2.9vw, 2.08rem);
  font-weight: 650;
  line-height: 1.18;
  letter-spacing: -0.05em;
  text-wrap: balance;
  text-shadow:
    1px 0 0 rgb(15 23 42 / 0.28),
    -1px 0 0 rgb(15 23 42 / 0.28),
    0 1px 0 rgb(15 23 42 / 0.28),
    0 -1px 0 rgb(15 23 42 / 0.28);
  transition: transform 240ms ease;
}

.home-showcase-card--cropped {
  gap: 0.8rem;
  padding: clamp(0.9rem, 2vw, 1.15rem);
}

.home-showcase-card--cropped .home-showcase-card__media {
  border-radius: clamp(1.2rem, 3vw, 1.8rem);
}

.home-showcase-card--cropped .home-showcase-card__title-wrap {
  top: clamp(0.9rem, 2.2vw, 1.2rem);
  bottom: auto;
  min-block-size: clamp(5.1rem, 24%, 6.8rem);
}

.home-showcase-card--cropped .home-showcase-card__title {
  max-width: min(100%, 18ch);
  padding-bottom: 0.14em;
  font-size: clamp(1.02rem, 1.8vw, 1.42rem);
  line-height: 1.16;
}

.home-showcase-card:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-primary) 78%, white 22%);
  outline-offset: 5px;
}

@media (hover: hover) and (pointer: fine) {
  .home-showcase-card:hover {
    border-color: color-mix(in srgb, var(--card-accent) 58%, rgb(255 255 255 / 34%));
    box-shadow:
      0 28px 72px rgb(15 23 42 / 0.2),
      inset 0 1px 0 rgb(255 255 255 / 0.24);
  }

  .home-showcase-card:hover .home-showcase-card__title {
    transform: translateY(-2px);
  }
}

@media (max-width: 767px) {
  .home-showcase-card {
    min-height: 22rem;
  }

  .home-showcase-card__title {
    max-width: calc(100% - 0.5rem);
  }
}

html.dark .home-showcase-card {
  border-color: color-mix(in srgb, var(--card-accent) 52%, rgb(47 56 72) 48%);
  background:
    linear-gradient(
      155deg,
      color-mix(in srgb, var(--card-accent) 74%, rgb(20 24 34) 26%),
      color-mix(in srgb, var(--card-accent) 38%, rgb(5 8 15) 62%)
    );
  color: rgb(248 250 252);
}

html.dark .home-showcase-card__label {
  background: color-mix(in srgb, var(--card-accent) 24%, rgb(35 43 58) 76%);
  color: rgb(241 245 249);
}

html.dark .home-showcase-card__chip {
  border-color: color-mix(in srgb, var(--card-accent) 20%, rgb(59 70 88) 80%);
  background: rgb(10 14 22);
  color: rgb(203 213 225);
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
