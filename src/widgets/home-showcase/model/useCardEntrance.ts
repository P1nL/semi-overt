import { computed, onBeforeUnmount, watch, type Ref } from 'vue'
import { useHomeIntro, riseWindow, out, progress, fromViewportBottom, leftToRightRanks } from '@/features/home-intro'

export function useCardEntrance(root: Ref<HTMLElement | null>, id: string, enabled: () => boolean, count: () => number) {
  const intro = useHomeIntro()
  const cleanup: Array<() => void> = []
  const active = computed(() => enabled() && (intro?.active.value ?? false))
  const owned = computed(() => enabled() && (intro?.participated.value ?? false))
  const ranks = computed(() => {
    const rects = intro?.rects.value ?? {}
    const keys = Object.keys(rects).filter(key => key.startsWith(`${id}:`)).sort((a, b) => Number(a.slice(id.length + 1)) - Number(b.slice(id.length + 1)))
    return leftToRightRanks(keys.map(key => rects[key]!.left))
  })
  // Read all geometry once before the playhead starts. Never measure during a tween.
  watch([root, count], ([element]) => {
    cleanup.splice(0).forEach(fn => fn())
    if (!element || !intro || !enabled()) return
    const entries = Array.from(element.querySelectorAll<HTMLElement>('[data-card-entry]'))
    // v-motion may replace keyed entries during its initial layout pass.
    // Resolve at measurement time, not against the now-detached first nodes.
    entries.forEach((_, index) => cleanup.push(intro.register(`${id}:${index}`, () => root.value?.querySelectorAll<HTMLElement>('[data-card-entry]')[index])))
  }, { flush: 'post' })
  onBeforeUnmount(() => cleanup.forEach(fn => fn()))
  function style(index: number, count: number) {
    if (!active.value || !intro) return undefined
    const r = intro.rects.value[`${id}:${index}`]
    const { start, duration } = riseWindow(ranks.value[index] ?? index, count)
    const p = out(progress(intro.time.value, start, duration))
    const dy = r ? fromViewportBottom(r.top, intro.viewport.value.height) : 0
    return { translate: `0 ${dy * (1 - p)}px`, opacity: intro.time.value >= start ? 1 : 0 }
  }
  return { active, owned, style }
}
