type Vertex = { x: number; y: number; z: number; w: number }
export const tesseractVertices: Vertex[] = Array.from({ length: 16 }, (_, i) => ({
  x: i & 1 ? 1 : -1, y: i & 2 ? 1 : -1, z: i & 4 ? 1 : -1, w: i & 8 ? 1 : -1,
}))
export const tesseractEdges: [number, number][] = tesseractVertices.flatMap((_, i) =>
  [1, 2, 4, 8].filter(bit => !(i & bit)).map(bit => [i, i | bit] as [number, number]))

export function projectTesseract(time: number) {
  const c = Math.cos(time), s = Math.sin(time)
  // 相机位于 w = 3，在半径为 2 的超立方体外，避免透视分母趋近零。
  const cameraDistance = 3
  return tesseractVertices.map(vertex => {
    // 只绕 x-w 平面旋转：每半圈交换原来两个 w 层的内外位置。
    const rotatedX = vertex.x * c - vertex.w * s
    const rotatedW = vertex.x * s + vertex.w * c
    // 4D → 3D 透视：初始 w = +1 的外立方体是 w = -1 内立方体的两倍。
    const perspective = cameraDistance / (cameraDistance - rotatedW)
    let x = rotatedX * perspective, y = vertex.y * perspective, z = vertex.z * perspective
    // 3D → 2D 保持原来的固定观察角度，不叠加自转或逐帧缩放、居中补偿。
    const y1 = y * Math.cos(0.65) - z * Math.sin(0.65)
    z = y * Math.sin(0.65) + z * Math.cos(0.65)
    y = y1
    const x1 = x * Math.cos(0.85) + z * Math.sin(0.85)
    z = -x * Math.sin(0.85) + z * Math.cos(0.85)
    x = x1
    return { x: x * 115 + 400, y: y * 115 + 400, z }
  })
}
