import { computed, inject, onBeforeUnmount, type ComputedRef, type InjectionKey, type Ref } from 'vue'
export type IntroRect = { left: number; top: number; width: number; height: number }
export type HomeIntroContentState = 'pending' | 'ready' | 'error'
export interface HomeIntroContext {
  active: Ref<boolean>
  participated: Ref<boolean>
  contentLocked: Ref<boolean>
  time: Ref<number>
  phase: ComputedRef<string>
  rects: Ref<Record<string, IntroRect>>
  viewport: Ref<{ width: number; height: number }>
  debug: boolean
  paused: Ref<boolean>
  finish: () => void
  skip: () => void
  seek: (time: number) => void
  play: () => void
  setContentState: (state: HomeIntroContentState) => void
  register: (id: string, target: () => Element | null | undefined) => () => void
}
export const homeIntroKey: InjectionKey<HomeIntroContext> = Symbol('home-intro')
export function useHomeIntro() { return inject(homeIntroKey, null) }
export function useIntroTarget(id: string, target: () => Element | null | undefined) {
  const intro = useHomeIntro()
  const unregister = intro?.register(id, target)
  onBeforeUnmount(() => unregister?.())
  return intro
}
export function useIntroActive() {
  const intro = useHomeIntro()
  return computed(() => intro?.active.value ?? false)
}
