<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowReactive, shallowRef, ref, watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { PageMotionKind, PageMotionPhase } from '@/shared/composables/usePageMotion'
import { isResultViewOnlyChange } from '@/shared/utils/resultViewNavigation'
import { isSibling, pageKind } from '../model/choreography'
import PageScene from './PageScene.vue'

const props = defineProps<{ route: RouteLocationNormalizedLoaded; enabled: boolean }>()
const emit = defineEmits<{ before: []; 'after-enter': []; display: [RouteLocationNormalizedLoaded] }>()
interface Layer { id: number; route: RouteLocationNormalizedLoaded; kind: PageMotionKind; phase: PageMotionPhase; staged: boolean }
let nextId = 0
const make = (route: RouteLocationNormalizedLoaded, staged = false): Layer => shallowReactive({ id: ++nextId, route, kind: pageKind(route.name), phase: staged ? 'staged' : 'idle', staged })
const initial = make(props.route)
const initialEntry = props.enabled && innerWidth >= 1024 && (initial.kind === 'profile' || initial.kind === 'results')
  && !props.route.meta.presentation && !matchMedia('(prefers-reduced-motion: reduce)').matches
if (initialEntry) initial.phase = 'enter'
const layers = shallowRef<Layer[]>([initial])
const scenes = new Map<number, InstanceType<typeof PageScene>>()
let generation = 0
let disposed = false
let stopReadiness: (() => void) | undefined
const reduced = ref(false)
let media: MediaQueryList | undefined
const updateMedia = () => { reduced.value = !!media?.matches }
onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)'); updateMedia(); media.addEventListener('change', updateMedia)
  if (initialEntry) {
    const token = generation
    emit('before')
    scenes.get(initial.id)?.play({ kind: initial.kind, phase: 'enter' }, () => {
      if (disposed || token !== generation) return
      initial.phase = 'idle'; emit('after-enter')
    })
  }
})
function settle() {
  generation++
  stopReadiness?.(); stopReadiness = undefined
  scenes.forEach(scene => scene.stop())
  const latest = layers.value[layers.value.length - 1]
  if (latest) { latest.phase = 'idle'; latest.staged = false; layers.value = [latest]; emit('display', latest.route) }
  emit('after-enter')
}
watch(reduced, value => { if (value) settle() })
watch(() => props.enabled, value => {
  if (!value && layers.value.some(layer => layer.phase !== 'idle')) settle()
})
watch(() => props.route, async () => {
  const target = props.route
  const current = layers.value[layers.value.length - 1]!
  if (current.route.fullPath === target.fullPath) {
    current.route = target; current.kind = pageKind(target.name); emit('display', target); return
  }
  // Query updates keep their component and focused input; full scene motion is route-level.
  if (layers.value.length === 1 && current.phase === 'idle' && current.route.path === target.path) {
    const scene = scenes.get(current.id)
    if (current.kind === 'results' && isResultViewOnlyChange(current.route, target)) {
      // The result widget owns this transition. Also disconnect the completed
      // page timeline's late-content observer so it cannot animate the new panel.
      scene?.stop()
      current.route = target
      emit('display', target)
      return
    }
    const snapshot = scene?.snapshot()
    scene?.stop()
    current.route = target
    emit('display', target)
    if (props.enabled && innerWidth >= 1024 && (current.kind === 'results' || current.kind === 'profile')) {
      const token = ++generation
      current.phase = 'swap'
      await nextTick()
      if (token !== generation || disposed) return
      scene?.play({ kind: current.kind, phase: 'swap', previous: snapshot, reduced: reduced.value, local: true }, () => {
        if (token !== generation || disposed) return
        current.phase = 'idle'; emit('after-enter')
      })
    }
    return
  }
  const token = ++generation
  stopReadiness?.(); stopReadiness = undefined
  scenes.forEach(scene => scene.stop())
  let outgoing = layers.value.find(layer => !layer.staged) ?? current
  outgoing.staged = false
  const incoming = make(target, true)
  const animated = props.enabled && innerWidth >= 1024 && !target.meta.presentation && !outgoing.route.meta.presentation
  if (!animated) {
    incoming.phase = 'idle'; incoming.staged = false; layers.value = [incoming]
    emit('display', target); emit('after-enter'); return
  }
  emit('before')
  const sibling = isSibling(outgoing.kind, incoming.kind)
  const snapshot = scenes.get(outgoing.id)?.snapshot()
  const direction = String(target.name) === 'category' ? -1 : 1
  outgoing.phase = 'leave'
  layers.value = [outgoing, incoming]
  await nextTick()
  if (disposed || token !== generation) return
  const enter = async () => {
    if (disposed || token !== generation) return
    incoming.staged = false
    incoming.phase = sibling ? 'swap' : 'enter'
    layers.value = [incoming]
    emit('display', target)
    await nextTick()
    if (disposed || token !== generation) return
    scenes.get(incoming.id)?.play({ kind: incoming.kind, phase: sibling ? 'swap' : 'enter', direction, previous: snapshot, reduced: reduced.value }, () => {
      if (token !== generation || disposed) return
      incoming.phase = 'idle'; emit('after-enter')
    })
  }
  if (sibling) {
    incoming.phase = 'swap'
    await nextTick()
    if (disposed || token !== generation) return
    const scene = scenes.get(incoming.id)
    const reveal = () => {
      if (disposed || token !== generation || !incoming.staged) return
      incoming.staged = false; layers.value = [incoming]; emit('display', target)
    }
    if (scene && incoming.kind === 'profile') {
      // Preserve the complete old layout until the new role-dependent sections
      // exist. Start the two-second replacement at readiness, not during loading.
      stopReadiness = scene.whenReady(() => {
        if (disposed || token !== generation) return
        scene.play({ kind: incoming.kind, phase: 'swap', direction, previous: snapshot, reduced: reduced.value }, () => {
          if (disposed || token !== generation) return
          stopReadiness?.(); stopReadiness = undefined
          incoming.phase = 'idle'; emit('after-enter')
        })
        reveal()
      })
    } else if (scene) {
      // Run the bounded clock immediately, but keep the old shell until data is ready.
      scene.play({ kind: incoming.kind, phase: 'swap', direction, previous: snapshot, reduced: reduced.value }, () => {
        if (disposed || token !== generation) return
        reveal(); stopReadiness?.(); stopReadiness = undefined
        incoming.phase = 'idle'; emit('after-enter')
      })
      stopReadiness = scene.whenReady(reveal)
    } else void enter()
  }
  else {
    const scene = scenes.get(outgoing.id)
    if (scene) scene.play({ kind: outgoing.kind, phase: 'leave', reduced: reduced.value }, () => void enter())
    else void enter()
  }
}, { flush: 'post' })
onBeforeUnmount(() => { disposed = true; generation++; stopReadiness?.(); scenes.forEach(scene => scene.stop()); media?.removeEventListener('change', updateMedia) })
</script>
<template>
  <div class="page-motion-host" data-motion-fps="60">
    <PageScene v-for="layer in layers" :key="layer.id" :ref="value => { if (value) scenes.set(layer.id, value as InstanceType<typeof PageScene>); else scenes.delete(layer.id) }" :kind="layer.kind" :phase="layer.phase" :staged="layer.staged">
      <slot :route="layer.route" />
    </PageScene>
  </div>
</template>
<style>
.page-motion-host { position: relative; min-width: 0; isolation: isolate; }
.page-motion-scene { position: relative; min-width: 0; }
.page-motion-scene--staged { position: absolute; inset: 0; visibility: hidden; opacity: 0 !important; pointer-events: none; }
.page-motion-scene[data-motion-prepared="false"][data-motion-phase="enter"],
.page-motion-scene[data-motion-prepared="false"][data-motion-phase="swap"] { opacity: 0 !important; pointer-events: none; }
.page-motion-scene[data-motion-phase="enter"], .page-motion-scene[data-motion-phase="leave"], .page-motion-scene[data-motion-phase="swap"] { overflow-x: clip; }
.page-motion-scene--managed .profile-header-reveal,
.page-motion-scene--managed .content-rise-in { animation: none !important; }
.page-motion-scene:not([data-motion-phase="idle"]) .article-infinite-menu__canvas,
.page-motion-scene:not([data-motion-phase="idle"]) .article-infinite-menu__hint,
.page-motion-scene:not([data-motion-phase="idle"]) .article-infinite-menu__overlay > * { transition: none !important; }
.page-motion-scene [data-motion-overlay] { user-select: none; }
</style>
