import { inject, type InjectionKey, type Ref } from 'vue'
export type PageMotionPhase = 'idle' | 'staged' | 'enter' | 'leave' | 'swap'
export type PageMotionKind = 'home' | 'results' | 'profile' | 'other'
export interface PageMotionContext {
  phase: Ref<PageMotionPhase>
}
export const pageMotionKey: InjectionKey<PageMotionContext> = Symbol('page-motion')
export function usePageMotion() { return inject(pageMotionKey, null) }
