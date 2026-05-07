<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import Icon from '@/shared/components/base/Icon.vue'
import IconButton from '@/shared/components/base/IconButton.vue'

const props = withDefaults(
  defineProps<{
    open?: boolean
    inset?: 'default' | 'article'
    variant?: 'default' | 'full'
    scrollMode?: 'sheet' | 'content'
  }>(),
  {
    open: false,
    inset: 'default',
    variant: 'default',
    scrollMode: 'sheet',
  },
)

const emit = defineEmits<{
  close: []
}>()

let previousBodyOverflow = ''
let previousHtmlOverflow = ''
let visualOpenFrame: number | null = null

const visualOpen = ref(false)

function restoreBodyLock() {
  if (typeof document === 'undefined') return

  document.documentElement.style.overflow = previousHtmlOverflow
  document.body.style.overflow = previousBodyOverflow
}

function syncBodyLock(locked: boolean) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  if (!locked) {
    restoreBodyLock()
    return
  }

  previousHtmlOverflow = document.documentElement.style.overflow
  previousBodyOverflow = document.body.style.overflow

  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
}

function onWindowKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key !== 'Escape') return

  event.preventDefault()
  emit('close')
}

function clearVisualOpenFrame() {
  if (visualOpenFrame === null || typeof window === 'undefined') return

  window.cancelAnimationFrame(visualOpenFrame)
  visualOpenFrame = null
}

function queueVisualOpen() {
  if (typeof window === 'undefined') {
    visualOpen.value = true
    return
  }

  clearVisualOpenFrame()
  visualOpen.value = false
  visualOpenFrame = window.requestAnimationFrame(() => {
    visualOpen.value = true
    visualOpenFrame = null
  })
}

watch(
  () => props.open,
  (value) => {
    syncBodyLock(value)

    if (typeof window === 'undefined') return

    if (value) {
      queueVisualOpen()
      window.addEventListener('keydown', onWindowKeydown)
      return
    }

    clearVisualOpenFrame()
    visualOpen.value = false
    window.removeEventListener('keydown', onWindowKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearVisualOpenFrame()

  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onWindowKeydown)
  }

  restoreBodyLock()
})
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-0 z-[70]">
      <button
        type="button"
        class="page-sheet-backdrop absolute inset-0 border-0 bg-[rgba(8,12,20,0.26)] backdrop-blur-[8px]"
        :class="visualOpen ? 'page-sheet-backdrop--open' : ''"
        aria-label="Close panel"
        :aria-hidden="!open"
        :tabindex="open ? 0 : -1"
        @click="emit('close')"
      />

      <div
        class="page-sheet-close pointer-events-none absolute inset-x-0 top-0 flex h-20 items-center justify-end px-4 md:h-24 md:px-6"
        :class="visualOpen ? 'page-sheet-close--open' : ''"
        :aria-hidden="!open"
      >
        <div class="pointer-events-auto">
          <IconButton
            ariaLabel="Close"
            variant="ghost"
            size="lg"
            class="!border-transparent !bg-transparent !shadow-none hover:!border-transparent hover:!bg-transparent"
            :disabled="!open"
            :tabindex="open ? 0 : -1"
            @click="emit('close')"
          >
            <Icon name="close" :size="18" />
          </IconButton>
        </div>
      </div>

      <section
        class="page-sheet-panel absolute inset-x-0 bottom-0 flex min-h-0 flex-col overflow-x-hidden bg-[color-mix(in_srgb,var(--color-surface)_92%,var(--color-surface-glass-strong)_8%)] backdrop-blur-[16px]"
        :class="[
          visualOpen ? 'page-sheet-panel--open' : '',
          props.variant === 'full'
            ? [
              'top-0 rounded-none border-0 shadow-none',
              props.scrollMode === 'content' ? 'overflow-y-hidden' : 'overflow-y-auto',
            ]
            : [
              props.inset === 'article' ? 'top-20 md:top-24' : 'top-[calc(var(--header-height)-0.75rem)] md:top-[var(--header-height)]',
              props.scrollMode === 'content' ? 'overflow-y-hidden' : 'overflow-y-auto',
              'rounded-t-[2rem] border-x border-t border-[color-mix(in_srgb,var(--color-border)_82%,white_14%)] shadow-[0_-18px_48px_rgb(15_23_42_/_0.12)]',
            ],
        ]"
        :aria-hidden="!open"
      >
        <div
          class="relative min-h-0 flex-1 overscroll-contain"
          :class="props.scrollMode === 'content' ? 'overflow-hidden' : ''"
        >
          <slot />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.page-sheet-backdrop {
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}

.page-sheet-backdrop--open {
  opacity: 1;
  pointer-events: auto;
}

.page-sheet-close {
  opacity: 0;
  transform: translateY(-8px);
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.page-sheet-close--open {
  opacity: 1;
  transform: translateY(0);
}

.page-sheet-panel {
  opacity: 0;
  pointer-events: none;
  transform: translateY(56px);
  transition:
    opacity 240ms ease,
    transform 240ms cubic-bezier(0.4, 0, 1, 1);
}

.page-sheet-panel--open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
  transition:
    opacity 320ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

</style>
