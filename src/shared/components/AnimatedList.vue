<template>
  <div
    class="animated-list"
    :style="{ gap: itemGap }"
    role="list"
  >
    <AnimatedItem
      v-for="(item, index) in items"
      :key="resolveItemKey(item, index)"
      :index="index"
      :active="active"
      :delay="getItemDelay(index)"
      :duration="duration"
      :reduced-motion="reducedMotion"
    >
      <slot :item="item" :index="index" />
    </AnimatedItem>
  </div>
</template>

<script setup lang="ts" generic="T">
import { useIntersectionObserver, usePreferredReducedMotion } from '@vueuse/core'
import { computed, defineComponent, h, ref, watch } from 'vue'

const AnimatedItem = defineComponent({
  name: 'AnimatedListItem',
  props: {
    index: { type: Number, required: true },
    active: { type: Boolean, default: true },
    delay: { type: Number, default: 0 },
    duration: { type: Number, default: 0.24 },
    reducedMotion: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const itemRef = ref<HTMLElement | null>(null)
    const inView = ref(false)
    const revealed = ref(props.reducedMotion)

    const { stop } = useIntersectionObserver(
      itemRef,
      ([entry]) => {
        if (!entry?.isIntersecting) return
        inView.value = true
        if (props.active) {
          revealed.value = true
        }
      },
      {
        threshold: 0.35,
      },
    )

    watch(
      [inView, () => props.active, () => props.reducedMotion],
      ([visible, active, prefersReducedMotion]) => {
        if (prefersReducedMotion || (active && visible)) {
          revealed.value = true
        }
      },
      { immediate: true },
    )

    watch(revealed, (visible) => {
      if (visible) stop()
    }, { immediate: true })

    return () =>
      h(
        'div',
        {
          ref: itemRef,
          role: 'listitem',
          'data-index': props.index,
          class: [
            'animated-list__item',
            {
              'animated-list__item--visible': revealed.value,
              'animated-list__item--reduced': props.reducedMotion,
            },
          ],
          style: {
            '--animated-list-delay': `${props.delay}s`,
            '--animated-list-duration': `${props.duration}s`,
          },
        },
        slots.default?.(),
      )
  },
})

type AnimatedListKey = string | number

interface AnimatedListProps<TItem> {
  items: TItem[]
  active?: boolean
  visibleCount?: number
  stagger?: number
  duration?: number
  itemGap?: string
  getKey?: (item: TItem, index: number) => AnimatedListKey
}

const props = withDefaults(defineProps<AnimatedListProps<T>>(), {
  active: true,
  visibleCount: 3,
  stagger: 0.065,
  duration: 0.24,
  itemGap: '0.75rem',
  getKey: undefined,
})

defineSlots<{
  default(props: { item: T; index: number }): unknown
}>()

const preferredReducedMotion = usePreferredReducedMotion()
const reducedMotion = computed(() => preferredReducedMotion.value === 'reduce')
const normalizedVisibleCount = computed(() => Math.max(0, props.visibleCount))

function resolveItemKey(item: T, index: number): AnimatedListKey {
  return props.getKey?.(item, index) ?? index
}

function getItemDelay(index: number): number {
  if (reducedMotion.value || index >= normalizedVisibleCount.value) return 0
  return index * props.stagger
}
</script>

<style scoped>
.animated-list {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

:deep(.animated-list__item) {
  flex: 0 0 auto;
  opacity: 0;
  transform: translate3d(0, 8px, 0) scale(0.985);
  transform-origin: center top;
  transition:
    opacity var(--animated-list-duration, 0.24s) cubic-bezier(0.22, 1, 0.36, 1),
    transform var(--animated-list-duration, 0.24s) cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: var(--animated-list-delay, 0s);
}

:deep(.animated-list__item--visible) {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

:deep(.animated-list__item--reduced) {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  :deep(.animated-list__item) {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
