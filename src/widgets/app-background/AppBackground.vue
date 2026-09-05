<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import type { Geometry, Mesh, Program, Renderer, Transform } from 'ogl'

type LightArtboard = {
  x: number
  y: number
  width: number
  height: number
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')

const THEME_TRANSITION_DURATION = 540
const INITIAL_ANIMATION_DELAY_MS = 900
const BACKGROUND_FRAME_INTERVAL_MS = 1000 / 45
const MAX_DEVICE_PIXEL_RATIO = 1.35
const LIGHT_ARTBOARD_RATIO = 420 / 250
const LIGHT_ARTBOARD_MARGIN_X = 0
const LIGHT_ARTBOARD_MARGIN_Y = 5
const LINE_GAP_PX = 15
const POINT_GAP_PX = 90
const CURVE_SUBDIVISIONS = 10

const pointerWarpShader = `
uniform vec4 uPointer;
uniform float uPointerStrength;
vec2 warpPointer(vec2 pixel) {
  vec2 delta = pixel - uPointer.xy;
  float influence = exp(-dot(delta, delta) / (100.0 * 100.0));
  vec2 local = pixel - uArtboard.xy;
  vec2 edge = min(local, uArtboard.zw - local);
  float pinned = smoothstep(0.0, 36.0, min(edge.x, edge.y));
  vec2 push = delta / sqrt(dot(delta, delta) + 900.0) * 10.0 + uPointer.zw;
  return pixel + push * influence * uPointerStrength * pinned;
}
`

const lineCurveVertexShader = `
precision highp float;

attribute vec3 curve;

uniform vec2 uResolution;
uniform vec4 uArtboard;
uniform float uGapX;
uniform float uPointCount;
uniform float uTime;
${pointerWarpShader}

vec2 resolveGridPoint(float lineX, float pointIndex) {
  float pointDenominator = max(uPointCount - 1.0, 1.0);
  float baseX = lineX * uArtboard.z;
  float baseY = pointIndex / pointDenominator * uArtboard.w;
  float interior = step(0.5, pointIndex) * step(pointIndex, uPointCount - 1.5);
  float offsetY = cos(baseX * 0.025 + uTime * 0.25) * 40.0 * interior;
  float offsetX = sin((baseY + offsetY) * 0.02 + uTime * 0.125) * uGapX * 2.5 * interior;
  return vec2(baseX + offsetX, baseY + offsetY);
}

void main() {
  float lineX = curve.x;
  float endPointIndex = curve.y;
  float progress = curve.z;
  float startPointIndex = endPointIndex - 1.0;
  float pointDenominator = max(uPointCount - 1.0, 1.0);

  vec2 startPoint = resolveGridPoint(lineX, startPointIndex);
  vec2 endPoint = resolveGridPoint(lineX, endPointIndex);

  float baseX = lineX * uArtboard.z;
  float startBaseY = startPointIndex / pointDenominator * uArtboard.w;
  float endBaseY = endPointIndex / pointDenominator * uArtboard.w;
  float previousBaseY = endPointIndex < uPointCount - 1.0 ? startBaseY : endBaseY;
  vec2 controlPoint = vec2(baseX, (endPoint.y + previousBaseY) * 0.5);

  vec2 firstHalf = mix(startPoint, controlPoint, progress);
  vec2 secondHalf = mix(controlPoint, endPoint, progress);
  vec2 curvePoint = mix(firstHalf, secondHalf, progress);
  vec2 pixelPosition = warpPointer(uArtboard.xy + curvePoint);
  vec2 clipPosition = vec2(
    pixelPosition.x / uResolution.x * 2.0 - 1.0,
    1.0 - pixelPosition.y / uResolution.y * 2.0
  );

  gl_Position = vec4(clipPosition, 0.0, 1.0);
}
`

const gridPointVertexShader = `
precision highp float;

attribute vec2 gridPoint;

uniform vec2 uResolution;
uniform vec4 uArtboard;
uniform float uGapX;
uniform float uPointCount;
uniform float uTime;
uniform float uPointSize;
${pointerWarpShader}

void main() {
  float lineX = gridPoint.x;
  float pointIndex = gridPoint.y;
  float pointDenominator = max(uPointCount - 1.0, 1.0);
  float baseX = lineX * uArtboard.z;
  float baseY = pointIndex / pointDenominator * uArtboard.w;
  float interior = step(0.5, pointIndex) * step(pointIndex, uPointCount - 1.5);
  float offsetY = cos(baseX * 0.025 + uTime * 0.25) * 40.0 * interior;
  float offsetX = sin((baseY + offsetY) * 0.02 + uTime * 0.125) * uGapX * 2.5 * interior;
  vec2 pixelPosition = warpPointer(uArtboard.xy + vec2(baseX + offsetX, baseY + offsetY));
  vec2 clipPosition = vec2(
    pixelPosition.x / uResolution.x * 2.0 - 1.0,
    1.0 - pixelPosition.y / uResolution.y * 2.0
  );

  gl_Position = vec4(clipPosition, 0.0, 1.0);
  gl_PointSize = uPointSize;
}
`

const borderVertexShader = `
precision highp float;

attribute vec2 position;

uniform vec2 uResolution;
uniform vec4 uArtboard;

void main() {
  vec2 pixelPosition = uArtboard.xy + position * uArtboard.zw;
  vec2 clipPosition = vec2(
    pixelPosition.x / uResolution.x * 2.0 - 1.0,
    1.0 - pixelPosition.y / uResolution.y * 2.0
  );

  gl_Position = vec4(clipPosition, 0.0, 1.0);
}
`

const lineFragmentShader = `
precision highp float;

void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`

const pointFragmentShader = `
precision highp float;

void main() {
  vec2 centeredPoint = gl_PointCoord - vec2(0.5);
  if (dot(centeredPoint, centeredPoint) > 0.25) {
    discard;
  }

  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`

let oglModule: typeof import('ogl') | null = null
let renderer: Renderer | null = null
let scene: Transform | null = null
let lineProgram: Program | null = null
let pointProgram: Program | null = null
let borderProgram: Program | null = null
let lineMesh: Mesh | null = null
let pointMesh: Mesh | null = null
let borderMesh: Mesh | null = null
let lineGeometry: Geometry | null = null
let pointGeometry: Geometry | null = null
let borderGeometry: Geometry | null = null

let frameId = 0
let resizeFrameId = 0
let lastRenderedAt = 0
let animationLoopEnabled = false
let animationStartTimer: number | null = null
let darkModePauseTimer: number | null = null
let themeObserver: MutationObserver | null = null
let reducedMotionQuery: MediaQueryList | null = null
let prefersReducedMotion = false
let lastPointerAt = 0
let lastInteractionFrame = 0
let previousPointer: { x: number; y: number } | null = null
const pointerDrag = [0, 0]

const sharedUniforms = {
  uResolution: { value: [1, 1] },
  uArtboard: { value: [0, 0, 1, 1] },
  uGapX: { value: 1 },
  uPointCount: { value: 2 },
  uTime: { value: 0 },
  uPointSize: { value: 2 },
  uPointer: { value: [0, 0, 0, 0] },
  uPointerStrength: { value: 0 },
}

function releasePointer() {
  previousPointer = null
  lastPointerAt = 0
}

function resetInteraction() {
  releasePointer()
  sharedUniforms.uPointerStrength.value = 0
  sharedUniforms.uPointer.value.fill(0)
  pointerDrag.fill(0)
  lastInteractionFrame = 0
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || prefersReducedMotion || resolveThemeIsDark() || document.hidden) return
  if (!(event.target instanceof Element) || event.target.closest(
    'header, nav, article, a, button, input, textarea, select, [role="dialog"], [role="menu"], .surface-1, .surface-2, .prose, [contenteditable]',
  )) { releasePointer(); return }
  const x = event.clientX, y = event.clientY
  const pointer = sharedUniforms.uPointer.value
  if (!previousPointer) {
    pointer[0] = x
    pointer[1] = y
    pointerDrag.fill(0)
  } else {
    pointerDrag[0] = Math.max(-12, Math.min(12, (x - previousPointer.x) * 1.2))
    pointerDrag[1] = Math.max(-12, Math.min(12, (y - previousPointer.y) * 1.2))
  }
  previousPointer = { x, y }
  lastPointerAt = performance.now()
  if (!animationLoopEnabled) startAnimationLoop(false)
}

