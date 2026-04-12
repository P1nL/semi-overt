<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'

import type { ArticleCardVm } from '@/entities/article/model/article.types'
import { ArticleCard } from '@/entities/article/ui'
import { EmptyState } from '@/shared/components/base'

const router = useRouter()

const props = withDefaults(
  defineProps<{
    articles?: ArticleCardVm[]
  }>(),
  {
    articles: () => [],
  },
)

const cardsRef = ref<HTMLElement | null>(null)
const isCompactViewport = ref(false)
const prefersReducedMotion = ref(false)
const displayedArticles = ref<ArticleCardVm[]>([...props.articles])

const STACK_X_STEP = 100
const STACK_Y_STEP = 13
const MAX_VISIBLE_CARDS = 5
const WHEEL_THRESHOLD = 60
const GRID_THRESHOLD = 5

/**
 * visualOrder 是一个「逻辑堆叠数组」：
 *   visualOrder[0]          = 视觉最底层（左下）
 *   visualOrder[length - 1] = 视觉最顶层（右上 / 当前卡）
 *
 * 数组值是 articles 的原始索引。
 *
 * 关键区别：改变 visualOrder **不会**改变 Vue 的 v-for DOM 顺序。
 * DOM 始终按 articles[0], articles[1], … 排列。
 * 我们仅通过 GSAP 设置每张卡片的 zIndex / x / y / opacity 来体现堆叠。
 */
const visualOrder = ref<number[]>([])

let compactViewportQuery: MediaQueryList | null = null
let reduceMotionQuery: MediaQueryList | null = null
let isAnimating = false
let articleTransitionToken = 0

let wheelAccum = 0

// ─── Touch swipe state ────────────────────────────────────────────────────────
let touchStartX = 0
let touchStartY = 0
const SWIPE_THRESHOLD = 48

// ─── Computed ─────────────────────────────────────────────────────────────────

const count = computed(() => displayedArticles.value.length)
const hasArticles = computed(() => count.value > 0)
const isGridMode = computed(() => count.value > GRID_THRESHOLD)
const desktopMode = computed(() => hasArticles.value && !isCompactViewport.value)

/** 当前视觉顶层卡片的原始索引 */
const topIndex = computed(() => visualOrder.value[visualOrder.value.length - 1] ?? 0)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function syncMediaState() {
  isCompactViewport.value = Boolean(compactViewportQuery?.matches)
  prefersReducedMotion.value = Boolean(reduceMotionQuery?.matches)
}

function bindCardInteractions(el: HTMLElement | null) {
  el?.addEventListener('wheel', handleWheel, { passive: false })
  el?.addEventListener('touchstart', handleTouchStart, { passive: true })
  el?.addEventListener('touchend', handleTouchEnd, { passive: true })
}

function unbindCardInteractions(el: HTMLElement | null) {
  el?.removeEventListener('wheel', handleWheel)
  el?.removeEventListener('touchstart', handleTouchStart)
  el?.removeEventListener('touchend', handleTouchEnd)
}

function initVisualOrder() {
  visualOrder.value = Array.from({ length: count.value }, (_, i) => i)
}

function getDesktopVisibleCards() {
  return visualOrder.value
    .slice(0, MAX_VISIBLE_CARDS)
    .map((originalIndex) => getCardEl(originalIndex))
    .filter((card): card is HTMLElement => Boolean(card))
}

function getFadeTargets() {
  if (desktopMode.value) {
    return getDesktopVisibleCards()
      .map((card) => card.querySelector<HTMLElement>('.content-card-shell'))
      .filter((card): card is HTMLElement => Boolean(card))
  }

  if (!cardsRef.value) return []
  return Array.from(cardsRef.value.querySelectorAll<HTMLElement>('.ptm__mobile-item .content-card-shell'))
}

function waitForTween(targets: gsap.TweenTarget, vars: gsap.TweenVars) {
  return new Promise<void>((resolve) => {
    gsap.to(targets, {
      ...vars,
      onComplete: () => resolve(),
    })
  })
}

/**
 * 根据 data-original-index 拿到对应 DOM 元素。
 * DOM 顺序始终固定，所以可以直接按属性查找。
 */
