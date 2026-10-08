<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowReactive, shallowRef, ref, watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { PageMotionKind, PageMotionPhase } from '@/shared/composables/usePageMotion'
import { isResultViewOnlyChange } from '@/shared/utils/resultViewNavigation'
import { isSibling, pageKind } from '../model/choreography'
import { getResultMenu } from '@/shared/utils/resultMenuBridge'
import { resultPresentation, resultTransition, resultEmptyKey, renderedResultTransition } from '../model/resultTransition'
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
  if (layers.value.length === 1 && current.phase === 'idle' && current.route.path === target.path && (current.kind !== 'results' || isResultViewOnlyChange(current.route, target))) {
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
  const resultMode = outgoing.kind === 'results' && incoming.kind === 'results' ? resultTransition(outgoing.route, target) : undefined
  const sibling = isSibling(outgoing.kind, incoming.kind) && resultMode !== 'replace'
  const snapshot = scenes.get(outgoing.id)?.snapshot()
  const direction = String(target.name) === 'category' ? -1 : 1
  outgoing.phase = 'leave'
  layers.value = [outgoing, incoming]
  await nextTick()
  if (disposed || token !== generation) return
  const enter = async (forceEnter = false) => {
    if (disposed || token !== generation) return
    const phase = !forceEnter && sibling ? 'swap' : 'enter'
    incoming.phase = phase
    // Keep both layers mounted and the target hidden until its first pose is
    // painted, including the actual GPU buffer. Do not reveal a static card first.
    await nextTick()
    if (disposed || token !== generation) return
    const revealPrepared = () => {
      if (disposed || token !== generation) return
      incoming.staged = false
      layers.value = [incoming]
      emit('display', target)
    }
    const scene = scenes.get(incoming.id)
    if (!scene) { revealPrepared(); incoming.phase = 'idle'; emit('after-enter'); return }
    scene.play({ kind: incoming.kind, phase, direction, previous: snapshot, reduced: reduced.value }, () => {
      if (token !== generation || disposed) return
      incoming.phase = 'idle'; emit('after-enter')
    }, revealPrepared)
  }
  if (resultMode) {
    incoming.phase = 'swap'
    await nextTick()
    if (disposed || token !== generation) return
    const scene = scenes.get(incoming.id)
    if (!scene) { void enter(); return }
    const reveal = (keepOutgoing = false) => {
      incoming.staged = false
      if (!keepOutgoing) layers.value = [incoming]
      emit('display', target)
    }
    const finish = () => {
      if (disposed || token !== generation) return
      stopReadiness?.(); stopReadiness = undefined
      layers.value = [incoming]; incoming.phase = 'idle'
      scene.stop(); emit('after-enter')
    }
    // Prepare the target behind the still-visible old result set. No fake screenshots
    // or empty clock before real cards / author profile textures become ready.
    stopReadiness = scene.whenReady(async () => {
      if (disposed || token !== generation) return
      const oldScene = scenes.get(outgoing.id)
      const oldRoot = oldScene?.element()
      const newRoot = scene.element()
      const visibleList = newRoot?.querySelector('[data-page-motion="result-list"]')
      const visibleCanvas = newRoot?.querySelector('.article-infinite-menu__canvas,.article-infinite-menu__fallback')
      const oldEmpty = resultEmptyKey(oldRoot), newEmpty = resultEmptyKey(newRoot)
      const oldMenu = getResultMenu(oldRoot?.querySelector<HTMLCanvasElement>('canvas'))
      const newMenu = getResultMenu(newRoot?.querySelector<HTMLCanvasElement>('canvas'))
      const effectiveMode = renderedResultTransition(resultMode, oldEmpty, newEmpty, !!oldMenu && !!newMenu)
      if (reduced.value || effectiveMode === 'direct' || (!visibleList && !visibleCanvas && newEmpty === undefined)) {
        if (effectiveMode === 'direct' && newRoot) newRoot.dataset.resultTransition = 'direct'
        incoming.phase = 'idle'; reveal(); finish(); return
      }
      if (effectiveMode === 'replace') {
        // Different card materials: old article/author exits fully, then new grows in.
        if (oldScene) oldScene.play({ kind: 'results', phase: 'leave', reduced: reduced.value }, () => void enter(true))
        else void enter(true)
        return
      }
      if (effectiveMode === 'view' && oldRoot) {
        scene.play({ kind: 'results', phase: 'swap', resultTransition: 'view', outgoingRoot: oldRoot,
          targetView: resultPresentation(target) === 'list' ? 'list' : 'infinite' }, finish)
        reveal(true)
        return
      }
      // The incoming card is result #1. Commit its real DOM copy before building
      // scramble spans, rather than capturing a constructor's arbitrary initial card.
      newMenu?.prepareRotation?.()
      await nextTick()
      if (disposed || token !== generation) return
      const liveSnapshot = oldScene?.snapshot()
      scene.play({ kind: 'results', phase: 'swap', resultTransition: 'rotate', direction,
        previous: liveSnapshot }, finish)
      reveal()
    })
    return
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

<style>
/* Direct dataset replacement has no second, intersection-driven list entrance. */
.page-motion-scene[data-result-transition="direct"] .animated-article-list-item,
.page-motion-scene[data-result-transition="view"] .animated-article-list-item {
  opacity: 1; filter: none; transform: none; transition: none;
}
</style>

<style>
/* Route choreography owns these states; Vue's loading-content fade must not
   hide an identical empty replacement or compete with its centre-scale effect. */
.page-motion-scene--managed .result-empty,
.page-motion-scene[data-result-transition="direct"] .content-fade-enter-from,
.page-motion-scene[data-result-transition="direct"] .content-fade-enter-active {
  opacity: 1 !important; transition: none !important;
}
</style>
