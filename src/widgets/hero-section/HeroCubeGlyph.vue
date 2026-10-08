<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { gsap } from 'gsap'

const props = withDefaults(defineProps<{ entryProgress?: number }>(), { entryProgress: 1 })
const reducedMotion = usePreferredReducedMotion()
// Driven by the existing intro clock: skipping immediately resolves to the resting pose.
const entry = computed(() => {
  const progress = reducedMotion.value === 'reduce' ? 1 : Math.max(0, Math.min(1, props.entryProgress))
  const eased = 1 - Math.pow(1 - progress, 3)
  return {
    opacity: progress,
    '--cube-entry-yaw': `${-(1 - eased) * Math.PI * 2}rad`,
    '--cube-entry-scale': 0.72 + 0.28 * eased,
  }
})
// Cross-sections of tightly packed concentric cube volumes, not open nested shells.
const sectionLayers = [
  { inset: .024, color: 'sand' },
  { inset: .068, color: 'clay' },
  { inset: .116, color: 'slate' },
  { inset: .170, color: 'core' },
] as const
const spin = reactive({ angle: 0 })
const turn = Math.PI * 2
let hovering = false
let animation: gsap.core.Tween | undefined

function stop() {
  animation?.kill()
  animation = undefined
}
function startSpin(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  hovering = true
  stop()
  if (reducedMotion.value === 'reduce') return
  animation = gsap.to(spin, {
    angle: spin.angle + turn,
    duration: 2.4,
    ease: 'none',
    repeat: -1,
  })
}
function settleSpin() {
  hovering = false
  stop()
  if (reducedMotion.value === 'reduce') {
    spin.angle = 0
    return
  }
  const target = Math.round(spin.angle / turn) * turn
  animation = gsap.to(spin, {
    angle: target,
    duration: 0.45,
    ease: 'power2.out',
    onComplete: () => { spin.angle = 0 },
  })
}
watch(reducedMotion, () => {
  stop()
  spin.angle = 0
  if (hovering && reducedMotion.value !== 'reduce') {
    animation = gsap.to(spin, { angle: turn, duration: 2.4, ease: 'none', repeat: -1 })
  }
})
onBeforeUnmount(stop)
</script>

<template>
  <span
    class="hero-cube-glyph"
    aria-hidden="true"
    :style="entry"
    @pointerenter="startSpin"
    @pointerleave="settleSpin"
    @pointercancel="settleSpin"
  >
    <span class="hero-cube-solid" :style="{ '--cube-hover-yaw': `${spin.angle}rad` }">
      <span class="cube-face cube-front" />
      <span class="cube-face cube-front-left" />
      <span class="cube-door-module" />
      <span class="cube-door-module door-module-back" />
      <span class="door-module-edge door-module-left" />
      <span class="door-module-edge door-module-right" />
      <span class="door-module-edge door-module-top" />
      <span class="door-module-edge door-module-bottom" />
      <span class="cube-door-jamb door-jamb-left" />
      <span class="cube-door-jamb door-jamb-right" />
      <span class="cube-door-jamb door-jamb-top" />
      <span class="cube-face cube-back" />
      <span class="cube-face cube-left" />
      <span class="cube-face cube-right" />
      <span class="cube-face cube-top" />
      <span class="cube-face cube-bottom" />
      <span v-for="plane in ['back', 'wall', 'floor']" :key="plane" class="cube-section" :class="`cube-section-${plane}`">
        <span v-for="layer in sectionLayers" :key="layer.color" class="cube-section-band" :style="{ '--section-inset': `${layer.inset}em`, background: `var(--color-hero-cube-stratum-${layer.color})` }" />
      </span>
      <span class="section-door-cut section-door-top" />
      <span class="section-door-cut section-door-side" />
    </span>
  </span>
</template>

<style scoped>
.hero-cube-glyph {
  display: grid;
  place-items: center;
  width: 100%;
  height: 1em;
  perspective: 4em;
}
.hero-cube-solid {
  position: relative;
  display: block;
  width: .56em;
  height: .56em;
  transform-style: preserve-3d;
  transform: rotateX(var(--cube-view-pitch, 12deg)) rotateY(calc(var(--cube-orbit-yaw, 0rad) + var(--cube-hover-yaw, 0rad) + var(--cube-entry-yaw, 0rad))) rotateZ(var(--glyph-local-roll, 0deg)) scale3d(var(--cube-entry-scale, 1), var(--cube-entry-scale, 1), var(--cube-entry-scale, 1));
}
.cube-face {
  --cube-face-tone: var(--color-hero-cube-front);
  position: absolute;
  inset: 0;
  display: block;
  backface-visibility: hidden;
  background:
    radial-gradient(ellipse at 22% 12%, var(--color-hero-cube-soft-light), transparent 72%),
    linear-gradient(145deg, transparent 28%, var(--color-hero-cube-soft-shade)),
    var(--cube-face-tone);
  border: .004em solid var(--color-hero-cube-edge);
  border-radius: .009em;
  box-shadow:
    inset .009em .009em .012em var(--color-hero-cube-rim-light),
    inset -.009em -.012em .018em var(--color-hero-cube-rim-shade);
}
.cube-face::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: url('@/shared/assets/cube-ceramic-grain.svg') repeat;
  background-size: 96px 96px;
  opacity: .085;
  pointer-events: none;
}
.cube-front { transform: translateZ(.28em); clip-path: polygon(50% 0, 100% 0, 100% 100%, 63% 100%, 63% 42%, 50% 42%); }
.cube-front-left { transform: translateZ(.28em); clip-path: polygon(0 50%, 34% 50%, 34% 100%, 0 100%); }
.cube-back { transform: rotateY(180deg) translateZ(.28em); --cube-face-tone: var(--color-hero-cube-side); }
.cube-left { clip-path: polygon(0 0, 50% 0, 50% 50%, 100% 50%, 100% 100%, 0 100%); transform: rotateY(-90deg) translateZ(.28em); --cube-face-tone: var(--color-hero-cube-side); }
.cube-right { transform: rotateY(90deg) translateZ(.28em); --cube-face-tone: var(--color-hero-cube-side); }
.cube-top { clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 100%, 50% 50%, 0 50%); transform: rotateX(90deg) translateZ(.28em); --cube-face-tone: var(--color-hero-cube-top); }
.cube-bottom { transform: rotateX(-90deg) translateZ(.28em); --cube-face-tone: var(--color-hero-cube-bottom); }
/* Three capped, perpendicular cuts expose solid material all the way to the core.
   Band boundaries meet at identical world coordinates on adjoining cut planes. */
