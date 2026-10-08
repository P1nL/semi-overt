import { BUTTON_BURST_RAYS, buttonBurstRay } from '@/shared/utils/buttonBurst'
import { mix, out, pixelResolution, progress } from './choreography'

export interface Effect { paint(time: number): void; dispose(): void }
const SVG = 'http://www.w3.org/2000/svg'
export function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) {
  const node = document.createElementNS(SVG, tag)
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value))
  return node
}
export function overlay<T extends HTMLElement | SVGElement>(node: T): T {
  node.setAttribute('data-motion-overlay', '')
  node.setAttribute('aria-hidden', 'true')
  node.style.pointerEvents = 'none'
  return node
}
/** Restore only properties we own, never a whole style attribute written by Vue/GSAP. */
export function styles(element: HTMLElement) {
  const saved = new Map<string, [string, string]>()
  return {
    set(key: string, value: string) {
      if (!saved.has(key)) saved.set(key, [element.style.getPropertyValue(key), element.style.getPropertyPriority(key)])
      element.style.setProperty(key, value)
    },
    restore(except: string[] = []) {
      saved.forEach(([value, priority], key) => {
        if (except.includes(key)) return
        if (value) element.style.setProperty(key, value, priority)
        else element.style.removeProperty(key)
      })
    },
  }
}

/** Keep the real text in layout/accessibility; animate an inert visual copy. */
export function textEffect(element: HTMLElement, start: number, duration: number, reverse = false, scrambledFrom?: string): Effect {
  const owned = styles(element)
  const computed = getComputedStyle(element)
  const clone = overlay(element.cloneNode(true) as HTMLElement)
  clone.removeAttribute('id')
  clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
  clone.style.cssText += ';position:absolute;inset:0;margin:0;width:100%;height:100%;pointer-events:none;'
  // The copy already lives inside the measured text box. Reapplying the
  // signature's 92% max-width (or balanced wrapping) shrinks it a second time.
  clone.style.maxWidth = 'none'
  clone.style.minWidth = '0'
  clone.style.padding = '0'
  // CSS ellipsis is painted for the full hidden suffix before any characters
  // reveal. Clip instead, and retain a little ink overhang for per-glyph shaping.
  clone.style.textOverflow = 'clip'
  clone.style.overflow = 'visible'
  owned.set('text-overflow', 'clip')
  clone.style.whiteSpace = computed.whiteSpace
  clone.style.setProperty('text-wrap', computed.getPropertyValue('text-wrap'))
  clone.style.color = computed.color
  clone.style.visibility = 'visible'
  clone.style.opacity = '1'
  clone.style.translate = 'none'
  clone.style.transform = 'none'
  clone.style.animation = 'none'
  if (computed.position === 'static') owned.set('position', 'relative')
  const characters: { element: HTMLSpanElement; text: string }[] = []
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    const fragment = document.createDocumentFragment()
    for (const char of Array.from(node.data)) {
      const span = document.createElement('span')
      span.textContent = char
      fragment.append(span)
      characters.push({ element: span, text: char })
    }
    node.replaceWith(fragment)
  }
  const children = Array.from(element.querySelectorAll<HTMLElement>('*')).map(child => styles(child))
  children.forEach(child => child.set('visibility', 'hidden'))
  owned.set('visibility', 'hidden')
  element.append(clone)
  const old = Array.from(scrambledFrom ?? '')
  const symbols = '01<>/+=*#'
  let previous = ''
  return {
    paint(time) {
      const p = progress(time, start, duration)
      const count = Math.round(characters.length * (reverse ? 1 - p : p))
      const frame = Math.floor(time / 50)
      const key = scrambledFrom === undefined ? String(count) : `${count}:${frame}`
      if (key === previous) return
      previous = key
      characters.forEach((char, index) => {
        if (scrambledFrom === undefined) char.element.style.visibility = index < count ? 'visible' : 'hidden'
        else {
          char.element.style.visibility = 'visible'
          char.element.textContent = p === 1 || index < Math.floor(characters.length * progress(p, .3, .7))
            ? char.text : p < .2 ? (old[index] ?? ' ') : /\s/.test(char.text) ? char.text : symbols[(index * 7 + frame) % symbols.length]!
        }
      })
    },
    dispose() { clone.remove(); children.forEach(child => child.restore()); owned.restore() },
  }
}