function getCardEl(originalIndex: number): HTMLElement | null {
  return cardsRef.value?.querySelector<HTMLElement>(
    `.ptm__card[data-original-index="${originalIndex}"]`,
  ) ?? null
}

/**
 * 根据 visualOrder，用 gsap.set 立即设置每张卡片的堆叠位置。
 * 不移动 DOM，只改 CSS transform / zIndex / opacity。
 */
function applyStackPositions(animate = false) {
  if (isGridMode.value) return
  const total = visualOrder.value.length
  const visibleCount = Math.min(total, MAX_VISIBLE_CARDS)
  const centerXShift = ((visibleCount - 1) * STACK_X_STEP) / 2
  const centerYShift = ((visibleCount - 1) * STACK_Y_STEP) / 2

  visualOrder.value.forEach((originalIndex, stackSlot) => {
    const card = getCardEl(originalIndex)
    if (!card) return

    const slot = Math.min(stackSlot, MAX_VISIBLE_CARDS - 1)
    const xOffset = slot * STACK_X_STEP
    const yOffset = slot * STACK_Y_STEP
    const visible = stackSlot < MAX_VISIBLE_CARDS
    const isTop = stackSlot === total - 1

    const target = {
      left: '50%',
      top: '50%',
      x: xOffset - centerXShift,
      y: centerYShift - yOffset,
      xPercent: -50,
      yPercent: -50,
      scale: 1,
      rotation: 0,
      transformOrigin: 'center center',
      zIndex: stackSlot + 1,
      opacity: visible ? 1 : 0,
      pointerEvents: isTop ? 'auto' : 'none',
    }

    if (animate) {
      gsap.to(card, { ...target, duration: 0.56, ease: 'sine.inOut' })
    } else {
      gsap.set(card, target)
    }
  })
}

function rotateVisualOrder() {
  if (visualOrder.value.length < 2) return
  const newOrder = [...visualOrder.value]
  const last = newOrder.pop()
  if (last === undefined) return
  newOrder.unshift(last)
  visualOrder.value = newOrder
}

/**
 * 核心翻牌动效 — 纯视觉方案（DOM 顺序不变）：
 *
 * 顶层卡片离场与其余卡片上推**并行**执行：
 *  t=0.00  顶层开始淡出飞走
 *  t=0.10  其余卡片开始滑向新位置（错开 100ms 让视觉有层次）
 *  t=0.48  全部完成
 *
 * DOM 节点始终不动，图片不会被销毁/重建/移动，不会闪烁。
 */
