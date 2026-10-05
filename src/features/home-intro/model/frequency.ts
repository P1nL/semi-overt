export const INTRO_FREQUENCY_KEY = 'now.homeIntro.v2'
export const INTRO_COOLDOWN_MS = 2 * 60 * 60 * 1000
export const INTRO_WINDOW_MS = 24 * 60 * 60 * 1000
export const INTRO_MAX_PLAYS = 2
export const INTRO_SKIP_PAUSE_MS = INTRO_WINDOW_MS

export type IntroFrequency = { plays: number[]; snoozedUntil: number }
export type IntroStorage = Pick<Storage, 'getItem' | 'setItem'>

export function parseIntroFrequency(raw: string | null, now: number): IntroFrequency {
  let value: Partial<IntroFrequency> | null = null
  try { value = JSON.parse(raw ?? 'null') } catch { /* discard malformed data */ }
  const plays = Array.isArray(value?.plays)
    ? value.plays.filter((time): time is number => typeof time === 'number' && Number.isFinite(time) && time >= 0 && now - time < INTRO_WINDOW_MS)
      .sort((a, b) => a - b).slice(-INTRO_MAX_PLAYS)
    : []
  const snoozedUntil = typeof value?.snoozedUntil === 'number' && Number.isFinite(value.snoozedUntil)
    ? Math.max(0, value.snoozedUntil) : 0
  return { plays, snoozedUntil }
}

export function readIntroFrequency(storage: IntroStorage | null, now: number): IntroFrequency | null {
  try { return storage ? parseIntroFrequency(storage.getItem(INTRO_FREQUENCY_KEY), now) : null }
  catch { return null }
}

export function canAutoPlayIntro(history: IntroFrequency | null, now: number): boolean {
  if (!history || now < history.snoozedUntil || history.plays.length >= INTRO_MAX_PLAYS) return false
  const latest = history.plays[history.plays.length - 1]
  return latest === undefined || now - latest >= INTRO_COOLDOWN_MS
}

// The caller serializes cross-tab writes. Re-read here after preparation/locking.
export function claimIntroPlayback(storage: IntroStorage | null, now: number): boolean {
  const history = readIntroFrequency(storage, now)
  if (!storage || !history || !canAutoPlayIntro(history, now)) return false
  try {
    storage.setItem(INTRO_FREQUENCY_KEY, JSON.stringify({ ...history, plays: [...history.plays, now] }))
    return true
  } catch { return false }
}

export function snoozeIntroPlayback(storage: IntroStorage | null, now: number): boolean {
  const history = readIntroFrequency(storage, now)
  if (!storage || !history) return false
  try {
    storage.setItem(INTRO_FREQUENCY_KEY, JSON.stringify({ ...history, snoozedUntil: Math.max(history.snoozedUntil, now + INTRO_SKIP_PAUSE_MS) }))
    return true
  } catch { return false }
}
