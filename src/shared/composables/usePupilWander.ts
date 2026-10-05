import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { createPupilTarget } from '@/shared/utils/pupilMotion'

export function usePupilWander(enabled: Readonly<Ref<boolean>>) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const pageVisible = ref(true)
  const position = ref({ x: 0, y: 0, duration: 0 })
  let timer: number | null = null
  let mounted = false

  const style = computed(() => ({
    '--pupil-x': `${position.value.x.toFixed(4)}em`,
    '--pupil-y': `${position.value.y.toFixed(4)}em`,
    '--pupil-duration': `${position.value.duration}ms`,
  }))

  function clearTimer() {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
  }
  function canMove() {
    return mounted && enabled.value && pageVisible.value && !reducedMotion.value
  }
  function move() {
    timer = null
    if (!canMove()) return
    const target = createPupilTarget()
    position.value = { x: target.x, y: target.y, duration: target.duration }
    // A short saccade followed by a longer fixation feels like looking, not drifting.
    timer = window.setTimeout(move, target.duration + target.pause)
  }
  function sync() {
    clearTimer()
    if (canMove()) timer = window.setTimeout(move, 700)
    else position.value = { x: 0, y: 0, duration: 0 }
  }
  function onVisibilityChange() {
    pageVisible.value = document.visibilityState === 'visible'
  }

  watch([enabled, reducedMotion, pageVisible], sync)
  onMounted(() => {
    mounted = true
    onVisibilityChange()
    document.addEventListener('visibilitychange', onVisibilityChange)
    sync()
  })
  onBeforeUnmount(() => {
    mounted = false
    clearTimer()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
  return { style }
}
