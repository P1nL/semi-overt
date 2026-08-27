export const GOOEY_ACTION_MINIMUM_MS = 1500

export function createMinimumDuration(minimumMs = GOOEY_ACTION_MINIMUM_MS) {
  const startedAt = Date.now()

  return async function waitForMinimumDuration() {
    const remaining = minimumMs - (Date.now() - startedAt)

    if (remaining > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, remaining))
    }
  }
}
