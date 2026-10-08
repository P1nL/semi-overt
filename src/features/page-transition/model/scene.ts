import type { PageMotionKind } from '@/shared/composables/usePageMotion'
import { motionTimer } from '@/shared/utils/motionClock'
import { clearResultCardMotion, setResultCardMotion } from '@/shared/utils/resultCardMotion'
import { avatarEffect, burstEffect, overlay, resultSwapEffect, slideCover, styles, svgNode, textEffect, type Effect } from './effects'
import { createRopeDescentClock, fallingPose, fallingRotation, LEAVE_DURATION, out, progress, randomLandingRotation, RESULT_SCALE_DURATION, ROPE_CONNECT_START, SCENE_DURATION } from './choreography'
import { createGlyphAnchor, type GlyphAnchor } from './ropeAnchor'
import { profileLayoutEffect, snapshotProfileLayout, type ProfileLayoutSnapshot } from './profileLayout'

export const TEXTS = '.profile-card__name,.profile-card__username,.profile-card__signature,.article-card h3,.article-summary,.article-infinite-menu__title,.article-infinite-menu__left-meta,.article-infinite-menu__details'
export const COVERS = '.profile-card__cover-image,.article-cover img'
export const AVATARS = '.profile-card__avatar,[data-motion-avatar]'
export interface SceneSnapshot { texts: string[]; covers: HTMLImageElement[]; avatars: HTMLImageElement[]; results?: HTMLCanvasElement; profileLayout?: ProfileLayoutSnapshot }
function targets(root: HTMLElement, selector: string) {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(el => !el.closest('[data-motion-overlay]'))
}
export function snapshotScene(root?: HTMLElement): SceneSnapshot {
  const canvas = root?.querySelector<HTMLCanvasElement>('.article-infinite-menu__canvas')
  let results: HTMLCanvasElement | undefined
  if (canvas?.width && canvas.height) {
    results = document.createElement('canvas')
    results.width = canvas.clientWidth; results.height = canvas.clientHeight
    try { results.getContext('2d')?.drawImage(canvas, 0, 0, results.width, results.height) }
    catch { results = undefined }
  }
  return {
    results,
    profileLayout: snapshotProfileLayout(root),
    texts: root ? targets(root, TEXTS).map(el => el.textContent ?? '') : [],
    covers: root ? targets(root, COVERS).filter((el): el is HTMLImageElement => el instanceof HTMLImageElement) : [],
    avatars: root ? targets(root, AVATARS).map(el => el.querySelector('img')).filter((el): el is HTMLImageElement => !!el) : [],
  }
}
export interface SceneOptions {
  kind: PageMotionKind
  phase: 'enter' | 'leave' | 'swap'
  direction?: number
  previous?: SceneSnapshot
  reduced?: boolean
  local?: boolean
}

