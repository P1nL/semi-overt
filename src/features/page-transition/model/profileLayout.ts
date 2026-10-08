import { out, progress } from './choreography'
import { overlay, styles, type Effect } from './effects'

const ARTICLES = '.profile-content-layout'
const REVIEW = '[data-page-motion="review"]:not([data-motion-overlay])'
interface Box { left: number; top: number; width: number; height: number }
export interface ProfileLayoutSnapshot {
  articleTop: number
  review?: { element: HTMLElement; box: Box }
}

/** Scene-relative measurements survive staged layers and scroll restoration. */
export function snapshotProfileLayout(root?: HTMLElement): ProfileLayoutSnapshot | undefined {
  const articles = root?.querySelector<HTMLElement>(ARTICLES)
  if (!root || !articles) return
  const origin = root.getBoundingClientRect()
  const review = root.querySelector<HTMLElement>(REVIEW)
  const rect = review?.getBoundingClientRect()
  return {
    articleTop: articles.getBoundingClientRect().top - origin.top,
    review: review && rect ? {
      element: review.cloneNode(true) as HTMLElement,
      box: { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height },
    } : undefined,
  }
}

/** Role-dependent layout changes: review exits/enters horizontally while the
 * entire article region moves from its old layout slot to the new one. */
export function profileLayoutEffect(root: HTMLElement, previous?: ProfileLayoutSnapshot): Effect | null {
  const articles = root.querySelector<HTMLElement>(ARTICLES)
  const review = root.querySelector<HTMLElement>(REVIEW)
  if (!articles || !previous || !!previous.review === !!review) return null
  const origin = root.getBoundingClientRect()
  const delta = previous.articleTop - (articles.getBoundingClientRect().top - origin.top)
  const articleStyles = styles(articles)
  const reviewStyles = review ? styles(review) : null
  const travel = Math.max(80, innerWidth - (review?.getBoundingClientRect().left ?? origin.left + previous.review!.box.left) + 32)
  const ghost = !review && previous.review ? overlay(previous.review.element.cloneNode(true) as HTMLElement) : null
  if (ghost && previous.review) {
    const box = previous.review.box
    ghost.removeAttribute('id')
    ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'))
    ghost.inert = true
    ghost.dataset.profileReviewGhost = ''
    ghost.style.cssText += `;position:absolute;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;box-sizing:border-box;margin:0;z-index:20;visibility:visible;pointer-events:none;`
    root.append(ghost)
  }
  articleStyles.set('will-change', 'translate')
  reviewStyles?.set('will-change', 'translate, opacity')
  let firstPaint: number | undefined
  return {
    paint(time) {
      // Avatar/text setup may take a few milliseconds before this effect is
      // registered. Its very first visible frame must still match the old slot.
      firstPaint ??= time
      time -= firstPaint
      const reflow = out(progress(time, review ? 0 : 250, 1100))
      articleStyles.set('translate', `0 ${delta * (1 - reflow)}px`)
      if (reviewStyles) {
        reviewStyles.set('translate', `${travel * (1 - out(progress(time, 250, 1000)))}px 0`)
        reviewStyles.set('opacity', String(out(progress(time, 250, 450))))
      }
      if (ghost) {
        ghost.style.translate = `${travel * out(progress(time, 0, 750))}px 0`
        ghost.style.opacity = String(1 - out(progress(time, 450, 300)))
      }
    },
    dispose() { ghost?.remove(); articleStyles.restore(); reviewStyles?.restore() },
  }
}
