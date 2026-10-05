// Real milliseconds. Each beat has its own tempo; never globally slow the pop.
export const HOME_INTRO = {
  outline: 0, open: 800, revealed: 2240, lookUp: 2550,
  home: 2880, category: 3260, seed: 3350, seedDetached: 4200,
  capsule: 5380, capsuleReady: 6080, upper: 6220, lower: 7480,
  rise: 10160, cubeReady: 11510, cards: 10760, end: 12760,
} as const
export const INTRO_MOTION = {
  outline: 680, lidDelay: 300, lidDraw: 490, eyeOpen: 790, eyeBlend: 300,
  gaze: 300, gazeReturn: 500, spark: 400, homeFade: 180, homeScale: 380,
  categoryPop: 180, categoryFade: 100, seedBirth: 174.4,
  iconDelay: 180, iconSpread: 360, iconFade: 240,
  upperStagger: 140, glyphWrite: 460, glyphBlendStart: 400, glyphBlend: 100,
  glyphWeight: 300, lowerStagger: 360, emoji: 1040, emojiTick: 180,
  cardStagger: 120, cardRise: 800,
} as const
export const HOME_INTRO_DURATION_MS = HOME_INTRO.end
export const HOME_INTRO_PREPARE_TIMEOUT_MS = 8000
export const HOME_INTRO_WATCHDOG_MS = HOME_INTRO_DURATION_MS + 3000
export function toPlaybackTime(logicalTime: number) {
  return logicalTime
}
export function toLogicalTime(playbackTime: number) {
  return playbackTime
}
export const unit = (n: number) => Math.min(1, Math.max(0, n))
export const progress = (time: number, start: number, duration: number) => time <= start ? 0 : time >= start + duration ? 1 : unit((time - start) / duration)
export const out = (p: number) => 1 - (1 - unit(p)) ** 3

/** Preserve the original first 16% (bud growth); compress only neck thinning. */
export function seedSeparationProgress(time: number) {
  const born = HOME_INTRO.seed + INTRO_MOTION.seedBirth
  if (time <= born) return .16 * progress(time, HOME_INTRO.seed, INTRO_MOTION.seedBirth)
  return .16 + .84 * progress(time, born, HOME_INTRO.seedDetached - born)
}

