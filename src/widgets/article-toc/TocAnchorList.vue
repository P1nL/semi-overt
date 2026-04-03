<script setup lang="ts">
import { computed } from 'vue'

import type { TocHeading } from '@/features/toc-sync'

const props = defineProps<{
  headings: TocHeading[]
  activeId: string
  expanded: boolean
}>()

const emit = defineEmits<{
  select: [string]
}>()

const TOC_LINE_MAX_REM = 0.72
const TOC_LINE_MIN_REM = 0.46

const levelRange = computed(() => {
  if (!props.headings.length) {
    return {
      min: 0,
      max: 0,
    }
  }

  const levels = props.headings.map((item) => item.level)

  return {
    min: Math.min(...levels),
    max: Math.max(...levels),
  }
})

function getLineWidth(level: number) {
  const { min, max } = levelRange.value

  if (max <= min) {
    return `${TOC_LINE_MAX_REM}rem`
  }

  const ratio = (level - min) / (max - min)
  const width = TOC_LINE_MAX_REM - ratio * (TOC_LINE_MAX_REM - TOC_LINE_MIN_REM)

  return `${width.toFixed(3)}rem`
}
</script>

<template>
  <ul class="toc-anchor-list">
    <li v-for="item in headings" :key="item.id">
      <button
          type="button"
          class="toc-anchor"
          :class="[
            expanded && 'toc-anchor--expanded',
            activeId === item.id && 'toc-anchor--active',
          ]"
          :style="{ '--toc-line-width': getLineWidth(item.level) }"
          @click="emit('select', item.id)"
      >
        <span class="toc-anchor__label">{{ item.text }}</span>
        <span class="toc-anchor__line" aria-hidden="true" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.toc-anchor-list {
  display: flex;
  width: max-content;
  flex-direction: column;
  gap: 0.10rem;
  align-items: stretch;
}

.toc-anchor {
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: flex-end;
  gap: 0.9rem;
  padding: 0.15rem 0;
  color: var(--color-text-muted);
  transition:
    color 180ms ease,
    transform 260ms ease;
}

.toc-anchor:hover {
  color: var(--color-text);
}

.toc-anchor__label {
  overflow: hidden;
  flex: 0 1 auto;
  max-width: 0;
  opacity: 0;
  transform: translateX(0.4rem);
  white-space: nowrap;
  text-align: right;
  text-overflow: ellipsis;
  font-size: 0.92rem;
  line-height: 1.45;
  transition:
    max-width 220ms ease,
    opacity 180ms ease,
    transform 300ms ease,
    color 180ms ease;
}

.toc-anchor__line {
  display: block;
  height: 2px;
  width: var(--toc-line-width, 0.72rem);
  flex: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-faint) 46%, transparent);
  opacity: 0.72;
  transform-origin: right center;
  transition:
    width 240ms ease,
    background-color 180ms ease,
    transform 260ms ease,
    opacity 220ms ease;
}

.toc-anchor--expanded .toc-anchor__label {
  max-width: 14rem;
  opacity: 1;
  transform: translateX(0);
}

.toc-anchor--active {
  color: var(--color-text);
  transform: translateX(-0.14rem);
}

.toc-anchor--active .toc-anchor__label {
  color: var(--color-primary);
  font-weight: 600;
  transform: translateX(-0.08rem);
}

.toc-anchor--active .toc-anchor__line {
  background: var(--color-primary);
  opacity: 1;
  transform: scaleX(1.4);
}

@media (max-width: 1023px) {
  .toc-anchor-list {
    width: 100%;
    gap: 0.4rem;
  }

  .toc-anchor {
    justify-content: space-between;
    gap: 0.85rem;
    padding: 0.35rem 0;
  }

  .toc-anchor__label,
  .toc-anchor--expanded .toc-anchor__label {
    max-width: none;
    opacity: 1;
    transform: none;
    white-space: normal;
    text-align: left;
  }

  .toc-anchor__line {
    order: -1;
    width: 0.8rem;
    transform-origin: left center;
  }

  .toc-anchor--active {
    transform: none;
  }

  .toc-anchor--active .toc-anchor__label {
    transform: none;
  }
}
</style>
