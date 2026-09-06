import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Uses the existing TypeScript dev dependency; no test runner or new package required.
const source = readFileSync(new URL('../src/widgets/app-header/model/cubeLogo.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const {
  CUBE_VERTICES: vertices, CUBE_EDGES: edges, CUBE_DOOR: door,
  CUBE_REST_YAW: rest, CUBE_TURN: turn, projectCubePoint: project, createCubeLogoGeometry: geometry,
} = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'))
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-9, message)
const delta = (a, b) => ({ x: b.x - a.x, y: b.y - a.y })
const cross = (a, b) => a.x * b.y - a.y * b.x

assert.equal(edges.length, 12)
for (const [a, b] of edges) {
  close(Math.hypot(...vertices[a].map((v, axis) => vertices[b][axis] - v)), 2, 'Every model-space edge must be length 2')
}
assert.ok(door.every(([x, y, z]) => z === 1 && x > -1 && x < 1 && y >= -1 && y <= 1))
assert.equal(door[2][1], 1)
assert.equal(door[3][1], 1)

for (let degree = 0; degree <= 360; degree += 5) {
  const yaw = rest + degree * Math.PI / 180
  const points = vertices.map(point => project(point, yaw))
  const opening = door.map(point => project(point, yaw))
  for (const point of [...points, ...opening]) {
    assert.ok(point.x > 1 && point.x < 47 && point.y > 1 && point.y < 47, 'Rotation must not clip the SVG viewport')
  }
  const axisProjections = new Map()
  for (const [a, b] of edges) {
    const axis = vertices[a].findIndex((v, i) => vertices[b][i] !== v)
    const signedLength = vertices[b][axis] - vertices[a][axis]
    const vector = delta(points[a], points[b])
    const unit = { x: vector.x / signedLength, y: vector.y / signedLength }
    const previous = axisProjections.get(axis)
    if (previous) {
      close(unit.x, previous.x, 'Parallel edges must retain equal projected X vectors')
      close(unit.y, previous.y, 'Parallel edges must retain equal projected Y vectors')
    }
    axisProjections.set(axis, unit)
  }
  const units = [...axisProjections.values()]
  close(units.reduce((sum, v) => sum + v.x * v.y, 0), 0, 'Projection rows must remain orthogonal')
  close(units.reduce((sum, v) => sum + v.x ** 2, 0), units.reduce((sum, v) => sum + v.y ** 2, 0), 'Projection must have a uniform scale')
  const floor = delta(points[7], points[6])
  close(cross(floor, delta(points[7], opening[2])), 0, 'Door bottom-right must remain on the floor edge')
  close(cross(floor, delta(points[7], opening[3])), 0, 'Door bottom-left must remain on the floor edge')
  close(cross(floor, delta(opening[0], opening[1])), 0, 'Door top must stay parallel to its wall')
  const state = geometry(yaw)
  assert.ok(state.edges.every(edge => edge.opacity >= 0.2 && edge.opacity <= 0.960001))
  assert.ok(state.door.opacity >= 0 && state.door.opacity <= 1)
}

const pose = vertices.map(point => project(point, rest))
assert.ok(pose[5].x - pose[4].x > pose[4].x - pose[0].x, 'The right face must be wider at rest')
assert.ok(pose[5].y < pose[4].y, 'Right-wall horizontal edges must slope up-right')
assert.equal(geometry(rest).door.opacity, 1)
assert.equal(geometry(rest + Math.PI).door.opacity, 0)
assert.equal(geometry(rest).edges.filter(edge => edge.opacity === 0.2).length, 3)
for (let i = 0; i < vertices.length; i++) {
  const a = project(vertices[i], rest)
  const b = project(vertices[i], rest + turn)
  close(a.x, b.x, 'A complete rotation must return to the same X coordinate')
  close(a.y, b.y, 'A complete rotation must return to the same Y coordinate')
}
console.log('Cube logo geometry checks passed: 12 equal edges, 73 rotation samples, door alignment, visibility and viewport bounds.')
