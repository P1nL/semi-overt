type CloseOptions = { restoreFocus?: boolean; immediate?: boolean }

/** Wait for actual row completion, not a timer that can outlive a reopen. */
export function createSearchCloseSequence(actions: {
  retract: () => void
  collapse: (restoreFocus: boolean) => void
}) {
  let pending = false
  let restoreFocus = false
  function collapse() {
    pending = false
    const restore = restoreFocus
    restoreFocus = false
    actions.collapse(restore)
  }
  return {
    request(hasPanel: boolean, options: CloseOptions = {}) {
      restoreFocus ||= !!options.restoreFocus
      if (options.immediate) { collapse(); return }
      if (pending) return
      if (!hasPanel) { collapse(); return }
      pending = true
      actions.retract()
    },
    complete() { if (pending) collapse() },
    cancel() { pending = false; restoreFocus = false },
  }
}
