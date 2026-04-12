<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import gsap from 'gsap'

import type { ProfileArticleTab } from '@/shared/types/profile'

const props = withDefaults(
  defineProps<{
    modelValue: ProfileArticleTab
    counts?: Partial<Record<ProfileArticleTab, number>>
    publicOnly?: boolean
    orientation?: 'horizontal' | 'vertical'
  }>(),
  {
    counts: () => ({}),
    publicOnly: false,
    orientation: 'horizontal',
  },
)

const emit = defineEmits<{
  'update:modelValue': [ProfileArticleTab]
  change: [ProfileArticleTab]
}>()

const tabItems = computed(() => {
  if (props.publicOnly) {
    return [
      { label: '已发布', value: 'approved' as const, badge: props.counts.approved ?? 0 },
    ]
  }

  return [
    { label: '全部', value: 'all' as const, badge: props.counts.all ?? 0 },
    { label: '已发布', value: 'approved' as const, badge: props.counts.approved ?? 0 },
    { label: '审核中', value: 'pending' as const, badge: props.counts.pending ?? 0 },
    { label: '已退回', value: 'returned' as const, badge: props.counts.returned ?? 0 },
    { label: '已拒绝', value: 'rejected' as const, badge: props.counts.rejected ?? 0 },
    { label: '草稿', value: 'draft' as const, badge: props.counts.draft ?? 0 },
  ]
})

const isVertical = computed(() => props.orientation === 'vertical')

// ── 竖线指示器 ────────────────────────────────────────────────────────────────

const listRef = ref<HTMLElement | null>(null)
const indicatorRef = ref<HTMLElement | null>(null)

function getActiveButton(): HTMLElement | null {
  return listRef.value?.querySelector<HTMLElement>('[aria-selected="true"]') ?? null
}

function moveIndicator(animate: boolean) {
  const list = listRef.value
  const indicator = indicatorRef.value
  const btn = getActiveButton()
  if (!list || !indicator || !btn) return

  const listTop = list.getBoundingClientRect().top
  const btnRect = btn.getBoundingClientRect()
  const targetY = btnRect.top - listTop
  const targetH = btnRect.height

  if (!animate) {
    gsap.set(indicator, { y: targetY, height: targetH })
    return
  }

  // 当前竖线的起点 y 和高度
  const currentY = gsap.getProperty(indicator, 'y') as number
  const currentH = gsap.getProperty(indicator, 'height') as number
  const movingDown = targetY > currentY

  const tl = gsap.timeline()

  if (movingDown) {
    // 向下：先拉伸底部到目标底边，再收起顶部
    tl.to(indicator, {
      height: (targetY + targetH) - currentY,
      duration: 0.22,
      ease: 'sine.in',
    })
    tl.to(indicator, {
      y: targetY,
      height: targetH,
      duration: 0.32,
      ease: 'expo.out',
    })
  } else {
    // 向上：先拉伸顶部到目标顶边，再收起底部
    tl.to(indicator, {
      y: targetY,
      height: (currentY + currentH) - targetY,
      duration: 0.22,
      ease: 'sine.in',
    })
    tl.to(indicator, {
      height: targetH,
      duration: 0.32,
      ease: 'expo.out',
    })
  }
}

onMounted(() => {
  if (!isVertical.value) return

  // 父容器在桌面端由 display:none 切换为 display:block（CSS 媒体查询），
  // onMounted 时 getBoundingClientRect 可能全为零。
  // 用 ResizeObserver 等到容器真正可见、有尺寸时再初始化竖线。
  const ro = new ResizeObserver(() => {
    const btn = getActiveButton()
    if (!btn || btn.getBoundingClientRect().height === 0) return
    moveIndicator(false)
    ro.disconnect()
  })

  if (listRef.value) ro.observe(listRef.value)
})

watch(
  () => props.modelValue,
  async () => {
    if (!isVertical.value) return
    await nextTick()
    moveIndicator(true)
  },
)

// ─────────────────────────────────────────────────────────────────────────────

function selectTab(value: ProfileArticleTab) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <!-- 横向：原样不变 -->
  <div
    v-if="!isVertical"
    class="profile-tabs flex items-center gap-2 overflow-x-auto rounded-[var(--radius-lg)] bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_72%,transparent)] p-1 [scrollbar-width:none] [-ms-overflow-style:none]"
    role="tablist"
  >
    <button
      v-for="item in tabItems"
      :key="item.value"
      type="button"
      role="tab"
      :aria-selected="item.value === modelValue"
      class="flex min-w-fit shrink-0 items-center justify-center gap-2 rounded-[calc(var(--radius-lg)-0.25rem)] px-3 py-2.5 text-sm whitespace-nowrap font-medium tracking-[-0.01em] transition-all duration-200 sm:flex-1 sm:px-4 sm:py-2"
      :class="item.value === modelValue
        ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-xs)]'
        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
      @click="selectTab(item.value)"
    >
      <span class="ptab-label">{{ item.label }}</span>
      <span class="ptab-count">{{ item.badge }}</span>
    </button>
  </div>

  <!-- 竖向：共享绝对定位竖线指示器 -->
  <div
    v-else
    ref="listRef"
    class="profile-tabs relative flex flex-col"
    role="tablist"
  >
    <!-- 滑动竖线 -->
    <div ref="indicatorRef" class="ptab-indicator" aria-hidden="true" />

    <button
      v-for="item in tabItems"
      :key="item.value"
      type="button"
      role="tab"
      :aria-selected="item.value === modelValue"
      class="ptab-v"
      :class="item.value === modelValue ? 'ptab-v--active' : 'ptab-v--idle'"
      @click="selectTab(item.value)"
    >
      <span class="ptab-label">{{ item.label }}</span>
      <span class="ptab-count">{{ item.badge }}</span>
    </button>
  </div>
</template>

<style scoped>
/* ── 竖线指示器 ── */
.ptab-indicator {
  position: absolute;
  left: 0;
  top: 0;
  width: 2px;
  border-radius: 1px;
  background: var(--color-primary);
  pointer-events: none;
  /* 初始 height/y 由 JS 写入 */
}

/* ── 竖向列表项 ── */
.ptab-v {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem 0.55rem 1rem;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  border-radius: var(--radius-md);
  transition: color 240ms ease-in-out;
}

.ptab-label {
  color: var(--color-text);
  font-size: 0.9375rem;
  font-weight: 600;
  transition: color 240ms ease-in-out;
}

.ptab-count {
  color: var(--color-text-muted);
  font-size: 0.6875rem;
}

.ptab-v--active {
  color: var(--color-text);
}

.ptab-v--active .ptab-label {
  font-weight: 700;
  color: var(--color-primary);
}

.ptab-v--idle {
  color: var(--color-text-muted);
}

.ptab-v--idle:hover .ptab-label {
  color: var(--color-primary);
}
</style>
