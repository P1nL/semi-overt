interface ResultRoute { name?: unknown; query: Record<string, unknown> }
export type ResultPresentation = 'article-infinite' | 'author-infinite' | 'list'
export type ResultTransition = 'rotate' | 'direct' | 'view' | 'replace'
export function resultPresentation(route: ResultRoute): ResultPresentation {
  if (String(route.name).toLowerCase() === 'search' && String(route.query.type ?? '').trim().toLowerCase() === 'users') return 'author-infinite'
  const view = Array.isArray(route.query.view) ? route.query.view[0] : route.query.view
  return view === 'list' ? 'list' : 'article-infinite'
}
export function resultTransition(from: ResultRoute, to: ResultRoute): ResultTransition {
  const a = resultPresentation(from), b = resultPresentation(to)
  if (a === 'list' && b === 'list') return 'direct'
  if (a === b) return 'rotate'
  if (a === 'list' || b === 'list') return 'view'
  return 'replace'
}

/** Empty/loading is a rendered state, not a route/view name. */
export function resultEmptyKey(root: HTMLElement | null | undefined) {
  return root?.querySelector<HTMLElement>('[data-page-motion="result-empty"]')?.dataset.resultEmptyKey
}
export function renderedResultTransition(mode: ResultTransition, fromEmpty: string | undefined, toEmpty: string | undefined, hasLiveMenus: boolean): ResultTransition {
  if (fromEmpty !== undefined && toEmpty !== undefined && fromEmpty === toEmpty) return 'direct'
  if (fromEmpty !== undefined || toEmpty !== undefined) return 'replace'
  // Never pause an incoming renderer unless an old live sphere can actually replace it.
  if (mode === 'rotate' && !hasLiveMenus) return 'replace'
  return mode
}
