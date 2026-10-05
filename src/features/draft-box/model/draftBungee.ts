export const DRAFT_STAR_PATH = 'M50 0 Q55 45 100 50 Q55 55 50 100 Q45 55 0 50 Q45 45 50 0 Z'
export const DRAFT_CLOSE_TIMING = { conceal: 0.2, collapse: 0.4, return: 0.4 } as const
export const BUNGEE_REST_LENGTH = 46
// Keep the fast fall, but allow a visible rebound and a longer natural settling tail.
const GRAVITY = 9000
const STIFFNESS = 1000
const DAMPING = 26
export const BUNGEE_EQUILIBRIUM = BUNGEE_REST_LENGTH + GRAVITY / STIFFNESS
export type DraftBungeeState = {
  phase: 'bungee' | 'expand' | 'reveal' | 'open' | 'conceal' | 'collapse' | 'return' | 'closed'
  y: number; velocity: number; stable: number; elapsed: number
  openness: number; fromOpen: number; fromY: number
  equilibrium: number; content: number; fromContent: number
}
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const easeOut = (value: number) => 1 - (1 - clamp(value)) ** 3

export function createDraftBungee(opening: boolean, previous?: DraftBungeeState, equilibrium = BUNGEE_EQUILIBRIUM): DraftBungeeState {
  const openness = previous?.openness ?? (opening ? 0 : 1)
  const y = previous?.y ?? (opening ? 0 : equilibrium)
  const content = previous?.content ?? (opening ? 0 : 1)
  return {
    phase: opening ? (openness >= 1 ? 'reveal' : openness > 0 ? 'expand' : 'bungee') : (content > 0 ? 'conceal' : openness > 0 ? 'collapse' : 'return'),
    y, velocity: previous?.phase === 'bungee' ? previous.velocity : 0,
    stable: 0, elapsed: 0, openness, fromOpen: openness, fromY: y,
    equilibrium, content, fromContent: content,
  }
}

export function advanceDraftBungee(state: DraftBungeeState, elapsedMs: number) {
  const dt = Math.min(64, Math.max(0, elapsedMs)) / 1000
  state.elapsed += dt
  if (state.phase === 'bungee') {
    // Slack cord permits free fall; once taut, gravity + spring tension + damping.
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)))
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      const stretch = Math.max(0, state.y - Math.max(0, state.equilibrium - GRAVITY / STIFFNESS))
      const tension = stretch > 0 ? Math.max(0, STIFFNESS * stretch + DAMPING * state.velocity) : 0
      const acceleration = GRAVITY - tension
      state.velocity += acceleration * h
      state.y = Math.max(0, state.y + state.velocity * h)
    }
    state.stable = Math.abs(state.y - state.equilibrium) < 0.35 && Math.abs(state.velocity) < 3 ? state.stable + dt : 0
    if (state.stable >= 0.12 || state.elapsed >= 2) {
      state.y = state.equilibrium
      state.velocity = 0
      state.phase = 'expand'
      state.elapsed = 0
      state.fromOpen = state.openness
    }
  } else if (state.phase === 'expand') {
    const t = clamp(state.elapsed / Math.max(0.12, 0.46 * (1 - state.fromOpen)))
    state.openness = state.fromOpen + (1 - state.fromOpen) * easeOut(t)
    if (t === 1) { state.phase = 'reveal'; state.elapsed = 0; state.fromContent = state.content }
  } else if (state.phase === 'reveal') {
    const t = clamp(state.elapsed / 0.52)
    state.content = state.fromContent + (1 - state.fromContent) * t
    if (t === 1) state.phase = 'open'
  } else if (state.phase === 'conceal') {
    const t = clamp(state.elapsed / DRAFT_CLOSE_TIMING.conceal)
    state.content = state.fromContent * (1 - t)
    if (t === 1) { state.phase = 'collapse'; state.elapsed = 0; state.fromOpen = state.openness }
  } else if (state.phase === 'collapse') {
    const t = clamp(state.elapsed / Math.max(0.1, DRAFT_CLOSE_TIMING.collapse * state.fromOpen))
    state.openness = state.fromOpen * (1 - t * t * (3 - 2 * t))
    if (t === 1) {
      state.phase = 'return'
      state.elapsed = 0
      state.fromY = state.y
    }
  } else if (state.phase === 'return') {
    const t = clamp(state.elapsed / DRAFT_CLOSE_TIMING.return)
    state.y = state.fromY * (1 - t * t)
    if (t === 1) state.phase = 'closed'
  }
  return state
}

export function draftBungeeVisual(state: DraftBungeeState, opening: boolean) {
  return {
    contentOpacity: state.content,
    starOpacity: ['open', 'reveal', 'conceal', 'closed'].includes(state.phase) ? 0 : 1,
    starScale: state.phase === 'return' ? Math.max(0.2, state.y / Math.max(1, state.fromY)) : 1,
    lineOpacity: opening && state.phase === 'bungee' ? 1 : 0,
  }
}

export function getDraftContentOpacity(progress: number, index: number) {
  return easeOut(clamp((progress - Math.min(index, 5) * 0.12) / 0.4))
}
