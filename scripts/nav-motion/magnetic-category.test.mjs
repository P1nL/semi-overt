import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createMagneticDeformation, magneticTarget, stepMagneticSpring } from '../../src/shared/utils/magneticSpring.ts'
import { createLiquidBridgePath } from '../../src/widgets/app-header/model/liquidBridge.ts'

test('magnetic input is bounded and keeps both movement directions', () => {
  assert.deepEqual(magneticTarget(1000, -1000), { x: 16, y: -13 })
  assert.deepEqual(magneticTarget(-1000, 1000), { x: -16, y: 13 })
  assert.deepEqual(magneticTarget(0, 0), { x: 0, y: 0 })
})

test('spring follows input and returns to a stable zero without drift', () => {
  let state = { x: 0, y: 0, vx: 0, vy: 0 }
  for (let i = 0; i < 120; i++) state = stepMagneticSpring(state, { x: 16, y: 13 }, 1 / 60)
  assert.ok(Math.abs(state.x - 16) < 0.001)
  assert.ok(Math.abs(state.y - 13) < 0.001)
  for (let i = 0; i < 180; i++) state = stepMagneticSpring(state, { x: 0, y: 0 }, 1 / 60)
  assert.ok(Math.hypot(state.x, state.y, state.vx, state.vy) < 0.001)
})

test('a stalled animation frame cannot destabilize the spring', () => {
  let state = { x: 0, y: 0, vx: 0, vy: 0 }
  for (let i = 0; i < 100; i++) state = stepMagneticSpring(state, { x: -16, y: 13 }, 30)
  assert.ok(Object.values(state).every(Number.isFinite))
  assert.ok(Math.abs(state.x + 16) < 0.001)
})

test('bridge anchors stay on both circles while the category button moves', () => {
  for (const [width, height] of [[119.2, 53.6], [108, 50]]) {
    for (const offset of [{ x: 0, y: 0 }, { x: 16, y: 13 }, { x: -16, y: -13 }]) {
      const path = createLiquidBridgePath(width, height, offset)
      const values = path.match(/-?\d+(?:\.\d+)?/g).map(Number)
      assert.equal(values.length, 16)
      assert.ok(values.every(Number.isFinite))
      const radius = height / 2
      assert.ok(Math.abs(Math.hypot(values[0] - radius, values[1] - radius) - radius) < 0.002)
      assert.ok(Math.abs(Math.hypot(values[6] - (width - radius + offset.x), values[7] - (radius + offset.y)) - radius) < 0.002)
    }
  }
})

test('bridge deforms with the button and rejects a missing layout', () => {
  const resting = createLiquidBridgePath(119.2, 53.6, { x: 0, y: 0 })
  assert.notEqual(createLiquidBridgePath(119.2, 53.6, { x: 16, y: 13 }), resting)
  assert.equal(createLiquidBridgePath(119.2, 53.6, { x: 0, y: 0 }), resting)
  assert.equal(createLiquidBridgePath(0, 0, { x: 0, y: 0 }), '')
})

test('radial links do not inherit the main button magnetic transform', async () => {
  const source = await readFile(new URL('../../src/widgets/category-menu/CategoryMenu.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /category-orbit-visual/)
  assert.match(source, /class="category-menu-trigger"\s+:style="magneticStyle"/)
  assert.match(source, /class="category-goo-main"[^>]*:transform="magneticBackgroundTransform"/)
  const nav = source.slice(source.indexOf('<nav '), source.indexOf('</nav>'))
  assert.doesNotMatch(nav, /magneticStyle|magneticOffset|magneticBackgroundTransform/)
})

test('button stretches toward input, squeezes across it, and rests as a circle', () => {
  assert.deepEqual(createMagneticDeformation({ x: 0, y: 0 }), { a: 1, b: 0, c: 0, d: 1 })
  const horizontal = createMagneticDeformation({ x: 16, y: 0 })
  assert.ok(Math.abs(horizontal.a - 1.18) < 1e-9 && Math.abs(horizontal.d - 0.9) < 1e-9)
  assert.equal(horizontal.b, 0)
  const vertical = createMagneticDeformation({ x: 0, y: 16 })
  assert.ok(Math.abs(vertical.d - 1.18) < 1e-9 && Math.abs(vertical.a - 0.9) < 1e-9)
})

test('bridge endpoint follows the deformed ellipse rather than the original circle', () => {
  for (const offset of [{ x: 16, y: 13 }, { x: -16, y: -13 }, { x: 0, y: 13 }]) {
    const shape = createMagneticDeformation(offset)
    const path = createLiquidBridgePath(119.2, 53.6, offset, shape)
    const values = path.match(/-?\d+(?:\.\d+)?/g).map(Number)
    const x = values[6] - (119.2 - 26.8 + offset.x)
    const y = values[7] - (26.8 + offset.y)
    const determinant = shape.a * shape.d - shape.b * shape.c
    const originalX = (shape.d * x - shape.c * y) / determinant
    const originalY = (-shape.b * x + shape.a * y) / determinant
    assert.ok(Math.abs(Math.hypot(originalX, originalY) - 26.8) < 0.002)
  }
})
