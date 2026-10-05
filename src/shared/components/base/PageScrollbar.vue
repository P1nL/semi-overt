<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getPageScrollbarGeometry, getPageScrollTopFromThumb } from '@/shared/utils/pageScrollbar'

const props = defineProps<{ container: HTMLElement | null; active: boolean }>()
const trackRef = ref<HTMLElement | null>(null)
const thumbRef = ref<HTMLElement | null>(null)
const metrics = ref({ scrollRange: 0, thumbSize: 32, travel: 0, thumbOffset: 0 })
const scrollTop = ref(0)
const visible = computed(() => props.active && metrics.value.scrollRange > 1)
let observed: HTMLElement | null = null
let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null
let frame = 0
let drag: { id: number; startY: number; offset: number } | null = null

function measure() {
  frame = 0
  const container = props.container
  const track = trackRef.value
  if (!container || !track) return
  scrollTop.value = container.scrollTop
  metrics.value = getPageScrollbarGeometry(container.clientHeight, container.scrollHeight, track.clientHeight, scrollTop.value)
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(measure)
}
function observeContent() {
  if (!observed || !resizeObserver) return
  resizeObserver.disconnect()
  resizeObserver.observe(observed)
  const content = observed.querySelector('.app-interface')
  if (content) resizeObserver.observe(content)
  schedule()
}
function releaseDrag() {
  if (drag && trackRef.value?.hasPointerCapture(drag.id)) trackRef.value.releasePointerCapture(drag.id)
  drag = null
}
function disconnect() {
  releaseDrag()
  observed?.removeEventListener('scroll', schedule)
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  window.removeEventListener('resize', schedule)
  cancelAnimationFrame(frame)
  frame = 0
  observed = null
}
watch(() => [props.container, props.active, trackRef.value] as const, ([container, active]) => {
  disconnect()
  if (!container || !active || !trackRef.value) return
  observed = container
  container.addEventListener('scroll', schedule, { passive: true })
  resizeObserver = new ResizeObserver(schedule)
  mutationObserver = new MutationObserver(observeContent)
  mutationObserver.observe(container, { childList: true, subtree: true, characterData: true })
  window.addEventListener('resize', schedule, { passive: true })
  observeContent()
}, { flush: 'post', immediate: true })
onBeforeUnmount(disconnect)

function seek(offset: number) {
  if (!props.container) return
  props.container.scrollTop = getPageScrollTopFromThumb(offset, metrics.value.travel, metrics.value.scrollRange)
  schedule()
}
function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || !visible.value || !trackRef.value) return
  event.preventDefault()
  measure()
  if (event.target !== thumbRef.value) {
    seek(event.clientY - trackRef.value.getBoundingClientRect().top - metrics.value.thumbSize / 2)
    measure()
  }
  drag = { id: event.pointerId, startY: event.clientY, offset: metrics.value.thumbOffset }
  trackRef.value.setPointerCapture(event.pointerId)
}
function onPointerMove(event: PointerEvent) {
  if (drag?.id === event.pointerId) seek(drag.offset + event.clientY - drag.startY)
}
function onKeydown(event: KeyboardEvent) {
  const container = props.container
  if (!container || !visible.value) return
  const steps: Record<string, number> = {
    ArrowDown: 48, ArrowUp: -48, PageDown: container.clientHeight * 0.9, PageUp: -container.clientHeight * 0.9,
  }
  if (event.key === 'Home') container.scrollTop = 0
  else if (event.key === 'End') container.scrollTop = metrics.value.scrollRange
  else if (event.key in steps) container.scrollTop += steps[event.key]!
  else return
  event.preventDefault()
  schedule()
}
</script>

<template>
    <div
      ref="trackRef"
      class="page-scrollbar"
      :class="visible && 'page-scrollbar--visible'"
      role="scrollbar"
      aria-label="页面滚动"
      aria-orientation="vertical"
      :aria-controls="container?.id"
      :aria-valuemin="0"
      :aria-valuemax="Math.round(metrics.scrollRange)"
      :aria-valuenow="Math.round(scrollTop)"
      :aria-hidden="!visible"
      :tabindex="visible ? 0 : -1"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="releaseDrag"
      @pointercancel="releaseDrag"
      @lostpointercapture="releaseDrag"
      @keydown="onKeydown"
    >
      <div ref="thumbRef" class="page-scrollbar__thumb" :style="{ height: metrics.thumbSize + 'px', transform: 'translateY(' + metrics.thumbOffset + 'px)' }" />
    </div>
</template>

<style scoped>
.page-scrollbar {
  position: fixed;
  top: calc(var(--header-height) + 0.5rem);
  right: 0.2rem;
  bottom: 0.5rem;
  z-index: 30;
  width: 14px;
  opacity: 0;
  pointer-events: none;
  touch-action: none;
  user-select: none;
}
.page-scrollbar--visible { opacity: 1; pointer-events: auto; }
.page-scrollbar__thumb {
  width: var(--scrollbar-size);
  min-height: 32px;
  margin-inline: auto;
  border-radius: var(--radius-pill);
  background: var(--color-scrollbar-thumb-hover);
  cursor: grab;
}
.page-scrollbar:active .page-scrollbar__thumb { cursor: grabbing; }
.page-scrollbar:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; border-radius: var(--radius-pill); }
@media (min-width: 768px) { .page-scrollbar { top: calc(var(--header-height-md) + 0.5rem); } }
</style>
