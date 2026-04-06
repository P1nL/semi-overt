<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

type MeshTheme = 'light' | 'dark'

type MeshPoint = {
  color: [number, number, number]
  x: number
  y: number
  r: number
  ax: number
  ay: number
  dx: number
  dy: number
  sx: number
  sy: number
  pulse: number
  ox: number
  oy: number
}

type MeshSample = {
  x: number
  y: number
  radius: number
  alpha: number
}

type GridVertex = {
  x: number
  y: number
}

type LightArtboard = {
  x: number
  y: number
  width: number
  height: number
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const THEME_TRANSITION_DURATION = 420
const DARK_TRAVEL_SCALE = 0.72
const DARK_PULSE_SCALE = 0.78
const LIGHT_GRID_DRIFT_SCALE = 0.8
const DARK_GLOBAL_DRIFT_SCALE = 0.82

const GRID_SIZE = 42
const GRID_SEGMENT = 8
const GRID_RADIUS = 150
const GRID_STRENGTH = 15

const LIGHT_POINTER_STRENGTH = GRID_STRENGTH * 0.78
const LIGHT_WAKE_RADIUS = GRID_RADIUS * 0.92
const LIGHT_WAKE_MAX_DISTANCE = 74
const LIGHT_ARTBOARD_RATIO = 420 / 297
const LIGHT_ARTBOARD_MARGIN_X = 16
const LIGHT_ARTBOARD_MARGIN_Y = 16

const pointer = {
  x: -1000,
  y: -1000,
  targetX: -1000,
  targetY: -1000,
  vx: 0,
  vy: 0,
  wakeX: -1000,
  wakeY: -1000,
  wakeEnergy: 0,
  active: false,
}

const lightPoints: MeshPoint[] = [
  { color: [255, 255, 255], x: 0.22, y: 0.18, r: 0.46, ax: 0.05, ay: 0.032, dx: 0.018, dy: 0.014, sx: 0.17, sy: 0.14, pulse: 0.46, ox: 0.6, oy: 1.4 },
  { color: [196, 236, 255], x: 0.12, y: 0.34, r: 0.31, ax: 0.055, ay: 0.042, dx: 0.016, dy: 0.012, sx: 0.2, sy: 0.16, pulse: 0.54, ox: 2.2, oy: 0.7 },
  { color: [228, 238, 252], x: 0.74, y: 0.22, r: 0.36, ax: 0.034, ay: 0.026, dx: 0.013, dy: 0.012, sx: 0.14, sy: 0.18, pulse: 0.42, ox: 1.7, oy: 2.1 },
  { color: [182, 226, 255], x: 0.55, y: 0.76, r: 0.39, ax: 0.042, ay: 0.034, dx: 0.015, dy: 0.013, sx: 0.18, sy: 0.2, pulse: 0.51, ox: 3.1, oy: 0.9 },
  { color: [244, 249, 255], x: 0.86, y: 0.82, r: 0.3, ax: 0.032, ay: 0.028, dx: 0.012, dy: 0.01, sx: 0.16, sy: 0.15, pulse: 0.48, ox: 4.4, oy: 1.2 },
]

const darkPoints: MeshPoint[] = [
  { color: [41, 76, 255], x: 0.18, y: 0.17, r: 0.34, ax: 0.06, ay: 0.048, dx: 0.02, dy: 0.012, sx: 0.16, sy: 0.12, pulse: 0.42, ox: 0.4, oy: 1.1 },
  { color: [77, 53, 196], x: 0.79, y: 0.24, r: 0.31, ax: 0.034, ay: 0.026, dx: 0.012, dy: 0.011, sx: 0.11, sy: 0.14, pulse: 0.36, ox: 1.8, oy: 0.6 },
  { color: [20, 34, 68], x: 0.5, y: 0.52, r: 0.48, ax: 0.02, ay: 0.018, dx: 0.01, dy: 0.008, sx: 0.09, sy: 0.1, pulse: 0.28, ox: 2.7, oy: 1.4 },
  { color: [16, 84, 206], x: 0.38, y: 0.7, r: 0.36, ax: 0.03, ay: 0.024, dx: 0.012, dy: 0.01, sx: 0.13, sy: 0.17, pulse: 0.39, ox: 3.6, oy: 1.8 },
  { color: [124, 72, 255], x: 0.66, y: 0.5, r: 0.24, ax: 0.022, ay: 0.018, dx: 0.01, dy: 0.008, sx: 0.15, sy: 0.12, pulse: 0.52, ox: 4.1, oy: 2.4 },
]

let frameId = 0
let dpr = 1
let currentTheme: MeshTheme = 'light'
let targetTheme: MeshTheme = 'light'
let transitionFromTheme: MeshTheme | null = null
let themeTransitionStart = 0
let themeObserver: MutationObserver | null = null
let reducedMotionQuery: MediaQueryList | null = null
let prefersReducedMotion = false

function easeOutQuart(value: number) {
  return 1 - (1 - value) ** 4
}

function queueFrame() {
  if (frameId !== 0 || prefersReducedMotion || document.hidden) {
    return
  }

  frameId = requestAnimationFrame(render)
}

function stopAnimation() {
  if (frameId === 0) {
    return
  }

  cancelAnimationFrame(frameId)
  frameId = 0
}

function syncAnimationLoop(forceRender = false) {
  if (prefersReducedMotion || document.hidden) {
    stopAnimation()

    if (forceRender) {
      renderFrame(performance.now())
    }
    return
  }

  if (forceRender) {
    renderFrame(performance.now())
  }

  queueFrame()
}

function handlePointerMove(event: MouseEvent) {
  pointer.active = true

  if (pointer.x < -500 || pointer.y < -500) {
    pointer.x = event.clientX
    pointer.y = event.clientY
    pointer.wakeX = event.clientX
    pointer.wakeY = event.clientY
  }

  pointer.targetX = event.clientX
  pointer.targetY = event.clientY
}

function handlePointerLeave() {
  pointer.active = false
  pointer.targetX = pointer.x
  pointer.targetY = pointer.y
}

function resolveTheme(): MeshTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function beginThemeTransition(nextTheme: MeshTheme, now = performance.now()) {
  if (nextTheme === targetTheme) {
    return
  }

  if (prefersReducedMotion) {
    transitionFromTheme = null
    currentTheme = nextTheme
    targetTheme = nextTheme
    renderFrame(now)
    return
  }

  transitionFromTheme = targetTheme
  currentTheme = nextTheme
  targetTheme = nextTheme
  themeTransitionStart = now
  queueFrame()
}

function resizeCanvas() {
  const canvas = canvasRef.value

  if (!canvas) {
    return
  }

  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.floor(window.innerWidth * dpr)
  canvas.height = Math.floor(window.innerHeight * dpr)
  canvas.style.width = `${window.innerWidth}px`
  canvas.style.height = `${window.innerHeight}px`
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, theme: MeshTheme) {
  if (theme === 'dark') {
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#08152b')
    gradient.addColorStop(0.56, '#0d1a3d')
    gradient.addColorStop(1, '#15153c')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    return
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
}

function resolveLightArtboard(width: number, height: number): LightArtboard {
  const maxWidth = Math.max(240, width - LIGHT_ARTBOARD_MARGIN_X)
  const maxHeight = Math.max(180, height - LIGHT_ARTBOARD_MARGIN_Y)

  let artboardWidth = maxWidth
  let artboardHeight = artboardWidth / LIGHT_ARTBOARD_RATIO

  // Wide screens are height-constrained with the original fit logic,
  // which leaves large side gutters. For the background we prefer width-first
  // sizing and allow the artboard to overflow vertically a bit.
  if (width / height <= LIGHT_ARTBOARD_RATIO) {
    if (artboardHeight > maxHeight) {
      artboardHeight = maxHeight
      artboardWidth = artboardHeight * LIGHT_ARTBOARD_RATIO
    }
  }

  return {
    x: (width - artboardWidth) * 0.5,
    y: (height - artboardHeight) * 0.5,
    width: artboardWidth,
    height: artboardHeight,
  }
}

function resolveGridOffset(
  centerX: number,
  centerY: number,
  pointX: number,
  pointY: number,
  axis: 'x' | 'y',
  radius: number,
  strength: number,
) {
  const deltaX = pointX - centerX
  const deltaY = pointY - centerY
  const distance = Math.hypot(deltaX, deltaY)

  if (distance >= radius) {
    return 0
  }

  const influence = 1 - distance / radius
  const easedInfluence = influence * influence * (3 - 2 * influence)
  const coreRadius = radius * 0.18
  const softenedDistance = Math.hypot(deltaX, deltaY, coreRadius)
  const centerSoftening = Math.min(distance / coreRadius, 1)
  const force = easedInfluence ** 1.08 * strength * centerSoftening
  const axisDelta = axis === 'x' ? deltaX : deltaY
  const offset = (axisDelta / softenedDistance) * force
  const maxOffset = strength * 0.82

  return Math.max(-maxOffset, Math.min(maxOffset, offset))
}

function drawSmoothGridPath(ctx: CanvasRenderingContext2D, points: GridVertex[]) {
  if (points.length === 0) {
    return
  }

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  if (points.length === 1) {
    ctx.stroke()
    return
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const midX = (current.x + next.x) * 0.5
    const midY = (current.y + next.y) * 0.5

    ctx.quadraticCurveTo(current.x, current.y, midX, midY)
  }

  const lastPoint = points[points.length - 1]
  ctx.lineTo(lastPoint.x, lastPoint.y)
  ctx.stroke()
}

function drawInteractiveGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
) {
  const artboard = resolveLightArtboard(width, height)
  const maxLines = Math.max(2, Math.floor(artboard.width / 15))
  const maxPoints = Math.max(2, Math.floor(artboard.height / 90))
  const gapX = artboard.width / Math.max(maxLines - 1, 1)
  const gapY = artboard.height / Math.max(maxPoints - 1, 1)
  const animationTime = time / 0.00136

  ctx.save()
  ctx.lineWidth = 1
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#000000'

  for (let lineIndex = 0; lineIndex < maxLines; lineIndex += 1) {
    const points: Array<GridVertex & { offsetX: number; offsetY: number }> = []
    const baseX = lineIndex * gapX

    for (let pointIndex = 0; pointIndex < maxPoints; pointIndex += 1) {
      const baseY = pointIndex * gapY
      let offsetY = Math.cos(baseX * 0.025 + animationTime * 0.00025) * 40
      let offsetX = Math.sin((baseY + offsetY) * 0.02 + animationTime * 0.000125) * gapX * 2.5

      if (pointIndex === 0 || pointIndex === maxPoints - 1) {
        offsetX = 0
        offsetY = 0
      }

      points.push({ x: baseX, y: baseY, offsetX, offsetY })
    }

    ctx.beginPath()

    points.forEach((point, pointIndex) => {
      const x = artboard.x + point.x + point.offsetX
      const y = artboard.y + point.y + point.offsetY

      if (pointIndex === 0) {
        ctx.moveTo(x, y)
      } else {
        const previousBasePoint =
          pointIndex > 0 && pointIndex < points.length - 1
            ? points[pointIndex - 1]
            : point

        const controlX = artboard.x + point.x
        const controlY = artboard.y + (y - artboard.y + previousBasePoint.y) * 0.5

        ctx.quadraticCurveTo(controlX, controlY, x, y)
      }
    })

    ctx.stroke()

    points.forEach((point) => {
      const x = artboard.x + point.x + point.offsetX
      const y = artboard.y + point.y + point.offsetY

      ctx.beginPath()
      ctx.arc(x, y, 1, 0, Math.PI * 2)
      ctx.stroke()
    })
  }

  ctx.beginPath()
  ctx.moveTo(artboard.x, artboard.y)
  ctx.lineTo(artboard.x + artboard.width, artboard.y)
  ctx.moveTo(artboard.x + artboard.width, artboard.y + artboard.height)
  ctx.lineTo(artboard.x, artboard.y + artboard.height)
  ctx.stroke()
  ctx.restore()
}

function drawPoint(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  radius: number,
  color: [number, number, number],
  alpha: number,
) {
  drawBlob(ctx, px, py, radius, radius, 0, color, alpha)
}

function drawBlob(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  color: [number, number, number],
  alpha: number,
) {
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(rotation)
  ctx.scale(radiusX, radiusY)

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`)
  gradient.addColorStop(0.34, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.46})`)
  gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`)

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawCluster(
  ctx: CanvasRenderingContext2D,
  sample: MeshSample,
  color: [number, number, number],
  time: number,
  phase: number,
) {
  const parts = [
    { ox: -0.34, oy: -0.08, rx: 0.84, ry: 0.52, rotation: -0.44, alpha: 0.88 },
    { ox: 0.24, oy: 0.2, rx: 0.56, ry: 0.86, rotation: 0.36, alpha: 0.72 },
    { ox: 0.06, oy: -0.32, rx: 0.44, ry: 0.34, rotation: 0.96, alpha: 0.58 },
    { ox: 0.28, oy: -0.14, rx: 0.38, ry: 0.54, rotation: -1.02, alpha: 0.42 },
    { ox: -0.08, oy: 0.3, rx: 0.46, ry: 0.28, rotation: 0.18, alpha: 0.4 },
  ]

  parts.forEach((part, index) => {
    const driftX = Math.sin(time * (0.42 + index * 0.08) + phase + index) * sample.radius * 0.08
    const driftY = Math.cos(time * (0.36 + index * 0.07) + phase * 0.8 + index) * sample.radius * 0.06

    drawBlob(
      ctx,
      sample.x + sample.radius * part.ox + driftX,
      sample.y + sample.radius * part.oy + driftY,
      sample.radius * part.rx,
      sample.radius * part.ry,
      part.rotation + Math.sin(time * 0.18 + phase + index) * 0.08,
      color,
      sample.alpha * part.alpha,
    )
  })

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  drawBlob(
    ctx,
    sample.x + sample.radius * 0.26 + Math.sin(time * 0.31 + phase) * sample.radius * 0.05,
    sample.y - sample.radius * 0.18 + Math.cos(time * 0.27 + phase) * sample.radius * 0.04,
    sample.radius * 0.22,
    sample.radius * 0.16,
    -0.58,
    color,
    Math.min(sample.alpha * 0.22, 0.18),
  )
  ctx.restore()
}

function drawMeshLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: MeshTheme,
  time: number,
) {
  const points = theme === 'dark' ? darkPoints : lightPoints
  const baseAlpha = theme === 'dark' ? 0.84 : 0.98
  const blurAmount = theme === 'dark' ? 58 : 46
  const saturation = theme === 'dark' ? 124 : 118
  const samples: MeshSample[] = []
  const globalDriftX =
    (Math.sin(time * (theme === 'dark' ? 0.16 : 0.14) + 0.8) * (theme === 'dark' ? 0.092 : 0.032) +
      Math.cos(time * (theme === 'dark' ? 0.11 : 0.1) + 2.1) * (theme === 'dark' ? 0.04 : 0.014)) *
    width *
    (theme === 'dark' ? DARK_GLOBAL_DRIFT_SCALE : 1)
  const globalDriftY =
    (Math.cos(time * (theme === 'dark' ? 0.13 : 0.12) + 1.4) * (theme === 'dark' ? 0.068 : 0.022) +
      Math.sin(time * (theme === 'dark' ? 0.09 : 0.08) + 0.2) * (theme === 'dark' ? 0.026 : 0.01)) *
    height *
    (theme === 'dark' ? DARK_GLOBAL_DRIFT_SCALE : 1)

  ctx.save()
  ctx.globalCompositeOperation = theme === 'dark' ? 'lighter' : 'source-over'
  ctx.filter = `blur(${blurAmount}px) saturate(${saturation}%)`

  points.forEach((point, index) => {
    const wobbleX =
      Math.sin(time * (point.sx * 0.63 + 0.03) + point.ox * 1.7) * (point.ax * 0.46) +
      Math.cos(time * (point.sy * 1.14 + 0.06) + point.oy * 1.3) * (point.dx * 0.92) +
      Math.sin(time * (point.sx * 0.41 + point.sy * 0.52) + point.ox * 0.7) * (point.ax * 0.22)

    const wobbleY =
      Math.cos(time * (point.sy * 0.58 + 0.04) + point.oy * 1.6) * (point.ay * 0.44) +
      Math.sin(time * (point.sx * 1.08 + 0.05) + point.ox * 1.15) * (point.dy * 0.96) +
      Math.cos(time * (point.sy * 0.43 + point.sx * 0.38) + point.oy * 0.65) * (point.ay * 0.2)

    let travelX = 0
    let travelY = 0

    if (theme === 'light' && index === 0) {
      travelX = Math.sin(time * 0.12 + point.ox) * width * 0.62
      travelY = Math.cos(time * 0.1 + point.oy) * height * 0.14
    }

    if (theme === 'light' && index === 3) {
      travelX = Math.cos(time * 0.1 + point.ox) * width * 0.1
      travelY = Math.sin(time * 0.12 + point.oy) * height * 0.06
    }

    if (theme === 'dark' && index === 0) {
      travelX = Math.sin(time * 0.11 + point.ox) * width * 0.68 * DARK_TRAVEL_SCALE
      travelY = Math.cos(time * 0.09 + point.oy) * height * 0.18 * DARK_TRAVEL_SCALE
    }

    if (theme === 'dark' && index === 4) {
      travelX = Math.cos(time * 0.1 + point.ox) * width * 0.34 * DARK_TRAVEL_SCALE
      travelY = Math.sin(time * 0.08 + point.oy) * height * 0.1 * DARK_TRAVEL_SCALE
    }

    const x =
      (point.x +
        Math.sin(time * point.sx + point.ox) * point.ax +
        Math.cos(time * point.sy * 0.7 + point.oy) * point.dx +
        wobbleX) *
        width +
      globalDriftX +
      travelX

    const y =
      (point.y +
        Math.cos(time * point.sy + point.oy) * point.ay +
        Math.sin(time * point.sx * 0.82 + point.ox) * point.dy +
        wobbleY) *
        height +
      globalDriftY +
      travelY

    const pulse =
      1 +
      Math.sin(time * point.pulse + point.ox) * (theme === 'dark' ? 0.09 * DARK_PULSE_SCALE : 0.065) +
      Math.cos(time * (point.pulse * 0.56 + 0.08) + point.oy) * (theme === 'dark' ? 0.028 * DARK_PULSE_SCALE : 0.02)
    const radius = Math.min(width, height) * point.r * pulse * 1.12

    let alpha = baseAlpha

    if (theme === 'light' && point === lightPoints[1]) {
      alpha += Math.sin(time * 0.82) * 0.1
    }

    if (theme === 'light' && point === lightPoints[3]) {
      alpha += Math.cos(time * 0.74 + 0.8) * 0.08
    }

    if (theme === 'dark' && point === darkPoints[4]) {
      alpha += Math.sin(time * 1.3 + 1.2) * 0.11
    }

    if (theme === 'dark' && point === darkPoints[0]) {
      alpha += Math.cos(time * 1.08 + 0.4) * 0.05
    }

    samples[index] = {
      x,
      y,
      radius,
      alpha: Math.max(0.22, Math.min(alpha, 1)),
    }
  })

  const primaryBlend = theme === 'dark'
    ? Math.sin(time * 0.44 + 0.7)
    : Math.sin(time * 0.48 + 0.4)
  const secondaryBlend = theme === 'dark'
    ? Math.cos(time * 0.37 + 2.1)
    : Math.cos(time * 0.42 + 1.6)

  function blendPair(aIndex: number, bIndex: number, amount: number, radiusBoost: number, alphaBoost: number) {
    const a = samples[aIndex]
    const b = samples[bIndex]

    if (!a || !b) {
      return
    }

    const mix = amount * 0.16
    const deltaX = b.x - a.x
    const deltaY = b.y - a.y
    const mergeAmount = Math.max(amount, 0)
    const splitAmount = Math.max(-amount, 0)

    a.x += deltaX * mix
    a.y += deltaY * mix
    b.x -= deltaX * mix
    b.y -= deltaY * mix

    a.radius *= 1 + mergeAmount * radiusBoost - splitAmount * radiusBoost * 0.42
    b.radius *= 1 + mergeAmount * radiusBoost - splitAmount * radiusBoost * 0.42
    a.alpha = Math.max(0.2, Math.min(1, a.alpha + mergeAmount * alphaBoost - splitAmount * alphaBoost * 0.3))
    b.alpha = Math.max(0.2, Math.min(1, b.alpha + mergeAmount * alphaBoost - splitAmount * alphaBoost * 0.3))
  }

  if (theme === 'light') {
    blendPair(0, 1, primaryBlend, 0.07, 0.04)
    blendPair(2, 3, secondaryBlend, 0.05, 0.03)
  } else {
    blendPair(0, 4, primaryBlend, 0.16, 0.12)
    blendPair(1, 3, secondaryBlend, 0.09, 0.06)
  }

  samples.forEach((sample, index) => {
    const useCluster =
      (theme === 'light' && index === 3) ||
      (theme === 'dark' && (index === 0 || index === 4))

    if (useCluster) {
      drawCluster(ctx, sample, points[index].color, time, points[index].ox)
      return
    }

    drawPoint(ctx, sample.x, sample.y, sample.radius, points[index].color, sample.alpha)
  })

  ctx.restore()
}

function drawThemeGlow(ctx: CanvasRenderingContext2D, width: number, height: number, theme: MeshTheme) {
  ctx.save()
  ctx.globalCompositeOperation = theme === 'dark' ? 'soft-light' : 'source-over'

  const glow = ctx.createRadialGradient(
    width * 0.5,
    height * (theme === 'dark' ? 0.48 : 0.44),
    0,
    width * 0.5,
    height * (theme === 'dark' ? 0.48 : 0.44),
    Math.max(width, height) * (theme === 'dark' ? 0.72 : 0.76),
  )

  if (theme === 'dark') {
    glow.addColorStop(0, 'rgba(255,255,255,0.07)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
  } else {
    glow.addColorStop(0, 'rgba(255,255,255,0.3)')
    glow.addColorStop(0.42, 'rgba(214,234,255,0.2)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
  }

  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: MeshTheme,
  time: number,
  opacity = 1,
) {
  if (opacity <= 0.001) {
    return
  }

  ctx.save()
  ctx.globalAlpha = opacity
  drawBackground(ctx, width, height, theme)

  if (theme === 'light') {
    drawInteractiveGrid(ctx, width, height, time)
  } else {
    drawMeshLayer(ctx, width, height, theme, time)
    drawThemeGlow(ctx, width, height, theme)
  }

  ctx.restore()
}

function renderFrame(now: number) {
  const canvas = canvasRef.value

  if (!canvas) {
    return
  }

  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return
  }

  const width = window.innerWidth
  const height = window.innerHeight
  const time = prefersReducedMotion ? 0 : now * 0.00136

  const prevX = pointer.x
  const prevY = pointer.y
  const pointerLerp = pointer.active ? 0.16 : 0.08
  pointer.x += (pointer.targetX - pointer.x) * pointerLerp
  pointer.y += (pointer.targetY - pointer.y) * pointerLerp
  pointer.vx += (pointer.x - prevX - pointer.vx) * 0.24
  pointer.vy += (pointer.y - prevY - pointer.vy) * 0.24

  const speed = Math.hypot(pointer.vx, pointer.vy)
  const wakeTarget = pointer.active ? speed : 0
  pointer.wakeEnergy += (wakeTarget - pointer.wakeEnergy) * 0.026
  const directionX = speed > 0.001 ? pointer.vx / speed : 0
  const directionY = speed > 0.001 ? pointer.vy / speed : 0
  const wakeDistance =
    targetTheme === 'light'
      ? Math.min(LIGHT_WAKE_MAX_DISTANCE, pointer.wakeEnergy * 5.8)
      : Math.min(138, pointer.wakeEnergy * 14)
  const wakeTargetX = pointer.x - directionX * wakeDistance
  const wakeTargetY = pointer.y - directionY * wakeDistance

  const wakeLerp = targetTheme === 'light' ? 0.028 : 0.05
  pointer.wakeX += (wakeTargetX - pointer.wakeX) * wakeLerp
  pointer.wakeY += (wakeTargetY - pointer.wakeY) * wakeLerp

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  if (transitionFromTheme) {
    const progress = Math.min((now - themeTransitionStart) / THEME_TRANSITION_DURATION, 1)
    const easedProgress = easeOutQuart(progress)

    drawScene(ctx, width, height, transitionFromTheme, time, 1)
    drawScene(ctx, width, height, targetTheme, time, easedProgress)

    if (progress >= 1) {
      transitionFromTheme = null
    }
  } else {
    drawScene(ctx, width, height, targetTheme, time)
  }
}

function render(now: number) {
  frameId = 0
  renderFrame(now)
  queueFrame()
}

function handleVisibilityChange() {
  syncAnimationLoop(true)
}

function handleReducedMotionChange(event: MediaQueryListEvent) {
  prefersReducedMotion = event.matches
  syncAnimationLoop(true)
}

onMounted(() => {
  currentTheme = resolveTheme()
  targetTheme = currentTheme
  resizeCanvas()
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion = reducedMotionQuery.matches

  themeObserver = new MutationObserver(() => {
    beginThemeTransition(resolveTheme())
  })

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('mousemove', handlePointerMove)
  window.addEventListener('mouseleave', handlePointerLeave)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  reducedMotionQuery.addEventListener('change', handleReducedMotionChange)
  syncAnimationLoop(true)
})

onBeforeUnmount(() => {
  stopAnimation()
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('mousemove', handlePointerMove)
  window.removeEventListener('mouseleave', handlePointerLeave)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  reducedMotionQuery?.removeEventListener('change', handleReducedMotionChange)
  themeObserver?.disconnect()
  themeObserver = null
  reducedMotionQuery = null
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
  background: none;
}

.app-background__noise {
  opacity: 0;
}

html.dark .app-background__overlay {
  background:
    radial-gradient(circle at center, transparent 34%, rgb(0 0 0 / 0.15) 100%),
    linear-gradient(180deg, rgb(255 255 255 / 0.02), rgb(0 0 0 / 0.12));
}

html.dark .app-background__noise {
  opacity: 0.032;
}
</style>
