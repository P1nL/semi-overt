import assert from 'node:assert/strict'
import { test } from 'node:test'
import { advanceTitleOrbit, createTitleOrbit, getTitleOrbitPose, TITLE_ORBIT_DURATION, TITLE_ORBIT_HEIGHT, getTitleOrbitHitDistance } from '../src/widgets/hero-section/model/titleOrbit.ts'

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b)
test('two arcs contain nine letters each, with the bullet inside each O', () => {
  const glyphs = createTitleOrbit('SEMI•OVERT')
  assert.equal(glyphs.length, 18)
  assert.equal(glyphs.filter(glyph => glyph.eye).length, 2)
  assert.ok(!glyphs.some(glyph => glyph.letter === '•'))
  assert.ok(glyphs.filter(glyph => glyph.eye).every(glyph => glyph.letter === 'O'))
  assert.equal(glyphs.slice(0, 9).map(glyph => glyph.letter).join(''), 'SEMIOVERT')
})
test('initial upper and lower arcs stay upright and have separate depth', () => {
  const glyphs = createTitleOrbit('SEMI•OVERT')
  for (let index = 0; index < 9; index++) {
    const upper = getTitleOrbitPose(glyphs[index].angle, 0)
    const lower = getTitleOrbitPose(glyphs[index + 9].angle, 0)
    close(upper.x, lower.x)
    assert.ok(upper.y < 0.38 && lower.y > 0.38)
    assert.ok(upper.front > lower.front)
    assert.ok(upper.blur < lower.blur)
  }
})
test('letters follow the fixed ellipse at every phase; the container does not rotate', () => {
  for (const glyph of createTitleOrbit('SEMI•OVERT')) {
    for (let phase = 0; phase <= Math.PI * 2; phase += 0.07) {
      const p = getTitleOrbitPose(glyph.angle, phase)
      close((p.x / 0.46) ** 2 + ((p.y - 0.38) / TITLE_ORBIT_HEIGHT) ** 2, 1)
      assert.ok(p.scaleX > 0 && p.scaleY > 0)
      assert.ok(p.blur >= 0 && p.blur <= 4)
      assert.ok(p.opacity >= 0.28 && p.opacity <= 1)
    }
  }
})
test('a half turn swaps upper/lower arcs; 120 seconds completes a seamless revolution', () => {
  const angle = createTitleOrbit('SEMI•OVERT')[4].angle
  const initial = getTitleOrbitPose(angle, 0)
  const half = getTitleOrbitPose(angle, advanceTitleOrbit(0, TITLE_ORBIT_DURATION / 2))
  assert.equal(initial.front, 1)
  assert.equal(half.front, 0)
  const full = getTitleOrbitPose(angle, advanceTitleOrbit(0, TITLE_ORBIT_DURATION))
  close(initial.x, full.x)
  close(initial.y, full.y)
  close(advanceTitleOrbit(0.5, -1000), 0.5)
})
test('empty and custom titles remain valid without inventing an eye', () => {
  assert.deepEqual(createTitleOrbit(''), [])
  assert.ok(createTitleOrbit('HELLO').every(glyph => !glyph.eye))
  assert.equal(createTitleOrbit('A•B').filter(glyph => glyph.letter === '•').length, 2)
})

test('font identity travels with each glyph instead of following the upper arc', () => {
  const glyphs = createTitleOrbit('SEMI•OVERT')
  assert.ok(glyphs.slice(0, 9).every(glyph => glyph.fontFamily === 'var(--font-pressure)'))
  assert.ok(glyphs.slice(9).every(glyph => glyph.fontFamily === 'var(--font-display)'))
  for (const glyph of glyphs) {
    const initialFont = glyph.fontFamily
    const start = getTitleOrbitPose(glyph.angle, 0)
    const half = getTitleOrbitPose(glyph.angle, Math.PI)
    assert.ok((start.y - 0.38) * (half.y - 0.38) < 0)
    assert.equal(glyph.fontFamily, initialFont)
    assert.equal(Object.hasOwn(half, 'fontFamily'), false)
  }
})

test('eye identity stays with the matching font after a half turn', () => {
  const eyes = createTitleOrbit('SEMI•OVERT').filter(glyph => glyph.eye)
  assert.equal(eyes.length, 2)
  const letterEye = eyes.find(glyph => glyph.fontFamily === 'var(--font-display)')
  const snoopyEye = eyes.find(glyph => glyph.fontFamily === 'var(--font-pressure)')
  assert.equal(letterEye.eyeStyle, 'letter')
  assert.equal(snoopyEye.eyeStyle, 'snoopy')
  assert.equal(getTitleOrbitPose(letterEye.angle, Math.PI).front, 1)
  assert.equal(letterEye.eyeStyle, 'letter')
  assert.equal(getTitleOrbitPose(snoopyEye.angle, Math.PI).front, 0)
  assert.equal(snoopyEye.eyeStyle, 'snoopy')
})

test('orbit is flatter without changing its horizontal radius or rotation speed', () => {
  assert.equal(TITLE_ORBIT_HEIGHT, 0.5)
  assert.ok(TITLE_ORBIT_HEIGHT < 0.67)
  close(getTitleOrbitPose(0, 0).x, 0.46)
})

test('each group connects glyph gaps along its own curved strip', () => {
  const upper = [
    { left: 0, right: 20, top: 0, bottom: 20 },
    { left: 60, right: 80, top: 10, bottom: 30 },
    { left: 120, right: 140, top: 0, bottom: 20 },
  ]
  const lower = upper.map(rect => ({ ...rect, top: rect.top + 60, bottom: rect.bottom + 60 }))
  for (let x = 0; x <= 140; x++) {
    assert.ok(Number.isFinite(getTitleOrbitHitDistance({ x, y: 15 }, upper)), `gap at ${x}`)
    assert.equal(getTitleOrbitHitDistance({ x, y: 15 }, lower), Infinity)
    assert.ok(Number.isFinite(getTitleOrbitHitDistance({ x, y: 75 }, lower)))
    assert.equal(getTitleOrbitHitDistance({ x, y: 45 }, upper), Infinity)
    assert.equal(getTitleOrbitHitDistance({ x, y: 45 }, lower), Infinity)
  }
  assert.equal(getTitleOrbitHitDistance({ x: -1, y: 15 }, upper), Infinity)
  assert.equal(getTitleOrbitHitDistance({ x: 141, y: 15 }, upper), Infinity)
})

test('hit strips handle reversed order, an empty title and zero-sized slots', () => {
  const rects = [
    { left: 0, right: 20, top: 0, bottom: 20 },
    { left: 60, right: 80, top: 10, bottom: 30 },
  ]
  close(getTitleOrbitHitDistance({ x: 40, y: 15 }, rects), 0)
  close(getTitleOrbitHitDistance({ x: 40, y: 15 }, [...rects].reverse()), 0)
  assert.equal(getTitleOrbitHitDistance({ x: 0, y: 0 }, []), Infinity)
  assert.equal(getTitleOrbitHitDistance({ x: 0, y: 0 }, [{ left: 0, right: 0, top: 0, bottom: 0 }]), Infinity)
})
