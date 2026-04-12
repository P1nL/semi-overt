<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
}>()

// --- refs ---
const btnEl = ref<HTMLButtonElement | null>(null)
const eyeEl = ref<SVGGElement | null>(null)
const lidUpperEl = ref<SVGPathElement | null>(null)
const lidLowerEl = ref<SVGPathElement | null>(null)

// Path data
const UPPER_OPEN  = 'M1 12C1 12 5 4 12 4C19 4 23 12 23 12'
const UPPER_CLOSE = 'M1 12C1 12 5 20 12 20C19 20 23 12 23 12'
const LOWER_PATH  = 'M1 12C1 12 5 20 12 20C19 20 23 12 23 12'

const TOGGLE_SPEED  = 0.125
const BLINK_SPEED   = 0.075
const SCRAMBLE_TIME = 0.6

let blinkTl: gsap.core.Timeline | null = null
let busy = false

// ---- blink ----
function scheduleBlink() {
  const delay  = gsap.utils.random(2, 8)
  const repeat = Math.random() > 0.5 ? 3 : 1

  blinkTl = gsap.timeline({
    delay,
    repeat,
    yoyo: true,
    onComplete: scheduleBlink,
  })
    .to(lidUpperEl.value!, {
      duration: BLINK_SPEED,
      attr: { d: UPPER_CLOSE },
      ease: 'power1.inOut',
    })
}

// ---- eye tracking ----
let resetEyeCall: gsap.core.Tween | null = null

function onPointerMove(e: PointerEvent) {
  if (!eyeEl.value) return
  if (resetEyeCall) resetEyeCall.kill()

  resetEyeCall = gsap.delayedCall(2, () => {
    gsap.to(eyeEl.value!, { xPercent: 0, yPercent: 0, duration: 0.2 })
  })

  const bounds = eyeEl.value.getBoundingClientRect()
  const cx = bounds.left + bounds.width / 2
  const cy = bounds.top  + bounds.height / 2
  const dx = e.clientX - cx
  const dy = e.clientY - cy

  const mapRange = gsap.utils.mapRange(-120, 120, -30, 30)

  gsap.set(eyeEl.value, {
    xPercent: gsap.utils.clamp(-30, 30, mapRange(dx)),
    yPercent: gsap.utils.clamp(-30, 30, mapRange(dy)),
  })
}

// ---- toggle animation ----
function handleClick() {
  if (busy) return
  emit('toggle')
}

// Watch visible prop changes and run the animation
import { watch } from 'vue'

watch(() => props.visible, (nowVisible) => {
  if (!lidUpperEl.value || !lidLowerEl.value) return
  busy = true

  if (nowVisible) {
    // Closing eye → text revealed
    if (blinkTl) { blinkTl.kill(); blinkTl = null }

    gsap.timeline({
      onComplete: () => { busy = false },
    })
      .to(lidUpperEl.value, {
        duration: TOGGLE_SPEED,
        attr: { d: UPPER_CLOSE },
        ease: 'power2.inOut',
      })
  } else {
    // Opening eye → text hidden
    gsap.timeline({
      onComplete: () => {
        busy = false
        scheduleBlink()
      },
    })
      .to(lidUpperEl.value, {
        duration: TOGGLE_SPEED,
        attr: { d: UPPER_OPEN },
        ease: 'power2.inOut',
      })
  }
})

onMounted(() => {
  // Small delay to let DOM settle
  gsap.delayedCall(0.3, scheduleBlink)
  window.addEventListener('pointermove', onPointerMove)
})

onUnmounted(() => {
  if (blinkTl) blinkTl.kill()
  if (resetEyeCall) resetEyeCall.kill()
  window.removeEventListener('pointermove', onPointerMove)
})
</script>

<template>
  <button
    ref="btnEl"
    type="button"
    :aria-pressed="visible"
    :title="visible ? '隐藏密码' : '显示密码'"
    class="password-toggle-btn"
    @click="handleClick"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <mask id="ptb-eye-open">
          <path
            d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12V20H12H1V12Z"
            fill="#D9D9D9"
            stroke="black"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </mask>
        <mask id="ptb-eye-closed">
          <path
            d="M1 12C1 12 5 20 12 20C19 20 23 12 23 12V20H12H1V12Z"
            fill="#D9D9D9"
          />
        </mask>
      </defs>

      <!-- upper lid -->
      <path
        ref="lidUpperEl"
        :d="UPPER_OPEN"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- lower lid -->
      <path
        ref="lidLowerEl"
        :d="LOWER_PATH"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- eyeball — only visible when eye is open (not closed) -->
      <g :mask="visible ? 'url(#ptb-eye-closed)' : 'url(#ptb-eye-open)'">
        <g ref="eyeEl" class="ptb-eye">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <circle cx="13" cy="11" r="1" fill="var(--color-bg, white)" />
        </g>
      </g>
    </svg>

    <span class="sr-only">{{ visible ? '隐藏密码' : '显示密码' }}</span>
  </button>
</template>

<style scoped>
.password-toggle-btn {
  position: absolute;
  right: 0;
  top: 50%;
  translate: 0 -50%;
  z-index: 2;

  display: grid;
  place-items: center;
  height: 100%;
  aspect-ratio: 1;

  padding: 0;
  border: 6px solid transparent;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  outline: none;

  color: var(--color-text-muted);
  transition: color 0.2s, background 0.125s;
}

.password-toggle-btn:is(:hover, :focus-visible) {
  color: var(--color-text);
}

.password-toggle-btn svg {
  width: 75%;
  height: 75%;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
