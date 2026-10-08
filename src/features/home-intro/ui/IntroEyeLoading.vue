<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AnimationItem } from 'lottie-web'
import loadingJson from '@/shared/assets/lottie/editor-save/loading.json?raw'

const props = defineProps<{ progress: number }>()
const host = ref<HTMLElement | null>(null)
const ready = ref(false)
let player: AnimationItem | null = null
let disposed = false
// Preserve Loading V2's staggered tile growth, but hold each tile once full.
// The save-button asset remains unchanged and retains its looping disappearance.
function createFillAnimation() {
  const data = JSON.parse(loadingJson)
  function holdGrowth(value: unknown): void {
    if (!value || typeof value !== 'object') return
    const node = value as Record<string, any>
    if (node.ty === 'tr' && node.s?.a === 1 && Array.isArray(node.s.k)) {
      const full = node.s.k.findIndex((key: { s?: number[] }) => key.s?.every(n => n === 100))
      if (full >= 0) node.s.k = node.s.k.slice(0, full + 1)
    }
    Object.values(node).forEach(child => {
      if (Array.isArray(child)) child.forEach(holdGrowth)
      else holdGrowth(child)
    })
  }
  holdGrowth(data)
  return data
}
function paint() {
  if (ready.value) player?.goToAndStop(Math.max(0, Math.min(1, props.progress)) * 28, true)
}
watch(() => props.progress, paint)
onMounted(async () => {
  try {
    const { default: lottie } = await import('lottie-web/build/player/lottie_svg')
    if (disposed || !host.value) return
    player = lottie.loadAnimation({
      container: host.value, renderer: 'svg', loop: false, autoplay: false,
      animationData: createFillAnimation(),
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet', viewBoxSize: '4 4 24 24' },
    })
    player.addEventListener('DOMLoaded', () => { ready.value = true; paint() })
  } catch {
    // Keep a clock-driven tile fallback; never block the intro clock or skip button.
  }
})
onBeforeUnmount(() => { disposed = true; player?.destroy(); player = null })
</script>

<template>
  <span class="intro-eye-loading" aria-hidden="true">
    <span ref="host" class="intro-eye-loading__player" />
    <span v-if="!ready" class="intro-eye-loading__fallback"><i v-for="n in 49" :key="n" :style="{ transform: `scale(${Math.max(0, Math.min(1, progress * 2 - ((n - 1) % 7 + Math.floor((n - 1) / 7)) / 12))})` }" /></span>
  </span>
</template>

<style scoped>
.intro-eye-loading { position: absolute; inset: 0; width: 100%; height: 100%; clip-path: circle(50%); color: var(--color-snoopy-eye-disc); pointer-events: none; }
.intro-eye-loading__player { display: block; width: 100%; height: 100%; }
.intro-eye-loading__player :deep(svg) { display: block; }
.intro-eye-loading__player :deep(path[fill]:not([fill='none'])) { fill: currentColor; }
.intro-eye-loading__player :deep(path[stroke]:not([stroke='none'])) { stroke: currentColor; }
.intro-eye-loading__fallback { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(7, 1fr); }
.intro-eye-loading__fallback i { background: currentColor;  }
</style>
