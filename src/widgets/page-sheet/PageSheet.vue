<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import Icon from '@/shared/components/base/Icon.vue'
import IconButton from '@/shared/components/base/IconButton.vue'
import { createSheetSequence } from './model/sequence'
import { UI_TIMING } from '@/shared/constants/ui'
import { getPageScrollPosition, scrollPageTo } from '@/shared/utils/pageScroll'

const props = withDefaults(
  defineProps<{
    open?: boolean
    animated?: boolean
    contentAnimated?: boolean
    inset?: 'default' | 'article' | 'editor'
    variant?: 'default' | 'full'
    scrollMode?: 'sheet' | 'content'
    backgroundScrollX?: number
    backgroundScrollY?: number
  }>(),
  {
    open: false,
    animated: true,
    contentAnimated: true,
    inset: 'default',
    variant: 'default',
    scrollMode: 'sheet',
  },
)

const motionStyle = {
  '--page-sheet-enter-duration': `${UI_TIMING.PAGE_SHEET_ENTER}ms`,
  '--page-sheet-leave-duration': `${UI_TIMING.PAGE_SHEET_LEAVE}ms`,
}

const emit = defineEmits<{
  close: []
  'after-close': []
}>()

let previousBodyOverflow = ''
let previousHtmlOverflow = ''
let lockedScrollX = 0
let lockedScrollY = 0
let bodyLockActive = false
let visualOpenFrame: number | null = null
const visualOpen = ref(false)
const contentReady = ref(false)
const contentArmed = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)
const closeRef = ref<HTMLElement | null>(null)
let sequence: ReturnType<typeof createSheetSequence> | undefined
function ensureSequence() {
  if (!sequence && panelRef.value) sequence = createSheetSequence(panelRef.value, backdropRef.value, closeRef.value,
    phase => { contentReady.value = phase === 'open' },
    phase => { if (phase === 'leave') { visualOpen.value = false; syncBodyLock(false); emit('after-close') } }, props.contentAnimated)
  return sequence
}

function restoreBodyLock() {
  if (typeof document === 'undefined' || !bodyLockActive) return
  document.documentElement.style.overflow = previousHtmlOverflow
  document.body.style.overflow = previousBodyOverflow
  scrollPageTo({ left: lockedScrollX, top: lockedScrollY, behavior: 'auto' })
  bodyLockActive = false
}

function syncBodyLock(locked: boolean) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  if (!locked) {
    restoreBodyLock()
    return
  }

  if (bodyLockActive) return

  previousHtmlOverflow = document.documentElement.style.overflow
  previousBodyOverflow = document.body.style.overflow
  lockedScrollX = typeof props.backgroundScrollX === 'number' && Number.isFinite(props.backgroundScrollX)
    ? props.backgroundScrollX
    : getPageScrollPosition().left
  lockedScrollY = typeof props.backgroundScrollY === 'number' && Number.isFinite(props.backgroundScrollY)
    ? props.backgroundScrollY
    : getPageScrollPosition().top
  bodyLockActive = true

  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  // The app owns scrolling. Do not fix/resize body or change page geometry.
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
    visualOpenFrame = null
    const motion = ensureSequence()
    motion?.play('enter', window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)
    contentArmed.value = true
    visualOpen.value = true
  })
}

