export const RESULT_VIEW_MODE = {
  GALLERY: 'gallery',
  LIST: 'list',
  GRID: 'grid',
} as const

export type ResultViewMode = (typeof RESULT_VIEW_MODE)[keyof typeof RESULT_VIEW_MODE]

export function isResultViewMode(value: unknown): value is ResultViewMode {
  return typeof value === 'string' && Object.values(RESULT_VIEW_MODE).includes(value as ResultViewMode)
}
