import { onBeforeUnmount, ref, type Ref } from 'vue'
import gsap from 'gsap'

interface UseGalleryWheelMotionOptions {
  prefersReducedMotion: Ref<boolean>
  topCycleWidth: Ref<number>
  bottomCycleWidth: Ref<number>
  onUpdate: () => void
  velocityGain?: number
  maxVelocity?: number
  friction?: number
  stopThreshold?: number
  normalizationRange?: number
}

export function useGalleryWheelMotion(options: UseGalleryWheelMotionOptions) {
  const wheelPosition = ref(0)
  const wheelVelocity = ref(0)

  let ticking = false

  function stopWheelAnimation() {
    if (ticking) {
      gsap.ticker.remove(tick)
      ticking = false
    }
  }

  function normalizeWheelPosition() {
    const cycle = Math.max(options.topCycleWidth.value, options.bottomCycleWidth.value, 1)
    if (!cycle) return

    const safeRange = cycle * (options.normalizationRange ?? 24)
    if (Math.abs(wheelPosition.value) > safeRange) {
      wheelPosition.value %= cycle
    }
  }

  function tick() {
    wheelPosition.value += wheelVelocity.value
    wheelVelocity.value *= options.friction ?? 0.93
    normalizeWheelPosition()

    if (Math.abs(wheelVelocity.value) < (options.stopThreshold ?? 0.03)) {
      wheelVelocity.value = 0
      stopWheelAnimation()
      options.onUpdate()
      return
    }

    options.onUpdate()
  }

  function animateWheelMotion() {
    if (ticking) return

    ticking = true
    gsap.ticker.add(tick)
  }

  function onWheel(event: WheelEvent) {
    if (options.prefersReducedMotion.value) return

    const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
    if (!dominantDelta) return

    event.preventDefault()
    wheelVelocity.value = Math.max(
      Math.min(
        wheelVelocity.value + dominantDelta * (options.velocityGain ?? 0.035),
        options.maxVelocity ?? 11,
      ),
      -(options.maxVelocity ?? 11),
    )
    options.onUpdate()
    animateWheelMotion()
  }

  onBeforeUnmount(() => {
    stopWheelAnimation()
  })

  return {
    wheelPosition,
    onWheel,
    stopWheelAnimation,
    normalizeWheelPosition,
  }
}