function advanceDeck() {
  if (isAnimating || !desktopMode.value || count.value < 2 || !cardsRef.value || isGridMode.value) return

  isAnimating = true

  if (prefersReducedMotion.value) {
    rotateVisualOrder()
    applyStackPositions(false)
    isAnimating = false
    return
  }

  const leavingIndex = topIndex.value
  const leavingCard = getCardEl(leavingIndex)

  // 先更新逻辑顺序，这样 applyStackPositions 能算出正确的目标位置
  rotateVisualOrder()

  const total = visualOrder.value.length
  const visibleCount = Math.min(total, MAX_VISIBLE_CARDS)
  const centerXShift = ((visibleCount - 1) * STACK_X_STEP) / 2
  const centerYShift = ((visibleCount - 1) * STACK_Y_STEP) / 2

  const tl = gsap.timeline({
    onComplete: () => {
      isAnimating = false
    },
  })

  // ── 顶层卡片离场（向右平移淡出 + 缩小）─────────────────────────────────
  if (leavingCard) {
    tl.to(leavingCard, {
      duration: 0.54,
      x: '+=42',
      opacity: 0,
      scale: 0.965,
      transformOrigin: 'center right',
      ease: 'sine.out',
    }, 0)
  }

  // ── 其余卡片滑向新堆叠位置（错开 0.1s 启动）─────────────────────────
  visualOrder.value.forEach((originalIndex, stackSlot) => {
    // 离场卡片由上面的动画处理，跳过
    if (originalIndex === leavingIndex) return

    const card = getCardEl(originalIndex)
    if (!card) return

    const slot = Math.min(stackSlot, MAX_VISIBLE_CARDS - 1)
    const xOffset = slot * STACK_X_STEP
    const yOffset = slot * STACK_Y_STEP
    const visible = stackSlot < MAX_VISIBLE_CARDS
    const isTop = stackSlot === total - 1

    tl.to(card, {
      duration: 0.52,
      left: '50%',
      top: '50%',
      x: xOffset - centerXShift,
      y: centerYShift - yOffset,
      xPercent: -50,
      yPercent: -50,
      scale: 1,
      rotation: 0,
      transformOrigin: 'center center',
      zIndex: stackSlot + 1,
      opacity: visible ? 1 : 0,
      pointerEvents: isTop ? 'auto' : 'none',
      ease: 'sine.inOut',
    }, 0.12)
  })

  // ── 离场卡片：先瞬移到底层起始位置，再柔和淡入 ─────────────────────
  if (leavingCard) {
    const leavingSlot = visualOrder.value.indexOf(leavingIndex)
    const slot = Math.min(leavingSlot, MAX_VISIBLE_CARDS - 1)
    const xOffset = slot * STACK_X_STEP
    const yOffset = slot * STACK_Y_STEP
    const visible = leavingSlot < MAX_VISIBLE_CARDS

    // 瞬移到底层，略偏下 + 缩小 + 透明，作为淡入起点
    tl.set(leavingCard, {
      xPercent: -50,
      yPercent: -50,
      x: xOffset - centerXShift,
      y: (centerYShift - yOffset) + 12,
      scale: 0.97,
      rotation: 0,
      transformOrigin: 'center center',
      zIndex: leavingSlot + 1,
      opacity: 0,
      pointerEvents: 'none',
    })

    // 从偏下位置柔和上浮淡入到最终位置
    if (visible) {
      tl.to(leavingCard, {
        duration: 0.48,
        y: centerYShift - yOffset,
        scale: 1,
        opacity: 1,
        ease: 'sine.out',
      })
    }
  }
}

// ─── Wheel ────────────────────────────────────────────────────────────────────

function handleWheel(e: WheelEvent) {
  if (!desktopMode.value || count.value < 2 || isGridMode.value) return
  e.preventDefault()

  wheelAccum += e.deltaY

  if (Math.abs(wheelAccum) >= WHEEL_THRESHOLD) {
    wheelAccum = 0
    advanceDeck()
  }
}

// ─── Touch ────────────────────────────────────────────────────────────────────

function handleTouchStart(e: TouchEvent) {
  if (!desktopMode.value || count.value < 2) return
  const touch = e.touches[0]
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}

