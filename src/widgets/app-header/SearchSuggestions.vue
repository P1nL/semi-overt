<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import Icon from '@/shared/components/base/Icon.vue'
import { getSearchDropMotion, getSearchReturnMotion, type SearchDropRow } from './model/searchDropMotion'

defineProps<{ open: boolean; keyword: string }>()
const emit = defineEmits<{ article: []; author: []; close: []; leaving: [value: boolean]; closed: [] }>()
type Run = { animations: Animation[]; cancelled: boolean }
const runs = new Map<HTMLElement, Run>()
const rows = (node: HTMLElement) => [...node.querySelectorAll<HTMLElement>('[data-search-row]')]

function cancel(element: Element) {
  const node = element as HTMLElement
  const run = runs.get(node)
  if (!run) return
  node.dataset.interrupted = 'true'
  run.cancelled = true
  for (const animation of run.animations) {
    // Preserve the current pose if a close interrupts the fall.
    try { animation.commitStyles() } catch { /* Detached/reduced-motion element. */ }
    animation.cancel()
  }
  runs.delete(node)
}
function clearPose(node: HTMLElement) {
  for (const element of [node, ...rows(node)]) {
    for (const property of ['transform', 'opacity', 'border-radius']) element.style.removeProperty(property)
  }
  delete node.dataset.dropping
}
function finish(node: HTMLElement, run: Run, done: () => void) {
  void Promise.all(run.animations.map(animation => animation.finished)).then(() => {
    if (run.cancelled || runs.get(node) !== run) return
    run.animations.forEach(animation => animation.cancel())
    runs.delete(node)
    clearPose(node)
    done()
  }).catch(() => { /* Vue cancellation/unmount owns interrupted transitions. */ })
}
function enter(element: Element, done: () => void) {
  const node = element as HTMLElement
  cancel(node)
  emit('leaving', false)
  const resumed = node.dataset.interrupted === 'true'
  const poses = resumed ? rows(node).map(row => {
    const style = getComputedStyle(row)
    return { transform: style.transform, opacity: style.opacity }
  }) : []
  clearPose(node)
  delete node.dataset.interrupted
  node.inert = false
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !node.animate) { done(); return }
  const source = node.parentElement?.querySelector('.header-search-shell')
  const sourceBottom = source?.getBoundingClientRect().bottom ?? node.getBoundingClientRect().top
  // Read all final positions once before starting any animation writes.
  const plans = rows(node).map((row, index) => {
    const pose = poses[index]
    const distance = pose
      ? -new DOMMatrixReadOnly(pose.transform === 'none' ? undefined : pose.transform).m42
      : row.getBoundingClientRect().bottom - sourceBottom
    const motion = getSearchDropMotion(distance, row.dataset.searchRow as SearchDropRow)
    if (pose) {
      motion.options.delay = 0
      motion.keyframes[0] = { ...motion.keyframes[0], ...pose }
      motion.keyframes.forEach((frame, index) => { if (index > 0) frame.opacity = 1 })
    }
    return { row, motion }
  })
  node.dataset.dropping = 'true'
  const run: Run = { animations: plans.map(({ row, motion }) => row.animate(motion.keyframes, motion.options)), cancelled: false }
  runs.set(node, run)
  finish(node, run, done)
}
function leave(element: Element, done: () => void) {
  const node = element as HTMLElement
  node.inert = true
  cancel(node)
  emit('leaving', true)
  const complete = () => { done(); emit('leaving', false); emit('closed') }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !node.animate) { clearPose(node); complete(); return }
  const source = node.parentElement?.querySelector('.header-search-shell')
  const sourceBottom = source?.getBoundingClientRect().bottom ?? node.getBoundingClientRect().top
  const top = node.getBoundingClientRect().top
  const plans = rows(node).map(row => {
    const style = getComputedStyle(row)
    // offset geometry ignores an interrupted drop's current transform.
    const distance = top + row.offsetTop + row.offsetHeight - sourceBottom
    return { row, motion: getSearchReturnMotion(distance, row.dataset.searchRow as SearchDropRow, {
      transform: style.transform, opacity: style.opacity, borderRadius: style.borderRadius,
    }) }
  })
  node.dataset.dropping = 'true'
  const run: Run = { animations: plans.map(({ row, motion }) => row.animate(motion.keyframes, motion.options)), cancelled: false }
  runs.set(node, run)
  finish(node, run, complete)
}
onBeforeUnmount(() => { for (const node of runs.keys()) cancel(node) })
</script>

<template>
  <Transition :css="false" @enter="enter" @leave="leave" @enter-cancelled="cancel" @leave-cancelled="cancel">
    <div v-if="open" class="search-suggestions" @keydown.esc.prevent.stop="emit('close')">
      <div class="search-dropdown" role="listbox" aria-label="搜索建议">
        <button type="button" class="search-dropdown-item" data-search-row="article" role="option" @click="emit('article')">
          <span class="search-dropdown-icon"><Icon name="search" size="0.85rem" /></span>
          <span class="search-dropdown-copy"><span class="search-dropdown-label">文章</span><span class="search-dropdown-description">具有「{{ keyword }}」的文章</span></span>
        </button>
        <button type="button" class="search-dropdown-item" data-search-row="author" role="option" @click="emit('author')">
          <span class="search-dropdown-icon"><Icon name="user" size="0.85rem" /></span>
          <span class="search-dropdown-copy"><span class="search-dropdown-label">作者</span><span class="search-dropdown-description">包含「{{ keyword }}」的作者</span></span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.search-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  padding-top: 12px;
  /* Rows emerge below the bar, never crossing its input or icons. */
  clip-path: inset(0 -24px -24px);
}
.search-dropdown { border-radius: 20px; }
.search-dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 64px;
  padding: 12px 16px;
  border: 0;
  text-align: left;
  background: var(--color-brand-logo-bg);
  color: var(--color-brand-logo-fg);
  transform-origin: bottom center;
}
.search-dropdown-item:first-child { border-radius: 20px 20px 0 0; }
.search-dropdown-item:last-child { border-radius: 0 0 20px 20px; }
.search-dropdown-item:last-child::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 16px;
  height: 1px;
  background: color-mix(in srgb, var(--color-brand-logo-fg) 16%, transparent);
  transition: opacity 120ms ease;
}
[data-dropping] .search-dropdown-item::before { opacity: 0; }
[data-dropping] .search-dropdown-item { will-change: transform, opacity; }
.search-dropdown-item:hover { background: color-mix(in srgb, var(--color-brand-logo-bg) 92%, var(--color-brand-logo-fg)); }
.search-dropdown-item:focus-visible { outline: 2px solid var(--color-brand-logo-fg); outline-offset: -5px; }
.search-dropdown-icon { display: grid; place-items: center; flex: 0 0 28px; height: 28px; border-radius: 10px; background: color-mix(in srgb, var(--color-brand-logo-fg) 10%, transparent); }
.search-dropdown-copy { display: block; min-width: 0; flex: 1; }
.search-dropdown-label { display: block; font-size: 12px; line-height: 18px; color: color-mix(in srgb, var(--color-brand-logo-fg) 68%, transparent); }
.search-dropdown-description { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 20px; font-weight: 500; }
@media (prefers-reduced-motion: reduce) { .search-dropdown-item::before { transition: none; } }
@media (forced-colors: active) { .search-dropdown-item { border: 1px solid ButtonText; } }
</style>