watch(
  () => props.open,
  (value, previous) => {
    if (value) syncBodyLock(true)

    if (typeof window === 'undefined') return

    if (!props.animated) {
      clearVisualOpenFrame()
      sequence?.dispose()
      sequence = undefined
      visualOpen.value = value
      contentArmed.value = true
      contentReady.value = value
      if (value) window.addEventListener('keydown', onWindowKeydown)
      else {
        window.removeEventListener('keydown', onWindowKeydown)
        syncBodyLock(false)
        if (previous !== undefined) emit('after-close')
      }
      return
    }

    if (value) {
      queueVisualOpen()
      window.addEventListener('keydown', onWindowKeydown)
      return
    }

    clearVisualOpenFrame()
    contentReady.value = false
    window.removeEventListener('keydown', onWindowKeydown)
    if (previous === undefined) return
    if (sequence) sequence.play('leave', window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)
    else { visualOpen.value = false; syncBodyLock(false); emit('after-close') }
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(() => {
  clearVisualOpenFrame()
  sequence?.dispose()

  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onWindowKeydown)
  }

  restoreBodyLock()
})
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-0 z-[70]" :style="motionStyle">
      <button
        ref="backdropRef"
        type="button"
        class="page-sheet-backdrop absolute inset-0 border-0 bg-[var(--color-sheet-overlay)] backdrop-blur-[8px]"
        :class="visualOpen ? 'page-sheet-backdrop--open' : ''"
        aria-label="Close panel"
        :aria-hidden="!open"
        :tabindex="open ? 0 : -1"
        @click="emit('close')"
      />

      <div
        ref="closeRef"
        class="page-sheet-close pointer-events-none absolute inset-x-0 top-0 flex items-center justify-end px-4 md:px-6"
        :class="[visualOpen ? 'page-sheet-close--open' : '', 'page-sheet-close--drawer']"
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
        ref="panelRef"
        :data-content-armed="contentArmed"
        :data-content-animated="props.contentAnimated"
        class="page-sheet-panel page-sheet-panel--managed app-scrollbar absolute inset-x-0 bottom-0 flex min-h-0 flex-col overflow-x-hidden bg-[color-mix(in_srgb,var(--color-surface)_92%,var(--color-surface-glass-strong)_8%)] backdrop-blur-[16px]"
        :class="[
          visualOpen ? 'page-sheet-panel--open' : '',
          props.variant === 'full'
            ? [
              'top-0 rounded-none border-0 shadow-none',
              props.scrollMode === 'content' ? 'overflow-y-hidden' : 'overflow-y-auto',
            ]
            : [
              'page-sheet-panel--drawer',
              props.scrollMode === 'content' ? 'overflow-y-hidden' : 'overflow-y-auto',
              'rounded-t-[2rem] border-x border-t border-[color-mix(in_srgb,var(--color-border)_82%,white_14%)] shadow-[0_-18px_48px_rgb(15_23_42_/_0.12)]',
            ],
        ]"
        :aria-hidden="!open"
        :inert="!open || !contentReady"
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
.page-sheet-close--drawer { height: var(--drawer-top); }
.page-sheet-panel--drawer { top: var(--drawer-top); }

.page-sheet-backdrop {
  opacity: 0;
  pointer-events: none;
  transition: none;
}

.page-sheet-backdrop--open {
  opacity: 1;
  pointer-events: auto;
}

.page-sheet-close {
  opacity: 0;
  transform: translateY(-8px);
  transition: none;
}

.page-sheet-close--open {
  opacity: 1;
  transform: translateY(0);
}

.page-sheet-panel {
  pointer-events: none;
  transform: translate3d(0, 100%, 0);
  transition: transform var(--page-sheet-leave-duration) cubic-bezier(0.4, 0, 1, 1);
  will-change: transform;
}

.page-sheet-panel.page-sheet-panel--open {
  pointer-events: auto;
  transform: translate3d(0, 0, 0);
  transition: transform var(--page-sheet-enter-duration) cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .page-sheet-panel {
    transition-duration: 1ms;
    will-change: auto;
  }
}

</style>

<style scoped>
/* The route content keeps its original flex/scroll structure; only owned motion
   channels change. Disable CSS transitions that would fight the shared clock. */
.page-sheet-panel--managed { transition: none !important; }
.page-sheet-panel--managed[data-content-armed="false"] > :deep(*) { visibility: hidden; }
.page-sheet-panel--managed[data-content-animated="true"] :deep([data-sheet-motion]) { animation: none !important; transition: none !important; }
</style>
