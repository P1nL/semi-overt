<script setup lang="ts">
import { computed } from 'vue'

import type { ArticleCardVm } from '@/entities/article'

const props = withDefaults(
  defineProps<{
    article: ArticleCardVm
    categoryLabel: string
    emphasis?: 'hero' | 'regular'
    toneIndex?: number
    cropped?: boolean
    revealed?: boolean
    animateReveal?: boolean
    delay?: number
  }>(),
  {
    emphasis: 'regular',
    toneIndex: 0,
    cropped: false,
    revealed: false,
    animateReveal: true,
    delay: 0,
  },
)

const homeShowcaseCardTones = [
  { background: '#B8C3D9', foreground: '#1D1D1F' },
  { background: '#A1C9A3', foreground: '#1D1D1F' },
  { background: '#C9C5A1', foreground: '#1D1D1F' },
  { background: '#BFB554', foreground: '#1D1D1F' },
  { background: '#857D3A', foreground: '#F8FAFC' },
  { background: '#DDEBE3', foreground: '#1D1D1F' },
  { background: '#94A4A8', foreground: '#1D1D1F' },
  { background: '#8D98A6', foreground: '#1D1D1F' },
  { background: '#333124', foreground: '#F8FAFC' },
  { background: '#BFBCAA', foreground: '#1D1D1F' },
] as const

const cardTone = computed(() => {
  const normalizedIndex = Math.abs(Math.trunc(props.toneIndex)) % homeShowcaseCardTones.length
  return homeShowcaseCardTones[normalizedIndex]
})

const cardStyle = computed(() => ({
  '--card-background': cardTone.value.background,
  '--card-foreground': cardTone.value.foreground,
  '--card-title-shadow': cardTone.value.foreground === '#F8FAFC'
    ? '0 1px 1px rgb(15 23 42 / 0.18)'
    : 'none',
  '--card-delay': `${props.delay}ms`,
}))
</script>

<template>
  <RouterLink
    :to="article.articlePath"
    class="home-showcase-card"
    :class="{
      'home-showcase-card--cropped': cropped,
      'home-showcase-card--revealed': revealed && animateReveal,
      'home-showcase-card--settled': revealed && !animateReveal,
    }"
    :style="cardStyle"
    :aria-label="`${categoryLabel}：${article.titleText}`"
  >
    <div class="home-showcase-card__header">

    </div>

    <div class="home-showcase-card__media-shell">
      <div class="home-showcase-card__media">
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
  --card-background: #b8c3d9;
  --card-foreground: #1d1d1f;
  --card-title-shadow: none;
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
  border: 0;
  border-radius: var(--card-radius);
  background: var(--card-background);
  box-shadow: 0 24px 60px rgb(15 23 42 / 0.16);
  color: var(--card-foreground);
  opacity: 0;
  transform: translateY(28px) scale(0.96);
  transition:
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 320ms ease;
}

.home-showcase-card--revealed {
  animation: home-showcase-card-rise 680ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--card-delay, 0ms);
}

.home-showcase-card--settled {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.home-showcase-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
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
  border: 0;
  background: transparent;
  box-shadow: none;
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
  color: var(--card-foreground);
  font-size: clamp(1.3rem, 2.9vw, 2.08rem);
  font-weight: 650;
  line-height: 1.18;
  letter-spacing: -0.05em;
  text-wrap: balance;
  text-shadow: var(--card-title-shadow);
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
    box-shadow: 0 28px 72px rgb(15 23 42 / 0.2);
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

/*
 * 主题切换期间：
 *
 * 卡片基础样式是 opacity:0 + transform:translateY(28px)，
 * 由 --revealed 的 home-showcase-card-rise 动画填充到最终状态。
 * 如果在 theme-switching 期间用另一个 animation 覆盖 rise，
 * theme-switching class 移除后 rise 动画会被浏览器重新触发 →
 * 部分卡片闪回 opacity:0 再重新入场。
 *
 * 修复：不替换 animation，而是用 !important 强制保持最终态：
 * opacity:1 + transform:none，让入场动画的 fill 值被静态属性压过。
 * theme-switching 移除后 rise 动画的 fill 自然恢复，但状态不变（已是1/none），
 * 不会产生视觉跳变。
 */
:global(html.theme-switching) .home-showcase-card,
:global(html.theme-settling) .home-showcase-card {
  opacity: 1 !important;
  transform: none !important;
  transition: none !important;
}
:global(html.theme-switching) .home-showcase-card *,
:global(html.theme-settling) .home-showcase-card * {
  transition: none !important;
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
