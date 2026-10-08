import { styles, svgNode } from './effects'

export type Point = { x: number; y: number }
export interface GlyphAnchor extends Point { read(): Point; dispose(): void }
export function topmostPoint(points: Point[], centerX: number): Point {
  return [...points].sort((a, b) => Math.abs(a.y - b.y) > .25 ? a.y - b.y : Math.abs(a.x - centerX) - Math.abs(b.x - centerX))[0] ?? { x: centerX, y: 0 }
}
function hull(points: Point[]) {
  const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const side = (input: Point[]) => {
    const result: Point[] = []
    for (const p of input) {
      while (result.length > 1 && cross(result[result.length - 2]!, result[result.length - 1]!, p) <= 0) result.pop()
      result.push(p)
    }
    return result.slice(0, -1)
  }
  return [...side(sorted), ...side([...sorted].reverse())]
}
/** Sample the real font ink, not the em-box/line-height above the character. */
function textOutline(element: HTMLElement): Point[] {
  const width = element.offsetWidth, height = element.offsetHeight
  if (!width || !height) return []
  const css = getComputedStyle(element)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 128 / Math.max(width, height))
  canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  const weight = css.fontVariationSettings.match(/['"]wght['"]\s+([\d.]+)/)?.[1] ?? css.fontWeight
  ctx.font = `${css.fontStyle} ${weight} ${css.fontSize} ${css.fontFamily}`
  const text = element.textContent ?? ''
  const metrics = ctx.measureText(text)
  const ascent = metrics.fontBoundingBoxAscent || parseFloat(css.fontSize) * .8
  const descent = metrics.fontBoundingBoxDescent || parseFloat(css.fontSize) * .2
  const baseline = (height - ascent - descent) / 2 + ascent
  ctx.fillText(text, (width - metrics.width) / 2, baseline)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const points: Point[] = []
  for (let x = 0; x < canvas.width; x++) {
    for (let y = 0; y < canvas.height; y++) if (pixels[(y * canvas.width + x) * 4 + 3]! > 40) { points.push({ x: x / scale, y: y / scale }); break }
    for (let y = canvas.height - 1; y >= 0; y--) if (pixels[(y * canvas.width + x) * 4 + 3]! > 40) { points.push({ x: x / scale, y: (y + 1) / scale }); break }
  }
  return hull(points)
}
/** Browser projects these zero-size probes through the complete CSS 3-D chain. */
function project(host: HTMLElement | SVGSVGElement, points: Point[]) {
  const svg = host instanceof SVGSVGElement
  const owned = svg ? null : styles(host as HTMLElement)
  if (!svg && getComputedStyle(host).position === 'static') owned?.set('position', 'relative')
  const probes = points.map(p => {
    const node = svg ? svgNode('circle', { cx: String(p.x), cy: String(p.y), r: '.001' }) : document.createElement('span')
    node.setAttribute('aria-hidden', 'true')
    node.setAttribute('data-motion-rope-anchor', '')
    node.style.cssText = 'position:absolute;width:0;height:0;margin:0;padding:0;border:0;visibility:hidden;pointer-events:none;'
    if (!svg) { node.style.left = `${p.x}px`; node.style.top = `${p.y}px` }
    host.append(node)
    return node
  })
  const pending = new Set(probes)
  return probes.map(node => {
    const read = () => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y } }
    return { ...read(), read, dispose() { node.remove(); pending.delete(node); if (!pending.size) owned?.restore() } }
  })
}
export function createGlyphAnchor(element: HTMLElement): GlyphAnchor {
  const bounds = element.getBoundingClientRect()
  const center = bounds.left + bounds.width / 2
  let candidates: GlyphAnchor[] = []
  const eye = element.querySelector<SVGSVGElement>('.snoopy-eye')
  if (eye) candidates = project(eye, Array.from({ length: 64 }, (_, i) => ({ x: 50 + 50 * Math.cos(i * Math.PI / 32), y: 50 + 50 * Math.sin(i * Math.PI / 32) })))
  const faces = Array.from(element.querySelectorAll<HTMLElement>('.cube-face,.cube-door-module,.door-module-edge'))
  if (!candidates.length && faces.length) candidates = faces.flatMap(face => project(face, [
    { x: 0, y: 0 }, { x: face.offsetWidth, y: 0 }, { x: face.offsetWidth, y: face.offsetHeight }, { x: 0, y: face.offsetHeight },
  ]))
  const letter = element.querySelector<HTMLElement>('.text-pressure-glyph,.scramble-text__glyph')
  if (!candidates.length && letter) {
    const outline = textOutline(letter)
    if (outline.length) candidates = project(letter, outline)
  }
  if (!candidates.length) candidates = project(element, [{ x: element.offsetWidth / 2, y: 0 }])
  const chosen = topmostPoint(candidates, center) as GlyphAnchor
  candidates.filter(point => point !== chosen).forEach(point => point.dispose())
  return chosen
}
