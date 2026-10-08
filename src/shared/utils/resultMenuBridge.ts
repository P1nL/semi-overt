export interface ResultMenuTexture { texture: HTMLCanvasElement }
export interface ResultMenuSnapshot {
  items: ResultMenuTexture[]
  orientation: number[]
  cameraZ: number
  itemOffset: number
  instanceCount: number
}
export interface ResultMenuHandle {
  prepareRotation?(): void
  renderFrame?(): void
  snapshot(): ResultMenuSnapshot
  rotateFrom(previous: ResultMenuSnapshot, direction: number): () => void
  setPress(value: number | null, initializeHidden?: boolean): void
}
const menus = new WeakMap<HTMLCanvasElement, ResultMenuHandle>()
export function registerResultMenu(canvas: HTMLCanvasElement, menu: ResultMenuHandle) {
  menus.set(canvas, menu)
  return () => { if (menus.get(canvas) === menu) menus.delete(canvas) }
}
export function getResultMenu(canvas: HTMLCanvasElement | null | undefined) { return canvas ? menus.get(canvas) : undefined }
