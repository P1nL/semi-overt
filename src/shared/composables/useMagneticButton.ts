import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { createMagneticDeformation, magneticTarget, stepMagneticSpring, type MagneticPoint, type MagneticSpringState } from '@/shared/utils/magneticSpring'

export function useMagneticButton(
  root: Ref<HTMLElement | null>,
  enabled: Readonly<Ref<boolean>>,
  onMove: (offset: MagneticPoint) => void,
) {
  const offset = ref<MagneticPoint>({ x: 0, y: 0 })
  let target: MagneticPoint = { x: 0, y: 0 }
  let state: MagneticSpringState = { x: 0, y: 0, vx: 0, vy: 0 }
  let frame = 0
  let lastTime = 0
  const style = computed(() => ({ transform: `translate3d(${offset.value.x}px, ${offset.value.y}px, 0)` }))
  const deformation = computed(() => createMagneticDeformation(offset.value))
  const surfaceStyle = computed(() => {
    const { a, b, c, d } = deformation.value
    return { transform: `matrix(${a}, ${b}, ${c}, ${d}, 0, 0)` }
  })

  function schedule() { if (!frame) frame = requestAnimationFrame(tick) }
  function publish() {
    offset.value = { x: state.x, y: state.y }
    onMove(offset.value)
  }
  function tick(now: number) {
    frame = 0
    state = stepMagneticSpring(state, target, lastTime ? (now - lastTime) / 1000 : 1 / 60)
    lastTime = now
    const settled = Math.hypot(state.x - target.x, state.y - target.y) < 0.01
      && Math.hypot(state.vx, state.vy) < 0.08
    if (settled) {
      state = { ...target, vx: 0, vy: 0 }
      lastTime = 0
    }
    publish()
    if (!settled) schedule()
  }
  function returnToRest() {
    target = { x: 0, y: 0 }
    if (enabled.value) schedule()
    else {
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
      state = { x: 0, y: 0, vx: 0, vy: 0 }
      publish()
    }
  }
  function onPointerMove(event: PointerEvent) {
    if (!enabled.value || event.pointerType !== 'mouse') return
    if (event.target instanceof Element && event.target.closest('.category-orbit-panel')) {
      returnToRest()
      return
    }
    // This is the stationary layout box, not the translated visual button.
    const rect = root.value?.getBoundingClientRect()
    if (!rect) return
    const x = event.clientX - rect.left - rect.width / 2
    const y = event.clientY - rect.top - rect.height / 2
    if (Math.abs(x) > rect.width / 2 || Math.abs(y) > rect.height / 2) {
      returnToRest()
      return
    }
    const next = magneticTarget(x, y)
    if (Math.hypot(next.x - target.x, next.y - target.y) < 0.15) return
    target = next
    schedule()
  }
  watch(enabled, returnToRest)
  onMounted(() => window.addEventListener('blur', returnToRest))
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    window.removeEventListener('blur', returnToRest)
  })
  return { offset, deformation, style, surfaceStyle, onPointerMove, returnToRest }
}
