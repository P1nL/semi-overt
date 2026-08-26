<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowUpRight } from 'lucide-vue-next'

import { ArticleCard, type ArticleCardVm } from '@/entities/article'
import { createArticleMenuTextureItems } from './model/article-card-texture'
import { InfiniteGridMenu } from './model/infinite-grid-menu.js'

const props = withDefaults(
  defineProps<{
    items: ArticleCardVm[]
    fullscreen?: boolean
    centerLabel?: string
    resultCount?: number
  }>(),
  {
    fullscreen: false,
    centerLabel: '',
    resultCount: 0,
  },
)

const rootRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasKey = ref(0)
const activeIndex = ref(0)
const moving = ref(false)
const loading = ref(true)
const errorMessage = ref('')

let renderer: InfiniteGridMenu | null = null
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null
let buildVersion = 0
let mounted = false
let darkMode = false

const rendererSignature = computed(() =>
  [
    props.centerLabel,
    ...props.items.map((item) =>
      [item.id, item.titleText, item.summary.text, item.cover.src, item.cover.color].join(':'),
    ),
  ].join('|'),
)

const activeArticle = computed(() => props.items[activeIndex.value] ?? props.items[0] ?? null)
const resultTotal = computed(() => Math.max(0, Math.trunc(Number(props.resultCount) || 0)))
const activeResultNumber = computed(() =>
  resultTotal.value > 0 ? Math.min(activeIndex.value + 1, resultTotal.value) : 0,
)
const activeHasCover = computed(() => Boolean(activeArticle.value?.cover.hasImage && activeArticle.value.cover.src))
const overlayStateClass = computed(() => (moving.value ? 'article-infinite-menu__overlay--moving' : 'article-infinite-menu__overlay--active'))

function disposeRenderer() {
  renderer?.dispose()
  renderer = null
}

async function rebuildRenderer() {
  if (!mounted || !canvasRef.value || !props.items.length) return

  const version = ++buildVersion
  loading.value = true
  errorMessage.value = ''
  moving.value = false
  disposeRenderer()
  canvasKey.value += 1

  await nextTick()

  try {
    const textureItems = await createArticleMenuTextureItems(props.items, props.centerLabel)
    if (version !== buildVersion || !canvasRef.value) return

    renderer = new InfiniteGridMenu(
      canvasRef.value,
      textureItems,
      (index) => {
        if (!props.items.length) return
        activeIndex.value = index % props.items.length
      },
      (isMoving) => {
        moving.value = isMoving
      },
      (instance) => instance.run(),
      1,
      { centerLabel: props.centerLabel },
    )

    renderer.resize()
    loading.value = false
  } catch (error) {
    if (version !== buildVersion) return

    console.error('InfiniteMenu 初始化失败：', error)
    errorMessage.value = '当前设备无法启用 WebGL 无限菜单，已显示静态卡片。'
    loading.value = false
  }
}

watch(rendererSignature, () => {
  activeIndex.value = Math.min(activeIndex.value, Math.max(0, props.items.length - 1))
  void rebuildRenderer()
})

