import { motionTimer } from '@/shared/utils/motionClock'
import { getResultMenu } from '@/shared/utils/resultMenuBridge'
import { VIEW_SWITCH_DURATION, viewSwitchPose } from '@/shared/utils/resultViewMotion'
import { styles } from './effects'

/** Same held-camera choreography as the in-page view toggle, across route layers. */
export function playResultLayoutChange(outgoing: HTMLElement, incoming: HTMLElement, target: 'list' | 'infinite', done: () => void) {
  const list = (target === 'list' ? incoming : outgoing).querySelector<HTMLElement>('[data-page-motion="result-list"]')
  const infinite = (target === 'infinite' ? incoming : outgoing).querySelector<HTMLElement>('.article-infinite-menu')
  const canvas = infinite?.querySelector<HTMLCanvasElement>('canvas')
  const menu = getResultMenu(canvas)
  const layerStyles = styles(incoming)
  const listStyles = list && styles(list)
  const infiniteStyles = infinite && styles(infinite)
  const toggles = Array.from(incoming.querySelectorAll<HTMLElement>('.search-page-view-toggle,.category-page-view-toggle')).map(styles)
  const wasInert = incoming.inert
  incoming.inert = true
  layerStyles.set('position', 'absolute'); layerStyles.set('inset', '0'); layerStyles.set('width', '100%')
  if (list) listStyles?.set('will-change', 'transform')
  if (infinite) { infiniteStyles?.set('will-change', 'transform, opacity'); infiniteStyles?.set('transform-origin', '50% 40%') }
  const from = target === 'list'
    ? { press: 0, infiniteOpacity: 1, infiniteScale: 1, listX: 1 }
    : { press: 1, infiniteOpacity: 0, infiniteScale: .88, listX: 0 }
  if (target === 'infinite') menu?.setPress(1, true)
  const start = performance.now()
  incoming.dataset.resultTransition = 'view'
  let frames = 0
  const cancel = motionTimer(VIEW_SWITCH_DURATION[target], time => {
    const pose = viewSwitchPose(target, time, from)
    listStyles?.set('transform', `translateX(${pose.listX * innerWidth}px)`)
    infiniteStyles?.set('opacity', String(pose.infiniteOpacity))
    infiniteStyles?.set('transform', `scale(${pose.infiniteScale})`)
    menu?.setPress(pose.press)
    toggles.forEach(owned => owned.set('opacity', target === 'list' ? String(Math.max(0, Math.min(1, (time - 950) / 250))) : '1'))
    frames++
  }, () => {
    menu?.setPress(null)
    if (import.meta.env.DEV) incoming.dataset.motionReport = JSON.stringify({ kind: 'results', phase: 'swap', resultTransition: 'view', budgetMs: VIEW_SWITCH_DURATION[target], elapsedMs: Math.round(performance.now() - start), frames })
    done()
  })
  return () => {
    cancel(); menu?.setPress(null); incoming.inert = wasInert
    listStyles?.restore(); infiniteStyles?.restore(); layerStyles.restore(); toggles.forEach(owned => owned.restore())
    delete incoming.dataset.resultTransition
  }
}
