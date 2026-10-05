import { computed, inject, onBeforeUnmount, onMounted, ref, type InjectionKey, type Ref } from 'vue'

type AnimationScene = { content: Readonly<Ref<boolean>>; background: Readonly<Ref<boolean>> }
export const animationSceneKey: InjectionKey<AnimationScene> = Symbol('animation-scene')

/** Explicit scene state handles occlusion; intersection handles the actual app scroll owner. */
export function useAnimationVisibility(target: Readonly<Ref<Element | null>>, kind: keyof AnimationScene = 'content') {
  const scene = inject(animationSceneKey, null)
  const pageVisible = ref(true)
  const intersecting = ref(true)
  const reducedMotion = ref(false)
  let observer: IntersectionObserver | undefined
  let media: MediaQueryList | undefined
  const visible = computed(() => pageVisible.value && intersecting.value && (scene?.[kind].value ?? true))
  const syncPage = () => { pageVisible.value = !document.hidden }
  const syncMotion = () => { reducedMotion.value = media?.matches ?? false }
  onMounted(() => {
    syncPage()
    media = matchMedia('(prefers-reduced-motion: reduce)')
    syncMotion()
    document.addEventListener('visibilitychange', syncPage)
    media.addEventListener('change', syncMotion)
    if (target.value && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        const entry = entries.find(entry => entry.target === target.value)
        if (entry) intersecting.value = entry.isIntersecting
      })
      observer.observe(target.value)
    }
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    media?.removeEventListener('change', syncMotion)
    document.removeEventListener('visibilitychange', syncPage)
  })
  return { visible, reducedMotion }
}
