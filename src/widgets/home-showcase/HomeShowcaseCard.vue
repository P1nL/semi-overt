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

const titleTypography = computed(() => {
  const titleLength = Array.from(props.article.titleText.trim()).length

  if (titleLength <= 14) {
    return {
      fontSize: '3rem',
      letterSpacing: props.cropped ? '0.11em' : '0.095em',
      lineHeight: '1.08',
      maxWidth: props.cropped ? '12ch' : '14ch',
    }
  }

  if (titleLength <= 24) {
    return { fontSize: '2.4rem', letterSpacing: '0.075em', lineHeight: '1.1', maxWidth: '100%' }
  }

  if (titleLength <= 40) {
    return { fontSize: '1.9rem', letterSpacing: '0.055em', lineHeight: '1.14', maxWidth: '100%' }
  }

  if (titleLength <= 64) {
    return { fontSize: '1.45rem', letterSpacing: '0.04em', lineHeight: '1.18', maxWidth: '100%' }
  }

  return { fontSize: '1.1rem', letterSpacing: '0.025em', lineHeight: '1.22', maxWidth: '100%' }
})

const cardStyle = computed(() => ({
  '--card-background': cardTone.value.background,
  '--card-foreground': cardTone.value.foreground,
  '--card-title-shadow': cardTone.value.foreground === '#F8FAFC'
    ? '0 1px 1px rgb(15 23 42 / 0.18)'
    : 'none',
  '--card-delay': `${props.delay}ms`,
  '--card-title-font-size': titleTypography.value.fontSize,
  '--card-title-letter-spacing': titleTypography.value.letterSpacing,
  '--card-title-line-height': titleTypography.value.lineHeight,
  '--card-title-max-width': titleTypography.value.maxWidth,
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
          <h3 class="home-showcase-card__title">
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
  top: clamp(1.5rem, 6%, 4rem);
  left: 50%;
  bottom: auto;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(72%, 34rem);
  min-block-size: clamp(7rem, 14%, 9rem);
  text-align: center;
  transform: translateX(-50%);
}

.home-showcase-card__title {
  margin: 0;
  max-width: min(100%, var(--card-title-max-width, 14ch));
  padding: 0.16em 0 0.22em;
  color: var(--card-foreground);
  font-family: var(--font-display);
  font-size: var(--card-title-font-size, 3rem);
  font-weight: 900;
  font-kerning: normal;
  line-height: var(--card-title-line-height, 1.08);
  letter-spacing: var(--card-title-letter-spacing, 0.095em);
  text-align: center;
  text-indent: var(--card-title-letter-spacing, 0.095em);
  overflow-wrap: anywhere;
  word-break: break-word;
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
    max-width: min(calc(100% - 0.5rem), var(--card-title-max-width, 12ch));
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
