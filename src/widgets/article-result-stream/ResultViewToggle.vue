<script setup lang="ts">
import { computed } from 'vue'
import { Grid2x2, PanelsTopLeft, Rows3 } from 'lucide-vue-next'

import { RESULT_VIEW_MODE, type ResultViewMode } from './result-view'

const props = defineProps<{
  modelValue: ResultViewMode
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ResultViewMode]
}>()

const options = [
  {
    value: RESULT_VIEW_MODE.GALLERY,
    label: '画廊视图',
    icon: PanelsTopLeft,
  },
  {
    value: RESULT_VIEW_MODE.LIST,
    label: '列表视图',
    icon: Rows3,
  },
  {
    value: RESULT_VIEW_MODE.GRID,
    label: '网格视图',
    icon: Grid2x2,
  },
] as const

const activeIndex = computed(() => {
  const index = options.findIndex((option) => option.value === props.modelValue)
  return index >= 0 ? index : 0
})

function updateValue(value: ResultViewMode) {
  if (value === props.modelValue) return
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="result-view-toggle"
    role="tablist"
    aria-label="切换结果视图"
    :style="{ '--result-view-active-index': activeIndex }"
  >
    <span class="result-view-toggle__thumb" aria-hidden="true" />
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="result-view-toggle__button"
      :class="option.value === modelValue && 'result-view-toggle__button--active'"
      :aria-label="option.label"
      :aria-selected="option.value === modelValue"
      :title="option.label"
      role="tab"
      @click="updateValue(option.value)"
    >
      <component :is="option.icon" :size="16" :stroke-width="1.9" />
    </button>
  </div>
</template>

<style scoped>
.result-view-toggle {
  --result-view-button-width: 2.25rem;
  --result-view-button-height: 2.125rem;
  --result-view-thumb-offset: calc(var(--result-view-active-index) * var(--result-view-button-width));
  display: inline-flex;
  align-items: center;
  position: relative;
  gap: 0;
  padding: 0.1875rem;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 72%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-surface-elevated) 94%, transparent);
  box-shadow:
    var(--shadow-inset),
    0 1px 2px rgb(15 23 42 / 0.03),
    0 8px 18px rgb(15 23 42 / 0.04);
  backdrop-filter: blur(var(--backdrop-blur-soft)) saturate(130%);
}

.result-view-toggle__thumb {
  position: absolute;
  top: 0.1875rem;
  left: 0.1875rem;
  width: var(--result-view-button-width);
  height: var(--result-view-button-height);
  border-radius: calc(var(--radius-pill) - 0.125rem);
  background: color-mix(in srgb, var(--color-surface) 90%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-border-strong) 52%, transparent);
  transform: translate3d(var(--result-view-thumb-offset), 0, 0);
  transition:
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 180ms ease,
    box-shadow 180ms ease;
  pointer-events: none;
}

.result-view-toggle__button {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--result-view-button-width);
  height: var(--result-view-button-height);
  border: 0;
  border-radius: calc(var(--radius-pill) - 0.125rem);
  color: var(--color-text-muted);
  background: transparent;
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease;
}

.result-view-toggle__button:hover {
  color: var(--color-text);
}

.result-view-toggle__button:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent),
    0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent);
}

.result-view-toggle__button--active {
  color: var(--color-text);
}

.result-view-toggle__button:active {
  transform: scale(0.97);
}

</style>