function resolveThemeIsDark() {
  return document.documentElement.classList.contains('dark')
}

function resolveLightArtboard(width: number, height: number): LightArtboard {
  const maxWidth = Math.max(240, width - LIGHT_ARTBOARD_MARGIN_X)
  const maxHeight = Math.max(180, height - LIGHT_ARTBOARD_MARGIN_Y)

  let artboardWidth = maxWidth
  let artboardHeight = artboardWidth / LIGHT_ARTBOARD_RATIO

  if (artboardHeight > maxHeight) {
    artboardHeight = maxHeight
    artboardWidth = artboardHeight * LIGHT_ARTBOARD_RATIO
  }

  return {
    x: (width - artboardWidth) * 0.5,
    y: (height - artboardHeight) * 0.5 + LIGHT_ARTBOARD_MARGIN_Y,
    width: artboardWidth,
    height: artboardHeight,
  }
}

function createLineCurveData(lineCount: number, pointCount: number) {
  const segmentCount = Math.max(pointCount - 1, 1)
  const valuesPerSubdivision = 6
  const curveData = new Float32Array(
    lineCount * segmentCount * CURVE_SUBDIVISIONS * valuesPerSubdivision,
  )
  let offset = 0

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const lineX = lineCount === 1 ? 0 : lineIndex / (lineCount - 1)

    for (let endPointIndex = 1; endPointIndex < pointCount; endPointIndex += 1) {
      for (let subdivision = 0; subdivision < CURVE_SUBDIVISIONS; subdivision += 1) {
        const startProgress = subdivision / CURVE_SUBDIVISIONS
        const endProgress = (subdivision + 1) / CURVE_SUBDIVISIONS

        curveData[offset] = lineX
        curveData[offset + 1] = endPointIndex
        curveData[offset + 2] = startProgress
        curveData[offset + 3] = lineX
        curveData[offset + 4] = endPointIndex
        curveData[offset + 5] = endProgress
        offset += valuesPerSubdivision
      }
    }
  }

  return curveData
}