onMounted(() => {
  mounted = true
  darkMode = document.documentElement.classList.contains('dark')

  if (rootRef.value) {
    resizeObserver = new ResizeObserver(() => renderer?.resize())
    resizeObserver.observe(rootRef.value)
  }

  themeObserver = new MutationObserver(() => {
    const nextDarkMode = document.documentElement.classList.contains('dark')
    if (nextDarkMode === darkMode) return

    darkMode = nextDarkMode
    void rebuildRenderer()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  void rebuildRenderer()
})

onBeforeUnmount(() => {
  mounted = false
  buildVersion += 1
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  disposeRenderer()
})
</script>

<template>
  <section
    ref="rootRef"
    class="article-infinite-menu"
    :class="[
      fullscreen && 'article-infinite-menu--fullscreen',
      !loading && !errorMessage && 'article-infinite-menu--ready',
    ]"
    :aria-busy="loading"
    aria-label="无限文章菜单"
  >
    <canvas
      :key="canvasKey"
      ref="canvasRef"
      class="article-infinite-menu__canvas"
      aria-label="拖拽球面文章卡片浏览文章"
    />

    <h1 v-if="centerLabel" class="article-infinite-menu__sr-label">
      {{ centerLabel }}
    </h1>

    <div
      v-if="activeArticle && !errorMessage"
      class="article-infinite-menu__overlay"
      :class="overlayStateClass"
    >
      <h2 v-if="activeHasCover" class="article-infinite-menu__title" :title="activeArticle.titleText">
        {{ activeArticle.titleText }}
      </h2>

      <div v-else class="article-infinite-menu__left-meta" aria-label="文章信息">
        <div class="article-infinite-menu__meta article-infinite-menu__meta--left">
          <span>{{ activeArticle.meta.readMinutesText }}</span>
          <span v-if="activeArticle.meta.wordCountText">{{ activeArticle.meta.wordCountText }}</span>
          <time
            v-if="activeArticle.meta.displayTime"
            :datetime="activeArticle.meta.publishedAt || activeArticle.meta.updatedAt || undefined"
          >
            {{ activeArticle.meta.displayTime }}
          </time>
        </div>
        <p v-if="activeArticle.author?.displayName" class="article-infinite-menu__author">
          {{ activeArticle.author.displayName }}
        </p>
      </div>

      <div class="article-infinite-menu__details">
        <p v-if="activeArticle.summary.text" class="article-infinite-menu__summary">
          {{ activeArticle.summary.text }}
        </p>

        <template v-if="activeHasCover">
          <div class="article-infinite-menu__meta" aria-label="文章信息">
            <span>{{ activeArticle.meta.readMinutesText }}</span>
            <span v-if="activeArticle.meta.wordCountText">{{ activeArticle.meta.wordCountText }}</span>
            <time
              v-if="activeArticle.meta.displayTime"
              :datetime="activeArticle.meta.publishedAt || activeArticle.meta.updatedAt || undefined"
            >
              {{ activeArticle.meta.displayTime }}
            </time>
          </div>

          <p v-if="activeArticle.author?.displayName" class="article-infinite-menu__author">
            {{ activeArticle.author.displayName }}
          </p>
        </template>
      </div>

      <p
        v-if="resultTotal > 0"
        class="article-infinite-menu__result-index"
        :aria-label="`第 ${activeResultNumber} 个搜索结果，共 ${resultTotal} 个`"
      >
        {{ activeResultNumber }}/{{ resultTotal }}
      </p>

      <RouterLink
        :to="activeArticle.articlePath"
        class="article-infinite-menu__action"
        :aria-label="`阅读《${activeArticle.titleText}》`"
        @pointerdown.stop
        @click.stop
      >
        <ArrowUpRight :size="24" :stroke-width="1.8" />
      </RouterLink>
    </div>

    <div v-if="loading" class="article-infinite-menu__loading" aria-live="polite">
      正在生成文章菜单…
    </div>

    <div v-else-if="errorMessage" class="article-infinite-menu__fallback">
      <p>{{ errorMessage }}</p>
      <ArticleCard
        v-if="activeArticle"
        :article="activeArticle"
        fill-height
      />
    </div>

    <p class="article-infinite-menu__hint" :class="moving && 'article-infinite-menu__hint--hidden'">
      按住并拖拽球面浏览
    </p>

    <p class="article-infinite-menu__sr-status" aria-live="polite">
      当前文章：{{ activeArticle?.titleText || '' }}
    </p>
  </section>
</template>

<style scoped>
.article-infinite-menu {
  position: relative;
  width: 100vw;
  height: clamp(40rem, 72vw, 54rem);
  margin-left: calc(50% - 50vw);
  overflow: hidden;
  border: 0;
  background: transparent;
  isolation: isolate;
}

.article-infinite-menu--fullscreen {
  height: 100vh;
  height: 100dvh;
  margin-top: calc(-1 * var(--header-height));
}

.article-infinite-menu--fullscreen .article-infinite-menu__hint {
  top: calc(var(--header-height) + 1.25rem);
}

.article-infinite-menu__canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  cursor: grab;
  opacity: 0;
  outline: none;
  transition: opacity 420ms cubic-bezier(0.22, 1, 0.36, 1);
  touch-action: none;
}