.cube-section {
  position: absolute;
  display: block;
  width: .28em;
  height: .28em;
  background: var(--color-hero-cube-front);
  backface-visibility: hidden;
}
.cube-section-back { left: 0; top: 0; transform: translateZ(0); }
.cube-section-wall { clip-path: polygon(0 0, 100% 0, 100% 84%, 85% 84%, 85% 100%, 0 100%); left: .28em; top: 0; transform-origin: left top; transform: translateZ(0) rotateY(-90deg); }
.cube-section-floor { clip-path: polygon(0 0, 100% 0, 100% 85%, 68% 85%, 68% 100%, 0 100%); left: 0; top: .28em; transform-origin: left top; transform: translateZ(0) rotateX(90deg); }
.cube-section-band { position: absolute; display: block; }
.cube-section-back > .cube-section-band { inset: var(--section-inset) 0 0 var(--section-inset); }
.cube-section-wall > .cube-section-band { inset: var(--section-inset) var(--section-inset) 0 0; }
.cube-section-floor > .cube-section-band { inset: 0 0 var(--section-inset) var(--section-inset); }
.cube-section::after { content: ''; position: absolute; inset: 0; pointer-events: none; }
.cube-section-wall::after { background: var(--color-hero-cube-soft-shade); }
.cube-section-floor::after { background: var(--color-hero-cube-soft-light); }
/* Independent green module, recessed .018em inside the outer white shell.
   The white front is genuinely open here; jambs join it to the inset green face. */
.cube-door-module {
  position: absolute;
  left: .1904em;
  top: .2352em;
  width: .1624em;
  height: .3248em;
  transform: translateZ(.262em);
  backface-visibility: hidden;
  clip-path: polygon(55.1724% 0, 100% 0, 100% 100%, 0 100%, 0 13.7931%, 55.1724% 13.7931%);
  background: var(--color-hero-cube-door);
  box-shadow: inset .008em .01em .012em var(--color-hero-cube-door-shadow);
}
/* The insert is a solid green block from z=.238 to z=.262, not a painted face. */
.door-module-back { transform: translateZ(.238em); backface-visibility: visible; }
.door-module-edge { position: absolute; display: block; transform-origin: left top; backface-visibility: hidden; background: var(--color-hero-cube-door); }
.door-module-left { left: .1904em; top: .28em; width: .024em; height: .28em; transform: translateZ(.238em) rotateY(-90deg); }
.door-module-right { left: .3528em; top: .2352em; width: .024em; height: .3248em; transform: translateZ(.262em) rotateY(90deg); }
.door-module-top { left: .28em; top: .2352em; width: .0728em; height: .024em; transform: translateZ(.238em) rotateX(90deg); }
.door-module-bottom { left: .1904em; top: .56em; width: .1624em; height: .024em; transform: translateZ(.262em) rotateX(-90deg); }
.cube-door-jamb {
  position: absolute;
  display: block;
  transform-origin: left top;
  backface-visibility: hidden;
  background: var(--color-hero-cube-front);
  box-shadow: inset 0 0 .01em var(--color-hero-cube-rim-shade);
}
.door-jamb-left { left: .1904em; top: .28em; width: .018em; height: .28em; transform: translateZ(.28em) rotateY(90deg); }
.door-jamb-right { left: .3528em; top: .2352em; width: .018em; height: .3248em; transform: translateZ(.262em) rotateY(-90deg); }
.door-jamb-top { left: .28em; top: .2352em; width: .0728em; height: .018em; transform: translateZ(.28em) rotateX(-90deg); }
/* Only the module's own footprint is green on the exposed cuts. */
.section-door-cut { position: absolute; display: block; transform-origin: left top; backface-visibility: hidden; background: var(--color-hero-cube-door); }
.section-door-top { left: .1904em; top: .28em; width: .0896em; height: .024em; transform: translateZ(.238em) rotateX(90deg); }
.section-door-side { left: .28em; top: .2352em; width: .024em; height: .0448em; transform: translateZ(.238em) rotateY(-90deg); }
</style>
