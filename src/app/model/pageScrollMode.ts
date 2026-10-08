import { ROUTE_NAME } from '@/shared/constants/routes'

export type PageScrollMode = 'page' | 'infinite' | 'list'

/** Read the rendered background route, never the sheet route covering it. */
export function resolvePageScrollMode(route: {
  name?: unknown
  query: Record<string, unknown>
}): PageScrollMode {
  if (route.name !== ROUTE_NAME.CATEGORY && route.name !== ROUTE_NAME.SEARCH) return 'page'
  if (route.name === ROUTE_NAME.SEARCH && String(route.query.type ?? '').trim().toLowerCase() === 'users') return 'infinite'
  const view = Array.isArray(route.query.view) ? route.query.view[0] : route.query.view
  return view === 'list' ? 'list' : 'infinite'
}