function handleTouchEnd(e: TouchEvent) {
  if (!desktopMode.value || count.value < 2 || isGridMode.value) return
  const touch = e.changedTouches[0]
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY

  // 上滑或左滑触发翻牌
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < -SWIPE_THRESHOLD) advanceDeck()
  } else {
    if (dy < -SWIPE_THRESHOLD) advanceDeck()
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * 清理所有 GSAP 内联样式并重置堆叠。
 * 在 articles 数组变化（tab 切换）时调用，
 * 确保旧动画残留不会污染新卡片布局。
 */
async function resetDeck() {
  gsap.killTweensOf('.ptm__card')
  isAnimating = false

  initVisualOrder()
  await nextTick()

  if (cardsRef.value) {
    const allCards = cardsRef.value.querySelectorAll<HTMLElement>('.ptm__card')
    allCards.forEach((card) => {
      gsap.set(card, { clearProps: 'all' })
      gsap.set(card, { opacity: 0 })
    })
  }

  applyStackPositions(false)
}

async function fadeInDeck() {
  await resetDeck()
  if (prefersReducedMotion.value) {
    for (const el of getFadeTargets()) gsap.set(el, { opacity: 1 })
    return
  }
  const targets = getFadeTargets()
  if (!targets.length) return
  gsap.set(targets, { opacity: 0, y: 16 })
  await waitForTween(targets, {
    opacity: 1,
    y: 0,
    duration: 0.46,
    ease: 'sine.out',
    stagger: 0.07,
    overwrite: true,
  })
}

async function syncArticlesWithFade(nextArticles: ArticleCardVm[]) {
  const token = ++articleTransitionToken

  if (prefersReducedMotion.value) {
    displayedArticles.value = [...nextArticles]
    await nextTick()
    if (!isGridMode.value) {
      await resetDeck()
      for (const el of getFadeTargets()) gsap.set(el, { opacity: 1 })
    }
    return
  }

  // 离场：只在有 cardsRef（堆叠模式）或平铺模式有可见卡片时淡出
  const leavingTargets = getFadeTargets()
  if (leavingTargets.length) {
    await waitForTween(leavingTargets, {
      opacity: 0,
      duration: 0.24,
      ease: 'sine.out',
      stagger: 0.05,
      overwrite: true,
    })
  }

  if (token !== articleTransitionToken) return

  displayedArticles.value = [...nextArticles]

  // 等 Vue 重渲染：isGridMode 会根据新数据重新计算，cardsRef 也会重新挂载
  await nextTick()

  if (token !== articleTransitionToken) return

  if (isGridMode.value) {
    // 平铺模式：CSS Transition 负责入场，不需要 GSAP
    return
  }

  // 堆叠模式：正常走 resetDeck + 入场动画
  await resetDeck()

  if (token !== articleTransitionToken) return

  const enteringTargets = getFadeTargets()
  if (!enteringTargets.length) return

  gsap.set(enteringTargets, { opacity: 0 })
  await waitForTween(enteringTargets, {
    opacity: 1,
    duration: 0.38,
    ease: 'sine.out',
    stagger: 0.06,
    overwrite: true,
  })
}

watch(() => props.articles, syncArticlesWithFade)

watch(cardsRef, (nextEl, prevEl) => {
  if (prevEl) unbindCardInteractions(prevEl)
  if (nextEl) bindCardInteractions(nextEl)
})

// 从空态切到非空态时，cardsRef 已挂载，触发带进场动画的完整初始化
watch(
  hasArticles,
  async (val) => {
    if (!val || isCompactViewport.value) return
    await fadeInDeck()
  },
  { flush: 'post' },
)

onMounted(async () => {
  compactViewportQuery = window.matchMedia('(max-width: 767px)')
  reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncMediaState()

  compactViewportQuery.addEventListener('change', syncMediaState)
  reduceMotionQuery.addEventListener('change', syncMediaState)

  if (hasArticles.value && !isCompactViewport.value) {
    await fadeInDeck()
  } else {
    initVisualOrder()
    await nextTick()
    applyStackPositions(false)
  }
})

onBeforeUnmount(() => {
  compactViewportQuery?.removeEventListener('change', syncMediaState)
  reduceMotionQuery?.removeEventListener('change', syncMediaState)
  unbindCardInteractions(cardsRef.value)
})
</script>

<template>
  <section class="ptm">
    <div v-if="!isCompactViewport" class="ptm__gallery">
      <!-- 空态：v-if 切换，独立 Transition，不影响卡片容器挂载时序 -->
      <Transition name="ptm-empty">
        <div
          v-if="!hasArticles"
          class="ptm__gallery-state ptm__gallery--empty"
          aria-label="文章列表为空"
        >
          <EmptyState title="还没有文章" description="" emoji="🙂" />
        </div>
      </Transition>

      <!-- 堆叠模式：≤5 张时，GSAP 控制每张卡的 opacity/transform -->
      <div v-if="!isGridMode" class="ptm__gallery-state" aria-label="文章卡片堆栈">
        <header class="ptm__header">
        </header>

        <div
          ref="cardsRef"
          class="ptm__cards"
          :class="{ 'ptm__cards--single': count === 1 }"
          tabindex="0"
          role="region"
          aria-label="滚动鼠标滚轮翻阅文章卡片"
          @keydown.enter.prevent="advanceDeck"
          @keydown.space.prevent="advanceDeck"
          @keydown.arrow-down.prevent="advanceDeck"
          @keydown.arrow-up.prevent="advanceDeck"
        >
          <article
            v-for="(article, index) in displayedArticles"
            :key="article.id"
            class="ptm__card"
            :data-original-index="index"
            @click="index === topIndex && router.push(article.articlePath)"
          >
            <ArticleCard
              :article="article"
              :clickable="false"
              :show-author="true"
              :show-status="true"
              :show-reason="true"
              :fill-height="true"
              :cover-eager="true"
            />
          </article>
        </div>
      </div>

      <!-- 平铺模式：>5 张时，2×2 网格可滚动 -->
      <Transition name="ptm-grid-fade">
      <div v-if="isGridMode" class="ptm__gallery-state ptm__grid-state" aria-label="文章卡片列表">
        <div class="ptm__grid">
          <RouterLink
            v-for="article in displayedArticles"
            :key="article.id"
            :to="article.articlePath"
            class="ptm__grid-item"
          >
            <ArticleCard
              :article="article"
              :clickable="false"
              :show-author="true"
              :show-status="true"
              :show-reason="true"
              :fill-height="true"
            />
          </RouterLink>
        </div>
      </div>
      </Transition>
    </div>

    <div v-else-if="hasArticles" class="ptm__mobile-strip content-rise-in" aria-label="文章列表">
        <RouterLink
          v-for="article in displayedArticles"
          :key="article.id"
          :to="article.articlePath"
          class="ptm__mobile-item"
        >
          <ArticleCard :article="article" :clickable="false" :show-status="true" :show-reason="true" :fill-height="true" />
        </RouterLink>
    </div>

    <div v-else class="ptm__gallery ptm__gallery--empty content-rise-in" aria-label="文章列表为空">
      <EmptyState
        title="还没有文章"
        description=""
        emoji="🙂"
      />
    </div>
  </section>
</template>

<style scoped>
.ptm {
  position: relative;
  color: var(--color-text);
}

.ptm__gallery {
  position: relative;
  overflow: hidden;
  min-height: clamp(31rem, 66vh, 42rem);
  border-radius: calc(var(--radius-xl) + 0.25rem);
}

.ptm__gallery-state {
  position: absolute;
  inset: 0;
}

.ptm__gallery--empty {
  display: grid;
  place-items: center;
  padding: 2rem;
  background: transparent;
  pointer-events: none;
}

.ptm__gallery--empty :deep(.empty-state) {
  width: 100%;
  max-width: 30rem;
}

/* 空态淡入淡出 */
.ptm-empty-enter-active,
.ptm-empty-leave-active {
  transition: opacity 0.28s ease;
}

.ptm-empty-enter-from,
.ptm-empty-leave-to {
  opacity: 0;
}

.ptm__header {
  position: relative;
  z-index: 2;
  display: grid;
  gap: 0.5rem;
  padding: 0.35rem 0.25rem 0;
}

.ptm__meta {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.ptm__counter {
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ptm__time {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.ptm__lead {
  display: grid;
  gap: 0.35rem;
  max-width: 32rem;
}

.ptm__title {
  margin: 0;
  font-size: clamp(1.1rem, 1.3vw + 0.9rem, 1.45rem);
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: -0.03em;
}

.ptm__hint {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.ptm__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.ptm__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 6.5rem;
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-surface-glass-strong) 94%, transparent);
  color: var(--color-text);
  font-size: 0.88rem;
  text-decoration: none;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
}

.ptm__action:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border));
}

