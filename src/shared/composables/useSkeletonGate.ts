import { computed, ref } from 'vue'

import { UI_TIMING } from '@/shared/constants/ui'

function sleep(duration: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration)
  })
}

export function useSkeletonGate(minDuration = UI_TIMING.SKELETON_MIN) {
  const visible = ref(false)
  let activeToken = 0
  let startedAt = 0

  function start() {
    activeToken += 1
    startedAt = Date.now()
    visible.value = true
    return activeToken
  }

  async function finish(token: number) {
    if (token !== activeToken) return

    const elapsed = Date.now() - startedAt
    const remaining = Math.max(minDuration - elapsed, 0)

    if (remaining > 0) {
      await sleep(remaining)
    }

    if (token !== activeToken) return
    visible.value = false
  }

  async function withGate<T>(task: () => Promise<T>) {
    const token = start()

    try {
      return await task()
    } finally {
      await finish(token)
    }
  }

  return {
    showSkeleton: computed(() => visible.value),
    start,
    finish,
    withGate,
  }
}
