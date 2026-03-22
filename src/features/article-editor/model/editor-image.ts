export const EDITOR_IMAGE_MIN_WIDTH_PERCENT = 20
export const EDITOR_IMAGE_MAX_WIDTH_PERCENT = 100

export function normalizeEditorImageWidthPercent(value: unknown): number | null {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN

  if (!Number.isFinite(numericValue)) {
    return null
  }

  const clampedValue = Math.min(
    EDITOR_IMAGE_MAX_WIDTH_PERCENT,
    Math.max(EDITOR_IMAGE_MIN_WIDTH_PERCENT, numericValue),
  )
  const roundedValue = Math.round(clampedValue * 10) / 10

  if (roundedValue >= EDITOR_IMAGE_MAX_WIDTH_PERCENT) {
    return null
  }

  return roundedValue
}

export function getEditorImageDisplayWidthPercent(value: unknown): number {
  return normalizeEditorImageWidthPercent(value) ?? EDITOR_IMAGE_MAX_WIDTH_PERCENT
}

export function extractEditorImageWidthPercentFromElement(element: HTMLElement): number | null {
  const dataWidth = element.getAttribute('data-width')
  if (dataWidth) {
    return normalizeEditorImageWidthPercent(dataWidth)
  }

  const styleWidth = element.style.width
  if (styleWidth && styleWidth.trim().endsWith('%')) {
    return normalizeEditorImageWidthPercent(styleWidth.trim().slice(0, -1))
  }

  return null
}
