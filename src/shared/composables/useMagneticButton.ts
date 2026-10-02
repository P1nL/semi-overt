import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { createLiquidRimState, magneticTarget, stepLiquidRim, stepMagneticSpring, type LiquidButtonMotion, type MagneticPoint, type MagneticSpringState } from '@/shared/utils/magneticSpring'

export function useMagneticButton(
  root: Ref<HTMLElement | null>,
  enabled: Readonly<Ref<boolean>>,
  onMove: (offset: LiquidButtonMotion) => void,
) {
  const offset = ref<LiquidButtonMotion>({ x: 0, y: 0 })
  let target: MagneticPoint = { x: 0, y: 0 }
  let state: MagneticSpringState = { x: 0, y: 0, vx: 0, vy: 0 }
  let rim = createLiquidRimState()
  let frame = 0
  let lastTime = 0
  let lastPointer: { x: number; y: number; time: number } | null = null
  const style = computed(() => ({ transform: `translate3d(${offset.value.x}px, ${offset.value.y}px, 0)` }))

  function schedule() { if (!frame) frame = requestAnimationFrame(tick) }
  function publish() {
    offset.value = { x: state.x * 0.65, y: state.y * 0.65, rim: [...rim.displacement] }
    onMove(offset.value)
  }
  function tick(now: number) {
    frame = 0
    const seconds = lastTime ? (now - lastTime) / 1000 : 1 / 60
    // Motion is a short impulse, not attraction to the pointer position.
    const decay = Math.exp(-Math.min(seconds, 0.032) / 0.16)
    target = { x: target.x * decay, y: target.y * decay }
    if (Math.hypot(target.x, target.y) < 0.01) target = { x: 0, y: 0 }
    state = stepMagneticSpring(state, target, seconds)
    rim = stepLiquidRim(rim, target, seconds)
    lastTime = now
    const settled = target.x === 0 && target.y === 0
      && Math.hypot(state.x - target.x, state.y - target.y) < 0.01
      && Math.hypot(state.vx, state.vy) < 0.08
      && rim.displacement.every(value => Math.abs(value) < 0.0001)
      && rim.velocity.every(value => Math.abs(value) < 0.001)
    if (settled) {
      state = { ...target, vx: 0, vy: 0 }
      rim = createLiquidRimState()
      lastTime = 0
    }
    publish()
    if (!settled) schedule()
  }
  function returnToRest() {
    lastPointer = null
    target = { x: 0, y: 0 }
    if (enabled.value) schedule()
    else {
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
      state = { x: 0, y: 0, vx: 0, vy: 0 }
      rim = createLiquidRimState()
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
    const previous = lastPointer
    lastPointer = { x: event.clientX, y: event.clientY, time: event.timeStamp }
    const milliseconds = previous ? Math.max(8, event.timeStamp - previous.time) : 16
    const dx = previous ? event.clientX - previous.x : event.movementX
    const dy = previous ? event.clientY - previous.y : event.movementY
    // Normalize speed to a 60Hz sample so slow and fast motion feel distinct.
    const next = magneticTarget(dx * 96 / milliseconds, dy * 96 / milliseconds)
    if (Math.hypot(next.x, next.y) < 0.15) return
    target = next
    schedule()
  }

  watch(enabled, returnToRest)
  onMounted(() => window.addEventListener('blur', returnToRest))
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    window.removeEventListener('blur', returnToRest)
  })
  return { offset, style, onPointerMove, returnToRest }
}