function createPointData(lineCount: number, pointCount: number) {
  const pointData = new Float32Array(lineCount * pointCount * 2)
  let offset = 0

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const lineX = lineCount === 1 ? 0 : lineIndex / (lineCount - 1)

    for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
      pointData[offset] = lineX
      pointData[offset + 1] = pointIndex
      offset += 2
    }
  }

  return pointData
}

function replaceGridGeometry(artboard: LightArtboard) {
  if (!renderer || !oglModule || !lineMesh || !pointMesh || !borderMesh) return

  const gl = renderer.gl
  const lineCount = Math.max(2, Math.floor(artboard.width / LINE_GAP_PX))
  const pointCount = Math.max(2, Math.floor(artboard.height / POINT_GAP_PX))

  lineGeometry?.remove()
  pointGeometry?.remove()
  borderGeometry?.remove()

  lineGeometry = new oglModule.Geometry(gl, {
    curve: {
      size: 3,
      data: createLineCurveData(lineCount, pointCount),
    },
  })

  pointGeometry = new oglModule.Geometry(gl, {
    gridPoint: {
      size: 2,
      data: createPointData(lineCount, pointCount),
    },
  })

  borderGeometry = new oglModule.Geometry(gl, {
    position: {
      size: 2,
      data: new Float32Array([
        0, 0,
        1, 0,
        1, 1,
        0, 1,
      ]),
    },
  })

  lineMesh.geometry = lineGeometry
  pointMesh.geometry = pointGeometry
  borderMesh.geometry = borderGeometry

  sharedUniforms.uGapX.value = artboard.width / Math.max(lineCount - 1, 1)
  sharedUniforms.uPointCount.value = pointCount
}

function resizeRenderer() {
  if (!renderer) return
  resetInteraction()

  const width = window.innerWidth
  const height = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
  const artboard = resolveLightArtboard(width, height)

  renderer.dpr = dpr
  renderer.setSize(width, height)

  sharedUniforms.uResolution.value = [width, height]
  sharedUniforms.uArtboard.value = [
    artboard.x,
    artboard.y,
    artboard.width,
    artboard.height,
  ]
  sharedUniforms.uPointSize.value = Math.max(1.5, 2 * dpr)

  replaceGridGeometry(artboard)
  renderFrame(performance.now())
}

function scheduleResize() {
  if (resizeFrameId !== 0) return

  resizeFrameId = requestAnimationFrame(() => {
    resizeFrameId = 0
    resizeRenderer()
  })
}

function renderFrame(now: number) {
  if (!renderer || !scene) return

  const dt = lastInteractionFrame ? Math.min((now - lastInteractionFrame) / 1000, 0.05) : 1 / 45
  lastInteractionFrame = now
  const active = lastPointerAt > 0 && now - lastPointerAt < 180 && !prefersReducedMotion && !resolveThemeIsDark()
  const ease = 1 - Math.exp(-dt / (active ? 0.16 : 0.45))
  sharedUniforms.uPointerStrength.value += ((active ? 1 : 0) - sharedUniforms.uPointerStrength.value) * ease
  const pointer = sharedUniforms.uPointer.value
  if (previousPointer && active) {
    pointer[0]! += (previousPointer.x - pointer[0]!) * ease
    pointer[1]! += (previousPointer.y - pointer[1]!) * ease
  }
  pointer[2]! += ((active ? pointerDrag[0]! : 0) - pointer[2]!) * ease
  pointer[3]! += ((active ? pointerDrag[1]! : 0) - pointer[3]!) * ease

  sharedUniforms.uTime.value = prefersReducedMotion ? 0 : now * 0.001
  renderer.render({
    scene,
    sort: false,
    frustumCull: false,
  })
}