.ptm__action--primary {
  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-glass-strong));
}

/* ── 卡片容器：position:relative，让 left/top 相对它定位 ── */
.ptm__cards {
  position: absolute;
  /* 底部留 header 空间，卡片区居中于剩余空间 */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  outline: none;
  /* 透视，对应 CodePen 的 perspective:100px */
  perspective: 600px;
}

.ptm__cards:focus-visible {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 40%, transparent);
}

/*
 * 每张卡的基准尺寸。
 * left/top 由 JS（applyStackPositions）动态写入，
 * 对应 CodePen 的 nth-child 规则。
 * position:absolute 相对 .ptm__cards。
 */
.ptm__card {
  position: absolute;
  width: min(28rem, calc(100% - 1rem));
  height: clamp(30.5rem, 68vh, 34.25rem);
  color: inherit;
  cursor: pointer;
  /* 只在最外层提升合成层，内部子元素不再重复提升 */
  will-change: transform, opacity;
}

.ptm__card :deep(.content-card-shell) {
  min-height: 100%;
  height: 100%;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 82%, white 18%);
  background: #fff;
  box-shadow:
    0 14px 32px rgb(15 23 42 / 0.07),
    inset 0 1px 0 rgb(255 255 255 / 0.96);
  /* 关闭全局 content-card-shell 的 backdrop-filter —
     堆叠卡片已有不透明 background，不需要模糊；
     backdrop-filter 在父元素 transform 动画时会导致图片逐帧重绘/闪烁 */
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  /* 关闭全局 .content-card-shell--regular 的 hover transition，
     避免与 GSAP 动画冲突产生闪烁 */
  transition: none;
}

