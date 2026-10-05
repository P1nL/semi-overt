<script setup lang="ts">
import { computed, useId } from 'vue'
import { out, progress, INTRO_MOTION } from '@/features/home-intro'
import { introGlyphs } from './model/introGlyphs'
const props = defineProps<{ letter: string; elapsed: number }>()
const maskId = 'intro-pen-' + useId().replace(/:/g, '-')
const glyph = computed(() => introGlyphs[props.letter])
const write = computed(() => progress(props.elapsed, 0, INTRO_MOTION.glyphWrite))
const blend = computed(() => progress(props.elapsed, INTRO_MOTION.glyphBlendStart, INTRO_MOTION.glyphBlend))
const weight = computed(() => 100 + 800 * out(progress(props.elapsed, INTRO_MOTION.glyphWrite, INTRO_MOTION.glyphWeight)))
</script>
<template>
  <span class="intro-glyph" :style="{ opacity: elapsed >= 0 ? 1 : 0 }" aria-hidden="true">
    <svg v-if="glyph && blend < 1" class="intro-glyph__pen" viewBox="0 0 1740.8 2048" :style="{ opacity: 1 - blend }">
      <defs><mask :id="maskId" maskUnits="userSpaceOnUse" x="-100" y="-100" width="2200" height="2400">
        <g :transform="glyph.transform"><g :transform="glyph.brushTransform">
          <path v-for="(stroke, i) in glyph.strokes" :key="i" :d="stroke" fill="none" stroke="white" stroke-width="25" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" :stroke-dashoffset="1 - Math.min(1, Math.max(0, write * glyph.strokes.length - i))" />
        </g></g>
      </mask></defs>
      <g :mask="`url(#${maskId})`"><path :d="glyph.outline" :transform="glyph.transform" fill="currentColor" /></g>
    </svg>
    <span class="intro-glyph__text" :style="{ opacity: glyph ? blend : progress(elapsed, 0, 150), fontVariationSettings: `'wght' ${weight}` }">{{ letter }}</span>
  </span>
</template>
<style scoped>
.intro-glyph { display: block; position: relative; height: 1em; line-height: 1; font-family: var(--font-pressure); font-synthesis: none; }
.intro-glyph__pen { position: absolute; inset: 0; width: 100%; height: 1em; overflow: visible; }
.intro-glyph__text { display: block; text-align: center; }
</style>
