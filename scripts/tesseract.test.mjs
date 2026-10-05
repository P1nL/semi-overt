import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectTesseract, tesseractEdges, tesseractVertices } from '../src/widgets/hero-section/model/tesseract.ts'

test('tesseract has 16 vertices and 32 unique edges differing in one coordinate', () => {
  assert.equal(tesseractVertices.length, 16)
  assert.equal(tesseractEdges.length, 32)
  assert.equal(new Set(tesseractEdges.map(edge => edge.join(':'))).size, 32)
  for (const [a, b] of tesseractEdges) {
    assert.equal(['x', 'y', 'z', 'w'].filter(key => tesseractVertices[a][key] !== tesseractVertices[b][key]).length, 1)
  }
})
test('projection stays finite and inside the SVG through a long rotation', () => {
  for (let time = 0; time < 200; time += 0.05) {
    for (const point of projectTesseract(time)) {
      assert.ok(Number.isFinite(point.z))
      assert.ok(point.x > 6 && point.x < 794)
      assert.ok(point.y > 6 && point.y < 794)
    }
  }
  assert.notDeepEqual(projectTesseract(0), projectTesseract(1))
})

test('perspective starts with concentric cubes and a 2:1 outer-to-inner scale', () => {
  const points = projectTesseract(0)
  for (let i = 0; i < 8; i++) {
    for (const axis of ['x', 'y', 'z']) {
      const origin = axis === 'z' ? 0 : 400
      assert.ok(Math.abs((points[i + 8][axis] - origin) - 2 * (points[i][axis] - origin)) < 1e-9)
    }
  }
  for (const start of [0, 8]) {
    for (const axis of ['x', 'y']) {
      const centroid = points.slice(start, start + 8).reduce((sum, point) => sum + point[axis], 0) / 8
      assert.ok(Math.abs(centroid - 400) < 1e-9)
    }
  }
})

test('a half turn swaps the original inner and outer cubes', () => {
  const initial = projectTesseract(0)
  const halfTurn = projectTesseract(Math.PI)
  for (let i = 0; i < 16; i++) {
    for (const axis of ['x', 'y', 'z']) {
      // A half turn reverses x and w, exchanging the two original w layers.
      assert.ok(Math.abs(halfTurn[i][axis] - initial[i ^ 9][axis]) < 1e-9)
    }
  }
  for (let i = 0; i < 8; i++) {
    for (const axis of ['x', 'y']) {
      assert.ok(Math.abs((halfTurn[i][axis] - 400) - 2 * (halfTurn[i + 8][axis] - 400)) < 1e-9)
    }
  }
})

test('perspective keeps all 16 vertices distinct at rest', () => {
  const points = projectTesseract(0)
  assert.equal(new Set(points.map(point => [point.x, point.y].join(':'))).size, 16)
})

test('rotation loops continuously without a reset or a projection jump', () => {
  for (let time = 0; time < Math.PI * 2; time += 0.01) {
    const points = projectTesseract(time)
    const next = projectTesseract(time + 0.0001)
    const loop = projectTesseract(time + Math.PI * 2)
    for (let i = 0; i < 16; i++) {
      for (const axis of ['x', 'y', 'z']) {
        assert.ok(Math.abs(points[i][axis] - loop[i][axis]) < 1e-9)
        assert.ok(Math.abs(points[i][axis] - next[i][axis]) < 0.1)
      }
    }
  }
})
