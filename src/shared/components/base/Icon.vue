<script setup lang="ts">
import { computed } from 'vue'

import AnimatedCloseIcon from './AnimatedCloseIcon.vue'
import AnimatedSearchIcon from './AnimatedSearchIcon.vue'

const props = withDefaults(
    defineProps<{
      name: string
      size?: number | string
      strokeWidth?: number
      decorative?: boolean
      title?: string
    }>(),
    {
      size: 18,
      strokeWidth: 2,
      decorative: true,
      title: '',
    },
)

const iconMap: Record<string, string[]> = {
  close: ['M6 6l12 12', 'M18 6 6 18'],
  x: ['M6 6l12 12', 'M18 6 6 18'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  minus: ['M5 12h14'],
  plus: ['M12 5v14', 'M5 12h14'],
  edit: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6', 'M14 11v6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-up': ['M6 15l6-6 6 6'],
  'chevron-left': ['M15 6l-6 6 6 6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  search: ['M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z', 'm20 20-4.2-4.2'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 20a8 8 0 0 1 16 0'],
  info: ['M12 16v-4', 'M12 8h.01', 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z'],
  warning: ['M12 9v4', 'M12 17h.01', 'M10.29 3.86 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3l-8.47-14a2 2 0 0 0-3.42 0Z'],
  success: ['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z', 'm8.5 12.5 2.5 2.5 5-5'],
  error: ['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z', 'M15 9 9 15', 'm9 9 6 6'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
}

const isAnimatedClose = computed(() => props.name === 'close' || props.name === 'x')
const isAnimatedSearch = computed(() => props.name === 'search')
const paths = computed(() => iconMap[props.name] ?? iconMap.info)
const pxSize = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <AnimatedCloseIcon
      v-if="isAnimatedClose"
      :size="size"
      :decorative="decorative"
      :title="title"
  />
  <AnimatedSearchIcon
      v-else-if="isAnimatedSearch"
      :size="size"
      :decorative="decorative"
      :title="title"
  />
  <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      :width="pxSize"
      :height="pxSize"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      :stroke-width="strokeWidth"
      :aria-hidden="decorative ? 'true' : undefined"
      :role="decorative ? undefined : 'img'"
  >
    <title v-if="!decorative && title">{{ title }}</title>
    <path v-for="(path, index) in paths" :key="`${name}-${index}`" :d="path" />
  </svg>
</template>
