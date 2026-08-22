const OFFSET_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/

/**
 * 兼容后端历史上的无时区 LocalDateTime。后端运行时与数据库按 UTC 记时，
 * 旧响应缺少 Z 会被浏览器误当成本地时间；新响应已有偏移时保持原样。
 */
export function normalizeBackendDateTime(value?: string | null): string | null {
    const trimmed = value?.trim()
    if (!trimmed) return null
    if (OFFSET_SUFFIX_PATTERN.test(trimmed)) return trimmed
    if (!LOCAL_DATE_TIME_PATTERN.test(trimmed)) return trimmed

    return `${trimmed.replace(' ', 'T')}Z`
}
