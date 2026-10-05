import { computed, watch, type Ref } from 'vue'
import { useIntroTarget, HOME_INTRO, INTRO_MOTION, progress, out } from '@/features/home-intro'

export function useHeaderIntro(header: Ref<HTMLElement | null>) {
  const intro = useIntroTarget('home', () => header.value?.querySelector('.brand-home-link'))
  useIntroTarget('category', () => header.value?.querySelector('.category-orbit'))
  useIntroTarget('tools', () => header.value?.querySelector('.header-capsule'))
  const active = computed(() => intro?.active.value ?? false)
  const ready = computed(() => !active.value || (intro?.time.value ?? 0) >= HOME_INTRO.upper)
  const style = computed(() => {
    if (!active.value || !intro) return undefined
    const t = intro.time.value
    return {
      '--intro-home-opacity': progress(t, HOME_INTRO.home, INTRO_MOTION.homeFade),
      '--intro-home-scale': .5 + .5 * out(progress(t, HOME_INTRO.home, INTRO_MOTION.homeScale)),
      // It is pulled out of the home silhouette, never independently faded in.
      '--intro-bridge-opacity': t >= HOME_INTRO.category ? 1 : 0,
      '--intro-capsule-opacity': t >= HOME_INTRO.capsuleReady ? 1 : 0,
      '--intro-icon-clock': t,
      '--intro-icon-fade': INTRO_MOTION.iconFade,
    }
  })
  watch(() => intro?.rects.value, () => {
    const icons = Array.from(header.value?.querySelectorAll<HTMLElement>('[data-header-dock-item]') ?? [])
      .map(element => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0)
      .sort((a, b) => a.box.left - b.box.left)
    icons.forEach(({ element }, index) => {
      element.style.setProperty('--intro-icon-start', String(HOME_INTRO.capsule + INTRO_MOTION.iconDelay + index * (icons.length > 1 ? INTRO_MOTION.iconSpread / (icons.length - 1) : 0)))
    })
  })
  return { active, ready, style, participated: computed(() => intro?.participated.value ?? false) }
}
