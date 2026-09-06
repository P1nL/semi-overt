<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{ refract: boolean }>()
const surface = ref<HTMLElement | null>(null)
const mapUrl = ref('')
const dimensions = ref({ width: 1, height: 1 })
const filterId = 'header-glass-' + useId().replace(/:/g, '-')
// Syntax support does not prove SVG backdrop rendering. Other engines use clear glass.
const supportsRefraction = ref(false)
const optical = computed(() => props.refract && supportsRefraction.value && Boolean(mapUrl.value))
const filterStyle = computed(() => optical.value
  ? { backdropFilter: 'url("#' + filterId + '") saturate(1.12)' }
  : undefined)
let observer: ResizeObserver | undefined
let frame = 0

function updateMap() {
  frame = 0
  if (!surface.value || !props.refract || !supportsRefraction.value) return
  const width = Math.ceil(surface.value.clientWidth)
  const height = Math.ceil(surface.value.clientHeight)
  if (!width || !height) return
  if (mapUrl.value && dimensions.value.width === width && dimensions.value.height === height) return
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const image = ctx.createImageData(width, height)
  const radius = Math.min(parseFloat(getComputedStyle(surface.value).borderRadius) || 28, height / 2)
  const band = Math.min(11, height / 3)
  // Rounded-rectangle distance field: neutral center, displacement only at the rim.
  // No turbulence, DOM screenshots, per-scroll updates, or animation loop.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - width / 2
      const py = y + 0.5 - height / 2
      const qx = Math.abs(px) - (width / 2 - radius)
      const qy = Math.abs(py) - (height / 2 - radius)
      const ox = Math.max(qx, 0)
      const oy = Math.max(qy, 0)
      const length = Math.hypot(ox, oy)
      const distance = length + Math.min(Math.max(qx, qy), 0) - radius
      const depth = -distance
      const lens = depth > 0 && depth < band ? Math.sin(Math.PI * depth / band) : 0
      const nx = length > 0 ? ox / length : Number(qx > qy)
      const ny = length > 0 ? oy / length : Number(qy >= qx)
      const offset = (y * width + x) * 4
      image.data[offset] = Math.round(128 - Math.sign(px) * nx * lens * 112)
      image.data[offset + 1] = Math.round(128 - Math.sign(py) * ny * lens * 112)
      image.data[offset + 2] = 128
      image.data[offset + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  dimensions.value = { width, height }
  mapUrl.value = canvas.toDataURL()
}
function scheduleMap() {
  if (!frame) frame = requestAnimationFrame(updateMap)
}
onMounted(() => {
  supportsRefraction.value = ['Chrome/', 'Chromium/', 'Edg/'].some(name => navigator.userAgent.includes(name))
    && CSS.supports('backdrop-filter', 'url("#glass")')
  observer = new ResizeObserver(scheduleMap)
  if (surface.value) observer.observe(surface.value)
  scheduleMap()
})
watch(() => props.refract, scheduleMap)
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
})
</script>

<template>
  <div ref="surface" class="header-glass" aria-hidden="true" :data-optical="optical">
    <svg v-if="optical" class="header-glass-defs" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter :id="filterId" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
          <feImage :href="mapUrl" :width="dimensions.width" :height="dimensions.height" preserveAspectRatio="none" result="rim" />
          <feDisplacementMap in="SourceGraphic" in2="rim" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
    <div class="header-glass-lens" :style="filterStyle" />
    <div class="header-glass-rim" />
  </div>
</template>

<style scoped>
.header-glass {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: var(--nav-glass-shadow);
}
.header-glass-defs { position: absolute; width: 0; height: 0; pointer-events: none; }
.header-glass-lens,
.header-glass-rim { position: absolute; inset: 0; border-radius: inherit; }
.header-glass-lens {
  background: var(--nav-glass-tint);
  -webkit-backdrop-filter: blur(var(--nav-glass-blur)) saturate(1.12);
  backdrop-filter: blur(var(--nav-glass-blur)) saturate(1.12);
}
.header-glass-rim {
  border: 1px solid var(--nav-glass-border);
  background: var(--nav-glass-reflection);
  box-shadow: var(--nav-glass-rim-shadow);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .header-glass-lens { background: var(--color-surface); }
}
@media (max-width: 767px) {
  .header-glass-lens { background: var(--nav-glass-mobile-tint); }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active) {
  .header-glass-lens {
    background: var(--color-surface);
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }
  .header-glass-rim { background: none; }
}
</style>
