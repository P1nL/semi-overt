import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getWarpPointerTarget, isWarpTriggerTarget } from '../src/shared/utils/warpText.ts'
import { isPressureTriggerTarget } from '../src/shared/utils/textPressure.ts'
import { createTitleOrbit } from '../src/widgets/hero-section/model/titleOrbit.ts'

const rect = { left: 0, top: 0, width: 100, height: 100 }
test('larger WarpText radius reaches adjacent glyphs without affecting distant ones', () => {
  const neighbor = { x: 190, y: 50 }
  assert.equal(getWarpPointerTarget(neighbor, rect, 1, 0.42), null)
  assert.deepEqual(getWarpPointerTarget(neighbor, rect, 1, 1.2), { x: 1.9, y: 0.5 })
  assert.equal(getWarpPointerTarget({ x: 350, y: 50 }, rect, 1, 1.2), null)
})
test('pointer coordinates account for scaled glyph bounds and reject zero size', () => {
  assert.deepEqual(getWarpPointerTarget({ x: 25, y: 25 }, { ...rect, width: 50, height: 50 }, 1, 1.2), { x: 0.5, y: 0.5 })
  assert.equal(getWarpPointerTarget({ x: 0, y: 0 }, { ...rect, width: 0 }, 1, 1.2), null)
  assert.equal(getWarpPointerTarget({ x: 0, y: 0 }, rect, 1, 0), null)
})
test('WarpText shares the pointer only with WarpText in the same group', () => {
  const own = {}, neighbor = {}, outside = {}
  const group = { contains: el => el === own || el === neighbor }
  const target = node => ({ closest: selector => selector === '.warp-text' ? node : null })
  assert.equal(isWarpTriggerTarget(target(own), own), true)
  assert.equal(isWarpTriggerTarget(target(neighbor), own), false)
  assert.equal(isWarpTriggerTarget(target(neighbor), own, group), true)
  assert.equal(isWarpTriggerTarget(target(outside), own, group), false)
  assert.equal(isWarpTriggerTarget(null, own, group), false)
  assert.equal(isWarpTriggerTarget({ closest: () => null }, own, group), false)
})
test('hovering Zhaohua WarpText cannot activate the other group pressure animation', () => {
  const warp = {}
  const target = { closest: selector => selector === '.warp-text' ? warp : null }
  assert.equal(isPressureTriggerTarget(target, { contains: () => true }, { x: 50, y: 50 }), false)
})
test('effect identity follows each font group throughout its orbit', () => {
  const glyphs = createTitleOrbit('SEMI•OVERT')
  assert.equal(glyphs.filter(glyph => glyph.effect === 'scramble').length, 9)
  assert.ok(glyphs.filter(glyph => glyph.fontFamily === 'var(--font-display)').every(glyph => glyph.effect === 'scramble'))
  assert.ok(glyphs.filter(glyph => glyph.fontFamily === 'var(--font-pressure)').every(glyph => glyph.effect === 'pressure'))
})
