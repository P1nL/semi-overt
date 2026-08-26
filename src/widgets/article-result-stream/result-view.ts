export const RESULT_VIEW_MODE = {
  INFINITE: 'infinite',
  LIST: 'list',
} as const

export type ResultViewMode = (typeof RESULT_VIEW_MODE)[keyof typeof RESULT_VIEW_MODE]

export function isResultViewMode(value: unknown): value is ResultViewMode {
  return typeof value === 'string' && Object.values(RESULT_VIEW_MODE).includes(value as ResultViewMode)
}

export function normalizeResultViewMode(value: unknown): ResultViewMode {
  const normalizedValue = Array.isArray(value) ? value[0] : value

  if (normalizedValue === RESULT_VIEW_MODE.LIST) return RESULT_VIEW_MODE.LIST

  // 兼容历史链接中的 gallery / grid，统一回落到新的无限菜单视图。
  return RESULT_VIEW_MODE.INFINITE
}