.article-infinite-menu__canvas:active {
  cursor: grabbing;
}

.article-infinite-menu__overlay {
  opacity: 0;
  pointer-events: none;
  transition: opacity 360ms cubic-bezier(0.22, 1, 0.36, 1) 60ms;
}

.article-infinite-menu--ready .article-infinite-menu__canvas,
.article-infinite-menu--ready .article-infinite-menu__overlay {
  opacity: 1;
}

.article-infinite-menu__title,
.article-infinite-menu__left-meta,
.article-infinite-menu__details,
.article-infinite-menu__result-index,
.article-infinite-menu__action {
  position: absolute;
  z-index: 10;
  transition:
    opacity 500ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.article-infinite-menu__title {
  --infinite-menu-copy-edge: clamp(11.5rem, 14vw, 18rem);
  --infinite-menu-copy-gap: clamp(1rem, 1.6vw, 2rem);
  top: 50%;
  right: calc(50% + var(--infinite-menu-copy-edge) + var(--infinite-menu-copy-gap));
  width: min(30rem, 27vw);
  margin: 0;
  color: var(--color-text);
  font-size: clamp(2rem, 3.2vw, 4rem);
  font-weight: 800;
  letter-spacing: -0.055em;
  line-height: 1.08;
  overflow-wrap: anywhere;
  text-align: right;
  text-wrap: balance;
  transform: translate3d(0, -50%, 0);
  user-select: none;
}

.article-infinite-menu__left-meta {
  --infinite-menu-copy-edge: clamp(11.5rem, 14vw, 18rem);
  --infinite-menu-copy-gap: clamp(1rem, 1.6vw, 2rem);
  top: 50%;
  right: calc(50% + var(--infinite-menu-copy-edge) + var(--infinite-menu-copy-gap));
  display: flex;
  width: min(24rem, 27vw);
  flex-direction: column;
  align-items: flex-end;
  gap: 0.85rem;
  color: var(--color-text-muted);
  text-align: right;
  transform: translate3d(0, -50%, 0);
  user-select: none;
}

.article-infinite-menu__details {
  --infinite-menu-copy-edge: clamp(11.5rem, 14vw, 18rem);
  --infinite-menu-copy-gap: clamp(1rem, 1.6vw, 2rem);
  top: 50%;
  left: calc(50% + var(--infinite-menu-copy-edge) + var(--infinite-menu-copy-gap));
  display: flex;
  width: min(23rem, 22vw);
  max-height: min(24rem, 58vh);
  flex-direction: column;
  gap: 0.9rem;
  overflow: hidden;
  color: var(--color-text-muted);
  transform: translate3d(0, -50%, 0);
  user-select: none;
}

.article-infinite-menu__result-index {
  --infinite-menu-copy-edge: clamp(11.5rem, 14vw, 18rem);
  --infinite-menu-copy-gap: clamp(1rem, 1.6vw, 2rem);
  top: calc(50% + clamp(13.5rem, 18vw, 21rem));
  left: calc(50% + var(--infinite-menu-copy-edge) + var(--infinite-menu-copy-gap));
  min-width: 4.5rem;
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: clamp(0.9rem, 1.1vw, 1.05rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
  line-height: 1;
  text-align: left;
  transform: translate3d(0, -50%, 0);
  user-select: none;
}

.article-infinite-menu__summary {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: clamp(0.95rem, 1.05vw, 1.08rem);
  font-weight: 500;
  line-height: 1.75;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  text-wrap: pretty;
}

.article-infinite-menu__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 1.05rem;
  color: var(--color-text-faint);
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.55;
}

.article-infinite-menu__meta > * {
  position: relative;
  white-space: nowrap;
}

.article-infinite-menu__meta--left {
  justify-content: flex-end;
  font-size: 0.92rem;
}

.article-infinite-menu__meta > * + *::before {
  content: '·';
  position: absolute;
  left: -0.72rem;
  color: var(--color-text-faint);
}

.article-infinite-menu__author {
  margin: 0;
  color: var(--color-text);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.5;
}

.article-infinite-menu__action {
  left: 50%;
  bottom: 3.5rem;
  display: grid;
  width: 3.75rem;
  height: 3.75rem;
  place-items: center;
  border: 5px solid color-mix(in srgb, var(--color-bg) 84%, transparent);
  border-radius: 50%;
  color: #fff;
  background: var(--color-primary);
  box-shadow: var(--shadow-button);
  pointer-events: auto;
  transform: translateX(-50%) scale(1);
}

.article-infinite-menu__action:hover {
  background: var(--color-primary-strong);
  transform: translateX(-50%) scale(1.06);
}

.article-infinite-menu__action:focus-visible {
  outline: none;
  box-shadow:
    var(--shadow-button),
    0 0 0 4px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.article-infinite-menu__overlay--moving .article-infinite-menu__title,
.article-infinite-menu__overlay--moving .article-infinite-menu__left-meta {
  opacity: 0;
  transform: translate3d(-2rem, -50%, 0);
}

.article-infinite-menu__overlay--moving .article-infinite-menu__details,
.article-infinite-menu__overlay--moving .article-infinite-menu__result-index {
  opacity: 0;
  transform: translate3d(2rem, -50%, 0);
}

.article-infinite-menu__overlay--moving .article-infinite-menu__action {
  bottom: -5rem;
  opacity: 0;
  transform: translateX(-50%) scale(0.2);
}

.article-infinite-menu__loading,
.article-infinite-menu__fallback {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  background: transparent;
}

.article-infinite-menu__fallback {
  align-content: center;
  gap: 1rem;
  padding: 2rem;
}

.article-infinite-menu__fallback > :deep(.article-card) {
  width: min(21rem, calc(100vw - 3rem));
  height: 29rem;
}

.article-infinite-menu__hint {
  position: absolute;
  top: 1.25rem;
  left: 50%;
  z-index: 10;
  margin: 0;
  color: var(--color-text-faint);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  opacity: 1;
  transform: translateX(-50%);
  transition: opacity 160ms ease;
  user-select: none;
  pointer-events: none;
}

.article-infinite-menu__hint--hidden {
  opacity: 0;
}

.article-infinite-menu__sr-label,
.article-infinite-menu__sr-status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1360px) {
  .article-infinite-menu__title,
  .article-infinite-menu__left-meta,
  .article-infinite-menu__details,
  .article-infinite-menu__result-index {
    display: none;
  }
}

@media (min-width: 768px) {
  .article-infinite-menu--fullscreen {
    margin-top: calc(-1 * var(--header-height-md));
  }

  .article-infinite-menu--fullscreen .article-infinite-menu__hint {
    top: calc(var(--header-height-md) + 1.25rem);
  }
}

@media (max-width: 640px) {
  .article-infinite-menu:not(.article-infinite-menu--fullscreen) {
    height: 38rem;
  }

  .article-infinite-menu__action {
    bottom: 2.2rem;
    width: 3.35rem;
    height: 3.35rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-infinite-menu__canvas,
  .article-infinite-menu__overlay,
  .article-infinite-menu__title,
  .article-infinite-menu__left-meta,
  .article-infinite-menu__details,
  .article-infinite-menu__result-index,
  .article-infinite-menu__action,
  .article-infinite-menu__hint {
    transition-duration: 1ms;
  }
}
</style>
