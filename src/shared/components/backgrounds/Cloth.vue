<script setup lang="ts">
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import { Renderer, Camera, Geometry, Program, Mesh } from 'ogl'
import { World, Body, Particle, DistanceConstraint, Vec3, GSSolver, SAPBroadphase } from 'cannon-es'

// Inspired by Arno Di Nunzio's physics-based cloth:
// https://tympanus.net/codrops/2020/02/11/how-to-create-a-physics-based-3d-cloth-with-cannon-js-and-three-js/
// Uses a particle/constraint fabric with OGL rendering, without slideshow images.
const host = useTemplateRef<HTMLDivElement>('host')
// A decorative background does not need a full-resolution physics mesh.
const COLS = 24
const ROWS = 18
const COUNT = (COLS + 1) * (ROWS + 1)
const STEP = 1 / 60
const FRAME_INTERVAL_MS = 1000 / 30
const MAX_DEVICE_PIXEL_RATIO = 1.25
const MAX_RENDER_PIXELS = 2560 * 1440
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
let motion: MediaQueryList | undefined
let lost = false
const positions = new Float32Array(COUNT * 3)
const normals = new Float32Array(COUNT * 3)
const uv = new Float32Array(COUNT * 2)
const indices = new Uint16Array(COLS * ROWS * 6)
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
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
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
  float fibre = hash(gl_FragCoord.xy);
  float weave = sin(vUv.x * 2800.0) * sin(vUv.y * 2400.0);
  vec3 cloth = vec3(0.145,0.137,0.158) * (0.26 + diffuse * 1.45)
               + vec3(0.030,0.028,0.032) * sheen;
  cloth *= 0.96 + fibre * 0.065 + weave * 0.012;
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
      const z = 0.30 * Math.sin(u * Math.PI * 10 + v * 2.0)
              + 0.10 * Math.sin(v * Math.PI * 4 + u * 7)
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
      const index = row * (COLS + 1) + col
      uv[index * 2] = u
      uv[index * 2 + 1] = 1 - v
    }
  }
  const stitch = (a: number, b: number, slack = 1) => {
    const first = bodies[a]!
    const second = bodies[b]!
    const distance = first.position.distanceTo(second.position) * slack
    world!.addConstraint(new DistanceConstraint(first, second, distance, 18))
  }
  let offset = 0
  for (let row = 0; row <= ROWS; row++) {
    for (let col = 0; col <= COLS; col++) {
      const index = row * (COLS + 1) + col
      if (col < COLS) stitch(index, index + 1, 1.008)
      if (row < ROWS) stitch(index, index + COLS + 1)
      if (col < COLS && row < ROWS) {
        stitch(index, index + COLS + 2)
        stitch(index + 1, index + COLS + 1)
        indices.set([index, index + COLS + 1, index + 1,
          index + 1, index + COLS + 1, index + COLS + 2], offset)
        offset += 6
      }
    }
  }
}

function updateMesh() {
  for (let i = 0; i < COUNT; i++) {
    const p = bodies[i]!.position
    const offset = i * 3
    positions[offset] = p.x
    positions[offset + 1] = p.y
    positions[offset + 2] = p.z
  }
  normals.fill(0)
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 3, b = indices[i + 1]! * 3, c = indices[i + 2]! * 3
    const abx = positions[b]! - positions[a]!, aby = positions[b+1]! - positions[a+1]!, abz = positions[b+2]! - positions[a+2]!
    const acx = positions[c]! - positions[a]!, acy = positions[c+1]! - positions[a+1]!, acz = positions[c+2]! - positions[a+2]!
    const x = aby*acz-abz*acy, y = abz*acx-abx*acz, z = abx*acy-aby*acx
    normals[a]! += x; normals[a+1]! += y; normals[a+2]! += z
    normals[b]! += x; normals[b+1]! += y; normals[b+2]! += z
    normals[c]! += x; normals[c+1]! += y; normals[c+2]! += z
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
  if (document.hidden || motion?.matches || lost) return
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
  if (event.pointerType !== 'mouse' || motion?.matches || document.hidden || lost) return
  // Keep only the latest sample; DOM queries and force updates run once per frame.
  pendingPointer = event
}

function consumePointer() {
  const event = pendingPointer
  pendingPointer = null
  if (!event) return
  if (!(event.target instanceof Element) || event.target.closest(
    'header, nav, article, a, button, input, textarea, select, [role="dialog"], [role="menu"], .surface-1, .surface-2, .prose, [contenteditable]',
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
  if (motion?.matches) draw()
  else if (!document.hidden && !lost) frame = requestAnimationFrame(animate)
}

function resize() {
  if (!renderer || !camera || !host.value) return
  // This background is fixed to the viewport, so scrolling does not change its rect.
  hostRect = host.value.getBoundingClientRect()
  const { width, height } = hostRect
  if (!width || !height) return
  viewHeight = viewWidth * height / width
  renderer.dpr = Math.min(
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
    motion = matchMedia('(prefers-reduced-motion: reduce)')
    motion.addEventListener('change', resume)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerout', resetPointer)
    window.addEventListener('blur', resetPointer)
    window.addEventListener('scroll', resetPointer, { passive: true })
    document.addEventListener('visibilitychange', resume)
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
  motion?.removeEventListener('change', resume)
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerout', resetPointer)
  window.removeEventListener('blur', resetPointer)
  window.removeEventListener('scroll', resetPointer)
  document.removeEventListener('visibilitychange', resume)
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
