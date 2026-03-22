<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { cn } from '@/shared/utils/cn'

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

const props = withDefaults(
    defineProps<{
      text?: string
      placement?: TooltipPlacement
      disabled?: boolean
      openDelay?: number
    }>(),
    {
      text: '',
      placement: 'top',
      disabled: false,
      openDelay: 120,
    },
)

const open = ref(false)
let timer: number | null = null

const placementClass = computed(() => {
  switch (props.placement) {
    case 'top':
      return 'bottom-full left-1/2 mb-2 -translate-x-1/2'
    case 'bottom':
      return 'top-full left-1/2 mt-2 -translate-x-1/2'
    case 'left':
      return 'right-full top-1/2 mr-2 -translate-y-1/2'
    case 'right':
      return 'left-full top-1/2 ml-2 -translate-y-1/2'
  }
})

function show() {
  if (props.disabled) return
  timer = window.setTimeout(() => {
    open.value = true
  }, props.openDelay)
}

function hide() {
  if (timer) {
    window.clearTimeout(timer)
    timer = null
  }
  open.value = false
}

onBeforeUnmount(hide)
</script>

<template>
  <span
      class="relative inline-flex"
      @mouseenter="show"
      @mouseleave="hide"
      @focusin="show"
      @focusout="hide"
  >
    <slot />

    <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
    >
      <span
          v-if="open && text"
          role="tooltip"
          :class="
          cn(
            'pointer-events-none absolute z-50 max-w-xs rounded-[var(--radius-sm)] bg-[var(--color-text)] px-2.5 py-1.5 text-xs text-[var(--color-surface)] shadow-[var(--shadow-sm)]',
            placementClass,
          )
        "
      >
        {{ text }}
      </span>
    </Transition>
  </span>
</template>