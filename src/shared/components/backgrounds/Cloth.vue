<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, useTemplateRef, watch } from 'vue'
import { useAnimationVisibility } from '@/shared/composables/useAnimationVisibility'
import { Renderer, Camera, Geometry, Program, Mesh } from 'ogl'
import { World, Body, Particle, DistanceConstraint, Vec3, GSSolver, SAPBroadphase } from 'cannon-es'

// Inspired by Arno Di Nunzio's physics-based cloth:
// https://tympanus.net/codrops/2020/02/11/how-to-create-a-physics-based-3d-cloth-with-cannon-js-and-three-js/
// Uses a particle/constraint fabric with OGL rendering, without slideshow images.
const props = withDefaults(defineProps<{ active?: boolean; nativeResolution?: boolean }>(), { active: true, nativeResolution: false })
const host = useTemplateRef<HTMLDivElement>('host')
const { visible, reducedMotion } = useAnimationVisibility(host, 'background')
const active = computed(() => props.active && visible.value)
// A decorative background does not need a full-resolution physics mesh.
const COLS = 24
const ROWS = 18
const RENDER_SUBDIVISIONS = 3
const RENDER_COLS = COLS * RENDER_SUBDIVISIONS
const RENDER_ROWS = ROWS * RENDER_SUBDIVISIONS
const RENDER_COUNT = (RENDER_COLS + 1) * (RENDER_ROWS + 1)
const STEP = 1 / 60
const FRAME_INTERVAL_MS = 1000 / 30
const MAX_DEVICE_PIXEL_RATIO = 2
const MAX_RENDER_PIXELS = 3840 * 2160
const POINTER_SPEED_SCALE = 12
// Preserve the drag strength of a 60 Hz input stream when sampling at 30 fps.
const POINTER_REFERENCE_INTERVAL_MS = 1000 / 60
const POINTER_FORCE = 0.27
const POINTER_DEPTH_FORCE = 0.96
let renderer: Renderer | undefined
let camera: Camera | undefined
let geometry: Geometry | undefined
let program: Program | undefined
let mesh: Mesh | undefined
let world: World | undefined
let bodies: Body[] = []
let frame = 0
let last = 0
let accumulator = 0
let elapsed = 0
let viewWidth = 10
let viewHeight = 10
let lost = false
const positions = new Float32Array(RENDER_COUNT * 3)
const normals = new Float32Array(RENDER_COUNT * 3)
const uv = new Float32Array(RENDER_COUNT * 2)
const indices = new Uint16Array(RENDER_COLS * RENDER_ROWS * 6)
const force = new Vec3()
const pointer = { x: 0, y: 0, dx: 0, dy: 0, energy: 0, active: false, time: 0 }
let pendingPointer: PointerEvent | null = null
let hostRect: DOMRect | undefined

const vertex = `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec3 vNormal;
varying vec2 vUv;
varying float vDepth;
void main() {
  vNormal = normal;
  vUv = uv;
  vDepth = position.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const fragment = `
