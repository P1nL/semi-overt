<script setup lang="ts">
import { computed, inject, onBeforeUnmount, provide, ref, toRef, watch } from 'vue'
import { animationSceneKey } from '@/shared/composables/useAnimationVisibility'
import { pageMotionKey, type PageMotionKind, type PageMotionPhase } from '@/shared/composables/usePageMotion'
import { playScene, snapshotScene, type SceneOptions } from '../model/scene'

const props = defineProps<{ phase: PageMotionPhase; kind: PageMotionKind; staged?: boolean }>()
const root = ref<HTMLElement | null>(null)
const managed = ref(props.phase !== 'idle')
const prepared = ref(props.phase === 'idle')
watch(() => props.phase, phase => {
  if (phase === 'enter' || phase === 'swap') prepared.value = false
}, { flush: 'sync' })
const parentScene = inject(animationSceneKey, null)
provide(animationSceneKey, {
  content: computed(() => (parentScene?.content.value ?? true) && props.phase !== 'staged' && props.phase !== 'leave'),
  background: computed(() => parentScene?.background.value ?? true),
})
provide(pageMotionKey, { phase: toRef(props, 'phase') })
let cancel: (() => void) | undefined
function stop() { cancel?.(); cancel = undefined }
function play(options: SceneOptions, done: () => void) {
  stop()
  if (!root.value) { done(); return }
  managed.value = true
  const start = () => {
    if (!root.value) return
    cancel = playScene(root.value, options, done)
    // Reveal only after every currently mounted effect has painted its first frame.
    prepared.value = true
  }
  if ((options.kind === 'profile' || options.kind === 'results') && options.phase === 'enter' && !options.reduced) {
    // Wait for real content / renderer readiness, not a static loading frame.
    prepared.value = false
    let started = false
    const release = whenReady(() => { started = true; start() })
    if (!started) cancel = release
  } else start()
}
function whenReady(ready: () => void) {
  const check = () => {
    const el = root.value
    if (!el) return false
    if (props.kind === 'profile') return !!el.querySelector('.profile-card,.profile-page[data-profile-state="error"]')
    return !el.querySelector('.content-loading-shell') && !!el.querySelector('main') && !el.querySelector('.article-infinite-menu[aria-busy="true"]')
  }
  if (check()) { ready(); return () => {} }
  const observer = new MutationObserver(() => { if (check()) { observer.disconnect(); ready() } })
  if (root.value) observer.observe(root.value, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy', 'data-profile-state'] })
  return () => observer.disconnect()
}
defineExpose({ play, stop, whenReady, snapshot: () => snapshotScene(root.value ?? undefined), element: () => root.value })
onBeforeUnmount(stop)
</script>
<template>
  <div ref="root" class="page-motion-scene" :class="{ 'page-motion-scene--staged': staged, 'page-motion-scene--managed': managed }" :data-page-scene="kind" :data-motion-phase="phase" :data-motion-prepared="prepared" :inert="phase !== 'idle' && phase !== 'swap'" :aria-hidden="staged || phase === 'leave' ? true : undefined">
    <slot />
  </div>
</template>
