<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AnimationItem } from 'lottie-web'
import loadingJson from '@/shared/assets/lottie/editor-save/loading.json?raw'
import checkmarkJson from '@/shared/assets/lottie/editor-save/checkmark.json?raw'

const props = defineProps<{ state: 'idle' | 'saving' | 'saved' | 'error'; animate?: boolean; finishLoading?: boolean }>()
const emit = defineEmits<{ 'loading-cycle-complete': []; 'saved-complete': [] }>()
const host = ref<HTMLElement | null>(null)
const reduced = ref(false)
let player: AnimationItem | null = null
let version = 0
let media: MediaQueryList | null = null
let unavailable = false
let completionSent = false
function completeLoading() {
  if (completionSent || props.state !== 'saving' || !props.finishLoading) return
  completionSent = true
  emit('loading-cycle-complete')
}
watch(() => props.finishLoading, () => {
  if (reduced.value || unavailable) completeLoading()
})
function destroy() { version++; player?.destroy(); player = null }
function motionChanged() { reduced.value = media?.matches ?? false }
watch([() => props.state, host, reduced], async () => {
  destroy()
  if (!host.value || !['saving', 'saved'].includes(props.state)) return
  const run = version
  const state = props.state
  completionSent = false
  unavailable = false
  try {
    const { default: lottie } = await import('lottie-web/build/player/lottie_svg')
    if (run !== version || !host.value) return
    player = lottie.loadAnimation({
      container: host.value, renderer: 'svg', loop: state === 'saving', autoplay: !reduced.value,
      animationData: JSON.parse(state === 'saving' ? loadingJson : checkmarkJson),
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
        // Loading's visible tiles occupy 4..28 within its 32px canvas.
        viewBoxSize: state === 'saving' ? '4 4 24 24' : undefined,
      },
    })
    player.addEventListener('loopComplete', () => {
      if (run !== version || !props.finishLoading) return
      player?.goToAndStop(45, true)
      completeLoading()
    })
    player.addEventListener('complete', () => {
      if (run === version && state === 'saved') emit('saved-complete')
    })
    if (reduced.value) player.goToAndStop(state === 'saved' ? 44 : 0, true)
    if (reduced.value) completeLoading()
    if (reduced.value && state === 'saved') emit('saved-complete')
  } catch {
    if (run !== version) return
    unavailable = true
    completeLoading()
    if (state === 'saved') emit('saved-complete')
  }
}, { flush: 'post' })
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionChanged()
  media.addEventListener('change', motionChanged)
})
onBeforeUnmount(() => { destroy(); media?.removeEventListener('change', motionChanged) })
</script>

<template>
  <span class="editor-save-icon" aria-hidden="true">
    <span v-if="state === 'saving' || state === 'saved'" ref="host" class="editor-save-icon__animation" :class="{ 'editor-save-icon__animation--saved': state === 'saved' }" />
    <svg v-else-if="state === 'error'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3 13 12H3L8 3Z" /><path d="M8 6.2v2.8" /><circle cx="8" cy="11.1" r="0.6" fill="currentColor" stroke="none" />
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-pen-line-icon" :class="{ animate }">
      <path d="m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2" />
      <path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" class="pen" />
      <path d="M8 18h1" class="line" />
    </svg>
  </span>
</template>

<style scoped>
.editor-save-icon { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; line-height: 0; }
.editor-save-icon__animation { display: block; width: 100%; height: 100%; line-height: 0; }
.editor-save-icon__animation--saved { color: var(--color-success); }
.editor-save-icon__animation :deep(svg) { display: block; }
.editor-save-icon > svg { width: 100%; height: 100%; overflow: visible; }
.editor-save-icon__animation :deep(path[stroke]:not([stroke='none'])) { stroke: currentColor; }
.editor-save-icon__animation :deep(path[fill]:not([fill='none'])) { fill: currentColor; }
.pen { transform-origin: 19.876px 11.124px; transition: transform 0.25s ease-in-out; }
.animate .pen { animation: penWiggle 0.5s ease-in-out 2; }
.line { transition: d 0.5s ease-in-out; }
.animate .line { d: path('M8 18h5'); }
@keyframes penWiggle {
  0%, 100% { transform: rotate(0deg) translate(0px, 0px); }
  25% { transform: rotate(-0.3deg) translate(-0.5px, 1px); }
  50% { transform: rotate(0.2deg) translate(1px, -0.5px); }
  75% { transform: rotate(-0.4deg) translate(0px, 0px); }
}
@media (prefers-reduced-motion: reduce) { .animate .pen { animation: none; } .line, .pen { transition: none; } }
</style>