.ptm__card :deep(.content-card-shell::before) {
  background: none;
}

.ptm__card :deep(.content-card-shell > :first-child) {
  min-height: 0;
  height: clamp(13.6rem, 29vw, 15rem);
  flex: 0 0 clamp(13.6rem, 29vw, 15rem);
}

.ptm__card :deep(.content-card-shell > :first-child img) {
  /* 不再强制独立合成层；父 .ptm__card 已有 will-change，
     嵌套层只增加 GPU 内存压力和重绘开销 */
}

.ptm__card :deep(.content-card-shell > :last-child) {
  min-height: 0;
  flex: 1;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0;
}

.ptm__card :deep(h3) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  line-clamp: unset;
  -webkit-line-clamp: 1;
  font-size: 1.18rem;
  line-height: 1.55;
}

.ptm__card :deep(p[class*='line-clamp-']) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  line-clamp: unset;
  -webkit-line-clamp: 1;
  font-size: 0.98rem;
  line-height: 1.75;
}

.ptm__card :deep(.content-card-shell > :last-child) {
  font-size: 1rem;
}

.ptm__card :deep(.content-card-shell > :last-child > .flex-wrap) {
  font-size: 0.8rem;
  line-height: 1.7;
}

.ptm__card :deep(.inline-flex.items-center.gap-2\.5.text-sm) {
  font-size: 0.96rem;
  line-height: 1.5;
}

.ptm__card :deep(.text-xs.text-\[var\(--color-danger\)\]) {
  font-size: 0.82rem;
  line-height: 1.6;
}

/*
 * 所有卡片禁止 hover transform —
 * 只有顶层卡片有 pointer-events:auto（由 GSAP 设置），
 * hover 上浮通过 box-shadow 变化体现，不再做 transform 以避免与 GSAP 冲突。
 */
.ptm__card :deep(.content-card-shell:hover) {
  transform: none;
  box-shadow: var(--shadow-glass-card-hover);
}

html.dark .ptm__card :deep(.content-card-shell) {
  border-color: rgb(255 255 255 / 0.08);
  background: rgb(20 24 33);
  box-shadow:
    0 16px 36px rgb(0 0 0 / 0.2),
    0 4px 12px rgb(0 0 0 / 0.1);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition: none;
}

html.dark .ptm__card :deep(.content-card-shell::before) {
  background:
    linear-gradient(
      135deg,
      rgb(255 255 255 / 0.1),
      transparent 24%,
      transparent 74%,
      rgb(255 255 255 / 0.04)
    ),
    radial-gradient(circle at 10% 10%, rgb(255 255 255 / 0.08), transparent 18%);
}

/* ── Mobile ── */
.ptm__mobile-strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(84vw, 1fr);
  gap: 0.9rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 0.35rem;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.ptm__mobile-strip::-webkit-scrollbar {
  display: none;
}

.ptm__mobile-item {
  display: block;
  color: inherit;
  text-decoration: none;
  scroll-snap-align: center;
}

.ptm__mobile-item :deep(.content-card-shell) {
  min-height: 100%;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 82%, white 18%);
  background: #fff;
  box-shadow:
    0 14px 32px rgb(15 23 42 / 0.07),
    inset 0 1px 0 rgb(255 255 255 / 0.96);
}

.ptm__mobile-item :deep(.content-card-shell::before) {
  background: none;
}

.ptm__mobile-item :deep(.content-card-shell > :first-child) {
  min-height: 0;
  height: clamp(11.7rem, 48vw, 12.9rem);
  flex: 0 0 clamp(11.7rem, 48vw, 12.9rem);
}