function queueFrame() {
  if (!animationLoopEnabled || frameId !== 0 || document.hidden || resolveThemeIsDark()) {
    return
  }

  frameId = requestAnimationFrame(render)
}

function render(now: number) {
  frameId = 0

  if (now - lastRenderedAt < BACKGROUND_FRAME_INTERVAL_MS) {
    queueFrame()
    return
  }

  lastRenderedAt = now
  renderFrame(now)
  queueFrame()
}

function stopAnimationFrame() {
  if (frameId === 0) return

  cancelAnimationFrame(frameId)
  frameId = 0
}

function startAnimationLoop(forceRender = true) {
  if (prefersReducedMotion || resolveThemeIsDark()) {
    animationLoopEnabled = false
    stopAnimationFrame()
    if (forceRender) renderFrame(performance.now())
    return
  }

  animationLoopEnabled = true
  if (forceRender) renderFrame(performance.now())
  queueFrame()
}

function pauseAnimationLoop() {
  animationLoopEnabled = false
  stopAnimationFrame()
}

function cancelAnimationLoopStart() {
  if (animationStartTimer === null) return

  window.clearTimeout(animationStartTimer)
  animationStartTimer = null
}

function scheduleAnimationLoopStart() {
  if (animationStartTimer !== null || prefersReducedMotion || resolveThemeIsDark()) return

  animationStartTimer = window.setTimeout(() => {
    animationStartTimer = null

    const startWhenIdle = () => {
      if (!resolveThemeIsDark()) {
        startAnimationLoop()
      }
    }

    if (window.requestIdleCallback) {
      window.requestIdleCallback(startWhenIdle, { timeout: 1200 })
      return
    }

    startWhenIdle()
  }, INITIAL_ANIMATION_DELAY_MS)
}

function cancelDarkModePause() {
  if (darkModePauseTimer === null) return

  window.clearTimeout(darkModePauseTimer)
  darkModePauseTimer = null
}

function scheduleDarkModePause() {
  cancelDarkModePause()
  darkModePauseTimer = window.setTimeout(() => {
    darkModePauseTimer = null
    if (resolveThemeIsDark()) {
      pauseAnimationLoop()
    }
  }, THEME_TRANSITION_DURATION + 80)
}

function syncThemeAnimation() {
  resetInteraction()
  cancelDarkModePause()

  if (resolveThemeIsDark()) {
    cancelAnimationLoopStart()
    scheduleDarkModePause()
    return
  }

  startAnimationLoop(false)
}

function syncReducedMotionPreference() {
  resetInteraction()
  prefersReducedMotion = reducedMotionQuery?.matches ?? false

  if (prefersReducedMotion) {
    cancelAnimationLoopStart()
    pauseAnimationLoop()
    renderFrame(0)
    return
  }

  if (!resolveThemeIsDark()) {
    startAnimationLoop()
  }
}

function handleVisibilityChange() {
  resetInteraction()
  if (document.hidden) {
    stopAnimationFrame()
    return
  }

  if (animationLoopEnabled && !resolveThemeIsDark()) {
    renderFrame(performance.now())
    queueFrame()
  }
}