/** Timelines write independent translate/scale/rotate channels, preserving widget transforms. */
export function playScene(root: HTMLElement, options: SceneOptions, done: () => void) {
  const { kind, phase, previous } = options
  const reverse = phase === 'leave'
  const swap = phase === 'swap'
  const duration = options.reduced ? 150 : swap ? 2000 : (reverse ? LEAVE_DURATION : SCENE_DURATION)[kind]
  const started = performance.now()
  const effects = new Set<Effect>()
  const cancels = new Set<() => void>()
  const seen = new WeakSet<HTMLElement>()
  const cleanups: (() => void)[] = []
  let stopped = false
  let completed = false
  let glyphIndex = 0
  const pendingHomeAnchors = new Set<HTMLElement>()
  const homeExitClock = createRopeDescentClock()

  function add(effect: Effect, localDuration: number = duration, waitFor?: () => boolean, holdUntilReady?: () => boolean, settled?: () => boolean) {
    effects.add(effect)
    // Late API content has its own bounded entrance; it never prolongs the route.
    const elapsed = performance.now() - started
    const offset = completed || elapsed > 250 ? 0 : elapsed
    let cancel: () => void = () => {}
    const dispose = () => { effect.dispose(); effects.delete(effect); cancels.delete(cancel) }
    const finish = () => {
      // Leave endpoints must survive until unmount. Restoring here exposes a
      // static old page between this painter's last frame and Vue's DOM removal.
      if (reverse) { cancels.delete(cancel); return }
      if (!holdUntilReady || (holdUntilReady() && (!settled || settled()))) { dispose(); return }
      // Keep a static pixel shell, with no busy RAF while the image is pending.
      cancels.delete(cancel)
      const ready = () => {
        if (stopped || !holdUntilReady()) return
        root.removeEventListener('load', ready, true); root.removeEventListener('error', ready, true)
        cancel = motionTimer(800, t => effect.paint(localDuration + t), dispose)
        cancels.add(cancel)
      }
      root.addEventListener('load', ready, true); root.addEventListener('error', ready, true)
      cleanups.push(() => { root.removeEventListener('load', ready, true); root.removeEventListener('error', ready, true) })
      ready()
    }
    if (waitFor && !waitFor()) {
      effect.paint(0)
      const retry = () => {
        if (stopped) return
        if (!waitFor()) return
        root.removeEventListener('load', retry, true)
        root.removeEventListener('error', retry, true)
        cancel = motionTimer(localDuration, effect.paint, finish)
        cancels.add(cancel)
      }
      root.addEventListener('load', retry, true)
      root.addEventListener('error', retry, true)
      cleanups.push(() => { root.removeEventListener('load', retry, true); root.removeEventListener('error', retry, true) })
    } else {
      cancel = motionTimer(Math.max(1, localDuration - offset), t => effect.paint(t + offset), finish)
      cancels.add(cancel)
    }
  }
  function move(el: HTMLElement, start: number, length: number, x = 0, y = 0, fade = false, scale = false) {
    const owned = styles(el)
    owned.set('will-change', scale ? 'scale, opacity' : 'translate, opacity')
    add({
      paint(time) {
        const p = out(progress(time, start, length))
        const remain = reverse ? p : 1 - p
        owned.set('translate', `${x * remain}px ${y * remain}px`)
        if (fade) owned.set('opacity', String(1 - remain))
        if (scale) owned.set('scale', String(1 - remain))
      },
      dispose() { owned.restore() },
    })
  }
  function flow(el: HTMLElement, start: number, length: number) {
    const index = targets(root, TEXTS).indexOf(el)
    add(textEffect(el, start, length, reverse, swap && kind === 'profile' ? previous?.texts[index] ?? '' : undefined))
  }
  function homeGlyph(el: HTMLElement) {
    const index = glyphIndex++
    const landing = randomLandingRotation()
    const owned = styles(el)
    // Random roll is consumed after orbit yaw, in the glyph's own plane.
    // Never override radial orientation or rotate the outer screen-space frame.
    const bounds = el.getBoundingClientRect()
    const parentTransform = getComputedStyle(el.parentElement!).transform
    const parentScale = parentTransform === 'none' ? 1 : Math.max(.1, Math.abs(new DOMMatrixReadOnly(parentTransform).m22))
    const screenDistance = Math.max(80, bounds.bottom + 32)
    const distance = screenDistance / parentScale
    const orbitGlyph = el.parentElement!
    const orbit = orbitGlyph.parentElement!
    let anchor = { x: bounds.left + bounds.width / 2, y: bounds.top }
    let attachment: GlyphAnchor | undefined
    let rope: SVGSVGElement | undefined
    let line: SVGLineElement | undefined
    if (reverse) {
      pendingHomeAnchors.add(el)
      rope = overlay(svgNode('svg', { width: String(innerWidth), height: String(innerHeight), viewBox: `0 0 ${innerWidth} ${innerHeight}` }))
      rope.dataset.ropeGlyph = String(index)
      // Share the glyphs' stacking context, immediately behind this glyph.
      // Front glyphs then genuinely occlude rear ropes, including after a return.
      rope.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;visibility:hidden;'
      rope.removeAttribute('viewBox')
      line = svgNode('line', { x1: String(bounds.left + bounds.width / 2), x2: String(bounds.left + bounds.width / 2), y1: '0', y2: '0', stroke: 'var(--color-text-muted)', 'stroke-width': '1' })
      rope.append(line); orbit.insertBefore(rope, orbitGlyph)
    }
    add({
      paint(time) {
        if (reverse) {
          // Wait for the orbit's half-second deceleration, then measure actual
          // ink/circle/cube vertices. Never attach to an empty layout-box corner.
          if (time >= ROPE_CONNECT_START && !attachment) {
            attachment = createGlyphAnchor(el)
            pendingHomeAnchors.delete(el)
            // Raster/projection measurements can consume a frame. Start descent
            // only AFTER the whole batch is ready, never on the old scene clock.
            if (!pendingHomeAnchors.size) homeExitClock.start(performance.now() - started)
          }
          const elapsed = performance.now() - started
          const y = -distance * homeExitClock.pull(elapsed)
          owned.set('translate', `0 ${y}px`)
          // Track the same material point through perspective/rotation while lifting.
          if (attachment) anchor = attachment.read()
          const connected = attachment ? homeExitClock.connection(elapsed) : 0
          if (line && rope) {
            rope.style.zIndex = orbitGlyph.style.zIndex
            rope.style.opacity = orbitGlyph.style.opacity
            const matrix = rope.getScreenCTM()?.inverse()
            if (matrix) {
              const top = new DOMPoint(anchor.x, 0).matrixTransform(matrix)
              const end = new DOMPoint(anchor.x, Math.max(0, anchor.y * connected)).matrixTransform(matrix)
              line.setAttribute('x1', String(top.x)); line.setAttribute('y1', String(top.y))
              line.setAttribute('x2', String(end.x)); line.setAttribute('y2', String(end.y))
              // Never expose the provisional box-center anchor. The exact ink
              // attachment is already locked before the first visible rope pixel.
              rope.style.visibility = attachment && homeExitClock.ready ? 'visible' : 'hidden'
            }
          }
        } else {
          const pose = fallingPose(time, index, distance, landing.x)
          const rotation = fallingRotation(time, index, landing)
          owned.set('translate', `0 ${pose.y}px`)
          owned.set('--glyph-local-roll', `${rotation.z}deg`)
        }
      },
      dispose() {
        rope?.remove()
        attachment?.dispose()
        owned.restore(reverse ? [] : ['--glyph-local-roll'])
      },
    })
  }
  function register(el: HTMLElement) {
    if (seen.has(el) || el.closest('[data-motion-overlay]')) return
    seen.add(el)
    const role = el.dataset.pageMotion
    if (kind === 'home') {
      if (role === 'glyph') { homeGlyph(el); return }
      if (role === 'home-bottom') {
        const distance = Math.max(80, innerHeight - el.getBoundingClientRect().top + 32)
        const owned = styles(el)
        add({ paint(time) {
          const p = reverse ? homeExitClock.pull(performance.now() - started) : 1 - out(progress(time, 0, 1700))
          owned.set('translate', `0 ${distance * p}px`)
        }, dispose() { owned.restore() } })
      }
      return
    }
    if (kind === 'results') {
      if (el.matches('.article-infinite-menu__canvas,.article-infinite-menu__fallback')) {
        if (!swap && el instanceof HTMLCanvasElement) {
          add({ paint(time) {
            const main = out(progress(time, 0, reverse ? RESULT_SCALE_DURATION.leave : RESULT_SCALE_DURATION.enter))
            const others = out(progress(time, reverse ? 0 : 250, reverse ? 650 : 850))
            setResultCardMotion(el, { mainScale: reverse ? 1 - main : main, othersOpacity: reverse ? 1 - others : others })
          }, dispose() { clearResultCardMotion(el) } })
        }
        else if (!swap) move(el, 0, reverse ? RESULT_SCALE_DURATION.leave : RESULT_SCALE_DURATION.enter, 0, 0, reverse, true)
        else if (el instanceof HTMLCanvasElement) add(resultSwapEffect(el, previous?.results, options.direction ?? 1))
      } else if (el.matches('.article-infinite-menu__title,.article-infinite-menu__left-meta')) flow(el, reverse ? 50 : swap ? 750 : 200, swap ? 1000 : 650)
      else if (el.matches('.article-infinite-menu__details')) flow(el, reverse ? 0 : swap ? 850 : 250, swap ? 1000 : 650)
      else if (el.matches('.article-infinite-menu__action')) {
        if (swap) move(el, 550, 650, 0, 0, true)
        else {
          move(el, reverse ? 100 : 1150, reverse ? 200 : 250, 0, 0, true)
          add(burstEffect(el, reverse ? 100 : 950, 650))
        }
      } else if (el.matches('.article-card')) move(el, swap ? 450 : 200, swap ? 1050 : 900, swap ? (options.direction ?? 1) * 20 : 0, 0, true)
      else move(el, reverse ? 0 : 350, reverse ? 650 : 850, 0, 0, true)
      return
    }
    if (kind === 'profile') {
      if (el.matches('.profile-content-layout')) {
        if (swap && !options.local) {
          const effect = profileLayoutEffect(root, previous?.profileLayout)
          if (effect) add(effect)
        }
        return
      }
      if (options.local && (el.closest('.profile-card') || el.matches('.profile-content-layout__tabs') || role === 'divider' || role === 'review' || role === 'review-item')) return
      if (el.matches(COVERS)) {
        if (swap) {
          const effect = slideCover(el, previous?.covers[targets(root, COVERS).indexOf(el)])
          add(effect, 2000, effect.ready)
        }
        return
      }
      if (el.matches('.profile-header-tilt')) {
        if (!swap) move(el, reverse ? 900 : 0, 1100, 0, -el.getBoundingClientRect().bottom - 32)
      } else if (el.matches(AVATARS)) {
        const effect = avatarEffect(el, reverse, swap ? previous?.avatars[targets(root, AVATARS).indexOf(el)] : undefined)
        // Draw the circle / neutral pixel shell immediately even before image load.
        add(effect, 2000, undefined, reverse ? undefined : effect.ready, effect.settled)
      } else if (el.matches(TEXTS)) flow(el, swap ? 0 : reverse ? 700 : 650, swap ? 1300 : 650)
      else if (el.matches('.profile-content-layout__tabs')) {
        if (!swap) move(el, reverse ? 800 : 200, 1000, -el.getBoundingClientRect().right - 32)
      } else if (role === 'divider') { if (!swap) move(el, reverse ? 700 : 600, 700, 0, 0, true) }
      else if (role === 'review') {
        if (!swap) move(el, reverse ? 750 : 250, 1000, innerWidth - el.getBoundingClientRect().left + 32)
      } else if (role === 'writing-stats') {
        if (!swap) move(el, reverse ? 1000 : 150, 850, innerWidth - el.getBoundingClientRect().left + 32)
      } else if (role === 'review-item') {
        const index = Array.from(el.parentElement?.children ?? []).indexOf(el)
        move(el, (reverse ? 0 : 600) + Math.min(index, 5) * 80, reverse ? 600 : 700, el.parentElement?.clientWidth ?? 600)
      } else if (el.matches('.ptm__card')) {
        if (!swap) {
          const index = Array.from(el.parentElement?.children ?? []).indexOf(el)
          move(el, reverse ? Math.min(4, index) * 60 : 800 + Math.min(4, index) * 80, reverse ? 900 : 800, 0, Math.max(80, innerHeight - el.getBoundingClientRect().top + 32), true)
        }
      } else if (!swap) move(el, reverse ? 0 : 800, 800, 0, 0, true)
    }
  }
  const selectors = kind === 'home' ? '[data-page-motion="glyph"],[data-page-motion="home-bottom"]'
    : kind === 'results' ? '.article-infinite-menu__canvas,.article-infinite-menu__fallback,.article-infinite-menu__title,.article-infinite-menu__left-meta,.article-infinite-menu__details,.article-infinite-menu__action,.article-infinite-menu__hint,.article-infinite-menu__result-index,.search-page-view-toggle,.category-page-view-toggle,.article-card,.content-loading-shell,.result-list-heading'
    : `${TEXTS},${AVATARS},${COVERS},.profile-header-tilt,.profile-content-layout,.profile-content-layout__tabs,.ptm__card,[data-page-motion="divider"],[data-page-motion="review"],[data-page-motion="review-item"],[data-page-motion="writing-stats"]`
  const scan = () => { if (!stopped) targets(root, selectors).forEach(register) }
  const observer = new MutationObserver(scan)
  if (options.reduced || kind === 'other') move(root, 0, duration, 0, 0, true)
  else {
    scan()
    if (kind === 'home' && reverse && !pendingHomeAnchors.size) homeExitClock.start(ROPE_CONNECT_START)
    if (!reverse) observer.observe(root, { childList: true, subtree: true })
  }
  let paintedFrames = 0
  const end = motionTimer(duration, () => { paintedFrames++ }, () => {
    completed = true
    if (import.meta.env.DEV) root.dataset.motionReport = JSON.stringify({ kind, phase, budgetMs: duration, elapsedMs: Math.round(performance.now() - started), frames: paintedFrames, fps: Math.round((paintedFrames - 1) * 1000 / (performance.now() - started)) })
    done()
  })
  return () => {
    stopped = true; end(); observer.disconnect()
    cancels.forEach(cancel => cancel()); cancels.clear()
    effects.forEach(effect => effect.dispose()); effects.clear()
    cleanups.forEach(cleanup => cleanup())
  }
}
