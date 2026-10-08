interface ViewRoute { path: string; hash?: string; query: Record<string, unknown> }
/** A presentation toggle is not a new search/category result set. */
export function isResultViewOnlyChange(from: ViewRoute, to: ViewRoute) {
  const contentQuery = (query: ViewRoute['query']) => JSON.stringify(
    Object.keys(query).filter(key => key !== 'view').sort().map(key => [key, query[key]]),
  )
  return from.path === to.path && from.hash === to.hash && contentQuery(from.query) === contentQuery(to.query)
}
