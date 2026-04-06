<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { useMotions, type Variant } from '@vueuse/motion'

import type { ArticleCardVm } from '@/entities/article/model/article.types'

import HomeShowcaseCard from './HomeShowcaseCard.vue'

const props = withDefaults(
    defineProps<{
      items: ArticleCardVm[]
      categoryLabel: string
      featured?: boolean
      revealed?: boolean
      delayBase?: number
      maxVisible?: number
    }>(),
    {
      featured: false,
      revealed: false,
      delayBase: 0,
      maxVisible: 6,
    },
)

const visibleItems = computed(() => props.items.slice(0, props.maxVisible))
const motions = useMotions()
const motionIdPrefix = `home-showcase-rail-${getCurrentInstance()?.uid ?? 'default'}`

// --- 🌟 动画核心逻辑开始 ---
const hoveredIndex = ref<number | null>(null)

const getMotionKey = (index: number) => `${motionIdPrefix}-${index}`

const getMotionState = (index: number): Variant => {
  // 1. 无悬停时：全部归位
  if (hoveredIndex.value === null) {
    return {
      y: 0,
      x: 0,
      rotate: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 120,
        damping: 25,
        mass: 1,
      },
    }
  }

  const distance = index - hoveredIndex.value

  // 2. 当前悬停卡片 (波峰)
  if (distance === 0) {
    return {
      y: -400,
      x: 0,
      rotate: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 120,
        damping: 16,
        mass: 1,
      },
    }
  }

  // 3. 左右相邻的第一张卡片
  if (Math.abs(distance) === 1) {
    return {
      y: -150,
      x: Math.sign(distance) * 20, // 向两侧微微推开
      rotate: Math.sign(distance) * 2, // 微微倾斜
      opacity: 0.95,
      transition: {
        type: 'spring',
        stiffness: 120,
        damping: 16,
        mass: 1,
      },
    }
  }

  // 4. 左右相邻的第二张卡片
  if (Math.abs(distance) === 2) {
    return {
      y: -40,
      x: Math.sign(distance) * 10,
      rotate: Math.sign(distance) * 1,
      opacity: 0.9,
      transition: {
        type: 'spring',
        stiffness: 120,
        damping: 16,
        mass: 1,
      },
    }
  }

  return {
    y: 0,
    x: 0,
    rotate: 0,
    opacity: 0.8,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 16,
      mass: 1,
    },
  }
}

async function syncMotionState() {
  await nextTick()

  visibleItems.value.forEach((_, index) => {
    motions[getMotionKey(index)]?.apply(getMotionState(index))
  })
}

watch([hoveredIndex, visibleItems], () => {
  void syncMotionState()
}, { immediate: true, flush: 'post' })
// --- 🌟 动画核心逻辑结束 ---
</script>

<template>
  <div
      class="home-showcase-rail"
      :class="{ 'home-showcase-rail--featured': featured }"
      @mouseleave="hoveredIndex = null"
  >
    <div class="home-showcase-rail__viewport">
      <div class="home-showcase-rail__track">
        <div
            v-for="(item, index) in visibleItems"
            :key="item.id"
            class="home-showcase-rail__item"
            :style="{ '--item-index': index }"
            @mouseenter="hoveredIndex = index"
            v-motion="getMotionKey(index)"
            :initial="{ y: 0, x: 0, rotate: 0, opacity: 1 }"
        >
          <HomeShowcaseCard
              :article="item"
              :category-label="categoryLabel"
              :emphasis="featured && index === 0 ? 'hero' : 'regular'"
              :cropped="featured"
              :revealed="revealed"
              :delay="delayBase + index * 80"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-showcase-rail {
  inline-size: 100%;
  --showcase-rail-gutter: max(0.75rem, calc((100% - 1200px) / 2));
  --showcase-rail-shift: 0rem;
}

.home-showcase-rail__viewport {
  padding-inline-start: max(0.75rem, calc(var(--showcase-rail-gutter) - var(--showcase-rail-shift)));
  padding-inline-end: var(--showcase-rail-gutter);
}

.home-showcase-rail__track {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
}

.home-showcase-rail__item {
  min-width: 0;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .home-showcase-rail__track {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.15rem;
  }
}

@media (min-width: 1024px) {
  .home-showcase-rail {
    --showcase-circle-size: min(30.5rem, 29vw);
    --showcase-hover-buffer: 30rem;
    --showcase-item-overlap: clamp(-5rem, -15vw, -15rem);
  }

  .home-showcase-rail--featured {
    --showcase-rail-shift: clamp(10rem, 10vw, 5rem);
    --showcase-circle-size: min(50rem, 55vw);
    --showcase-hover-buffer: 30rem;
    --showcase-item-overlap: clamp(-45rem, -55vw, -50rem);
  }

  .home-showcase-rail__viewport {
    overflow: hidden;
  }

  .home-showcase-rail--featured .home-showcase-rail__viewport {
    block-size: calc(var(--showcase-circle-size) * 1.12);
    overflow: visible;
    clip-path: inset(calc(-1 * var(--showcase-hover-buffer)) 0 0 0);
  }

  .home-showcase-rail__track {
    display: flex;
    align-items: flex-end; /* 确保卡片基于底部对齐向上推 */
    min-width: 0;
    gap: 0;
    padding-right: 0;
    perspective: 1200px; /* 为 rotate 提供空间深度感 */
  }

  .home-showcase-rail__item {
    width: var(--showcase-circle-size);
    flex: 0 0 auto;
    scroll-snap-align: start;

    /* 开启硬件加速，匹配 JS 需要操作的属性 */
    will-change: transform, opacity;
  }

  .home-showcase-rail__item + .home-showcase-rail__item {
    margin-left: var(--showcase-item-overlap);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-showcase-rail__viewport {
    scroll-behavior: auto;
  }

  /* 禁用动画偏好时，直接覆盖内联样式 */
  .home-showcase-rail__item {
    transform: none !important;
  }
}
</style>