export function burstEffect(element: HTMLElement, start: number, duration: number): Effect {
  const rect = element.getBoundingClientRect()
  const svg = overlay(svgNode('svg', { viewBox: '0 0 120 120', width: '120', height: '120' }))
  svg.style.cssText = `position:fixed;left:${rect.left + rect.width / 2 - 60}px;top:${rect.top + rect.height / 2 - 60}px;overflow:visible;z-index:39;pointer-events:none;`
  const group = svgNode('g', { transform: 'translate(60 60)' })
  const rays = BUTTON_BURST_RAYS.map(() => {
    const line = svgNode('line', { stroke: 'var(--color-brand-logo-bg)', 'stroke-width': '2', 'stroke-linecap': 'round' })
    group.append(line)
    return line
  })
  svg.append(group)
  element.closest('[data-page-scene]')?.append(svg)
  return {
    paint(time) {
      const p = progress(time, start, duration)
      svg.style.opacity = time < start ? '0' : String(1 - p)
      rays.forEach((ray, i) => Object.entries(buttonBurstRay(i, p)).forEach(([key, value]) => ray.setAttribute(key, String(value))))
    },
    dispose() { svg.remove() },
  }
}

function avatarOutline() {
  const svg = overlay(svgNode('svg', { viewBox: '0 0 100 100' }))
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;visibility:visible;'
  const circle = svgNode('circle', { cx: '50', cy: '50', r: '48.8', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', pathLength: '1', 'stroke-dasharray': '1', transform: 'rotate(-90 50 50)' })
  svg.append(circle)
  return { svg, circle }
}

/** No photo means no fabricated bitmap. Animate the actual initials node so
 * its font, baseline, surface and identity stay identical after cleanup. */
function initialAvatarEffect(element: HTMLElement, reverse: boolean): Effect & { ready(): boolean; settled(): boolean } {
  const { svg, circle } = avatarOutline()
  const children = Array.from(element.children).filter(node => node instanceof HTMLElement).map(node => styles(node as HTMLElement))
  element.append(svg)
  return {
    ready: () => true,
    settled: () => true,
    paint(time) {
      const t = reverse ? 2000 - time : time
      circle.style.strokeDashoffset = String(1 - progress(t, 100, 300))
      svg.style.opacity = String(1 - progress(t, 900, 250))
      children.forEach(child => child.set('opacity', String(progress(t, 400, 250))))
    },
    dispose() { svg.remove(); children.forEach(child => child.restore()) },
  }
}

/** Drawing is allowed for cross-origin images: no canvas readback/export is used. */
export function avatarEffect(element: HTMLElement, reverse = false, oldImage?: HTMLImageElement): Effect & { ready(): boolean; settled(): boolean } {
  const owned = styles(element)
  const size = Math.max(32, Math.round(element.getBoundingClientRect().width))
  const image = element.querySelector<HTMLImageElement>('img')
  if (!image) return initialAvatarEffect(element, reverse)
  const fallbackLabel = (element.textContent?.trim() || image?.alt || '?').slice(0, 1)
  const canvas = overlay(document.createElement('canvas'))
  canvas.width = size; canvas.height = size
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border-radius:50%;pointer-events:none;visibility:visible;image-rendering:pixelated;'
  const ctx = canvas.getContext('2d')!
  const small = document.createElement('canvas')
  const smallContext = small.getContext('2d')!
  const fallback = document.createElement('canvas')
  fallback.width = size; fallback.height = size
  const fallbackContext = fallback.getContext('2d')!
  const avatarStyle = getComputedStyle(element)
  fallbackContext.fillStyle = avatarStyle.color
  fallbackContext.globalAlpha = .12
  fallbackContext.fillRect(0, 0, size, size)
  fallbackContext.globalAlpha = 1
  fallbackContext.font = `600 ${Math.round(size * .42)}px ${avatarStyle.fontFamily}`
  fallbackContext.textAlign = 'center'
  fallbackContext.textBaseline = 'middle'
  fallbackContext.fillText(fallbackLabel, size / 2, size / 2)
  const { svg, circle } = avatarOutline()
  if (getComputedStyle(element).position === 'static') owned.set('position', 'relative')
  const children = Array.from(element.children).filter(node => node instanceof HTMLElement).map(node => styles(node as HTMLElement))
  children.forEach(child => child.set('visibility', 'hidden'))
  element.append(canvas, svg)
  let last = ''
  let firstReady: number | null = null
  let settled = false
  function draw(source: HTMLImageElement | null | undefined, cells: number) {
    const ready = source?.complete && source.naturalWidth > 0
    const key = `${cells}:${ready ? source.currentSrc || source.src : 'placeholder'}`
    if (key === last) return
    last = key
    if (import.meta.env.DEV) canvas.dataset.pixelCells = String(cells)
    ctx.clearRect(0, 0, size, size)
    small.width = cells; small.height = cells
    if (ready && source) {
      const side = Math.min(source.naturalWidth, source.naturalHeight)
      smallContext.drawImage(source, (source.naturalWidth - side) / 2, (source.naturalHeight - side) / 2, side, side, 0, 0, cells, cells)
    } else {
      // Missing source pixels cannot describe a photo. Pixelate the honest
      // initial-avatar fallback instead of fabricating a grey checker pattern.
      smallContext.drawImage(fallback, 0, 0, cells, cells)
    }
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, size, size)
  }
  return {
    ready: () => !image || (image.complete && image.naturalWidth > 0) || Boolean(image.complete && image.naturalWidth === 0),
    settled: () => settled,
    paint(time) {
      const t = reverse ? 2000 - time : time
      const ready = image?.complete && image.naturalWidth > 0
      if (ready && firstReady === null) firstReady = t
      const pixelStart = reverse ? 400 : Math.max(400, firstReady ?? t)
      circle.style.strokeDashoffset = String(1 - progress(t, 100, 300))
      svg.style.opacity = oldImage ? '0' : String(1 - progress(t, 900, 250))
      canvas.style.opacity = oldImage ? '1' : String(progress(t, 390, 50))
      const source = oldImage && t < 400 ? oldImage : image
      const cells = !ready && image ? 4 : pixelResolution(progress(t, image ? pixelStart : 400, 750), size)
      draw(source, oldImage && t < 100 ? size : cells)
      settled = !image || Boolean(image.complete && image.naturalWidth === 0) || cells === size
    },
    dispose() { canvas.remove(); svg.remove(); children.forEach(child => child.restore()); owned.restore() },
  }
}

export function slideCover(element: HTMLElement, oldImage?: HTMLImageElement): Effect & { ready(): boolean } {
  const owned = styles(element)
  const image = element instanceof HTMLImageElement ? element : element.querySelector<HTMLImageElement>('img')
  const parent = image?.parentElement ?? element
  const parentStyles = styles(parent)
  parentStyles.set('overflow', 'hidden')
  if (getComputedStyle(parent).position === 'static') parentStyles.set('position', 'relative')
  const ghost = oldImage ? overlay(oldImage.cloneNode(true) as HTMLImageElement) : null
  if (ghost) {
    ghost.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;'
    parent.append(ghost)
  }
  return {
    ready: () => !image || image.complete,
    paint(time) {
      const p = out(progress(time, 0, 1500))
      owned.set('translate', `0 ${mix(100, 0, p)}%`)
      if (ghost) ghost.style.translate = `0 ${-100 * p}%`
    },
    dispose() { ghost?.remove(); owned.restore(); parentStyles.restore() },
  }
}

/** Freeze only the previous WebGL pixels while the next menu is prepared. */
export function resultSwapEffect(element: HTMLCanvasElement, oldCanvas: HTMLCanvasElement | undefined, direction: number): Effect {
  const owned = styles(element)
  const ghost = oldCanvas ? overlay(oldCanvas) : null
  if (ghost) {
    ghost.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;'
    element.parentElement?.append(ghost)
  }
  return {
    paint(time) {
      const incoming = out(progress(time, 450, 1050))
      owned.set('translate', `${direction * 20 * (1 - incoming)}px 0`)
      owned.set('opacity', String(incoming))
      if (ghost) {
        const outgoing = out(progress(time, 0, 650))
        ghost.style.translate = `${-direction * 20 * outgoing}px 0`
        ghost.style.opacity = String(1 - outgoing)
      }
    },
    dispose() { ghost?.remove(); owned.restore() },
  }
}