async function initRenderer() {
  const canvas = canvasRef.value
  if (!canvas) return false

  try {
    oglModule = await import('ogl')
    renderer = new oglModule.Renderer({
      canvas,
      dpr: Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO),
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: 'high-performance',
    })
  } catch (error) {
    console.warn('Unable to initialize the light background WebGL renderer.', error)
    renderer = null
    return false
  }

  const gl = renderer.gl
  gl.clearColor(0, 0, 0, 0)

  lineProgram = new oglModule.Program(gl, {
    vertex: lineCurveVertexShader,
    fragment: lineFragmentShader,
    uniforms: sharedUniforms,
    transparent: true,
    cullFace: null,
    depthTest: false,
    depthWrite: false,
  })

  pointProgram = new oglModule.Program(gl, {
    vertex: gridPointVertexShader,
    fragment: pointFragmentShader,
    uniforms: sharedUniforms,
    transparent: true,
    cullFace: null,
    depthTest: false,
    depthWrite: false,
  })

  borderProgram = new oglModule.Program(gl, {
    vertex: borderVertexShader,
    fragment: lineFragmentShader,
    uniforms: sharedUniforms,
    transparent: true,
    cullFace: null,
    depthTest: false,
    depthWrite: false,
  })

  scene = new oglModule.Transform()
  lineGeometry = new oglModule.Geometry(gl, {
    curve: { size: 3, data: new Float32Array([0, 1, 0, 0, 1, 1]) },
  })
  pointGeometry = new oglModule.Geometry(gl, {
    gridPoint: { size: 2, data: new Float32Array([0, 0]) },
  })
  borderGeometry = new oglModule.Geometry(gl, {
    position: { size: 2, data: new Float32Array([0, 0, 1, 0]) },
  })

  lineMesh = new oglModule.Mesh(gl, {
    geometry: lineGeometry,
    program: lineProgram,
    mode: gl.LINES,
    frustumCulled: false,
  })
  pointMesh = new oglModule.Mesh(gl, {
    geometry: pointGeometry,
    program: pointProgram,
    mode: gl.POINTS,
    frustumCulled: false,
  })
  borderMesh = new oglModule.Mesh(gl, {
    geometry: borderGeometry,
    program: borderProgram,
    mode: gl.LINES,
    frustumCulled: false,
  })

  lineMesh.setParent(scene)
  pointMesh.setParent(scene)
  borderMesh.setParent(scene)

  return true
}

function cleanupRenderer() {
  pauseAnimationLoop()
  cancelAnimationLoopStart()
  cancelDarkModePause()

  if (resizeFrameId !== 0) {
    cancelAnimationFrame(resizeFrameId)
    resizeFrameId = 0
  }

  lineGeometry?.remove()
  pointGeometry?.remove()
  borderGeometry?.remove()
  lineProgram?.remove()
  pointProgram?.remove()
  borderProgram?.remove()

  if (renderer) {
    renderer.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  renderer = null
  oglModule = null
  scene = null
  lineProgram = null
  pointProgram = null
  borderProgram = null
  lineMesh = null
  pointMesh = null
  borderMesh = null
  lineGeometry = null
  pointGeometry = null
  borderGeometry = null
}

onMounted(async () => {
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion = reducedMotionQuery.matches

  if (!(await initRenderer())) return

  resizeRenderer()

  themeObserver = new MutationObserver(syncThemeAnimation)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  reducedMotionQuery.addEventListener('change', syncReducedMotionPreference)
  window.addEventListener('resize', scheduleResize)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerout', releasePointer)
  window.addEventListener('blur', releasePointer)
  window.addEventListener('scroll', releasePointer, { passive: true })
  document.addEventListener('visibilitychange', handleVisibilityChange)

  if (!prefersReducedMotion && !resolveThemeIsDark()) {
    scheduleAnimationLoopStart()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerout', releasePointer)
  window.removeEventListener('blur', releasePointer)
  window.removeEventListener('scroll', releasePointer)
  window.removeEventListener('resize', scheduleResize)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  reducedMotionQuery?.removeEventListener('change', syncReducedMotionPreference)
  reducedMotionQuery = null
  themeObserver?.disconnect()
  themeObserver = null
  cleanupRenderer()
})
</script>

<template>
  <div aria-hidden="true" class="app-background">
    <canvas ref="canvasRef" class="app-background__mesh" />
    <div class="app-background__overlay" />
    <div class="app-background__noise" />
  </div>
</template>

<style>
.app-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  isolation: isolate;
  background: #fff;
}

.app-background__mesh,
.app-background__overlay,
.app-background__noise {
  position: absolute;
  inset: 0;
}

.app-background__mesh {
  width: 100%;
  height: 100%;
  display: block;
}

.app-background__overlay {
  background:
    radial-gradient(ellipse 70% 88% at 50% 38%, rgb(255 255 255 / 0.14), rgb(255 255 255 / 0.08) 42%, rgb(255 255 255 / 0.03) 74%, transparent 92%),
    linear-gradient(180deg, rgb(255 255 255 / 0.06), rgb(255 255 255 / 0.02));
}

.app-background__noise {
  opacity: 0;
}

html.dark .app-background {
  background: #0b0b0f;
}

html.dark .app-background__overlay {
  background:
    radial-gradient(circle at center, transparent 34%, rgb(0 0 0 / 0.15) 100%),
    linear-gradient(180deg, rgb(255 255 255 / 0.02), rgb(0 0 0 / 0.12));
}

html.theme-switching .app-background__overlay {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

html.dark .app-background__noise {
  opacity: 0.032;
}
</style>