/** One pose drives the thrown button AND the drop's live attachment point. */
export function categoryEntryPose(time: number, originX = -56) {
  const elapsed = time - HOME_INTRO.category
  const pop = out(progress(elapsed, 0, INTRO_MOTION.categoryPop))
  const split = (time - HOME_INTRO.seed) / (HOME_INTRO.seedDetached - HOME_INTRO.seed)
  // One impulse: the first rightward overshoot emits the drop, then relaxes.
  // A separate late pressure ramp would look like a second inflated throw.
  let tension = 0
  if (split >= 0 && split <= 1) {
    const charge = out(progress(time, HOME_INTRO.seed, 90))
    const relax = out(progress(time, HOME_INTRO.seed + 90, 260))
    tension = charge * (1 - .65 * relax) * (1 - .2 * progress(split, .45, .55))
  } else if (split > 1) {
    const release = (time - HOME_INTRO.seedDetached) / 1000
    if (release < .6) tension = .28 * Math.exp(-10 * release) * Math.cos(22 * release) * (1 - progress(release, .4, .2))
  }
  // Exaggerate the silhouette, not the icon or its stationary hit target.
  const stretch = .30 * Math.sin(Math.PI * progress(elapsed, 0, INTRO_MOTION.categoryPop)) + .30 * tension
  const baseScale = .4 + .6 * pop
  const pressure = .42 * tension
  const direction = pressure >= 0 ? 0 : Math.PI
  const rim = Array.from({ length: 32 }, (_, index) => {
    const angle = index * Math.PI * 2 / 32 - direction
    return Math.max(-.30, Math.min(.60, Math.abs(pressure) * (Math.exp((Math.cos(angle) - 1) * 5) - .14)))
  })
  return {
    x: originX * (1 - pop) + 28 * tension, y: 0, rim,
    scaleX: baseScale * (1 + stretch), scaleY: baseScale * (1 - stretch * .68),
    iconScale: baseScale * (1 + .07 * tension),
  }
}
type CategoryRect = { left: number; top: number; width: number; height: number }
export function categoryVisualBounds(rect: CategoryRect, pose: ReturnType<typeof categoryEntryPose>): CategoryRect {
  const cx = rect.left + rect.width / 2 + pose.x, cy = rect.top + rect.height / 2 + pose.y
  const leftRadius = rect.width / 2 * (1 + pose.rim[16]!) * pose.scaleX
  const rightRadius = rect.width / 2 * (1 + pose.rim[0]!) * pose.scaleX
  const topRadius = rect.height / 2 * (1 + pose.rim[24]!) * pose.scaleY
  const bottomRadius = rect.height / 2 * (1 + pose.rim[8]!) * pose.scaleY
  return { left: cx - leftRadius, top: cy - topRadius, width: leftRadius + rightRadius, height: topRadius + bottomRadius }
}
export function introPhase(time: number) {
  if (time < 0) return 'prepare'
  if (time < HOME_INTRO.open) return 'outline'
  if (time < HOME_INTRO.revealed) return 'open'
  if (time < HOME_INTRO.home) return 'look-up'
  if (time < HOME_INTRO.upper) return 'header'
  if (time < HOME_INTRO.lower) return 'upper-arc'
  if (time < HOME_INTRO.rise) return 'lower-arc'
  if (time < HOME_INTRO.cards) return 'cube-rise'
  if (time < HOME_INTRO.end) return 'cards-rise'
  return 'complete'
}
export function glyphStart(index: number, count: number, eye: number, lower: boolean) {
  if (!lower) return HOME_INTRO.upper + Math.max(0, Math.abs(index - eye) - 1) * INTRO_MOTION.upperStagger
  const rank = index === eye ? Math.max(eye, count - eye - 1)
    : index < eye ? index : count - index - 1
  return HOME_INTRO.lower + rank * INTRO_MOTION.lowerStagger
}
export function riseWindow(index: number, count: number) {
  const step = count <= 1 ? 0 : Math.min(INTRO_MOTION.cardStagger, (HOME_INTRO.end - HOME_INTRO.cards - INTRO_MOTION.cardRise) / (count - 1))
  const start = HOME_INTRO.cards + Math.max(0, Math.min(count - 1, index)) * step
  // Fixed travel time: early cards must not crawl just to share an end time.
  return { start, duration: INTRO_MOTION.cardRise }
}
export function fromViewportBottom(top: number, viewportHeight: number) {
  return Math.max(0, viewportHeight - top) + 32
}
export function shouldPlayIntro(home: boolean, blocked: boolean, reduced: boolean, replay = false) {
  return home && !reduced && (!blocked || replay)
}
export function gazeAt(time: number) {
  return -0.85 * out(progress(time, HOME_INTRO.lookUp, INTRO_MOTION.gaze)) * (1 - out(progress(time, HOME_INTRO.upper, INTRO_MOTION.gazeReturn))) || 0
}
/** DOM order need not match physical order in an overlapping card rail. */
export function leftToRightRanks(lefts: number[]) {
  const order = lefts.map((left, index) => ({ left, index })).sort((a, b) => a.left - b.left || a.index - b.index)
  const ranks: number[] = []
  order.forEach(({ index }, rank) => { ranks[index] = rank })
  return ranks
}
// Eight exclusive symbols per slot: no duplicate across the nine letters,
// even when their staggered local clocks land on different frames.
const symbols = [
  '👀', '🪐', '🧿', '🔮', '⚡', '🌈', '🎲', '🎯',
  '🦋', '🐙', '🦊', '🐼', '🐸', '🦄', '🐳', '🦚',
  '🍄', '🌵', '🌸', '🍀', '🌻', '🌴', '🌷', '🍁',
  '🍒', '🍋', '🍉', '🍩', '🍕', '🍿', '🍭', '🧀',
  '🤖', '👻', '👽', '😎', '🤩', '🥳', '🧐', '😴',
  '📷', '📺', '📼', '💾', '🧲', '💎', '🚀', '🧩',
  '🐢', '🦀', '🐝', '🐬', '🦉', '🐧', '🦁', '🐨',
  '🎈', '🎨', '🎹', '🎸', '🎺', '🎷', '🎻', '🎬',
  '🌙', '⭐', '🌍', '🔥', '💧', '❄️', '🌊', '🌋',
  '🧁', '🍓', '🍊', '🥝', '🍍', '🥑', '🍇', '🍎',
]
export function introEmoji(index: number, elapsed: number) {
  const slot = Math.max(0, Math.trunc(index))
  const frame = Math.min(7, Math.max(0, Math.floor(elapsed / INTRO_MOTION.emojiTick)))
  return symbols[(slot * 8 + frame) % symbols.length]!
}
