import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { draftRubberOffset, draftRawOffset, draftSwipeVelocity, draftSnapFrames, type DraftSwipeSample, DRAFT_DELETE_WIDTH, DRAFT_HINT_DISTANCE, draftDragIntent, shouldRevealDraftDelete } from './draftSwipe'

type Options = { enabled: Readonly<Ref<boolean>>; active: Readonly<Ref<boolean>>; owner: Readonly<Ref<boolean>>; busy: Readonly<Ref<boolean>>; claim: () => void }
export function useDraftSwipe(options: Options) {
  const root = ref<HTMLElement | null>(null)
  const content = ref<HTMLElement | null>(null)
  const rail = ref<HTMLElement | null>(null)
  const dragging = ref(false), revealed = ref(false), hinting = ref(false), coarse = ref(false)
  const deleteExposed = computed(() => options.active.value && options.enabled.value && (revealed.value || coarse.value))
  let offset = 0, frame = 0, pendingOffset: number | null = null
  let animation: Animation | null = null
  let railAnimation: Animation | null = null
  let gesture: { id: number; x: number; y: number; base: number; samples: DraftSwipeSample[] } | null = null
  let hinted = false, suppressClick = false, suppressFocus = false, disposed = false
  let reduced: MediaQueryList | undefined, pointerMedia: MediaQueryList | undefined
  const canInteract = () => options.active.value && options.enabled.value && !options.busy.value && !disposed
  const transform = (x: number) => `translate3d(${x}px, 0, 0)`
  const railTransform = (x: number) => transform(Math.max(0, DRAFT_DELETE_WIDTH + x))
  function paint(x: number) {
    offset = x
    if (content.value) content.value.style.transform = transform(offset)
    if (rail.value) rail.value.style.transform = railTransform(offset)
  }
  function stopAnimation() {
    if (!animation) return
    const value = content.value ? getComputedStyle(content.value).transform : 'none'
    const current = value === 'none' ? 0 : new DOMMatrixReadOnly(value).m41
    animation.onfinish = null
    animation.cancel()
    railAnimation?.cancel(); railAnimation = null
    animation = null
    hinting.value = false
    paint(current)
  }
  function animateTo(x: number, velocity = 0) {
    stopAnimation()
    const element = content.value
    if (!element || reduced?.matches || !element.animate) { paint(x); return }
    const spring = draftSnapFrames(offset, x, velocity)
    const settings: KeyframeAnimationOptions = { duration: spring.duration, easing: 'linear', fill: 'both' }
    const current = element.animate(spring.positions.map(value => ({ transform: transform(value) })), settings)
    railAnimation = rail.value?.animate(spring.positions.map(value => ({ transform: railTransform(value) })), settings) ?? null
    animation = current
    current.onfinish = () => {
      if (animation !== current || disposed) return
      paint(x); current.cancel(); animation = null
      railAnimation?.cancel(); railAnimation = null
    }
  }
  function flushMove() {
    cancelAnimationFrame(frame); frame = 0
    if (pendingOffset !== null) { paint(pendingOffset); pendingOffset = null }
  }
  function detachGesture() {
    const previous = gesture
    gesture = null
    dragging.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', cancelGesture)
    if (previous && root.value?.hasPointerCapture(previous.id)) root.value.releasePointerCapture(previous.id)
  }
  function reset() {
    detachGesture()
    cancelAnimationFrame(frame); frame = 0; pendingOffset = null
    stopAnimation(); revealed.value = false; hinting.value = false; paint(0)
  }
  function hint(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || !canInteract() || coarse.value || reduced?.matches || hinted || revealed.value || gesture) return
    const element = content.value
    if (!element?.animate) return
    hinted = true; hinting.value = true
    const current = element.animate([
      { transform: transform(0), offset: 0, easing: 'ease-out' },
      { transform: transform(-DRAFT_HINT_DISTANCE), offset: 0.28 },
      { transform: transform(-DRAFT_HINT_DISTANCE), offset: 0.55, easing: 'ease-in-out' },
      { transform: transform(0), offset: 1 },
    ], { duration: 720, fill: 'both' })
    railAnimation = rail.value?.animate([
      { transform: railTransform(0), offset: 0, easing: 'ease-out' },
      { transform: railTransform(-DRAFT_HINT_DISTANCE), offset: 0.28 },
      { transform: railTransform(-DRAFT_HINT_DISTANCE), offset: 0.55, easing: 'ease-in-out' },
      { transform: railTransform(0), offset: 1 },
    ], { duration: 720, fill: 'both' }) ?? null
    animation = current
    current.onfinish = () => {
      if (animation !== current || disposed) return
      paint(0); current.cancel(); animation = null; hinting.value = false
      railAnimation?.cancel(); railAnimation = null
    }
  }
  function leaveHint() { if (hinting.value && !gesture) animateTo(0) }
  function prepareClick() { suppressClick = false }
  function start(event: PointerEvent) {
    if (!canInteract() || coarse.value || event.button !== 0 || event.isPrimary === false || gesture) return
    stopAnimation(); flushMove()
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, base: draftRawOffset(offset), samples: [{ time: event.timeStamp, offset }] }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cancelGesture)
  }
  function move(event: PointerEvent) {
    const current = gesture
    if (!current || event.pointerId !== current.id) return
    const dx = event.clientX - current.x, dy = event.clientY - current.y
    if (!dragging.value) {
      const intent = draftDragIntent(dx, dy)
      if (intent === 'pending') return
      if (intent === 'vertical') { detachGesture(); animateTo(revealed.value ? -DRAFT_DELETE_WIDTH : 0); return }
      dragging.value = true; suppressClick = true; hinted = true
      options.claim()
      try { root.value?.setPointerCapture(current.id) } catch { /* Window listeners still track the gesture. */ }
    }
    event.preventDefault()
    pendingOffset = draftRubberOffset(current.base + dx)
    current.samples.push({ time: event.timeStamp, offset: pendingOffset })
    current.samples = current.samples.filter(sample => event.timeStamp - sample.time <= 80).slice(-5)
    if (!frame) frame = requestAnimationFrame(flushMove)
  }
  function end(event: PointerEvent) {
    if (!gesture || gesture.id !== event.pointerId) return
    const wasDragging = dragging.value
    const velocity = wasDragging ? draftSwipeVelocity(gesture.samples, event.timeStamp) : 0
    flushMove(); detachGesture()
    if (wasDragging) revealed.value = shouldRevealDraftDelete(offset, velocity)
    animateTo(revealed.value ? -DRAFT_DELETE_WIDTH : 0, velocity)
  }
  function cancelGesture(event?: PointerEvent) {
    if (!gesture) return
    if (event && gesture && event.pointerId !== gesture.id) return
    flushMove(); detachGesture()
    animateTo(revealed.value ? -DRAFT_DELETE_WIDTH : 0)
  }
  function captureClick(event: MouseEvent) {
    if (!suppressClick || event.detail === 0) return
    suppressClick = false
    event.preventDefault(); event.stopImmediatePropagation()
  }
  function keyboardFocus(event: FocusEvent) {
    if (suppressFocus || !canInteract() || coarse.value || !(event.target instanceof Element) || !event.target.matches(':focus-visible')) return
    options.claim(); revealed.value = true; hinted = true
    animateTo(-DRAFT_DELETE_WIDTH)
  }
  function keydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || (!revealed.value && !dragging.value && !hinting.value)) return
    event.preventDefault(); event.stopPropagation()
    flushMove(); detachGesture(); revealed.value = false; animateTo(0)
    suppressFocus = true
    root.value?.querySelector<HTMLButtonElement>('.draft-item-open')?.focus({ preventScroll: true })
    suppressFocus = false
  }
  function focusout(event: FocusEvent) {
    if (event.relatedTarget instanceof Node && root.value?.contains(event.relatedTarget)) return
    if (!gesture && revealed.value) { revealed.value = false; animateTo(0) }
  }
  function onMediaChange() { coarse.value = pointerMedia?.matches ?? false; reset() }
  watch([options.active, options.enabled], ([active, enabled]) => {
    if (!active) hinted = false
    if (!active || !enabled) reset()
  })
  watch(options.owner, owner => { if (!owner && (revealed.value || dragging.value)) { flushMove(); detachGesture(); revealed.value = false; animateTo(0) } })
  onMounted(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)')
    pointerMedia = matchMedia('(hover: none), (pointer: coarse)')
    coarse.value = pointerMedia.matches
    reduced.addEventListener('change', onMediaChange)
    pointerMedia.addEventListener('change', onMediaChange)
    window.addEventListener('blur', reset)
  })
  onBeforeUnmount(() => {
    disposed = true; reset()
    reduced?.removeEventListener('change', onMediaChange)
    pointerMedia?.removeEventListener('change', onMediaChange)
    window.removeEventListener('blur', reset)
  })
  return { root, content, rail, dragging, revealed, hinting, coarse, deleteExposed, hint, leaveHint, prepareClick, start, cancelGesture, captureClick, keyboardFocus, keydown, focusout }
}
