export type CubePoint = readonly [number, number, number]

export const CUBE_REST_YAW = 35 * Math.PI / 180
export const CUBE_CAMERA_TILT = 22 * Math.PI / 180
export const CUBE_TURN = 2 * Math.PI
export const CUBE_TURN_DURATION = 580

// Model-space edges are exactly 2 units long. Y points down in SVG coordinates.
export const CUBE_VERTICES: readonly CubePoint[] = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
]
export const CUBE_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
] as const

// Preserve the approved SVG's proportions on the z=1 wall, not screen coordinates.
const doorLeft = -1 + 2 * 105 / 311
const doorRight = -1 + 2 * 195 / 311
const doorTop = 1 - 2 * 205 / 352
export const CUBE_DOOR: readonly CubePoint[] = [
  [doorLeft, doorTop, 1], [doorRight, doorTop, 1],
  [doorRight, 1, 1], [doorLeft, 1, 1],
]

export function projectCubePoint([x, y, z]: CubePoint, yaw: number) {
  const horizontal = x * Math.cos(yaw) + z * Math.sin(yaw)
  const depth = -x * Math.sin(yaw) + z * Math.cos(yaw)
  // Rigid Y rotation, then orthographic camera tilt. The wider z=1 right wall
  // has horizontal edges that slope up-right at the approved resting angle.
  return {
    x: 24 + horizontal * 11.5,
    y: 24 + (y * Math.cos(CUBE_CAMERA_TILT) + depth * Math.sin(CUBE_CAMERA_TILT)) * 11.5,
    depth: depth * Math.cos(CUBE_CAMERA_TILT) - y * Math.sin(CUBE_CAMERA_TILT),
  }
}

function smoothstep(low: number, high: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

export function createCubeLogoGeometry(yaw: number) {
  const points = CUBE_VERTICES.map(point => projectCubePoint(point, yaw))
  const opening = CUBE_DOOR.map(point => projectCubePoint(point, yaw))
  const viewDirection = [
    -Math.sin(yaw) * Math.cos(CUBE_CAMERA_TILT),
    -Math.sin(CUBE_CAMERA_TILT),
    Math.cos(yaw) * Math.cos(CUBE_CAMERA_TILT),
  ] as const
  const edges = CUBE_EDGES.map(([a, b], index) => {
    const start = points[a]!
    const end = points[b]!
    const vertexA = CUBE_VERTICES[a]!
    const vertexB = CUBE_VERTICES[b]!
    // An edge belongs to the two planes shared by its endpoints.
    const facing = ([0, 1, 2] as const)
      .filter(axis => vertexA[axis] === vertexB[axis])
      .map(axis => vertexA[axis] * viewDirection[axis])
    const visibility = smoothstep(-0.04, 0.04, Math.max(...facing))
    const frontCorner = smoothstep(0, 0.15, Math.min(...facing))
    return {
      key: 'edge-' + index,
      path: 'M' + start.x + ',' + start.y + ' L' + end.x + ',' + end.y,
      depth: (start.depth + end.depth) / 2,
      opacity: 0.2 + 0.68 * visibility + 0.08 * frontCorner,
    }
  }).sort((a, b) => a.depth - b.depth)
  return {
    edges,
    door: {
      path: opening.map((point, index) => (index ? 'L' : 'M') + point.x + ',' + point.y).join(' ') + ' Z',
      // A rear-facing doorway must not look like a panel pasted in front of the cube.
      opacity: smoothstep(0, 0.1, viewDirection[2]),
    },
  }
}