precision highp float;
varying vec3 vNormal;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  // Side lighting reveals fold slopes; weak fill preserves the shaded valleys.
  vec3 light = normalize(vec3(-0.9, 0.12, 0.65));
  vec3 fillLight = normalize(vec3(0.35, 0.0, 1.0));
  float diffuse = max(dot(n, light), 0.0) * 0.88
                + max(dot(n, fillLight), 0.0) * 0.12;
  vec3 halfLight = normalize(light + vec3(0.0,0.0,1.0));
  float sheen = pow(max(dot(n, halfLight), 0.0), 8.0);
  vec3 cloth = vec3(0.145,0.137,0.158) * (0.26 + diffuse * 1.45)
               + vec3(0.030,0.028,0.032) * sheen;
  cloth *= 0.9925;
  cloth *= 1.0 - clamp(-vDepth * 0.05, 0.0, 0.12);
  gl_FragColor = vec4(cloth,1.0);
}`

function createFabric() {
  world = new World({ gravity: new Vec3(0, -0.5, 0), allowSleep: false })
  world.broadphase = new SAPBroadphase(world)
  const solver = new GSSolver()
  solver.iterations = 7
  solver.tolerance = 0.001
  world.solver = solver
  bodies = []
  const shape = new Particle()
  const width = viewWidth * 1.32
  const height = viewHeight * 1.3
  for (let row = 0; row <= ROWS; row++) {
    for (let col = 0; col <= COLS; col++) {
      const u = col / COLS
      const v = row / ROWS
      // Overscan and anchored borders keep a continuous background while the
      // interior has slack, giving it folds rather than a rubber-sheet stretch.
      const pinned = row === 0 || row === ROWS || col === 0 || col === COLS
      // Predominantly vertical folds: vary spacing across the fabric, while
      // bending gently with height rather than adding diagonal travelling waves.
      const bend = 0.018 * Math.sin(v * Math.PI * 2 + 0.4)
                 + 0.009 * Math.sin(v * Math.PI * 3.4 + 1.2)
      const foldU = u + bend
      const foldPhase = foldU * Math.PI * 5
                      + 0.48 * Math.sin(foldU * Math.PI * 3 + 0.7)
      const foldDepth = 0.20 + 0.035 * Math.sin(u * Math.PI * 2.6 + 0.5)
      const drape = 0.88 + 0.12 * Math.sin(v * Math.PI)
      const z = drape * foldDepth * Math.sin(foldPhase)
              + 0.035 * Math.sin(v * Math.PI * 1.6 + 0.3)
      const body = new Body({
        mass: pinned ? 0 : 0.025,
        shape,
        position: new Vec3((u - 0.5) * width, (0.5 - v) * height, z),
        linearDamping: 0.88,
        collisionFilterGroup: 0,
        collisionFilterMask: 0,
      })
      world.addBody(body)
      bodies.push(body)
    }
  }
  const stitch = (a: number, b: number, slack = 1) => {
    const first = bodies[a]!
    const second = bodies[b]!
    const distance = first.position.distanceTo(second.position) * slack
    world!.addConstraint(new DistanceConstraint(first, second, distance, 18))
  }
  for (let row = 0; row <= ROWS; row++) {
    for (let col = 0; col <= COLS; col++) {
      const index = row * (COLS + 1) + col
      if (col < COLS) stitch(index, index + 1, 1.008)
      if (row < ROWS) stitch(index, index + COLS + 1)
      if (col < COLS && row < ROWS) {
        stitch(index, index + COLS + 2)
        stitch(index + 1, index + COLS + 1)
      }
    }
  }
}

// Cache tensor-product cubic weights. Physics stays on the original grid;
// only the visible surface is subdivided, avoiding extra constraint work.
function renderSamples(segments: number) {
  return Array.from({ length: segments * RENDER_SUBDIVISIONS + 1 }, (_, i) => {
    const coordinate = i / RENDER_SUBDIVISIONS
    const base = Math.min(segments - 1, Math.floor(coordinate))
    const t = coordinate - base, t2 = t * t, t3 = t2 * t
    return {
      indices: [base - 1, base, base + 1, base + 2].map(n => Math.max(0, Math.min(segments, n))),
      weights: [-0.5 * t + t2 - 0.5 * t3, 1 - 2.5 * t2 + 1.5 * t3,
        0.5 * t + 2 * t2 - 1.5 * t3, -0.5 * t2 + 0.5 * t3],
    }
  })
}
const horizontalSamples = renderSamples(COLS)
const verticalSamples = renderSamples(ROWS)

function createRenderGrid() {
  let offset = 0
  for (let row = 0; row <= RENDER_ROWS; row++) {
    for (let col = 0; col <= RENDER_COLS; col++) {
      const index = row * (RENDER_COLS + 1) + col
      uv[index * 2] = col / RENDER_COLS
      uv[index * 2 + 1] = 1 - row / RENDER_ROWS
      if (row < RENDER_ROWS && col < RENDER_COLS) {
        indices.set([index, index + RENDER_COLS + 1, index + 1,
          index + 1, index + RENDER_COLS + 1, index + RENDER_COLS + 2], offset)
        offset += 6
      }
    }
  }
}

function updateMesh() {
  for (let row = 0; row <= RENDER_ROWS; row++) {
    const ys = verticalSamples[row]!
    for (let col = 0; col <= RENDER_COLS; col++) {
      const xs = horizontalSamples[col]!
      let x = 0, y = 0, z = 0
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const weight = ys.weights[j]! * xs.weights[i]!
          const point = bodies[ys.indices[j]! * (COLS + 1) + xs.indices[i]!]!.position
          x += point.x * weight
          y += point.y * weight
          z += point.z * weight
        }
      }
      const offset = (row * (RENDER_COLS + 1) + col) * 3
      positions[offset] = x
      positions[offset + 1] = y
      positions[offset + 2] = z
    }
  }
  // Derive smooth normals from the fabric's two grid directions, not from
  // consistently diagonal triangles, which can imprint diagonal light bands.
  for (let row = 0; row <= RENDER_ROWS; row++) {
    for (let col = 0; col <= RENDER_COLS; col++) {
      const left = (row * (RENDER_COLS + 1) + Math.max(0, col - 1)) * 3
      const right = (row * (RENDER_COLS + 1) + Math.min(RENDER_COLS, col + 1)) * 3
      const top = (Math.max(0, row - 1) * (RENDER_COLS + 1) + col) * 3
      const bottom = (Math.min(RENDER_ROWS, row + 1) * (RENDER_COLS + 1) + col) * 3
      const ux = positions[right]! - positions[left]!
      const uy = positions[right + 1]! - positions[left + 1]!
      const uz = positions[right + 2]! - positions[left + 2]!
      const vx = positions[top]! - positions[bottom]!
      const vy = positions[top + 1]! - positions[bottom + 1]!
      const vz = positions[top + 2]! - positions[bottom + 2]!
      const nx = uy * vz - uz * vy
      const ny = uz * vx - ux * vz
      const nz = ux * vy - uy * vx
      const length = Math.hypot(nx, ny, nz) || 1
      const offset = (row * (RENDER_COLS + 1) + col) * 3
      normals[offset] = nx / length
      normals[offset + 1] = ny / length
      normals[offset + 2] = nz / length
    }
  }
  if (geometry) {
    geometry.attributes.position!.needsUpdate = true
    geometry.attributes.normal!.needsUpdate = true
  }
}

function step() {
  elapsed += STEP
  pointer.energy *= 0.97
  for (const body of bodies) {
    if (!body.mass) continue
    const p = body.position
    const wind = Math.sin(p.x * 1.1 + elapsed * 0.65) * Math.cos(p.y * 0.6 - elapsed * 0.4)
    force.set(0.00169 * Math.sin(elapsed * 0.4), 0, 0.0507 * wind)
    if (pointer.energy > 0.001) {
      const dx = p.x - pointer.x, dy = p.y - pointer.y
      const influence = Math.exp(-(dx * dx + dy * dy) / 0.65) * pointer.energy
      force.x += pointer.dx * influence * POINTER_FORCE
      force.y += pointer.dy * influence * POINTER_FORCE
      force.z -= influence * POINTER_DEPTH_FORCE
    }
    body.applyForce(force)
  }
  world!.step(STEP)
}

function draw() {
  if (!renderer || !mesh || !camera || lost) return
  updateMesh()
  renderer.render({ scene: mesh, camera })
}

function animate(now: number) {
  frame = 0
  if (!active.value || reducedMotion.value || lost) return
  if (now - last < FRAME_INTERVAL_MS - 0.5) {
    frame = requestAnimationFrame(animate)
    return
  }
  consumePointer()
  // Keep the fixed physics step, but slow the decoration on overloaded devices
  // instead of accumulating extra work that makes the next frame even slower.
  accumulator += Math.min((now - last) / 1000, STEP * 2)
  last = now
  // Bound catch-up work after slow frames; never simulate an entire hidden tab gap.
  let steps = 0
  while (accumulator >= STEP && steps < 2) {
    step()
    accumulator -= STEP
    steps++
  }
  draw()
  frame = requestAnimationFrame(animate)
}

function resetPointer() {
  pointer.active = false
  pendingPointer = null
}
function move(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || reducedMotion.value || !active.value || lost) return
  // Keep only the latest sample; DOM queries and force updates run once per frame.
  pendingPointer = event
}

function consumePointer() {
  const event = pendingPointer
  pendingPointer = null
  if (!event) return
  if (!(event.target instanceof Element) || event.target.closest(
    'header, nav, article, a, button, input, textarea, select, [role="dialog"], [role="menu"], .surface-1, .surface-2, .prose, [contenteditable], [data-draft-interaction-shield]',
  )) { resetPointer(); return }
  const rect = hostRect
  if (!rect || !rect.width || !rect.height) return
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * viewWidth
  const y = (0.5 - (event.clientY - rect.top) / rect.height) * viewHeight
  if (pointer.active) {
    const timeScale = POINTER_REFERENCE_INTERVAL_MS / Math.max(1, event.timeStamp - pointer.time)
    pointer.dx = Math.max(-2, Math.min(2, (x - pointer.x) * POINTER_SPEED_SCALE * timeScale))
    pointer.dy = Math.max(-2, Math.min(2, (y - pointer.y) * POINTER_SPEED_SCALE * timeScale))
    pointer.energy = Math.min(1.9, 0.72 + Math.hypot(pointer.dx, pointer.dy))
  }
  pointer.x = x; pointer.y = y; pointer.active = true
  pointer.time = event.timeStamp
}

function resume() {
  cancelAnimationFrame(frame)
  frame = 0
  pointer.energy = 0
  resetPointer()
  last = performance.now()
  accumulator = 0
  if (!active.value || lost || !mesh) return
  if (reducedMotion.value) draw()
  else frame = requestAnimationFrame(animate)
}
watch([active, reducedMotion], resume)

function resize() {
  if (!renderer || !camera || !host.value) return
  // This background is fixed to the viewport, so scrolling does not change its rect.
  hostRect = host.value.getBoundingClientRect()
  const { width, height } = hostRect
  if (!width || !height) return
  viewHeight = viewWidth * height / width
  renderer.dpr = props.nativeResolution ? (window.devicePixelRatio || 1) : Math.min(
    window.devicePixelRatio || 1,
    MAX_DEVICE_PIXEL_RATIO,
    Math.sqrt(MAX_RENDER_PIXELS / (width * height)),
  )
  renderer.setSize(width, height)
  camera.orthographic({ left: -viewWidth/2, right: viewWidth/2, top: viewHeight/2, bottom: -viewHeight/2, near: 0.1, far: 100 })
  createFabric()
  draw()
  resume()
}

function contextLost(event: Event) {
  event.preventDefault()
  lost = true
  resetPointer()
  cancelAnimationFrame(frame)
}

onMounted(() => {
  if (!host.value) return
  try {
    renderer = new Renderer({ alpha: false, antialias: false, depth: false, dpr: 1, powerPreference: 'low-power' })
    const gl = renderer.gl
    gl.clearColor(0.043, 0.043, 0.059, 1)
    camera = new Camera(gl)
    camera.position.z = 12
    createFabric()
    createRenderGrid()
    updateMesh()
    geometry = new Geometry(gl, {
      position: { size: 3, data: positions, usage: gl.DYNAMIC_DRAW },
      normal: { size: 3, data: normals, usage: gl.DYNAMIC_DRAW },
      uv: { size: 2, data: uv },
      index: { data: indices },
    })
    program = new Program(gl, { vertex, fragment, cullFace: null })
    mesh = new Mesh(gl, { geometry, program, frustumCulled: false })
    host.value.appendChild(gl.canvas)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerout', resetPointer)
    window.addEventListener('blur', resetPointer)
    window.addEventListener('scroll', resetPointer, { passive: true, capture: true })
    gl.canvas.addEventListener('webglcontextlost', contextLost)
    resize()
  } catch (error) {
    console.warn('Cloth background unavailable; retaining dark fallback.', error)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resetPointer()
  hostRect = undefined
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerout', resetPointer)
  window.removeEventListener('blur', resetPointer)
  window.removeEventListener('scroll', resetPointer, true)
  renderer?.gl.canvas.removeEventListener('webglcontextlost', contextLost)
  geometry?.remove()
  program?.remove()
  renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext()
  bodies = []
  world = undefined
})
</script>

<template><div ref="host" class="cloth-background" aria-hidden="true" /></template>

<style scoped>
.cloth-background { width: 100%; height: 100%; pointer-events: none; background: #0b0b0f; }
.cloth-background :deep(canvas) { display: block; width: 100%; height: 100%; }
</style>