.ptm__mobile-item :deep(.content-card-shell > :last-child) {
  gap: 0.75rem;
}

@media (max-width: 1023px) {
  .ptm__card {
    width: min(24.5rem, calc(100% - 1.5rem));
  }
}

html.dark .ptm__mobile-item :deep(.content-card-shell) {
  border-color: rgb(255 255 255 / 0.08);
  background: rgb(20 24 33);
  box-shadow:
    0 16px 36px rgb(0 0 0 / 0.2),
    0 4px 12px rgb(0 0 0 / 0.1);
}

html.dark .ptm__mobile-item :deep(.content-card-shell::before) {
  background:
    linear-gradient(
      135deg,
      rgb(255 255 255 / 0.1),
      transparent 24%,
      transparent 74%,
      rgb(255 255 255 / 0.04)
    ),
    radial-gradient(circle at 10% 10%, rgb(255 255 255 / 0.08), transparent 18%);
}

/* ── 平铺模式入场动画 ── */
.ptm-grid-fade-enter-active {
  transition: opacity 0.32s ease, transform 0.32s ease;
}

.ptm-grid-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

/* ── 平铺模式 ── */
.ptm__grid-state {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.75rem;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-border) 60%, transparent) transparent;
}

.ptm__grid-state::-webkit-scrollbar {
  width: 4px;
}

.ptm__grid-state::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-border) 60%, transparent);
  border-radius: 2px;
}

.ptm__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.65rem;
}

.ptm__grid-item {
  display: block;
  color: inherit;
  text-decoration: none;
  border-radius: var(--radius-xl);
  transition: transform 220ms ease;
  will-change: transform;
}

.ptm__grid-item:hover {
  transform: translateY(-4px);
}

/* 缩小后的卡片内部样式重置，保持等比缩小视觉 */
.ptm__grid-item :deep(.content-card-shell) {
  min-height: 0;
  height: 100%;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 82%, white 18%);
  background: #fff;
  box-shadow:
    0 6px 18px rgb(15 23 42 / 0.07),
    inset 0 1px 0 rgb(255 255 255 / 0.96);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition: box-shadow 220ms ease;
}

.ptm__grid-item:hover :deep(.content-card-shell) {
  box-shadow:
    0 12px 28px rgb(15 23 42 / 0.11),
    inset 0 1px 0 rgb(255 255 255 / 0.96);
}

.ptm__grid-item :deep(.content-card-shell::before) {
  background: none;
}

.ptm__grid-item :deep(.content-card-shell > :first-child) {
  min-height: 0;
  height: clamp(9.5rem, 18vw, 13rem);
  flex: 0 0 clamp(9.5rem, 18vw, 13rem);
}

.ptm__grid-item :deep(.content-card-shell > :last-child) {
  gap: 0.4rem;
  padding-bottom: 0;
  font-size: 0.82rem;
}

.ptm__grid-item :deep(h3) {
  font-size: 0.9rem;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.ptm__grid-item :deep(p[class*='line-clamp-']) {
  font-size: 0.78rem;
  line-height: 1.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.ptm__grid-item :deep(.flex-wrap) {
  font-size: 0.72rem;
}

html.dark .ptm__grid-item :deep(.content-card-shell) {
  border-color: rgb(255 255 255 / 0.08);
  background: rgb(20 24 33);
  box-shadow:
    0 6px 18px rgb(0 0 0 / 0.18),
    0 2px 6px rgb(0 0 0 / 0.1);
}

html.dark .ptm__grid-item:hover :deep(.content-card-shell) {
  box-shadow:
    0 12px 28px rgb(0 0 0 / 0.26),
    0 4px 10px rgb(0 0 0 / 0.14);
}

html.dark .ptm__grid-item :deep(.content-card-shell::before) {
  background:
    linear-gradient(
      135deg,
      rgb(255 255 255 / 0.1),
      transparent 24%,
      transparent 74%,
      rgb(255 255 255 / 0.04)
    ),
    radial-gradient(circle at 10% 10%, rgb(255 255 255 / 0.08), transparent 18%);
}

@media (prefers-reduced-motion: reduce) {
  .ptm__action {
    transition: none;
  }

  .ptm__grid-item {
    transition: none;
  }
}
</style>
