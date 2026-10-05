import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue'
import { gsap } from 'gsap'
import { createFrameLimiter } from '@/shared/utils/animationFrame'
import { HOME_INTRO, HOME_INTRO_DURATION_MS, HOME_INTRO_PREPARE_TIMEOUT_MS, HOME_INTRO_WATCHDOG_MS, introPhase, shouldPlayIntro, toPlaybackTime, toLogicalTime } from './choreography'
import { homeIntroKey, type HomeIntroContext, type HomeIntroContentState, type IntroRect } from './context'
import { INTRO_FREQUENCY_KEY, canAutoPlayIntro, claimIntroPlayback, readIntroFrequency, snoozeIntroPlayback, type IntroStorage } from './frequency'

export function provideHomeIntro(isInitialHome: boolean): HomeIntroContext {
  const params = new URLSearchParams(location.search)
  const debug = import.meta.env.DEV && params.get('intro') === 'debug'
  const replay = import.meta.env.DEV && ['replay', 'debug'].includes(params.get('intro') ?? '')
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  let storage: IntroStorage | null = null
  try { storage = window.localStorage } catch { /* unavailable: do not auto-play */ }
  const historyRestore = performance.getEntriesByType('navigation').some(entry => (entry as PerformanceNavigationTiming).type === 'back_forward')
  const requestedAt = Date.now()
  const allowed = canAutoPlayIntro(readIntroFrequency(storage, requestedAt), requestedAt)
  const active = ref(!document.hidden && !historyRestore && shouldPlayIntro(isInitialHome, !allowed, media.matches, replay))
  // Initial-home fallbacks/revisits also own the settled state: do not fall
  // back into the older staggered card animation when motion is reduced.
  const participated = ref(isInitialHome)
  const contentLocked = ref(false)
  const time = ref(active.value ? -1 : HOME_INTRO.end)
  const paused = ref(debug)
  const rects = shallowRef<Record<string, IntroRect>>({})
  const viewport = shallowRef({ width: innerWidth, height: innerHeight })
  const targets = new Map<string, () => Element | null | undefined>()
  const abort = new AbortController()
  let timeline: gsap.core.Timeline | undefined
  let watchdog: number | undefined
  let observed: ResizeObserver | undefined
  let disposed = false
  const clock = { time: 0 }
  const stateFrames = createFrameLimiter(60)
  let contentState: HomeIntroContentState = 'pending'
  const contentWaiters = new Set<(ready: boolean) => void>()
  function resolveContent(ready: boolean) {
    contentWaiters.forEach(resolve => resolve(ready))
    contentWaiters.clear()
  }
  function waitForContent(): Promise<boolean> {
    if (!active.value || disposed || contentState === 'error') return Promise.resolve(false)
    if (contentState === 'ready') return Promise.resolve(true)
    return new Promise(resolve => contentWaiters.add(resolve))
  }
  function finish() {
    // Release preparation too, so a late API result cannot restart a skipped intro.
    resolveContent(false)
    timeline?.kill()
    timeline = undefined
    window.clearTimeout(watchdog)
    observed?.disconnect()
    abort.abort()
    time.value = HOME_INTRO.end
    active.value = false
    contentLocked.value = false
    document.documentElement.removeAttribute('data-intro-boot')
  }
  async function updateFrequency(write: () => boolean) {
    try {
      // Only hold the origin-wide lock for a synchronous read/check/write.
      // Loading and animation never hold it; older browsers use a fresh read.
      if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request(INTRO_FREQUENCY_KEY, write)
      return write()
    } catch { return false }
  }
  function skip() {
    if (!active.value) return
    const skippedAt = Date.now()
    if (!replay) void updateFrequency(() => snoozeIntroPlayback(storage, skippedAt))
    finish()
  }
  function seek(value: number) {
    if (!debug || !active.value || !timeline) return
    paused.value = true
    timeline.pause()
    stateFrames.reset()
    const ms = Math.max(0, Math.min(HOME_INTRO_DURATION_MS - 1, value))
    timeline.time(ms / 1000, true)
    time.value = toLogicalTime(ms)
  }
  function play() {
    if (timeline && active.value) {
      if (paused.value) stateFrames.reset()
      paused.value = false
      timeline.play()
    }
  }
  function wait(ms: number): Promise<boolean> {
    return new Promise(resolve => {
      if (abort.signal.aborted) return resolve(false)
      const done = (ok: boolean) => { clearTimeout(timer); abort.signal.removeEventListener('abort', cancel); resolve(ok) }
      const cancel = () => done(false)
      const timer = setTimeout(() => done(true), ms)
      abort.signal.addEventListener('abort', cancel, { once: true })
    })
  }
  async function prepare() {
    if (!active.value) { finish(); return }
    watchdog = window.setTimeout(finish, HOME_INTRO_PREPARE_TIMEOUT_MS)
    const [, ready] = await Promise.all([
      Promise.race([
        Promise.all([document.fonts.load('900 100px "Hero Pressure"'), document.fonts.load('900 100px "Zhaohua Display"')]).catch(() => []),
        wait(1200),
      ]),
      waitForContent(),
    ])
    if (!ready || !active.value || disposed) return
    for (let attempt = 0; attempt < 25 && active.value && !disposed; attempt++) {
      await nextTick()
      if (['eye', 'home', 'category', 'tools', 'cube'].every(id => targets.get(id)?.()?.getBoundingClientRect().width)) break
      if (!await wait(40)) return
    }
    if (!active.value || disposed) return
    // Auth restoration can still be expanding the header's draft slot. Avoid
    // measuring its transient width (and aborting on the very next resize).
    let previousWidth = -1, previousHeight = -1, stable = 0
    for (let attempt = 0; attempt < 13; attempt++) {
      if (!await wait(50) || !active.value || disposed) return
      const bounds = targets.get('tools')?.()?.getBoundingClientRect()
      if (!bounds?.width) { finish(); return }
      stable = Math.abs(bounds.width - previousWidth) < .1 && Math.abs(bounds.height - previousHeight) < .1 ? stable + 1 : 0
      previousWidth = bounds.width
      previousHeight = bounds.height
      if (attempt >= 5 && stable >= 3) break
    }
    if (stable < 3) { finish(); return }
    // A cache reset/refetch during preparation may have made data pending again.
    if (!await waitForContent() || !active.value || disposed) return
    contentLocked.value = true
    await nextTick()
    if (!active.value || disposed) return
    if (contentState !== 'ready') { finish(); return }
    const measured: Record<string, IntroRect> = {}
    for (const [id, target] of targets) {
      const r = target()?.getBoundingClientRect()
      if (r) measured[id] = { left: r.left, top: r.top, width: r.width, height: r.height }
    }
    if (!measured.eye?.width || !measured.tools?.width || !document.fonts.check('900 100px "Hero Pressure"') || !document.fonts.check('900 100px "Zhaohua Display"')) { finish(); return }
    // Count on start, not completion: reloading mid-animation cannot evade the cap.
    // Another tab may have played or been skipped while this page was preparing.
    if (!replay && !await updateFrequency(() => active.value && !disposed && claimIntroPlayback(storage, Date.now()))) { finish(); return }
    if (!active.value || disposed) return
    viewport.value = { width: innerWidth, height: innerHeight }
    rects.value = measured
    time.value = 0
    document.documentElement.removeAttribute('data-intro-boot')
    timeline = gsap.timeline({ paused: debug, onComplete: finish })
    for (const [name, ms] of Object.entries(HOME_INTRO)) timeline.addLabel(name, toPlaybackTime(ms) / 1000)
    timeline.to(clock, {
      time: HOME_INTRO.end,
      duration: HOME_INTRO_DURATION_MS / 1000,
      ease: 'none',
      onUpdate: () => {
        // Cap only Splash's reactive rendering, never the shared GSAP ticker.
        // Sample the live clock rather than accumulating fixed frame steps.
        if (stateFrames.consume(performance.now()) !== null) time.value = clock.time
      },
    }, 0)
    // Loading time must not consume the complete animation's playback budget.
    window.clearTimeout(watchdog)
    watchdog = debug ? undefined : window.setTimeout(finish, HOME_INTRO_WATCHDOG_MS)
    observed = new ResizeObserver(entries => {
      for (const entry of entries) {
        const id = entry.target.getAttribute('data-intro-anchor')
        const initial = id ? measured[id] : undefined
        const now = entry.target.getBoundingClientRect()
        if (initial && (Math.abs(now.width - initial.width) > 2 || Math.abs(now.height - initial.height) > 2)) finish()
      }
    })
    for (const id of ['tools', 'eye']) { const target = targets.get(id)?.(); if (target) observed.observe(target) }
  }
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && active.value) { event.preventDefault(); skip() } }
  const hidden = () => { if (document.hidden && active.value) finish() }
  const resized = () => { if (active.value && time.value >= 0) finish() }
  const reduced = () => { if (media.matches) finish() }
  const context: HomeIntroContext = {
    active, participated, contentLocked, time, phase: computed(() => introPhase(time.value)), rects, viewport, debug, paused, finish, skip, seek, play,
    setContentState(state) {
      if (!active.value || disposed || timeline) return
      contentState = state
      if (state === 'ready') resolveContent(true)
      else if (state === 'error') finish()
    },
    register(id, target) { targets.set(id, target); return () => { if (targets.get(id) === target) targets.delete(id) } },
  }
  provide(homeIntroKey, context)
  onMounted(() => {
    window.addEventListener('keydown', escape)
    window.addEventListener('resize', resized)
    document.addEventListener('visibilitychange', hidden)
    media.addEventListener('change', reduced)
    void prepare().catch(finish)
  })
  onBeforeUnmount(() => {
    disposed = true
    finish()
    window.removeEventListener('keydown', escape)
    window.removeEventListener('resize', resized)
    document.removeEventListener('visibilitychange', hidden)
    media.removeEventListener('change', reduced)
  })
  return context
}
