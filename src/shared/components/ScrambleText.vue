<script setup lang="ts">
// Adapted from https://vue-bits.dev/r/ScrambleText.json.
// The orbit already splits characters: use direct hover instead of radius/SplitText.
// Keep GSAP timing, but draw from a shared shuffle bag instead of cached random strings.
import { gsap } from 'gsap'
import { isTitleEffectOccluded } from '@/shared/utils/titleEffectOcclusion'
import { nextScrambleSymbol } from '@/shared/utils/scrambleSampler'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  text: string
  duration?: number
  speed?: number
  scrambleChars?: string
}>(), {
  duration: 2.5,
  speed: 0.16,
  scrambleChars: '😀😃😄😁😆😅😂🤣😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🥸🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🫣🤭🫢🫡🤫🫠🤥😶😐😑😬🙄😯😮😲🥱😴🤤👀👻👽🤖💀🎃🤡👺🐸🐙🦊🐼🦋🦖🪼🦄🍄🌵🍀🌸🪐🌈⚡🔥🍒🍋🍉🍩🍕🍿🍭🧀🎲🧩🎯🎈🔮🧿🪩🗿📺📼📷🕹️💾🧲💎🚀',
})
const glyphRef = ref<HTMLElement | null>(null)
const scrambling = ref(false)
let tween: gsap.core.Tween | null = null
let media: MediaQueryList | undefined
let disposed = false

function reset() {
  tween?.kill()
  tween = null
  scrambling.value = false
  if (glyphRef.value) glyphRef.value.textContent = props.text
}
function enter(event: PointerEvent) {
  if (disposed || event.pointerType === 'touch' || media?.matches || document.hidden || scrambling.value || !glyphRef.value) return
  if (isTitleEffectOccluded(event, document)) return
  scrambling.value = true
  const clock = { elapsed: 0 }
  const interval = 0.05 / Math.max(0.001, props.speed)
  let lastStep = -1
  const update = () => {
    const step = Math.floor(clock.elapsed / interval)
    if (step === lastStep || clock.elapsed >= props.duration || !glyphRef.value) return
    if (isTitleEffectOccluded({ clientX: event.clientX, clientY: event.clientY }, document)) { reset(); return }
    lastStep = step
    glyphRef.value.textContent = nextScrambleSymbol(props.scrambleChars) || props.text
  }
  update()
  if (!scrambling.value) return
  tween = gsap.to(clock, {
    elapsed: props.duration,
    duration: props.duration,
    ease: 'none',
    onUpdate: update,
    onComplete: reset,
  })
}
watch(() => props.text, reset, { flush: 'post' })
onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', reset)
  document.addEventListener('visibilitychange', reset)
  window.addEventListener('blur', reset)
})
onBeforeUnmount(() => {
  disposed = true
  reset()
  media?.removeEventListener('change', reset)
  document.removeEventListener('visibilitychange', reset)
  window.removeEventListener('blur', reset)
})
</script>

<template>
  <span class="scramble-text" :data-scrambling="scrambling" aria-hidden="true" @pointerenter="enter">
    <span class="scramble-text__measure">{{ text }}</span>
    <span ref="glyphRef" class="scramble-text__glyph">{{ text }}</span>
  </span>
</template>

<style scoped>
.scramble-text { position: relative; display: inline-block; line-height: 1; vertical-align: top; }
.scramble-text__measure { visibility: hidden; }
.scramble-text__glyph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; white-space: nowrap; }
</style>
